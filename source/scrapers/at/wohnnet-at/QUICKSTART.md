# Wohnnet.at Scraper - Quick Start Guide

**Get running in 5 minutes**

---

## Prerequisites

- Node.js 20+
- npm or yarn
- Access to landomo-world repository

---

## Installation

### Step 1: Navigate to Scraper Directory

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Austria/wohnnet-at
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env if needed (defaults work for local development)
nano .env
```

**Default Configuration (works out of the box):**
```env
PORT=8083
MAX_PAGES=10
REQUESTS_PER_SECOND=2
ENABLE_DETAIL_SCRAPING=false
```

---

## Running the Scraper

### Development Mode

```bash
npm run dev
```

**Output:**
```
🚀 Wohnnet.at scraper running
   Port: 8083
   Health: http://localhost:8083/health
   Trigger: POST http://localhost:8083/scrape

Waiting for scrape triggers...
```

### Test Health Endpoint

```bash
curl http://localhost:8083/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "scraper": "wohnnet",
  "version": "1.0.0",
  "timestamp": "2026-02-07T..."
}
```

### Trigger Scraping

```bash
curl -X POST http://localhost:8083/scrape
```

**Expected Response:**
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T..."
}
```

**Console Output:**
```
[2026-02-07T...] 🚀 Starting Wohnnet.at scrape...

📡 Fetching listings from Wohnnet.at...
Starting Wohnnet.at scrape...
Options: { maxPages: 10, requestsPerSecond: 2, enableDetailScraping: false }

📄 Scraping page 1...
   Found 20 listings on page 1
   Pagination: page 1/1409, hasNext: true

📄 Scraping page 2...
   Found 20 listings on page 2
   ...

✅ Scraping completed!
Statistics:
   Total pages: 10
   Total listings: 200
   Successful: 200
   Failed: 0
   Details enriched: 0
   Duration: 5.23s

🔄 Transforming 200 listings...
✅ Successfully transformed 200 listings

📤 Sending batch 1/2 (100 properties)...
✅ Sent 100 properties to ingest API
📤 Sending batch 2/2 (100 properties)...
✅ Sent 100 properties to ingest API

✅ Scrape completed in 6.45s
   Total listings: 200
   Transformed: 200
   Sent to ingest API: 200
```

---

## Production Build

### Build TypeScript

```bash
npm run build
```

**Output:**
```
dist/
├── index.js
├── index.d.ts
├── scrapers/
├── transformers/
├── types/
├── utils/
└── adapters/
```

### Run Production Build

```bash
npm start
```

---

## Docker

### Build Image

```bash
docker build -t landomo-wohnnet-scraper .
```

### Run Container

```bash
docker run -p 8083:8083 --env-file .env landomo-wohnnet-scraper
```

### Check Container Health

```bash
docker ps
curl http://localhost:8083/health
```

---

## Configuration Options

### Environment Variables

```env
# Server Configuration
PORT=8083                          # API server port

# Scraper Settings
MAX_PAGES=10                       # Maximum pages to scrape (1-1500)
REQUESTS_PER_SECOND=2              # Rate limit (1-10)
ENABLE_DETAIL_SCRAPING=false       # Fetch detail pages (true/false)

# Ingest API (for production)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_WOHNNET=dev_key_austria_wohnnet
```

### Common Configurations

**Quick Test (1 page):**
```env
MAX_PAGES=1
REQUESTS_PER_SECOND=2
ENABLE_DETAIL_SCRAPING=false
```

**Medium Test (10 pages):**
```env
MAX_PAGES=10
REQUESTS_PER_SECOND=2
ENABLE_DETAIL_SCRAPING=false
```

**Full Scrape (no details):**
```env
MAX_PAGES=1500
REQUESTS_PER_SECOND=2
ENABLE_DETAIL_SCRAPING=false
```

**Full Scrape (with details):**
```env
MAX_PAGES=1500
REQUESTS_PER_SECOND=1
ENABLE_DETAIL_SCRAPING=true
```

---

## Troubleshooting

### Issue: `Cannot find module '@landomo/core'`

**Solution:**
```bash
# Ensure shared-components exists
ls -la ../../../shared-components

# If missing, the scraper needs the core package
# Check with the team for the correct path
```

### Issue: Connection refused to ingest API

**Solution:**
```bash
# Check if ingest API is running
curl http://localhost:3004/health

# If not running, start the ingest service first
# OR update .env to point to correct URL
```

### Issue: TypeScript errors

**Solution:**
```bash
# Clean and rebuild
npm run clean
npm run build

# If errors persist, check tsconfig.json
```

### Issue: No listings found

**Possible causes:**
1. Wohnnet.at changed HTML structure
2. Network issues
3. Rate limiting

**Check:**
```bash
# Test direct URL
curl https://www.wohnnet.at/immobilien/

# Check logs for specific errors
# Update selectors in src/utils/htmlParser.ts if needed
```

---

## Testing Tips

### Test Single Page

Edit `.env`:
```env
MAX_PAGES=1
ENABLE_DETAIL_SCRAPING=false
```

Run and verify output structure.

### Test Pagination

Edit `.env`:
```env
MAX_PAGES=3
ENABLE_DETAIL_SCRAPING=false
```

Check console for pagination detection.

### Test Detail Scraping

Edit `.env`:
```env
MAX_PAGES=1
ENABLE_DETAIL_SCRAPING=true
```

Verify enriched data (slower but more complete).

### Monitor Performance

```bash
# Watch console for:
- Listings per page (should be ~20-30)
- Request timing (should be ~500ms with 2 req/s)
- Error rates (should be 0%)
- Transformation success (should be 100%)
```

---

## Next Steps

1. **Test Locally**: Run with `MAX_PAGES=1`
2. **Verify Data**: Check ingest API for transformed properties
3. **Scale Up**: Increase `MAX_PAGES` gradually
4. **Monitor**: Watch for errors or structure changes
5. **Deploy**: Build Docker image and deploy to production

---

## Useful Commands

```bash
# Development
npm run dev                    # Run in development mode
npm run build                  # Build TypeScript
npm run clean                  # Clean build artifacts

# Testing
curl http://localhost:8083/health              # Health check
curl -X POST http://localhost:8083/scrape      # Trigger scrape

# Docker
docker build -t landomo-wohnnet-scraper .      # Build image
docker run -p 8083:8083 landomo-wohnnet-scraper # Run container
docker logs -f <container-id>                  # View logs

# Debugging
npm run dev | tee scraper.log  # Save logs to file
tail -f scraper.log            # Watch logs in real-time
```

---

## Performance Expectations

### Quick Test (1 page)
- **Time**: ~5 seconds
- **Listings**: ~20-30
- **Perfect for**: Initial testing

### Medium Test (10 pages)
- **Time**: ~1 minute
- **Listings**: ~200-300
- **Perfect for**: Integration testing

### Full Scrape (1500 pages, no details)
- **Time**: ~12 minutes
- **Listings**: ~30,000
- **Perfect for**: Production scraping

### Full Scrape (with details)
- **Time**: ~4 hours
- **Listings**: ~30,000 (enriched)
- **Perfect for**: Maximum data quality

---

## Support

### Check Logs
All output goes to console. Errors are prefixed with `❌`.

### Common Patterns
- `📄` = Scraping page
- `✅` = Success
- `❌` = Error
- `⚠️` = Warning
- `📤` = Sending to API

### Need Help?
1. Check logs for specific error messages
2. Review `IMPLEMENTATION_SUMMARY.md` for details
3. Check `VERIFICATION.md` for known issues
4. Review HTML structure if selectors fail

---

**Ready to Scrape!** 🚀

Start with `npm run dev` and trigger your first scrape!
