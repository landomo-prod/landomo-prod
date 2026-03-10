# Development Guide

> Local setup, testing, and contribution guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Running the Scraper](#running-the-scraper)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Structure](#code-structure)
- [Contributing](#contributing)

## Prerequisites

### Required Software

- **Node.js**: 20.x or higher
- **npm**: 9.x or higher
- **Redis**: 6.x or higher (for queue)
- **Git**: For version control

### Recommended Tools

- **VS Code**: With TypeScript extensions
- **Redis CLI**: For queue inspection
- **Postman/Insomnia**: For API testing
- **Docker Desktop**: For containerized testing

## Local Setup

### 1. Clone Repository

```bash
cd ~/Development
git clone https://github.com/yourusername/landomo-world.git
cd landomo-world/scrapers/Czech\ Republic/sreality
```

### 2. Install Dependencies

```bash
# Install shared-components first
cd ../../../shared-components
npm install
npm run build

# Install scraper dependencies
cd ../scrapers/Czech\ Republic/sreality
npm install
```

### 3. Start Redis

**Option A: Docker**

```bash
docker run -d --name redis -p 6379:6379 redis:7
```

**Option B: Local Installation**

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Verify Redis**:

```bash
redis-cli ping
# Expected: PONG
```

### 4. Configure Environment

Create `.env.dev`:

```bash
# API
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_cz_1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Performance (reduced for local dev)
WORKER_CONCURRENCY=50
CONCURRENT_PAGES=10

# Server
PORT=8102
NODE_ENV=development
```

### 5. Start Ingest Service

The scraper requires the ingest service to be running.

```bash
# In another terminal
cd ~/Development/landomo-world/ingest-service
npm install
npm run dev
```

Verify:
```bash
curl http://localhost:3004/health
# Expected: {"status":"healthy"}
```

## Running the Scraper

### Development Mode (Hot Reload)

```bash
npm run dev
```

This uses `ts-node` for automatic recompilation on file changes.

### Production Build

```bash
npm run build
npm start
```

This compiles TypeScript to JavaScript and runs the compiled code.

### Docker

```bash
# From project root
cd ~/Development/landomo-world

# Start dependencies
docker compose -f docker/docker-compose.yml up -d postgres redis ingest-czech

# Start scraper
docker compose -f docker/docker-compose.yml up scraper-sreality
```

## Testing

### Manual Testing

**Trigger Scrape**:

```bash
# All categories
curl -X POST http://localhost:8102/scrape

# Specific categories
curl -X POST "http://localhost:8102/scrape?categories=1,2"

# Critical only (apartments + houses)
curl -X POST "http://localhost:8102/scrape?categories=critical"
```

**Check Health**:

```bash
curl http://localhost:8102/health | jq
```

**View Metrics**:

```bash
curl http://localhost:8102/metrics
```

### Queue Inspection

**Redis CLI**:

```bash
redis-cli

# List all keys
KEYS *

# Check queue length
LLEN bull:sreality-details:wait

# View job data
HGETALL bull:sreality-details:12345

# Clear queue (DANGER!)
FLUSHALL
```

**BullBoard (optional)**:

```bash
npm install -g bull-board
bull-board
# Open http://localhost:3000
```

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- itemsParser.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Integration Tests

```bash
# Test transformation
npm run test:transform

# Test full scrape (small sample)
npm run test:scrape:sample

# Test checksum extraction
npm run test:checksums
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Scraper",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/scrapers/Czech Republic/sreality",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development",
        "WORKER_CONCURRENCY": "10"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "cwd": "${workspaceFolder}/scrapers/Czech Republic/sreality",
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Techniques

**Add Breakpoints**: Click left margin in VS Code

**Log Statements**:

```typescript
console.log('Listing:', JSON.stringify(listing, null, 2));
console.log('Phase stats:', phaseStats);
```

**Inspect Queue Jobs**:

```typescript
// In detailQueue.ts worker
worker.on('active', (job) => {
  console.log('Processing job:', job.id, job.data);
});
```

**Debug Transformation**:

```typescript
// In transformer
try {
  const result = transformApartment(listing);
  console.log('Transform success:', result.portal_id);
} catch (error) {
  console.error('Transform error:', error);
  console.error('Listing data:', listing);
}
```

### Common Debug Scenarios

**Checksum Not Detecting Changes**:

```typescript
// Add to checksumExtractor.ts
console.log('Checksum fields:', extractSRealityChecksumFields(listing));
console.log('Generated hash:', createSRealityChecksum(listing).contentHash);
```

**Category Detection Failing**:

```typescript
// Add to categoryDetection.ts
console.log('Category ID:', listing.seo?.category_main_cb);
console.log('Title:', listing.name);
console.log('Detected:', detectCategoryFromSreality(listing));
```

**Worker Not Processing**:

```typescript
// Check queue stats
const stats = await getQueueStats();
console.log('Queue stats:', stats);

// Check worker events
worker.on('failed', (job, err) => {
  console.error('Job failed:', job.id, err);
});
```

## Code Structure

### Directory Layout

```
src/
├── index.ts                      # Express server + entry point
├── scraper/
│   └── threePhaseOrchestrator.ts # Main scrape logic
├── scrapers/
│   ├── listingsScraper.ts        # Legacy scraper (unused)
│   └── detailScraper.ts          # Detail fetch logic
├── transformers/
│   ├── srealityTransformer.ts    # Category router
│   ├── apartments/
│   │   └── apartmentTransformer.ts
│   ├── houses/
│   │   └── houseTransformer.ts
│   ├── land/
│   │   └── landTransformer.ts
│   ├── commercial/
│   │   └── commercialTransformer.ts
│   └── other/
│       └── otherTransformer.ts
├── adapters/
│   └── ingestAdapter.ts          # Ingest API client
├── queue/
│   └── detailQueue.ts            # BullMQ queue + workers
├── workers/
│   └── discoveryWorker.ts        # Legacy worker (unused)
├── utils/
│   ├── fetchData.ts              # HTTP fetch utilities
│   ├── checksumExtractor.ts      # Checksum generation
│   ├── itemsParser.ts            # Type-safe field parser
│   ├── srealityHelpers.ts        # Helper functions
│   ├── categoryDetection.ts      # Category detection
│   ├── headers.ts                # User-Agent rotation
│   └── rateLimiter.ts            # Rate limiting
└── types/
    ├── srealityTypes.ts          # SReality listing types
    └── srealityApiTypes.ts       # API response types
```

### Key Files

**Entry Point**: `src/index.ts`
- Express server
- Health check
- Scrape trigger endpoint
- Worker initialization

**Orchestrator**: `src/scraper/threePhaseOrchestrator.ts`
- Phase 1: Discovery
- Phase 2: Checksum comparison
- Phase 3: Selective fetching

**Transformers**: `src/transformers/*/`
- Category detection
- Field extraction
- Tier I type mapping

**Queue**: `src/queue/detailQueue.ts`
- BullMQ configuration
- Worker pool
- Batch accumulation

### Adding a New Field

1. **Check API Response**: Verify field exists in SReality API

2. **Add to Field Names** (`types/srealityApiTypes.ts`):

```typescript
export const FIELD_NAMES = {
  // ...existing fields
  NEW_FIELD: 'Czech Field Name',
} as const;
```

3. **Update Transformer** (e.g., `transformers/apartments/apartmentTransformer.ts`):

```typescript
// Extract from parser
const newField = parser.getString(FIELD_NAMES.NEW_FIELD);

// Add to return object
return {
  // ...existing fields
  newField,
};
```

4. **Update Tier I Type** (in `shared-components`):

```typescript
// shared-components/src/types/ApartmentPropertyTierI.ts
export interface ApartmentPropertyTierI {
  // ...existing fields
  newField?: string;
}
```

5. **Rebuild Shared Components**:

```bash
cd shared-components
npm run build
```

6. **Test**:

```bash
npm run dev
# Trigger scrape and verify new field
```

### Adding a New Category

1. **Create Transformer**:

```bash
mkdir -p src/transformers/newcategory
touch src/transformers/newcategory/newcategoryTransformer.ts
```

2. **Implement Transformer**:

```typescript
import { NewCategoryPropertyTierI } from '@landomo/core';
import { SRealityListing } from '../../types/srealityTypes';

export function transformNewCategory(listing: SRealityListing): NewCategoryPropertyTierI {
  return {
    property_category: 'newcategory',
    // ...required fields
  };
}
```

3. **Update Category Detection** (`utils/categoryDetection.ts`):

```typescript
export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial' | 'other' | 'newcategory';

export function detectCategoryFromSreality(listing: SRealityListing): PropertyCategory {
  if (categoryId === 6) return 'newcategory';
  // ...existing logic
}
```

4. **Update Router** (`transformers/srealityTransformer.ts`):

```typescript
import { transformNewCategory } from './newcategory/newcategoryTransformer';

export function transformSRealityToStandard(listing: SRealityListing) {
  const category = detectCategoryFromSreality(listing);

  switch (category) {
    case 'newcategory':
      return transformNewCategory(listing);
    // ...existing cases
  }
}
```

## Contributing

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Use Prettier (auto-format on save)
- **Linting**: ESLint with Airbnb config
- **Naming**: camelCase for variables, PascalCase for types

### Commit Messages

Follow conventional commits:

```
feat(transformers): add garage_count field to house transformer
fix(queue): prevent memory leak in batch accumulator
docs(readme): update performance metrics
refactor(checksum): extract field normalization logic
test(parser): add unit tests for itemsParser
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test locally
3. Run type check: `npm run type-check`
4. Commit with conventional message
5. Push and create PR
6. Wait for CI checks to pass
7. Request review from maintainer

### Testing Requirements

- All new fields must have tests
- Transformers must have integration tests
- Maintain >80% code coverage
- Test both happy path and error cases

### Documentation Requirements

- Update relevant docs in `docs/`
- Add JSDoc comments for public functions
- Update CHANGELOG.md
- Include examples in API_REFERENCE.md
