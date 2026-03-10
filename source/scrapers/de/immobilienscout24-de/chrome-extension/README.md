# ImmobilienScout24 Chrome Extension Scraper

## Overview

**Zero automation detection!** This Chrome extension runs directly in your browser, extracting data from pages you're already viewing. No Puppeteer, no CDP, no cookies.txt needed.

## Why This Works

✅ **Runs in real browser** - Your actual Chrome with your actual session
✅ **No automation traces** - Not Puppeteer/Selenium, just JavaScript
✅ **Manual CAPTCHA solving** - You solve it, extension extracts after
✅ **Persistent session** - Works as long as you're logged in
✅ **Easy debugging** - Chrome DevTools shows everything

## Installation (2 minutes)

### Step 1: Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder: `scrapers/Germany/immobilienscout24-de/chrome-extension/`

### Step 2: Add Icons (Optional)

Create simple PNG icons or use placeholders:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

Or download from: https://www.flaticon.com/free-icon/house_1946488

### Step 3: Test

1. Navigate to https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten
2. Solve any CAPTCHAs if needed
3. Click the extension icon
4. Click "📦 Extract Listings from Page"
5. Should see: "✅ Extracted X listings"

## Usage

### Basic Extraction

1. **Navigate** to any search results page on immobilienscout24.de
2. **Click** extension icon
3. **Click** "Extract Listings from Page"
4. **Export** as JSON or send to API

### Export as JSON

- Click "💾 Export as JSON"
- Downloads `immoscout24-listings-{timestamp}.json`
- Use for testing or manual analysis

### Send to Ingest API

- Configure API endpoint in `popup.js`:
  ```javascript
  const INGEST_API_URL = 'http://localhost:3009/api/v1/properties/bulk-ingest';
  const INGEST_API_KEY = 'dev_key_de_1';
  ```
- Click "🚀 Send to Ingest API"
- Listings sent directly to your backend

## How It Works

```
User navigates to immobilienscout24.de
          ↓
    Solve any CAPTCHAs manually
          ↓
    Page loads with listings
          ↓
    Click extension → Extract
          ↓
  content.js reads DOM directly
          ↓
    No automation detection!
          ↓
  Export JSON or send to API
```

## Architecture

### Files

- **manifest.json** - Extension config
- **popup.html** - UI when you click extension icon
- **popup.js** - Button handlers
- **content.js** - Runs on immobilienscout24.de, extracts listings
- **background.js** - Background tasks (optional)

### Data Flow

1. **content.js** injects into immobilienscout24.de pages
2. **popup.js** sends `extractListings` message
3. **content.js** queries DOM and returns data
4. **popup.js** displays results and handles export

## Extracted Fields

Each listing includes:
- `id` - Property ID
- `title` - Property title
- `price` - Price
- `location` - Address/location
- `rooms` - Number of rooms
- `area` - Square meters
- `url` - Detail page URL
- `image` - Main image URL
- `extractedAt` - ISO timestamp
- `source` - "chrome-extension"
- `pageUrl` - Search page URL

## Advanced: Automated Extraction

### Option 1: Auto-extract on Page Load

Edit `background.js`:

```javascript
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' &&
      tab.url.includes('immobilienscout24.de/Suche')) {
    // Auto-extract
    chrome.tabs.sendMessage(tabId, { action: 'extractListings' }, (response) => {
      // Auto-send to API
      sendToApi(response.listings);
    });
  }
});
```

### Option 2: Periodic Extraction

```javascript
// Extract every 5 minutes while on search page
setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url.includes('immobilienscout24.de/Suche')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractListings' }, sendToApi);
    }
  });
}, 5 * 60 * 1000);
```

### Option 3: Pagination Support

Add to `content.js`:

```javascript
async function extractAllPages() {
  let allListings = [];
  let currentPage = 1;
  const maxPages = 25;

  while (currentPage <= maxPages) {
    // Extract current page
    const listings = extractListings();
    allListings.push(...listings);

    // Find next button
    const nextButton = document.querySelector('[data-qa="page-next"], .next-page');
    if (!nextButton || nextButton.disabled) break;

    // Click next
    nextButton.click();
    await new Promise(r => setTimeout(r, 2000)); // Wait for load

    currentPage++;
  }

  return allListings;
}
```

## Production Deployment

### Option 1: Manual Operation

1. User runs Chrome with extension
2. Navigates to search pages
3. Clicks extract periodically
4. Data sent to API

**Use case**: Testing, low-volume scraping, manual QA

### Option 2: Scheduled Browser Sessions

```bash
# Cron job opens Chrome with extension
*/30 * * * * /usr/bin/google-chrome --load-extension=./chrome-extension "https://www.immobilienscout24.de/Suche/..."
```

**Use case**: Scheduled scraping with manual oversight

### Option 3: CDP + Extension

1. Start Chrome with extension loaded AND CDP enabled:
   ```bash
   google-chrome \
     --remote-debugging-port=9222 \
     --load-extension=./chrome-extension \
     --user-data-dir=/tmp/chrome
   ```

2. Connect Puppeteer to trigger extension:
   ```javascript
   const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
   // Navigate, wait, then extension auto-extracts
   ```

**Use case**: Automated pipeline with real browser session

## Advantages vs Other Approaches

| Approach | Detection Risk | Setup Time | Maintenance | Session |
|----------|---------------|------------|-------------|---------|
| **Chrome Extension** | ✅ **None** | 2 min | Low | User's real session |
| Puppeteer + Cookies | ❌ High | 30 min | Daily cookie refresh | Emulated |
| Puppeteer + CDP | ⚠️ Low | 10 min | Keep browser alive | Real but linked |
| Cloudflare Bypass | ⚠️ Medium | 2-3 hrs | Low | Simulated |

## Troubleshooting

### No listings found

**Check**:
1. Are you on a search results page?
2. Did listings load? (Wait a few seconds)
3. Open DevTools Console - any errors?

**Fix**: Adjust selectors in `content.js` if page structure changed

### Extension not appearing

**Check**:
1. Go to `chrome://extensions/`
2. Is it loaded and enabled?
3. Any errors shown?

**Fix**: Check manifest.json syntax

### Can't send to API

**Check**:
1. Is ingest API running? (`curl http://localhost:3009/api/v1/health`)
2. Is URL correct in `popup.js`?
3. CORS enabled on API?

**Fix**: Add CORS headers to ingest API or use extension as proxy

## Next Steps

1. ✅ Test extraction on a few pages
2. ✅ Verify JSON export works
3. ✅ Test API integration
4. Consider adding:
   - Detail page scraping
   - Auto-pagination
   - Scheduled extraction
   - Data validation
   - Error reporting

## Summary

The Chrome extension approach is the **simplest and most reliable** way to scrape immobilienscout24.de:

- **2 minutes** to install
- **Zero** automation detection
- **Real** browser session
- **Easy** to debug and maintain

Perfect for:
- Testing and development
- Manual data collection
- Low to medium volume scraping
- When automation detection is a blocker

For high-volume production, combine with CDP mode or cloudflare-bypass service.
