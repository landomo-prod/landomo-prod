"use strict";
/**
 * Azure OpenAI Client Configuration
 *
 * Manages connection to Azure AI Foundry API with retry logic,
 * exponential backoff, and comprehensive error handling.
 *
 * Uses DeepSeek-V3.2 deployment for structured property extraction with 150x cost savings.
 * Cost: $0.14 input / $0.28 output per 1M tokens (vs GPT-4.1 at ~$20/1M)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAIClientManager = void 0;
exports.getAzureOpenAIClient = getAzureOpenAIClient;
const axios_1 = __importDefault(require("axios"));
/**
 * Load Azure OpenAI configuration from environment
 */
function loadAzureConfig() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.1');
    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '2000', 10); // Increased for comprehensive extraction
    const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);
    if (!endpoint) {
        throw new Error('AZURE_OPENAI_ENDPOINT environment variable is required');
    }
    if (!apiKey) {
        throw new Error('AZURE_OPENAI_API_KEY environment variable is required');
    }
    return {
        endpoint,
        apiKey,
        deploymentName,
        apiVersion,
        temperature,
        maxTokens,
        timeoutMs,
    };
}
const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 5, // Increased from 3 to 5 for better resilience
    initialDelayMs: 2000, // Start with 2s delay
    maxDelayMs: 15000, // Max 15s delay between retries
    backoffMultiplier: 2,
};
/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt, config) {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs);
}
/**
 * Determine if error is retryable
 */
function isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return true;
    }
    // Axios response errors
    const status = error.response?.status || error.statusCode;
    // Rate limiting
    if (status === 429) {
        return true;
    }
    // Temporary errors
    if (status === 503 || status === 504) {
        return true;
    }
    // Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        return true;
    }
    return false;
}
/**
 * Azure AI Foundry Client Manager
 *
 * Singleton client with retry logic and error handling for DeepSeek-V3.2
 */
class AzureOpenAIClientManager {
    constructor(config, retryConfig = DEFAULT_RETRY_CONFIG) {
        this.config = config;
        this.retryConfig = retryConfig;
        // Detect if endpoint is OpenAI-compatible format (ends with /v1/ or /v1)
        const isOpenAICompatible = config.endpoint.includes('/openai/v1');
        if (isOpenAICompatible) {
            // OpenAI-compatible format: POST to /chat/completions
            const baseUrl = config.endpoint.endsWith('/') ? config.endpoint : config.endpoint + '/';
            this.apiUrl = `${baseUrl}chat/completions`;
            // Use Authorization header for OpenAI-compatible endpoints
            this.axiosClient = axios_1.default.create({
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: config.timeoutMs,
            });
            console.log(`[AzureAI] Initialized OpenAI-compatible client`);
            console.log(`[AzureAI] Endpoint: ${config.endpoint}`);
            console.log(`[AzureAI] Chat completions URL: ${this.apiUrl}`);
        }
        else {
            // Azure native format: append api-version query param
            this.apiUrl = `${config.endpoint}?api-version=${config.apiVersion}`;
            // Use api-key header for Azure native endpoints
            this.axiosClient = axios_1.default.create({
                headers: {
                    'api-key': config.apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: config.timeoutMs,
            });
            console.log(`[AzureAI] Initialized Azure native client`);
            console.log(`[AzureAI] Endpoint: ${config.endpoint}`);
            console.log(`[AzureAI] API Version: ${config.apiVersion}`);
        }
        console.log(`[AzureAI] Deployment: ${config.deploymentName}`);
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AzureOpenAIClientManager.instance) {
            const config = loadAzureConfig();
            AzureOpenAIClientManager.instance = new AzureOpenAIClientManager(config);
        }
        return AzureOpenAIClientManager.instance;
    }
    /**
     * Create chat completion
     */
    async createChatCompletion(params) {
        const response = await this.axiosClient.post(this.apiUrl, {
            model: this.config.deploymentName,
            messages: params.messages,
            temperature: params.temperature ?? this.config.temperature,
            max_tokens: params.max_tokens ?? this.config.maxTokens,
            ...(params.response_format && { response_format: params.response_format }),
        });
        return response.data;
    }
    /**
     * Get deployment configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Execute API call with retry logic
     *
     * @param operation - Async function to execute
     * @param operationName - Name for logging
     * @returns Operation result
     */
    async executeWithRetry(operation, operationName = 'API call') {
        let lastError;
        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                console.log(`[AzureOpenAI] Executing ${operationName} (attempt ${attempt}/${this.retryConfig.maxAttempts})`);
                // Execute operation with timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Operation timeout')), this.config.timeoutMs);
                });
                const result = await Promise.race([operation(), timeoutPromise]);
                console.log(`[AzureOpenAI] ${operationName} succeeded on attempt ${attempt}`);
                return result;
            }
            catch (error) {
                lastError = error;
                console.error(`[AzureOpenAI] ${operationName} failed on attempt ${attempt}:`, {
                    message: error.message,
                    code: error.code,
                    statusCode: error.statusCode,
                });
                // Don't retry on last attempt
                if (attempt === this.retryConfig.maxAttempts) {
                    break;
                }
                // Only retry if error is retryable
                if (!isRetryableError(error)) {
                    console.error(`[AzureOpenAI] Non-retryable error, aborting`);
                    throw error;
                }
                // Calculate backoff delay
                const delayMs = calculateBackoff(attempt, this.retryConfig);
                console.log(`[AzureOpenAI] Retrying after ${delayMs}ms...`);
                await sleep(delayMs);
            }
        }
        // All attempts failed
        console.error(`[AzureOpenAI] ${operationName} failed after ${this.retryConfig.maxAttempts} attempts`);
        throw lastError;
    }
    /**
     * Test connection to Azure AI Foundry
     */
    async testConnection() {
        try {
            console.log('[AzureAI] Testing connection...');
            // Simple chat completion to verify connectivity
            const result = await this.executeWithRetry(async () => this.createChatCompletion({
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Say "OK" if you can read this.' },
                ],
                max_tokens: 10,
                temperature: 0,
            }), 'Connection test');
            console.log('[AzureAI] Connection test successful');
            console.log('[AzureAI] Response:', result.choices[0]?.message?.content);
            return true;
        }
        catch (error) {
            console.error('[AzureAI] Connection test failed:', error.message);
            return false;
        }
    }
    /**
     * Reset singleton instance (for testing)
     */
    static reset() {
        AzureOpenAIClientManager.instance = null;
    }
}
exports.AzureOpenAIClientManager = AzureOpenAIClientManager;
AzureOpenAIClientManager.instance = null;
/**
 * Get configured Azure OpenAI client instance
 */
function getAzureOpenAIClient() {
    return AzureOpenAIClientManager.getInstance();
}
