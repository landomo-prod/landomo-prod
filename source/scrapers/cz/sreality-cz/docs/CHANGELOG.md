# Changelog

All notable changes to the SReality scraper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Removed legacy mode - checksum-based optimization is now mandatory
- Improved documentation with comprehensive docs folder

## [2.0.0] - 2026-02-16

### Added
- **Three-phase orchestration** with checksum-based optimization
- **Checksum system** for 90-95% API call reduction
- **Category-specific transformers** (apartment, house, land, commercial, other)
- **BullMQ queue architecture** with 200 concurrent workers
- **Type-safe field parser** (`SRealityItemsParser`)
- **Rate limiting** to respect API limits
- **Header rotation** for anti-bot protection
- **Batch ingestion** (100 properties per request)
- **Comprehensive metrics** (Prometheus integration)
- **Graceful shutdown** handling
- **Tier 1 universal fields** support (furnished, renovation_year, etc.)

### Changed
- Migrated from direct fetch to queue-based architecture
- Improved memory efficiency with batch accumulation
- Enhanced error handling with retry logic
- Optimized parallel page fetching (20 pages/batch)

### Removed
- Puppeteer dependency (now uses direct API calls)
- Browser-based scraping (switched to API-only)
- Manual pagination (now automatic with parallel fetching)

### Fixed
- Memory leaks in worker pool
- Race conditions in queue processing
- Incorrect category detection for edge cases
- Missing fields in transformation

### Performance
- Reduced scrape time from 60+ minutes to 10-15 minutes
- Reduced API calls by 90-95% through checksum optimization
- Increased throughput with 200 concurrent workers
- Improved memory usage with batch processing

## [1.5.0] - 2025-12-10

### Added
- Change detection with in-memory cache
- Batch processing for detail fetches
- Connection pooling for HTTP requests

### Changed
- Increased concurrency from 50 to 100 workers
- Improved error handling in transformers

### Fixed
- Timeout issues with large batches
- Category detection for commercial properties

## [1.0.0] - 2025-10-01

### Added
- Initial release with Puppeteer-based scraping
- Basic transformation to standard schema
- Express API for scrape triggering
- Health check endpoint
- Docker support

### Features
- Scrapes all 5 categories (apartments, houses, land, commercial, other)
- Extracts basic property information
- Transforms to Landomo schema
- Sends to ingest API

### Known Issues
- Slow performance (~2 hours per scrape)
- High memory usage with Puppeteer
- No change detection (fetches all properties)
- Limited error recovery

## Migration Guides

### Migrating from 1.x to 2.0

**Breaking Changes**:

1. **Queue Required**: Redis now required for BullMQ queue

```bash
# Before (1.x)
npm run dev

# After (2.0)
# Start Redis first
docker run -d -p 6379:6379 redis:7
npm run dev
```

2. **Environment Variables**:

```bash
# New required variables
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_CONCURRENCY=200

# Updated variable names
INGEST_API_KEY_SREALITY  # Preferred over INGEST_API_KEY
```

3. **API Response Changes**:

```json
// Before (1.x)
{
  "status": "scraping",
  "message": "Scrape started"
}

// After (2.0)
{
  "status": "scraping started",
  "categories": "1,2",
  "timestamp": "2026-02-16T10:30:00Z"
}
```

4. **Checksum Mode**:

Now mandatory. No option to disable. First scrape will be slow (all new), subsequent scrapes will be fast (90% unchanged).

**Migration Steps**:

1. Update dependencies:
```bash
npm install
```

2. Install Redis:
```bash
docker run -d --name redis -p 6379:6379 redis:7
```

3. Update `.env`:
```bash
echo "REDIS_HOST=localhost" >> .env
echo "REDIS_PORT=6379" >> .env
echo "WORKER_CONCURRENCY=200" >> .env
```

4. Rebuild shared-components:
```bash
cd ../../../shared-components
npm install
npm run build
```

5. Update ingest service (if needed):
```bash
cd ../../../ingest-service
# Apply migration 021 for listing_checksums table
psql -U landomo -d landomo_czech_republic -f migrations/021_create_listing_checksums.sql
```

6. Test:
```bash
npm run dev
curl -X POST http://localhost:8102/scrape?categories=1
```

7. Monitor first scrape:
```bash
# First scrape: All new (slow)
curl http://localhost:8102/health

# Wait for completion
# Check logs for "Phase 2" results
docker logs -f landomo-scraper-sreality | grep "Phase 2"
```

8. Verify checksums stored:
```bash
psql -U landomo -d landomo_czech_republic -c \
  "SELECT COUNT(*) FROM listing_checksums WHERE portal = 'sreality';"
# Should show ~100,000 rows
```

9. Run second scrape:
```bash
# Second scrape: 90% unchanged (fast)
curl -X POST http://localhost:8102/scrape?categories=1

# Should see:
# - Phase 2: ~90% unchanged
# - Phase 3: Only ~10k queued
# - Total time: ~10-15 minutes
```

## Versioning Strategy

- **Major version** (X.0.0): Breaking changes, architecture changes
- **Minor version** (0.X.0): New features, backwards compatible
- **Patch version** (0.0.X): Bug fixes, performance improvements

## Support Policy

- **Current**: 2.x - Full support, active development
- **Previous**: 1.x - Security fixes only until 2026-06-01
- **Legacy**: 0.x - No support (deprecated)

## Upgrade Path

```
0.x → 1.0 → 1.5 → 2.0 (current)
                    ↓
                  2.1 (planned)
```

## Future Roadmap

### Planned for 2.1

- [ ] Incremental discovery (skip unchanged pages)
- [ ] Smart scheduling (prioritize high-value categories)
- [ ] Real-time WebSocket updates
- [ ] CDN caching for listing pages
- [ ] Advanced change detection (image hash, description diff)

### Under Consideration

- Distributed workers across multiple machines
- Machine learning for category detection
- Automatic field mapping updates
- Self-healing error recovery
- GraphQL API for scrape control

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for contribution guidelines.

## License

Part of the Landomo World platform.
