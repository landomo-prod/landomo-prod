# Ingatlan.com Scraper

Scraper for Ingatlan.com, Hungary's largest real estate portal with 250,000+ active listings.

## Overview

This scraper collects property listings from Ingatlan.com and transforms them into the standardized `StandardProperty` format for the Landomo platform.

## Features

- Scrapes Hungarian real estate listings
- Transforms data to StandardProperty format
- Supports Hungarian-specific property attributes (disposition, ownership, condition, etc.)
- Integration with landomo-world ingest API
- Express server with health check and scrape endpoints

## Architecture

```
src/
├── index.ts                      # Express server
├── adapters/ingestAdapter.ts     # Ingest API client
├── transformers/ingatlanTransformer.ts  # Data transformation
├── scrapers/listingsScraper.ts   # Data fetching
├── types/ingatlanTypes.ts        # Type definitions
├── shared/hungarian-value-mappings.ts  # Value standardization
└── utils/userAgents.ts           # HTTP client config
```

## Installation

```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Production
```bash
npm start
```

## Endpoints

### Health Check
```
GET /health
```

### Trigger Scrape
```
POST /scrape
```

## Environment Variables

- `PORT` - Server port (default: 8086)
- `INGEST_API_URL` - Ingest service URL
- `INGEST_API_KEY` - API authentication key (if required)

## Hungarian Property Terminology

- **Szobák** (Disposition): 1-szobás, 2-szobás, etc.
- **Tulajdonjog** (Ownership): személyi, szövetkezeti, állami
- **Állapot** (Condition): újépítésű, felújított, jó, felújítandó
- **Bútorozott** (Furnished): bútorozott, részben_bútorozott, bútorozatlan
- **Fűtés** (Heating): központi, gázfűtés, elektromos
- **Építés** (Construction): panel, tégla, vasbeton

## Docker

Build:
```bash
docker build -t landomo-scraper-ingatlan-com .
```

Run:
```bash
docker run -p 8086:8086 -e INGEST_API_URL=http://ingest-service:3000 landomo-scraper-ingatlan-com
```
