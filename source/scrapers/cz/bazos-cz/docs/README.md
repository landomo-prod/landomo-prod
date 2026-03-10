# Bazos Scraper

## Overview
- **Portal:** bazos.cz (also bazos.sk, bazos.pl, bazos.at)
- **Port:** 8102
- **Source Platform ID:** `bazos`
- **Scraping Method:** HTML scraping with Cheerio + LLM-enhanced extraction
- **Architecture:** Two-phase with BullMQ LLM extraction queue

## Multi-Country Support

| Country | Domain | Section |
|---------|--------|---------|
| Czech Republic | bazos.cz | RE (reality) |
| Slovakia | bazos.sk | RE (reality) |
| Poland | bazos.pl | RE (nieruchomości) |
| Austria | bazos.at | RE (Immobilien) |

## Key Features
- **LLM-enhanced extraction** via Azure OpenAI DeepSeek-V3.2 for structured field extraction from unstructured Czech text
- **Category detection** from Czech text patterns (byt/2+kk → apartment, rodinný dům → house, pozemek → land)
- **Checksum mode** with persistent cache (Redis 7d + PostgreSQL 90d)
- **Category-specific transformers** with LLM extraction prompts

## Data Flow
```
POST /scrape/:country
  → listingsScraper.scrapeWithChecksums()
    → Fetch section listings (HTML)
    → Checksum comparison (skip unchanged)
    → Fetch detail pages (descriptions)
    → Queue LLM extraction jobs (BullMQ)
      → Azure OpenAI DeepSeek-V3.2 extracts structured fields
      → Category-specific transformer
      → Batch ingest to API
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, per-country scrape endpoints |
| `src/scrapers/listingsScraper.ts` | HTML listing page scraper |
| `src/scrapers/detailScraper.ts` | Detail page description extraction |
| `src/services/bazosLLMExtractor.ts` | Azure OpenAI LLM extraction service |
| `src/transformers/bazosTransformer.ts` | Category routing transformer |
| `src/transformers/bazosApartmentTransformer.ts` | Apartment transformer with LLM prompt |
| `src/transformers/bazosHouseTransformer.ts` | House transformer with LLM prompt |
| `src/transformers/bazosLandTransformer.ts` | Land transformer with LLM prompt |
| `src/utils/categoryDetection.ts` | Czech text → category detection |
| `src/queue/llmQueue.ts` | BullMQ queue for LLM extraction jobs |
| `src/queue/llmWorker.ts` | LLM job processor with caching |
| `src/types/bazosTypes.ts` | TypeScript interfaces |
