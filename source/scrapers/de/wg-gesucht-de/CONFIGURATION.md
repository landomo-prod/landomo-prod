# WG-Gesucht.de Scraper Configuration Guide

## Summary

The wg-gesucht-de scraper is **optional** and requires personal credentials. It will NOT start by default with `docker compose up -d`.

## Status

✅ **Configured as optional** - Uses Docker Compose profiles
✅ **Environment variables ready** - Template added to `.env.example`
✅ **Documentation complete** - README.md updated with full instructions

## Quick Start

### Option 1: I Don't Have Credentials (Default)

**Do nothing.** The scraper is disabled by default and won't affect your deployment.

```bash
# This will NOT start wg-gesucht-de
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d
```

### Option 2: I Have Credentials

1. **Register at WG-Gesucht:**
   - Go to https://www.wg-gesucht.de
   - Create a free account
   - Verify your email address

2. **Add credentials to `.env.dev`:**

```bash
# Add these lines to .env.dev
WG_GESUCHT_USERNAME=your-email@example.com
WG_GESUCHT_PASSWORD=your-password
```

3. **Start the scraper with profile:**

```bash
# Method 1: Start specific service
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d scraper-wg-gesucht-de

# Method 2: Use profile
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev --profile wg-gesucht up -d

# Method 3: Enable all optional scrapers
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev --profile optional up -d
```

4. **Verify it's working:**

```bash
curl http://localhost:8096/health
```

Expected response with credentials:
```json
{
  "status": "healthy",
  "scraper": "wg-gesucht",
  "authenticated": true
}
```

## Files Modified

### 1. docker/docker-compose.yml

**Changes:**
- Added `WG_GESUCHT_USERNAME` and `WG_GESUCHT_PASSWORD` environment variables
- Added `profiles: [optional, wg-gesucht]` to make scraper optional
- Added documentation comments

**Result:** Scraper will NOT start by default

### 2. .env.example

**Changes:**
- Added section "OPTIONAL SCRAPER CREDENTIALS"
- Added commented template for WG_GESUCHT credentials
- Included registration URL

**Result:** Developers know how to configure if needed

### 3. scrapers/Germany/wg-gesucht-de/README.md

**Changes:**
- Complete rewrite with focus on authentication requirements
- Added Docker profile instructions
- Added troubleshooting section
- Added security considerations

**Result:** Clear documentation on optional nature and how to enable

## Verification

### Test 1: Default Behavior (No Credentials)

```bash
# Should NOT include wg-gesucht-de
docker compose -f docker/docker-compose.yml --env-file .env.dev config --services | grep wg-gesucht

# Expected: No output (because of profile)
```

### Test 2: With Profile Enabled

```bash
# Should include wg-gesucht-de
docker compose -f docker/docker-compose.yml --env-file .env.dev --profile wg-gesucht config --services | grep wg-gesucht

# Expected: scraper-wg-gesucht-de
```

### Test 3: Health Check Without Credentials

```bash
# Start scraper without credentials (will show authenticated: false)
docker compose --profile wg-gesucht up -d scraper-wg-gesucht-de

# Check health
curl http://localhost:8096/health

# Expected: "authenticated": false
```

## Docker Compose Profiles Explained

### What are profiles?

Profiles allow you to selectively enable/disable services in docker-compose.yml.

### How it works:

- **No profile**: `docker compose up -d` → Only services without profiles start
- **With profile**: `docker compose --profile wg-gesucht up -d` → Services with matching profile start

### Benefits:

1. **No impact on default deployment** - Other scrapers work normally
2. **Easy to enable** - Just add `--profile wg-gesucht` when needed
3. **Clear intent** - Profile name indicates it's optional
4. **Flexible** - Can enable multiple profiles: `--profile optional --profile xyz`

## Authentication Flow

### Why OAuth2?

WG-Gesucht.de requires OAuth2 authentication for their API:

1. User logs in with email/password
2. API returns access token + refresh token
3. All requests include access token in header
4. Token expires after X hours
5. Refresh token gets new access token

### Implementation:

The scraper's `src/utils/fetchData.ts` handles:
- Initial authentication on startup
- Automatic token refresh before expiry
- Retry logic on 401 errors
- Token storage in memory (not persisted)

### Security:

- Credentials passed as environment variables (not in code)
- Never logged or stored in files
- Container restart requires re-authentication
- No credential sharing between containers

## Troubleshooting

### Issue: Scraper won't start

**Check:**
```bash
docker compose --profile wg-gesucht ps
```

**Fix:**
- Verify you're using `--profile wg-gesucht`
- Or explicitly name service: `docker compose up -d scraper-wg-gesucht-de`

### Issue: "authenticated": false

**Check:**
```bash
docker exec landomo-scraper-wg-gesucht-de env | grep WG_GESUCHT
```

**Fix:**
- Add credentials to `.env.dev`
- Restart container: `docker compose restart scraper-wg-gesucht-de`

### Issue: 401 Unauthorized

**Check:**
- Log in via browser: https://www.wg-gesucht.de
- Verify email is confirmed

**Fix:**
- Reset password if needed
- Update credentials in `.env.dev`
- Restart container

### Issue: No listings found

**Normal behavior:**
- Some cities have few listings
- Certain property types may not be available
- Rate limiting may cause delays

**Check logs:**
```bash
docker logs landomo-scraper-wg-gesucht-de -f
```

## Production Deployment

### Recommended Approach:

1. **Use secrets management** (not environment variables):
   - AWS Secrets Manager
   - HashiCorp Vault
   - Docker Secrets

2. **Rotate credentials regularly**

3. **Monitor authentication status**:
   ```bash
   curl http://scraper:8096/health | jq .authenticated
   ```

4. **Set up alerts** for authentication failures

### Environment Variables:

```bash
# Required
WG_GESUCHT_USERNAME=production-account@example.com
WG_GESUCHT_PASSWORD=secure-password-here

# Optional (production values)
PORT=8096
INGEST_API_URL=http://ingest-germany:3000
INGEST_API_KEY=prod_key_de_1
```

## Support

### Documentation:
- **README.md** - Full documentation with examples
- **QUICK_START.md** - 5-minute setup guide
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details

### External Resources:
- WG-Gesucht Registration: https://www.wg-gesucht.de
- Unofficial API Reference: https://github.com/Zero3141/WgGesuchtAPI
- Alternative Scraper: https://github.com/grantwilliams/wg-gesucht-crawler-cli

### Contact:
For credential issues, contact WG-Gesucht support directly.

---

**Configuration Date:** February 9, 2026
**Status:** Optional (requires credentials)
**Default Behavior:** Disabled
**Docker Profile:** `optional`, `wg-gesucht`
