# Bazos LLM Extraction System

## Overview

This system uses Azure AI Foundry with DeepSeek-V3 to extract structured property data from unstructured Bazos.cz listings.

Bazos is a classifieds platform with minimal structure - listings consist of free-text titles and descriptions. Unlike structured portals (sreality, bezrealitky), we cannot extract property details via DOM parsing or API fields.

**Solution:** LLM-powered extraction with forced JSON mode for reliability.

---

## Architecture

```
┌─────────────────┐
│ Bazos Listing   │ (unstructured text)
│ Title + Desc    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ LLM Extraction  │ (Azure AI Foundry + DeepSeek-V3)
│ Service         │ • Forced JSON mode
│                 │ • Few-shot examples
│                 │ • Czech RE terminology
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ LLMExtracted    │ (structured TypeScript)
│ Property        │ • 172+ fields
│                 │ • Czech-specific enums
│                 │ • Validation
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Standard        │ (database format)
│ Property        │ • 3-tier schema
│ Transformer     │ • Normalized values
└─────────────────┘
```

---

## File Structure

```
scrapers/Czech Republic/bazos/
├── src/
│   ├── types/
│   │   └── llmExtraction.ts         # TypeScript interfaces
│   ├── prompts/
│   │   └── extractionPrompt.ts      # Prompt templates + JSON schema
│   ├── services/
│   │   └── llmExtractionService.ts  # Azure AI client (to be created)
│   └── transformers/
│       └── llmToStandardTransformer.ts  # LLM → StandardProperty (to be created)
└── docs/
    ├── LLM_EXTRACTION_README.md     # This file
    └── LLM_FIELD_MAPPING.md         # Field mapping reference
```

---

## Key Features

### 1. Forced JSON Mode

Uses Azure AI's forced JSON response format with a strict schema:

```typescript
{
  property_type: "apartment" | "house" | "villa" | ...,
  transaction_type: "sale" | "rent",
  location: { city, region, district },
  details: { bedrooms, area_sqm, floor, ... },
  czech_specific: { disposition, ownership, condition, ... },
  amenities: { has_parking, has_elevator, ... },
  extraction_metadata: { confidence, missing_fields }
}
```

### 2. Czech Real Estate Terminology

Trained with Czech-specific examples:

| Czech Term | Extracted As |
|------------|-------------|
| byt 2+kk | property_type: "apartment", disposition: "2+kk" |
| rodinný dům | property_type: "house" |
| panelový dům | construction_type: "panel" |
| po rekonstrukci | condition: "after_renovation" |
| výtah, sklep | has_elevator: true, has_basement: true |
| osobní vlastnictví | ownership: "personal" |

### 3. Few-Shot Learning

Includes 5 real-world examples covering:
- Apartment sale (byt 2+kk)
- Apartment rental (pronájem 3+1)
- House sale (rodinný dům 5+1)
- Studio sale (garsonka)
- Land sale (pozemek)

### 4. Confidence Scoring

Every extraction includes confidence assessment:

- **high**: 90%+ fields extracted, clear terminology
- **medium**: 60-90% fields, some ambiguity
- **low**: <60% fields, significant uncertainty

Use for quality monitoring and fallback strategies.

### 5. Validation

Automatic validation of extracted data:
- Required fields present
- Enum values match allowed values
- Numeric fields are positive
- Area values are reasonable (sqm > 0)

---

## Data Extraction Coverage

### Tier 1: Global Fields
- property_type
- transaction_type
- price
- location (city, region)
- basic details (bedrooms, bathrooms, area_sqm)
- standard amenities

### Tier 2: Czech-Specific Fields
- **czech_disposition** (1+kk, 2+1, 3+kk, etc.)
- **czech_ownership** (personal, cooperative, state)
- **condition** (new, excellent, after_renovation, etc.)
- **construction_type** (panel, brick, stone, etc.)
- **heating_type** (central, individual, gas, etc.)
- **energy_rating** (PENB A-G)
- **furnished** (furnished, partially_furnished, not_furnished)
- **area_balcony, area_terrace, area_loggia, area_cellar**
- **water_supply, sewage_type, gas_supply**
- **rental_period, deposit, monthly_price**

### Tier 3: Portal Metadata
- extraction_metadata (confidence, missing_fields, assumptions)
- original listing text snippet
- Bazos-specific metadata (ad_id, views, posted_date)

---

## Usage Examples

### Basic Extraction

```typescript
import { extractPropertyData } from './services/llmExtractionService';

const listingText = `
Prodej bytu 2+kk 54 m²
Pardubice - Zelené Předměstí
Cena: 3.450.000 Kč
Byt se nachází ve 3. patře panelového domu s výtahem.
Po kompletní rekonstrukci. Sklep.
`;

const result = await extractPropertyData({
  listingText,
  listingId: 'bazos-123456',
  country: 'cz',
  portal: 'bazos'
});

if (result.validation.isValid) {
  console.log(`Extracted: ${result.data.property_type} ${result.data.czech_specific.disposition}`);
  console.log(`Confidence: ${result.data.extraction_metadata.confidence}`);
} else {
  console.error('Validation errors:', result.validation.errors);
}
```

### Transform to StandardProperty

```typescript
import { transformLLMToStandard } from './transformers/llmToStandardTransformer';

const standardProperty = transformLLMToStandard(
  result.data,
  bazosListing,
  'cz'
);

// Send to ingest API
await ingestProperty(standardProperty);
```

### Batch Processing

```typescript
const listings = await fetchBazosListings({ country: 'cz', section: 'RE' });

const results = await Promise.all(
  listings.map(async (listing) => {
    const extracted = await extractPropertyData({
      listingText: `${listing.title}\n${listing.description}`,
      listingId: listing.id,
      country: 'cz',
      portal: 'bazos'
    });

    return {
      listing,
      extracted: extracted.data,
      confidence: extracted.data.extraction_metadata.confidence
    };
  })
);

// Filter by confidence
const highConfidence = results.filter(r => r.confidence === 'high');
console.log(`High confidence: ${highConfidence.length}/${results.length}`);
```

---

## Prompt Engineering

### System Prompt

Sets context as Czech real estate extraction specialist with:
- Czech/Slovak language understanding
- Real estate terminology expertise
- Strict JSON output format
- Confidence assessment capabilities

### Few-Shot Examples

Provides 5 diverse examples:
1. **Apartment sale** - Full details (2+kk, 54 m², panel, 3rd floor)
2. **Apartment rental** - Monthly price, partial furnishing (3+1, Prague)
3. **House sale** - Large plot, condition issues (5+1, requires renovation)
4. **Studio sale** - New construction (garsonka, 28 m², 2023)
5. **Land sale** - Infrastructure details (1200 m², utilities)

### JSON Schema

Enforces structure with:
- Required fields (property_type, transaction_type, confidence)
- Enum constraints (disposition, ownership, condition, etc.)
- Type validation (numbers, booleans, strings)
- Nested objects (location, details, czech_specific, amenities)

---

## Quality Assurance

### Extraction Monitoring

Log and track:
```typescript
{
  timestamp: Date,
  listingId: string,
  confidence: 'high' | 'medium' | 'low',
  fieldsExtracted: number,
  fieldsMissing: string[],
  processingTimeMs: number,
  tokensUsed: number,
  validationErrors: string[]
}
```

### Metrics to Track

1. **Confidence Distribution**
   - % high / medium / low confidence
   - Target: >80% high confidence

2. **Field Coverage**
   - Average fields extracted per listing
   - Most commonly missing fields

3. **Validation Errors**
   - % of extractions with validation errors
   - Common error patterns

4. **Performance**
   - Average processing time (target: <2s)
   - Token usage per extraction
   - Cost per 1000 extractions

### Quality Improvement

**For low confidence extractions:**
1. Review missing fields
2. Add more few-shot examples for that pattern
3. Enhance system prompt with specific instructions
4. Consider fallback strategies (regex for price, location)

**For validation errors:**
1. Check JSON schema constraints
2. Review enum values (are they complete?)
3. Add validation rules to prompt
4. Provide clearer examples for ambiguous cases

---

## Performance Optimization

### Caching Strategy

Cache extracted data by listing hash to avoid re-extraction:

```typescript
const listingHash = crypto
  .createHash('md5')
  .update(listingText)
  .digest('hex');

const cached = await cache.get(`extraction:${listingHash}`);
if (cached) return cached;

const extracted = await extractPropertyData(...);
await cache.set(`extraction:${listingHash}`, extracted, { ttl: 86400 });
```

### Batch Processing

Process multiple listings in parallel:

```typescript
const BATCH_SIZE = 10;
const batches = chunk(listings, BATCH_SIZE);

for (const batch of batches) {
  await Promise.all(batch.map(extractPropertyData));
  await delay(1000); // Rate limiting
}
```

### Cost Optimization

**DeepSeek-V3 Pricing (Azure AI Foundry):**
- ~$0.14 per 1M input tokens
- ~$0.28 per 1M output tokens

**Estimated Cost per Extraction:**
- Input: ~500 tokens (system + few-shot + listing)
- Output: ~300 tokens (JSON response)
- Cost: ~$0.0001 per extraction
- **100,000 extractions = ~$10 USD**

**Optimization Tips:**
1. Use caching aggressively (deduplicate by listing hash)
2. Skip re-extraction for unchanged listings
3. Process in batches with delays (avoid rate limits)
4. Monitor token usage and adjust prompt length

---

## Error Handling

### Extraction Failures

```typescript
try {
  const result = await extractPropertyData(request);
  if (!result.validation.isValid) {
    // Log validation errors but continue
    logger.warn('Validation errors', {
      listingId: request.listingId,
      errors: result.validation.errors
    });
  }
  return result;
} catch (error) {
  // LLM service failure - use fallback
  logger.error('Extraction failed', { error, listingId: request.listingId });
  return buildFallbackExtraction(listing);
}
```

### Fallback Strategy

For critical failures, use basic extraction:

```typescript
function buildFallbackExtraction(listing: BazosAd): LLMExtractedProperty {
  return {
    property_type: 'other',
    transaction_type: 'sale',
    location: {
      city: extractCity(listing.locality)
    },
    details: {},
    czech_specific: {},
    amenities: {},
    extraction_metadata: {
      confidence: 'low',
      missing_fields: ['all'],
      assumptions: ['Fallback extraction - LLM service unavailable']
    }
  };
}
```

---

## Testing Strategy

### Unit Tests

Test individual components:

```typescript
describe('LLM Extraction', () => {
  test('extracts apartment 2+kk correctly', async () => {
    const result = await extractPropertyData({
      listingText: 'Prodej bytu 2+kk 54 m² Praha',
      listingId: 'test-1',
      country: 'cz',
      portal: 'bazos'
    });

    expect(result.data.property_type).toBe('apartment');
    expect(result.data.czech_specific.disposition).toBe('2+kk');
    expect(result.data.details.area_sqm).toBe(54);
  });
});
```

### Integration Tests

Test with real Bazos data:

```typescript
test('processes real Bazos listings', async () => {
  const listings = await fetchBazosListings({ maxPages: 1 });
  const results = await Promise.all(
    listings.slice(0, 10).map(async (listing) => {
      return await extractPropertyData({
        listingText: `${listing.title}\n${listing.description}`,
        listingId: listing.id,
        country: 'cz',
        portal: 'bazos'
      });
    })
  );

  const highConfidence = results.filter(
    r => r.data.extraction_metadata.confidence === 'high'
  );

  expect(highConfidence.length).toBeGreaterThan(5); // >50% high confidence
});
```

### Quality Tests

Validate extraction quality:

```typescript
test('maintains high extraction coverage', async () => {
  const testCases = loadTestCases(); // Known good examples

  for (const testCase of testCases) {
    const result = await extractPropertyData(testCase.input);

    // Check key fields extracted
    expect(result.data.property_type).toBe(testCase.expected.property_type);
    expect(result.data.transaction_type).toBe(testCase.expected.transaction_type);

    // Check confidence
    expect(result.data.extraction_metadata.confidence).not.toBe('low');
  }
});
```

---

## Deployment Checklist

- [ ] Azure AI Foundry project created
- [ ] DeepSeek-V3 model deployed
- [ ] API key secured in environment variables
- [ ] LLM extraction service implemented
- [ ] Transformer (LLM → StandardProperty) implemented
- [ ] Integration tests passing
- [ ] Caching layer configured
- [ ] Monitoring/logging in place
- [ ] Error handling tested
- [ ] Cost estimation validated
- [ ] Rate limiting configured
- [ ] Documentation complete

---

## Next Steps

1. **Deploy Azure AI Foundry** (Task #2)
   - Create project
   - Deploy DeepSeek-V3 model
   - Get API endpoint + key

2. **Build LLM Service** (Task #4)
   - Implement `llmExtractionService.ts`
   - Azure AI client integration
   - Request/response handling

3. **Build Transformer** (Task #5)
   - Implement `llmToStandardTransformer.ts`
   - Map LLMExtracted → StandardProperty
   - Use normalization functions

4. **Integration** (Task #5)
   - Update `bazosTransformer.ts`
   - Call LLM service for detail pages
   - Merge with basic listing data

5. **Testing** (Task #6)
   - Create test script
   - Validate with real data
   - Measure accuracy

6. **Deployment** (Task #7)
   - Docker configuration
   - Environment setup
   - Production rollout

---

## Resources

- **TypeScript Types**: `src/types/llmExtraction.ts`
- **Prompt Templates**: `src/prompts/extractionPrompt.ts`
- **Field Mapping**: `docs/LLM_FIELD_MAPPING.md`
- **Czech Value Mappings**: `shared/czech-value-mappings.ts`
- **StandardProperty Schema**: `shared-components/src/types/property.ts`

---

## Questions & Support

Contact the team lead for:
- Azure AI Foundry access
- API key configuration
- Cost/budget questions
- Production deployment approval
