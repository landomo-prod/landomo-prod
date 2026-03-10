# Chrome CDP Mode - Quick Setup

## What is CDP Mode?

Connect Puppeteer to your **real Chrome browser** with all your actual sessions, cookies, and login state. No automation detection because it's the real Chrome!

## Setup (2 minutes)

### Step 1: Start Chrome with Remote Debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"
```

**Important**: This starts a **new** Chrome instance with a clean profile. If you want your existing profile:

```bash
# macOS - Use your actual profile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
```

### Step 2: Navigate to ImmobilienScout24

In the Chrome window that opened:
1. Go to https://www.immobilienscout24.de
2. Solve any CAPTCHAs or challenges
3. Make sure you see actual listings

### Step 3: Run the Test Script

```bash
cd scrapers/Germany/immobilienscout24-de
npx ts-node test-with-cdp.ts
```

The script will:
- Connect to your real Chrome
- Use your existing session
- Extract listings
- Save cookies for future use

## Advantages

✅ **No automation detection** - It's real Chrome!
✅ **Real session** - All cookies and auth already there
✅ **Solve CAPTCHAs manually** - Just do it in Chrome window
✅ **Keep session alive** - Browser stays open
✅ **Extract cookies** - Save for later use

## Production Use

For production, you can:

1. **Keep Chrome running 24/7**
   - Use a headless server with Xvfb
   - Keep a real Chrome instance alive
   - Scraper connects via CDP

2. **Session pool**
   - Run multiple Chrome instances
   - Rotate between them
   - Each on different CDP port (9222, 9223, etc.)

3. **Combine with cookie extraction**
   - Use CDP to get fresh cookies
   - Use cookies in regular Puppeteer
   - Best of both worlds

## Troubleshooting

**Error: ECONNREFUSED**
- Chrome not started with --remote-debugging-port=9222
- Check if port 9222 is already in use: `lsof -i :9222`

**Error: Browser closed**
- Don't close Chrome while script is running
- Script will disconnect (not close) when done

**Still seeing anti-bot**
- Solve it manually in Chrome window
- Wait a few seconds
- Run script again

## Next Steps

After confirming CDP works:
1. Update V4 scraper to use CDP mode
2. Deploy with Chrome in remote debugging mode
3. Monitor and keep Chrome sessions alive
