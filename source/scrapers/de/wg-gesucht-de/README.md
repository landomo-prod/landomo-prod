# WG-Gesucht.de Scraper

Production-ready TypeScript scraper for **wg-gesucht.de** - Germany's largest shared housing (WG) and apartment rental platform.

## Overview

This scraper uses the **unofficial WG-Gesucht API** to fetch rental listings for shared flats (WG-Zimmer), studios, and apartments across major German cities.

### Key Features

- **Authentication-based API client** with automatic token refresh
- **Rate limiting** with 5-8 second delays to avoid reCAPTCHA
- **Multi-city scraping** (Berlin, Munich, Hamburg, Cologne, Frankfurt, etc.)
- **Detailed enrichment** - fetches full details for each listing
- **Standardized output** - transforms to Landomo StandardProperty format
- **Production-ready** - follows the proven Czech scraper architecture

## ⚠️ Authentication Required

**This scraper requires a personal WG-Gesucht account** to function. It cannot operate without valid credentials.

### Why Credentials Are Required

WG-Gesucht.de uses OAuth2 authentication for their API. All API requests must include a valid access token obtained through user login. This is not bypassable with typical scraping techniques.

### Getting Started

1. **Register for a free account** at [https://www.wg-gesucht.de](https://www.wg-gesucht.de)
2. **Verify your email address** (required for API access)
3. **Set environment variables** (see Configuration section below)

## Architecture

```
wg-gesucht-de/
├── src/
│   ├── index.ts                      # Express server + orchestration
│   ├── scrapers/
│   │   └── listingsScraper.ts        # Main scraping logic
│   ├── types/
│   │   └── wgGesuchtTypes.ts         # TypeScript type definitions
│   ├── transformers/
│   │   └── wgGesuchtTransformer.ts   # Data transformation
│   └── utils/
│       ├── fetchData.ts              # API client with auth
│       └── userAgents.ts             # User agent rotation
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

### Docker Deployment (Recommended)

The scraper is configured as an **optional service** in docker-compose.yml. To enable it:

1. **Add credentials to `.env.dev`:**

```bash
# WG-Gesucht.de Scraper (optional - requires personal account)
WG_GESUCHT_USERNAME=your-email@example.com
WG_GESUCHT_PASSWORD=your-password
```

2. **Start the scraper with the `wg-gesucht` profile:**

```bash
# Start with other German scrapers
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d scraper-wg-gesucht-de

# Or enable the wg-gesucht profile
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev --profile wg-gesucht up -d

# Or enable all optional scrapers
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev --profile optional up -d
```

3. **Verify it's running:**

```bash
curl http://localhost:8096/health
```

Expected response:
```json
{
  "status": "healthy",
  "scraper": "wg-gesucht",
  "version": "1.0.0",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "authenticated": true
}
```

If `"authenticated": false`, check your credentials in `.env.dev`.

### Standalone Development Mode

```bash
# Navigate to scraper directory
cd scrapers/Germany/wg-gesucht-de

# Install dependencies
npm install

# Set credentials
export WG_GESUCHT_USERNAME="your-email@example.com"
export WG_GESUCHT_PASSWORD="your-password"

# Run in dev mode with ts-node
npm run dev

# Or build and run production mode
npm run build
npm start
```

### Environment Variables

```bash
# Required (will not start without these)
WG_GESUCHT_USERNAME=your-email@example.com
WG_GESUCHT_PASSWORD=your-password

# Optional
PORT=8096                                    # Server port (default: 8082)
INGEST_API_URL=http://ingest-germany:3000    # Ingest API endpoint
INGEST_API_KEY=dev_key_de_1                  # API key for ingest
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8096/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "wg-gesucht",
  "version": "1.0.0",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "authenticated": true
}
```

### Trigger Scrape
```bash
POST http://localhost:8096/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## Scraping Configuration

### Default Cities

The scraper targets these cities by default:
- Berlin (ID: 8)
- Munich (ID: 90)
- Hamburg (ID: 55)
- Cologne (ID: 73)
- Frankfurt (ID: 41)

### Default Categories

- `WG_ROOM` (0) - Shared flat rooms
- `ONE_ROOM` (1) - Studio apartments
- `TWO_ROOM` (2) - 2-room apartments

### Customization

Edit `src/index.ts` to customize:

```typescript
const scraper = new ListingsScraper({
  cities: [
    CITY_IDS.BERLIN,
    CITY_IDS.MUNICH,
    // Add more cities...
  ],
  categories: [
    CATEGORY_TYPES.WG_ROOM,
    CATEGORY_TYPES.ONE_ROOM,
    // Add more categories...
  ],
  fetchDetails: true // Set to false for faster scraping
});
```

### Available Cities (15)

```typescript
BERLIN: 8,         MUNICH: 90,        HAMBURG: 55,
COLOGNE: 73,       FRANKFURT: 41,     STUTTGART: 124,
DUSSELDORF: 27,    DORTMUND: 24,      ESSEN: 30,
LEIPZIG: 77,       BREMEN: 17,        DRESDEN: 25,
HANOVER: 57,       NUREMBERG: 96,     DUISBURG: 26
```

## API Details

### Base URL
```
https://www.wg-gesucht.de/api/asset/offers/
```

### Authentication

The scraper uses OAuth2 password grant flow:

1. **Login** - Exchanges username/password for access token
2. **Token Storage** - Stores access + refresh tokens in memory
3. **Auto-Refresh** - Automatically refreshes tokens before expiry
4. **Retry Logic** - Retries failed requests with fresh tokens

### Rate Limiting

To avoid reCAPTCHA triggers:
- **5-8 second delays** between requests (randomized)
- **Exponential backoff** on errors (2s, 4s, 8s, max 15s)
- **User agent rotation** from pool of 6 realistic browser agents

### Endpoints Used

#### Search Offers
```
GET /api/asset/offers/
  ?city_id={cityId}
  &categories={categories}
  &rent_max={maxRent}
  &size_min={minSize}
  &page={page}
```

#### Offer Details
```
GET /api/asset/offers/{offerId}
```

## Data Transformation

### Input Format (WG-Gesucht API)

```json
{
  "id": "12345678",
  "title": "Schönes WG-Zimmer in Berlin-Kreuzberg",
  "city": "Berlin",
  "district": "Kreuzberg",
  "rent": 450,
  "size": 18,
  "available_from": "2026-03-01",
  "furnished": true,
  "flatmates": {
    "total": 2,
    "male": 1,
    "female": 1
  }
}
```

### Output Format (StandardProperty)

```json
{
  "title": "Schönes WG-Zimmer in Berlin-Kreuzberg",
  "price": 450,
  "currency": "EUR",
  "property_type": "room",
  "transaction_type": "rent",
  "location": {
    "city": "Berlin",
    "region": "Kreuzberg",
    "country": "Germany"
  },
  "details": {
    "sqm": 18,
    "bedrooms": 1
  },
  "amenities": {
    "is_furnished": true
  },
  "country_specific": {
    "furnished": "furnished",
    "wg_type": "shared_flat",
    "flatmates_total": 2,
    "available_from": "2026-03-01"
  }
}
```

## Troubleshooting

### Authentication Failed

```
❌ Authentication failed: 401 Unauthorized
```

**Solutions:**
- Verify credentials are correct in `.env.dev` or environment
- Check account is verified (email confirmation required)
- Try logging in via browser first at https://www.wg-gesucht.de
- Reset password if needed

### Missing Credentials

```
❌ WG-Gesucht credentials not configured. Set WG_GESUCHT_USERNAME and WG_GESUCHT_PASSWORD environment variables.
```

**Solution:**
- Add credentials to `.env.dev` file
- Restart the container: `docker compose restart scraper-wg-gesucht-de`

### Health Check Shows Not Authenticated

```json
{
  "authenticated": false
}
```

**Solutions:**
- Check environment variables are being passed: `docker exec landomo-scraper-wg-gesucht-de env | grep WG_GESUCHT`
- Verify `.env.dev` has the correct variable names (not typos)
- Restart container after updating `.env.dev`

### Rate Limited / reCAPTCHA

```
❌ Too many requests - reCAPTCHA triggered
```

**Solutions:**
- Increase delay in `src/utils/fetchData.ts` (try 10-15 seconds)
- Reduce concurrent requests
- Use residential proxies (advanced)

### Token Expired

```
❌ Access token expired
```

**Solution:**
- Scraper auto-refreshes tokens
- If persists, restart scraper to force re-authentication

## Performance

### Scraping Speed

With rate limiting (5-8 seconds per request):
- **~450 listings/hour** (7-8 per minute)
- **Berlin alone**: ~2-3 hours for complete scrape
- **All 5 cities**: ~10-12 hours

### Optimization Tips

1. **Disable detail fetching** for faster scraping:
   ```typescript
   fetchDetails: false  // 2x faster
   ```

2. **Reduce cities** - Start with 1-2 cities
3. **Increase delays** if getting rate limited

## Docker Profiles

The scraper is configured with two Docker Compose profiles:

- **`optional`** - Use to enable all optional scrapers
- **`wg-gesucht`** - Use to enable only this scraper

### Start Without Scraper (Default)

```bash
# Normal docker-compose up will NOT start wg-gesucht-de
docker compose up -d
```

### Start With Scraper

```bash
# Method 1: Enable specific service
docker compose up -d scraper-wg-gesucht-de

# Method 2: Enable wg-gesucht profile
docker compose --profile wg-gesucht up -d

# Method 3: Enable all optional scrapers
docker compose --profile optional up -d
```

## Security Considerations

### Credential Safety

- **Never commit credentials** to version control
- Use `.env.dev` (which is gitignored)
- Credentials are passed as environment variables to containers
- No credentials are stored in code or logs

### API Usage

- Uses official OAuth2 authentication (not bypassing security)
- Respects rate limits to avoid triggering protections
- Implements user-agent rotation and delays

## Legal & Ethical Considerations

### Terms of Service

- WG-Gesucht TOS **may prohibit** automated access
- This scraper is for **educational and personal use** only
- For commercial use, contact WG-Gesucht for official API access

### Best Practices

1. **Respect rate limits** - Use 5-8 second delays
2. **Don't overwhelm servers** - Scrape during off-peak hours
3. **Cache data** - Don't re-fetch unchanged listings
4. **GDPR compliance** - Handle personal data appropriately

### Recommendations

- **Request official API access** for commercial use
- **Monitor for TOS changes** regularly
- **Implement exponential backoff** on all errors

## GitHub Resources

### Reference Implementations

1. **Zero3141/WgGesuchtAPI** - Unofficial Python API client
   - [https://github.com/Zero3141/WgGesuchtAPI](https://github.com/Zero3141/WgGesuchtAPI)
   - Provides authentication flow and API endpoints

2. **grantwilliams/wg-gesucht-crawler-cli** - CLI scraper
   - [https://github.com/grantwilliams/wg-gesucht-crawler-cli](https://github.com/grantwilliams/wg-gesucht-crawler-cli)
   - Alternative HTML scraping approach

## Monitoring

### Logs

The scraper provides detailed logging:

```
[2026-02-09T12:00:00.000Z] 🚀 Starting WG-Gesucht scrape...
🔐 Authenticating with WG-Gesucht API...
✅ Successfully authenticated with WG-Gesucht API

📍 Scraping Berlin (ID: 8)...
   Page 5: 100 listings
✅ Berlin: 450 listings

✅ Scrape completed in 3600.00s
   Total listings: 450
   Transformed: 445
```

### Metrics to Track

- **Listings scraped** per city
- **Success rate** (transformed / total)
- **Average request time**
- **Authentication failures**
- **Rate limit hits**

## Support

For issues or questions:

1. Check [GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md](/docs/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md)
2. Review GitHub projects:
   - [Zero3141/WgGesuchtAPI](https://github.com/Zero3141/WgGesuchtAPI)
   - [grantwilliams/wg-gesucht-crawler-cli](https://github.com/grantwilliams/wg-gesucht-crawler-cli)

## Quick Reference

### Check if Running
```bash
curl http://localhost:8096/health
```

### Trigger Scrape
```bash
curl -X POST http://localhost:8096/scrape
```

### View Logs
```bash
docker logs landomo-scraper-wg-gesucht-de -f
```

### Restart After Config Changes
```bash
docker compose restart scraper-wg-gesucht-de
```

### Stop Scraper
```bash
docker compose stop scraper-wg-gesucht-de
```

---

**Last Updated:** February 9, 2026
**API Version:** Unofficial (as of Feb 2026)
**Status:** Production Ready (requires credentials)
**Docker Profile:** `optional`, `wg-gesucht`
