# immobiliare.it Scraper

Italy's largest real estate portal. Covers 1.25M+ listings across all 20 Italian regions, spanning apartments, houses, land, and commercial properties for both sale and rent.

## Quick Reference

| Property | Value |
|---|---|
| Portal | immobiliare.it |
| Country | Italy |
| Port | 8111 |
| Version | 2.0.0-playwright |
| Language | TypeScript / Node.js |
| Browser Engine | Playwright (Chromium, persistent profile) |
| Anti-bot | Datadome (TLS fingerprinting) |
| Deployment | Local machine only (residential IP required) |
| Ingest Target | http://46.225.167.44:3007 |
| Categories | apartment, house, land, commercial |
| Active Combos | 140 (7 category-contract × 20 regions) |
| Estimated Listings | 1,250,000+ |

## Why Local Only

Datadome blocks datacenter IP ranges via TLS fingerprinting. The scraper **must run on a machine with a residential IP address**. The VPS at 46.225.167.44 is used only as the ingest target, not the scrape origin.

## Documentation

| File | Contents |
|---|---|
| [SCRAPER.md](./SCRAPER.md) | Architecture, phases, browser setup, rate limiting |
| [TRANSFORMERS.md](./TRANSFORMERS.md) | Category routing, field transformation logic per category |
| [CONFIGURATION.md](./CONFIGURATION.md) | Environment variables, endpoints, regions, category map |
| [FIELD_MAPPING.md](./FIELD_MAPPING.md) | Complete source-to-schema field mapping tables |

## File Structure

```
scrapers/Italy/immobiliare-it/
├── src/
│   ├── index.ts                                  # Express server (port 8111)
│   ├── scraper/
│   │   └── threePhaseOrchestrator.ts             # Inline streaming orchestrator
│   ├── scrapers/
│   │   └── listingsScraper.ts                    # Playwright browser, page fetching
│   ├── transformers/
│   │   ├── immobiliareTransformer.ts             # Category router
│   │   ├── apartments/apartmentTransformer.ts    # → ApartmentPropertyTierI
│   │   ├── houses/houseTransformer.ts            # → HousePropertyTierI
│   │   ├── land/landTransformer.ts               # → LandPropertyTierI
│   │   └── commercial/commercialTransformer.ts   # → CommercialPropertyTierI
│   ├── utils/
│   │   └── checksumExtractor.ts                  # createImmobiliareChecksum()
│   ├── types/
│   │   └── immobiliareTypes.ts                   # ImmobiliareResult, REGIONS[], CATEGORY_ID_MAP
│   └── adapters/
│       └── ingestAdapter.ts                      # POST to remote ingest API
└── docs/
    ├── README.md
    ├── SCRAPER.md
    ├── TRANSFORMERS.md
    ├── CONFIGURATION.md
    └── FIELD_MAPPING.md
```

## Starting the Scraper

```bash
# Install dependencies
npm install

# Start server (browser window will open on first run)
npm start

# Trigger a scrape
curl -X POST http://localhost:8111/scrape

# Health check
curl http://localhost:8111/health
```

## First-Run Setup

On the very first run, Playwright opens a visible Chromium browser window. Datadome may present a CAPTCHA. Solve it manually — the persistent Chrome profile at `~/.landomo/immobiliare-profile` will save the resulting cookies for all subsequent runs.

## Scrape Scope

| Category | Contract | URL Slug | Regions | Status |
|---|---|---|---|---|
| apartment | sale | vendita-appartamenti | 20 | Active |
| apartment | rent | affitto-appartamenti | 20 | Active |
| house | sale | vendita-case | 20 | Active |
| house | rent | affitto-case | 20 | Active |
| land | sale | vendita-terreni | 20 | Active |
| commercial | sale | vendita-uffici | 20 | Active |
| commercial | rent | affitto-uffici | 20 | Active |
| land | rent | — | — | Skipped (extremely rare in Italy) |

**Total: 140 active region-category-contract combos**

## Architecture Summary

Three-phase inline orchestrator with no BullMQ queue:

1. **Phase 1 — Discovery**: Playwright navigates search pages, extracts `__NEXT_DATA__` JSON
2. **Phase 2 — Checksum Compare**: Compares extracted IDs/checksums against ingest API; identifies new and changed listings
3. **Phase 3 — Detail + Ingest**: Fetches detail page for each new/changed listing via Playwright, transforms, buffers, and POSTs to ingest API in batches of 100

See [SCRAPER.md](./SCRAPER.md) for full architecture details.
