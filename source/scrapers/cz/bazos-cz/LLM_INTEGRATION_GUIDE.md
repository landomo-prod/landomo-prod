# LLM Integration Guide - Bazos Scraper

## Overview

The Bazos scraper now supports **optional LLM-enhanced extraction** using Azure OpenAI (DeepSeek-V3 via Azure AI Foundry). This significantly improves data quality by extracting detailed property information from unstructured listing text.

## Features

✅ **Optional Integration** - Feature flag controlled, no breaking changes
✅ **Graceful Degradation** - Falls back to structured data on LLM failures
✅ **Field Merging** - LLM data takes priority over structured extraction
✅ **Czech/Slovak Focus** - Specialized prompts for Czech real estate terminology
✅ **Cost Tracking** - Token usage and performance metrics logged
✅ **Batch Processing** - Efficient rate-limited extraction

## Architecture

```
Bazos API → Listings Scraper
             ↓
         [Optional] LLM Extractor (Azure OpenAI)
             ↓
         Transformer (merges LLM + structured data)
             ↓
         StandardProperty (enhanced)
             ↓
         Ingest Service
```

## Quick Start

### 1. Enable LLM Extraction

```bash
# In .env file
LLM_EXTRACTION_ENABLED=true

# Azure OpenAI credentials
AZURE_OPENAI_ENDPOINT=https://prg-operations-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### 2. Test Integration

```bash
# Test LLM service
npm run test:llm

# Test integration (LLM + transformer)
npm run test:integration
```

### 3. Run Scraper

```bash
# With LLM enabled
LLM_EXTRACTION_ENABLED=true npm start

# Without LLM (baseline)
LLM_EXTRACTION_ENABLED=false npm start
```

## Field Coverage Improvement

### Without LLM (Baseline)
```typescript
{
  title: "Prodej bytu 2+kk...",
  price: 3450000,
  currency: "CZK",
  property_type: "real_estate",
  location: { city: "Pardubice" },
  details: {},  // Empty!
  czech_specific: {}  // Empty!
}
```

### With LLM (Enhanced)
```typescript
{
  title: "Prodej bytu 2+kk...",
  price: 3450000,
  currency: "CZK",
  property_type: "apartment",  // LLM classified
  transaction_type: "sale",     // LLM extracted
  location: {
    city: "Pardubice",
    district: "Zelené Předměstí"  // LLM extracted
  },
  details: {
    bedrooms: 2,              // LLM extracted
    bathrooms: 1,             // LLM extracted
    area_sqm: 54,             // LLM extracted
    floor: 3,                 // LLM extracted
  },
  czech_specific: {
    disposition: "2+kk",      // LLM extracted
    construction_type: "panel",  // LLM extracted
    condition: "after_renovation",  // LLM extracted
    ownership: "personal"     // LLM extracted
  },
  amenities: {
    has_elevator: true,       // LLM extracted
    has_basement: true,       // LLM extracted
    is_renovated: true        // LLM extracted
  },
  portal_metadata: {
    llm_extraction: {
      confidence: "high",
      missing_fields: [],
      processing_time_ms: 1234
    }
  }
}
```

**Result:** ~15-20 additional fields extracted per listing

## How It Works

### 1. LLM Extraction Service (`bazosLLMExtractor.ts`)

```typescript
const extractor = getLLMExtractor();
const result = await extractor.extract(listingText);

// Returns:
{
  data: LLMExtractedProperty,      // Structured extraction
  validation: ExtractionValidation, // Field validation
  tokensUsed: number,               // Cost tracking
  processingTimeMs: number          // Performance tracking
}
```

### 2. Enhanced Transformer (`bazosTransformer.ts`)

```typescript
export function transformBazosToStandard(
  listing: BazosAd,
  country: string,
  section?: string,
  llmExtracted?: LLMExtractedProperty  // Optional LLM data
): StandardProperty {
  // Merge logic: LLM data → structured data → defaults
}
```

### 3. Scraper Integration (`index.ts`)

```typescript
if (LLM_EXTRACTION_ENABLED) {
  // Extract with LLM
  const llmMap = await extractWithLLM(listings);

  // Transform with LLM data
  const properties = listings.map(listing => {
    const llmData = llmMap.get(listing.id);
    return transformBazosToStandard(listing, country, section, llmData);
  });
}
```

## Field Mapping

| LLM Field | StandardProperty Field | Priority |
|-----------|------------------------|----------|
| `property_type` | `property_type` | LLM > structured |
| `transaction_type` | `transaction_type` | LLM > structured |
| `price` | `price` | LLM > structured |
| `location.*` | `location.*` | Merged |
| `details.bedrooms` | `bedrooms` | LLM |
| `details.bathrooms` | `bathrooms` | LLM |
| `details.area_sqm` | `area` | LLM |
| `details.floor` | `floor` | LLM |
| `czech_specific.*` | `czech_specific.*` | LLM |
| `amenities.*` | `amenities` | LLM |

## Graceful Degradation

The integration is designed to **never break scraping**:

1. **Feature flag disabled** → Normal scraping (no LLM calls)
2. **Azure connection fails** → Fallback to structured data
3. **LLM extraction fails** → Continue with baseline transformation
4. **Validation fails** → Log warning, use partial data
5. **Rate limits hit** → Batch processing with delays

## Performance Considerations

### Cost
- **GPT-4.1**: ~$0.01-0.02 per listing
- **Batch size**: 5 listings/batch (rate limiting)
- **Monthly cost**: ~$500-1000 for 50K listings/month

### Speed
- **Without LLM**: ~100 listings/min
- **With LLM**: ~20 listings/min (5x slower due to API calls)
- **Processing time**: ~1-2s per listing

### Optimization Tips
1. Cache LLM results by listing text hash
2. Only extract for new/updated listings
3. Use batch extraction for large scrapes
4. Consider cheaper model for less critical fields

## Testing

### Unit Tests
```bash
# Test LLM service
npm run test:llm
# Expected: 5/5 successful extractions

# Test transformer
npm run test:transformer
# Expected: Proper field merging
```

### Integration Tests
```bash
# Full integration test
npm run test:integration
# Expected:
#   - Baseline transformation works
#   - LLM extraction works
#   - Enhanced transformation works
#   - +15-20 fields improvement
```

### Production Validation
```bash
# Scrape with LLM enabled
curl -X POST http://localhost:8082/scrape/cz

# Check logs for:
# - "🤖 LLM extraction enabled"
# - "✅ LLM extraction completed for X/Y listings"
# - Token usage and processing time
```

## Troubleshooting

### LLM extraction not working
1. Check `LLM_EXTRACTION_ENABLED=true` in `.env`
2. Verify Azure credentials are set
3. Test connection: `npm run test:llm`
4. Check logs for errors

### Low extraction quality
1. Review validation errors in logs
2. Check confidence levels (should be "high")
3. Verify listing text quality (title only)
4. Consider fetching full description (future enhancement)

### High costs
1. Disable for testing: `LLM_EXTRACTION_ENABLED=false`
2. Reduce `MAX_PAGES` in scraper config
3. Use cheaper model (Grok-3 instead of GPT-4.1)
4. Implement caching layer

### Rate limits
1. Reduce batch size (currently 5)
2. Increase delay between batches (currently 2s)
3. Use model with higher TPM (Grok-3: 400K TPM)

## Future Enhancements

- [ ] Fetch full ad description for better extraction
- [ ] Cache LLM results to reduce costs
- [ ] Support multiple LLM providers (OpenAI, Anthropic)
- [ ] A/B testing framework (LLM vs baseline)
- [ ] Confidence-based field selection
- [ ] Incremental extraction (only new listings)

## Code Structure

```
scrapers/Czech Republic/bazos/
├── src/
│   ├── services/
│   │   ├── azureClient.ts          # Azure OpenAI client + retry logic
│   │   └── bazosLLMExtractor.ts    # Main extraction service
│   ├── types/
│   │   └── llmExtraction.ts        # TypeScript interfaces
│   ├── prompts/
│   │   └── extractionPrompt.ts     # System prompt + few-shot examples
│   ├── transformers/
│   │   └── bazosTransformer.ts     # Enhanced transformer (LLM support)
│   └── index.ts                    # Scraper orchestration
├── test-llm-service.ts             # LLM service tests
├── test-integration.ts             # Integration tests
└── .env.example                    # Configuration template
```

## References

- **Azure AI Foundry**: https://azure.microsoft.com/en-us/products/ai-foundry
- **DeepSeek-V3 Model**: Deployed as `gpt-4.1` in Azure
- **StandardProperty Schema**: `shared-components/src/types/property.ts`
- **Czech Field Mappings**: `scrapers/Czech Republic/shared/czech-value-mappings.ts`

## Support

For questions or issues:
1. Check logs for error messages
2. Run test scripts to isolate problem
3. Review this guide's troubleshooting section
4. Contact team lead if issue persists
