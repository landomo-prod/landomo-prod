# Byty.sk Scraper

Real estate scraper for Byty.sk - uses **curl-impersonate** to bypass **Imperva WAF**.

## Overview

- **Portal**: Byty.sk
- **Method**: curl-impersonate + Cheerio (WAF bypass)
- **Port**: 8086
- **Language**: TypeScript
- **Difficulty**: ⭐⭐⭐ Hard (Imperva WAF protected)

## Challenges

- ✅ **Imperva WAF** - Web Application Firewall protection
- ✅ **TSPD Tokens** - Challenge-response mechanism
- ✅ **Rate Limiting** - Aggressive blocking
- ✅ **Cookie Management** - Session validation

## Solution

We use **curl-impersonate** to:
- Emulate Chrome's TLS fingerprint
- Bypass bot detection
- Handle cookies automatically
- Add realistic browser headers

## Installation

### Prerequisites
```bash
# Install curl-impersonate (required!)
# macOS
brew install curl-impersonate

# Ubuntu/Debian
wget https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz
tar -xzf curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz
sudo mv curl-impersonate-chrome /usr/local/bin/
sudo chmod +x /usr/local/bin/curl-impersonate-chrome
```

### Install Dependencies
```bash
cd scrapers/Slovakia/byty-sk
npm install
```

## Configuration

```bash
PORT=8086
INGEST_API_URL=http://localhost:3008
INGEST_API_KEY_BYTY_SK=dev_key_sk_1
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t landomo-scraper-byty-sk .
docker run -p 8086:8086 landomo-scraper-byty-sk
```

## Scraping Strategy

### Categories
- Apartments (byty) - Sale & Rent
- Houses (domy) - Sale
- Land (pozemky) - Sale

### Rate Limiting
- **Between pages**: 3-6 seconds
- **Between categories**: 5 seconds
- **Max pages**: 5 per category
- **Sequential requests**: No parallel (WAF will block)

### WAF Bypass Headers
```
User-Agent: Chrome 120
Accept: text/html,application/xhtml+xml...
Accept-Language: sk-SK,sk;q=0.9
Referer: https://www.byty.sk/
sec-ch-ua: "Chromium";v="120"
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
```

## Data Extraction

### HTML Structure
```html
<div class="inzerat" id="i6038173">
  <h2><a href="[url]">[title]</a></h2>
  <div class="price cena"><span class="tlste">[price]</span></div>
  <div class="locationText">[location]</div>
  <ul class="condition-info">
    <li><span>Predaj</span></li>
    <li><span>Byty</span></li>
    <li><span>89 m²</span></li>
  </ul>
</div>
```

## Performance

- **Speed**: Slow (WAF limits speed)
- **Memory**: ~100-150 MB
- **Success Rate**: ~85% (WAF may block)
- **Duration**: 15-20 minutes per full scrape

## Troubleshooting

### WAF Blocking (403/429 errors)
```bash
# Increase delays
# Use residential proxies
# Rotate user agents more frequently
```

### curl-impersonate not found
```bash
which curl-impersonate-chrome
# If not found, reinstall curl-impersonate
```

## Legal & Ethics

- ⚠️ Imperva WAF protection means site doesn't want bots
- ⚠️ Verify Byty.sk Terms of Service
- ⚠️ Consider requesting official API access
- ✅ Rate limited to be respectful
- ✅ GDPR compliance required

## Related Documentation

- [Byty.sk Research](../../../research-byty-sk/BYTY_SK_RESEARCH_REPORT.md)
- [Slovak Scrapers Plan](../../../SLOVAK_SCRAPERS_IMPLEMENTATION_PLAN.md)

---

**Status**: ✅ Production Ready (with WAF bypass)
**Difficulty**: ⭐⭐⭐ Hard (hardest Slovak scraper)
**Last Updated**: 2026-02-07
