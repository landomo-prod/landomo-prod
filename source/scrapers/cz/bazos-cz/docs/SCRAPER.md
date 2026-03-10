# Bazos - Scraper Mechanics

## Scraping Architecture

Bazos uses a two-phase approach with LLM-enhanced extraction:

### Phase 1: Discovery + Detail Fetch
- Fetches RE (reality) section listings from HTML pages
- Extracts: title, price_formatted, locality, URL, views, topped, favourite
- With `ENABLE_CHECKSUM_MODE`: compares checksums, skips unchanged
- Fetches detail pages sequentially (500ms delay) for descriptions from `div.popisdetail`
- Deduplicates listings by URL

### Phase 2: LLM Extraction
- Queues listings to BullMQ `bazos-llm-extraction` queue
- LLM worker checks Redis/PostgreSQL cache first (7d/90d TTL)
- On cache miss: sends to Azure OpenAI DeepSeek-V3.2 for structured extraction
- Category-specific prompts (apartment/house/land) with few-shot examples
- Results cached and transformed to TierI properties

## Category Detection (`categoryDetection.ts`)

Regex patterns on Czech text (title + description):

| Pattern | Category |
|---------|----------|
| `byt`, `2+kk`, `3+1`, `garsoniéra`, `garsonka` | `apartment` |
| `rodinný dům`, `vila`, `chalupa`, `chata`, `řadový dům` | `house` |
| `pozemek`, `parcela`, `zahrada`, `stavební parcela`, `louka` | `land` |
| _(default fallback)_ | `apartment` |

## LLM Extraction

### Service: Azure OpenAI
- **Model:** DeepSeek-V3.2
- **Cost:** $0.14/$0.28 per 1M input/output tokens
- **Mode:** JSON mode (structured output)
- **Fallback:** Returns basic data on LLM failure

### Category-Specific Prompts

Each category has a tailored extraction prompt with few-shot examples:

**Apartment prompt extracts:** disposition (2+kk), sqm, floor, construction type, condition, bedrooms, balcony, elevator, parking, basement, heating, energy class, furnished

**House prompt extracts:** sqm_living, sqm_plot, bedrooms, garage, garden, parking, basement, construction type, condition, heating, stories

**Land prompt extracts:** area_plot_sqm, land_type (stavební/zahrada/pole/les), water, sewage, electricity, gas, road access

### Caching Strategy

| Layer | TTL | Purpose |
|-------|-----|---------|
| Redis | 7 days | Fast lookup for recent extractions |
| PostgreSQL | 90 days | Persistent cache for LLM results |
| Cache key | `bazos:llm:{hash(url+title+price)}` | Deduplication |

## Rate Limiting

| Component | Limit |
|-----------|-------|
| Detail page fetching | 500ms sequential delay |
| LLM queue | 60 jobs per minute |
| LLM worker concurrency | 5 |
| BullMQ job retries | 3 attempts with exponential backoff |

## Portal ID Format

```
bazos-{numeric_id}
```

Where `numeric_id` is extracted from the listing URL.

## Multi-Country Scraping

Each country is scraped independently via `POST /scrape/:country`:
- Separate listing URLs per domain (bazos.cz, bazos.sk, etc.)
- Shared LLM extraction service
- Country passed to ingest for correct database routing
