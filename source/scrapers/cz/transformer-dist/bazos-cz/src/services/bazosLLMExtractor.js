"use strict";
/**
 * Bazos LLM Extraction Service
 *
 * Extracts structured property data from unstructured Bazos listings
 * using Azure AI Foundry DeepSeek-V3.2 with forced JSON mode.
 *
 * Cost Savings: 150x cheaper than GPT-4.1
 * - DeepSeek-V3.2: $0.14 input / $0.28 output per 1M tokens
 * - GPT-4.1: ~$20 per 1M tokens
 *
 * Features:
 * - Forced JSON output for reliable parsing
 * - Few-shot examples for accurate extraction
 * - Response validation against schema
 * - Token usage and performance tracking
 * - Comprehensive error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BazosLLMExtractor = void 0;
exports.getLLMExtractor = getLLMExtractor;
const azureClient_1 = require("./azureClient");
const extractionPrompt_1 = require("../prompts/extractionPrompt");
/**
 * Bazos LLM Extractor
 *
 * Main service for extracting structured property data from listings
 */
class BazosLLMExtractor {
    constructor() {
        this.azureClient = (0, azureClient_1.getAzureOpenAIClient)();
        this.deploymentName = this.azureClient.getConfig().deploymentName;
    }
    /**
     * Extract structured property data from listing text
     *
     * @param listingText - Raw listing text (title + description)
     * @param options - Extraction options
     * @returns ExtractionResult with data, validation, and metrics
     */
    async extract(listingText, options = {}) {
        const startTime = Date.now();
        try {
            console.log('[LLMExtractor] Starting extraction...');
            console.log('[LLMExtractor] Input length:', listingText.length, 'characters');
            // Validate input
            if (!listingText || listingText.trim().length === 0) {
                throw new Error('Listing text cannot be empty');
            }
            // Truncate very long listings to avoid token limits
            const maxInputLength = 4000; // ~1000 tokens
            const truncatedText = listingText.length > maxInputLength
                ? listingText.substring(0, maxInputLength) + '...'
                : listingText;
            // Build messages with few-shot examples
            const messages = this.buildMessages(truncatedText);
            // Get configuration
            const config = this.azureClient.getConfig();
            const temperature = options.temperature ?? config.temperature;
            const maxTokens = options.maxTokens ?? config.maxTokens;
            console.log('[LLMExtractor] Calling Azure OpenAI...');
            console.log('[LLMExtractor] Deployment:', this.deploymentName);
            console.log('[LLMExtractor] Temperature:', temperature);
            console.log('[LLMExtractor] Max tokens:', maxTokens);
            // Execute completion with retry logic
            const result = await this.azureClient.executeWithRetry(async () => {
                return await this.azureClient.createChatCompletion({
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                    response_format: { type: 'json_object' }, // Force JSON output
                });
            }, 'LLM extraction');
            const processingTimeMs = Date.now() - startTime;
            // Extract response
            const choice = result.choices[0];
            if (!choice?.message?.content) {
                throw new Error('No response from LLM');
            }
            const rawResponse = choice.message.content;
            console.log('[LLMExtractor] Received response:', rawResponse.length, 'characters');
            // Parse JSON response with repair attempt
            let extractedData;
            try {
                extractedData = JSON.parse(rawResponse);
            }
            catch (error) {
                console.warn('[LLMExtractor] Initial JSON parsing failed:', error.message);
                // Attempt to repair common JSON issues
                try {
                    // Remove trailing incomplete JSON
                    let repairedResponse = rawResponse;
                    // If unterminated string, try to close it
                    if (error.message.includes('Unterminated string')) {
                        // Find the last complete property and truncate there
                        const lastValidComma = rawResponse.lastIndexOf('",');
                        const lastValidBrace = rawResponse.lastIndexOf('}');
                        const truncateAt = Math.max(lastValidComma + 1, lastValidBrace);
                        repairedResponse = rawResponse.substring(0, truncateAt);
                        // Add closing braces if needed
                        const openBraces = (repairedResponse.match(/{/g) || []).length;
                        const closeBraces = (repairedResponse.match(/}/g) || []).length;
                        repairedResponse += '}'.repeat(Math.max(0, openBraces - closeBraces));
                    }
                    console.log('[LLMExtractor] Attempting to parse repaired JSON...');
                    extractedData = JSON.parse(repairedResponse);
                    console.log('[LLMExtractor] ✅ Successfully parsed repaired JSON');
                }
                catch (repairError) {
                    console.error('[LLMExtractor] JSON repair also failed:', repairError.message);
                    console.error('[LLMExtractor] Response preview:', rawResponse.substring(0, 500));
                    throw new Error(`Failed to parse LLM response as JSON: ${error.message}`);
                }
            }
            // Validate extraction
            const validation = this.validateExtractedData(extractedData);
            // Track token usage
            const tokensUsed = result.usage?.total_tokens;
            if (tokensUsed) {
                console.log('[LLMExtractor] Tokens used:', tokensUsed);
                console.log('[LLMExtractor] Prompt tokens:', result.usage?.prompt_tokens);
                console.log('[LLMExtractor] Completion tokens:', result.usage?.completion_tokens);
            }
            console.log('[LLMExtractor] Extraction completed in', processingTimeMs, 'ms');
            console.log('[LLMExtractor] Validation:', validation.isValid ? 'PASSED' : 'FAILED');
            if (validation.errors.length > 0) {
                console.warn('[LLMExtractor] Validation errors:', validation.errors);
            }
            if (validation.warnings.length > 0) {
                console.warn('[LLMExtractor] Validation warnings:', validation.warnings);
            }
            return {
                data: extractedData,
                validation,
                rawResponse: options.includeRawResponse ? rawResponse : undefined,
                tokensUsed,
                processingTimeMs,
            };
        }
        catch (error) {
            const processingTimeMs = Date.now() - startTime;
            console.error('[LLMExtractor] Extraction failed:', error.message);
            // Return fallback result with error information
            return {
                data: this.createFallbackData(listingText),
                validation: {
                    isValid: false,
                    errors: [`Extraction failed: ${error.message}`],
                    warnings: ['Returned fallback data with minimal fields'],
                },
                rawResponse: options.includeRawResponse ? error.message : undefined,
                processingTimeMs,
            };
        }
    }
    /**
     * Build chat messages with system prompt and few-shot examples
     */
    buildMessages(listingText) {
        const messages = [];
        // System prompt with extraction guidelines
        messages.push({
            role: 'system',
            content: extractionPrompt_1.SYSTEM_PROMPT,
        });
        // Add few-shot examples as assistant messages
        for (const example of extractionPrompt_1.FEW_SHOT_EXAMPLES) {
            messages.push({
                role: 'user',
                content: `Extract structured data from this listing:\n\n${example.input}`,
            });
            messages.push({
                role: 'assistant',
                content: JSON.stringify(example.output),
            });
        }
        // User message with actual listing to extract
        messages.push({
            role: 'user',
            content: (0, extractionPrompt_1.buildUserMessage)(listingText),
        });
        return messages;
    }
    /**
     * Validate extracted data
     */
    validateExtractedData(data) {
        const warnings = [];
        // Use schema validation from prompts
        const schemaValidation = (0, extractionPrompt_1.validateExtraction)(data);
        // Additional business logic validation
        if (data.price !== undefined && data.price <= 0) {
            warnings.push('Price is zero or negative');
        }
        if (data.details?.area_sqm !== undefined && data.details.area_sqm > 1000) {
            warnings.push('Unusually large living area (>1000 m²)');
        }
        if (data.details?.year_built !== undefined) {
            const currentYear = new Date().getFullYear();
            if (data.details.year_built < 1800 || data.details.year_built > currentYear + 2) {
                warnings.push(`Unusual year_built: ${data.details.year_built}`);
            }
        }
        // Check if key fields are missing
        const missingKeyFields = [];
        if (!data.location?.city && !data.location?.region) {
            missingKeyFields.push('location (city or region)');
        }
        if (!data.price && !data.price_note) {
            missingKeyFields.push('price information');
        }
        if (!data.details?.area_sqm && data.property_type !== 'land') {
            missingKeyFields.push('area_sqm (for non-land properties)');
        }
        if (missingKeyFields.length > 0) {
            warnings.push(`Missing key fields: ${missingKeyFields.join(', ')}`);
        }
        return {
            isValid: schemaValidation.isValid,
            errors: schemaValidation.errors,
            warnings,
        };
    }
    /**
     * Create fallback data when extraction fails
     */
    createFallbackData(listingText) {
        return {
            property_type: 'other',
            transaction_type: 'sale',
            location: {},
            details: {},
            czech_specific: {},
            amenities: {},
            extraction_metadata: {
                confidence: 'low',
                missing_fields: ['all'],
                assumptions: ['Extraction failed, fallback data returned'],
                original_text_snippet: listingText.substring(0, 200),
            },
        };
    }
    /**
     * Batch extraction for multiple listings
     *
     * @param listings - Array of listing texts
     * @param options - Extraction options
     * @returns Array of extraction results
     */
    async extractBatch(listings, options = {}) {
        console.log(`[LLMExtractor] Starting batch extraction for ${listings.length} listings`);
        const results = [];
        for (let i = 0; i < listings.length; i++) {
            console.log(`[LLMExtractor] Processing listing ${i + 1}/${listings.length}`);
            try {
                const result = await this.extract(listings[i], options);
                results.push(result);
                // Rate limiting: small delay between requests
                if (i < listings.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }
            catch (error) {
                console.error(`[LLMExtractor] Batch item ${i + 1} failed:`, error.message);
                results.push({
                    data: this.createFallbackData(listings[i]),
                    validation: {
                        isValid: false,
                        errors: [`Batch extraction failed: ${error.message}`],
                        warnings: [],
                    },
                    processingTimeMs: 0,
                });
            }
        }
        console.log(`[LLMExtractor] Batch extraction completed: ${results.length} results`);
        return results;
    }
    /**
     * Test LLM extraction with sample data
     */
    async test() {
        console.log('[LLMExtractor] Running test extraction...');
        const sampleListing = `Prodej bytu 2+kk 54 m²
Pardubice - Zelené Předměstí
Cena: 3.450.000 Kč
Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví.
Byt se nachází ve 3. patře panelového domu s výtahem. Po kompletní rekonstrukci.
Plastová okna, plovoucí podlahy, koupelna s vanou a WC. Sklep.`;
        try {
            const result = await this.extract(sampleListing, { includeRawResponse: true });
            console.log('[LLMExtractor] Test result:');
            console.log('  Valid:', result.validation.isValid);
            console.log('  Property type:', result.data.property_type);
            console.log('  Transaction type:', result.data.transaction_type);
            console.log('  Disposition:', result.data.czech_specific.disposition);
            console.log('  Price:', result.data.price);
            console.log('  Area:', result.data.details.area_sqm);
            console.log('  Confidence:', result.data.extraction_metadata.confidence);
            console.log('  Processing time:', result.processingTimeMs, 'ms');
            return result.validation.isValid;
        }
        catch (error) {
            console.error('[LLMExtractor] Test failed:', error.message);
            return false;
        }
    }
}
exports.BazosLLMExtractor = BazosLLMExtractor;
/**
 * Create singleton extractor instance
 */
let extractorInstance = null;
/**
 * Get singleton LLM extractor
 */
function getLLMExtractor() {
    if (!extractorInstance) {
        extractorInstance = new BazosLLMExtractor();
    }
    return extractorInstance;
}
