import fs from 'fs';
import path from 'path';
import { Browser, BrowserContext } from 'playwright';
import { config } from './config';

const COOKIES_FILE = 'fb-cookies.json';

function getCookiesPath(): string {
  return path.join(config.facebook.sessionDir, COOKIES_FILE);
}

export async function loadSession(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: getRandomUserAgent(),
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
  });

  const cookiesPath = getCookiesPath();
  if (fs.existsSync(cookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      await context.addCookies(cookies);
      console.log('[session-manager] Loaded saved cookies');
    } catch (err) {
      console.warn('[session-manager] Failed to load cookies, starting fresh session:', err);
    }
  }

  return context;
}

export async function saveSession(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  const cookiesPath = getCookiesPath();
  fs.mkdirSync(path.dirname(cookiesPath), { recursive: true });
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2), { mode: 0o600 });
  console.log('[session-manager] Saved session cookies');
}

export async function isSessionValid(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const url = page.url();
    // If redirected to login, session is invalid
    if (url.includes('/login') || url.includes('checkpoint')) {
      console.warn('[session-manager] Session expired or checkpoint required');
      return false;
    }
    return true;
  } catch (err) {
    console.error('[session-manager] Session validation failed:', err);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

function getRandomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}
