import path from 'path';
import Redis from 'ioredis';
import { Browser, BrowserContext } from 'playwright';
import { config } from './config';
import { MarketingPost, PublishResult } from './types';
import { generatePostText } from './template-engine';
import { loadSession, saveSession, isSessionValid } from './session-manager';

let redis: Redis | null = null;

const HOUR_KEY = 'fb:group-rate:hour';
const DAY_KEY = 'fb:group-rate:day';
const HOUR_WINDOW_MS = 3600_000;
const DAY_WINDOW_MS = 86400_000;

export function initGroupRateLimiter(redisClient: Redis): void {
  redis = redisClient;
}

async function checkGroupRateLimit(): Promise<boolean> {
  if (!redis) throw new Error('Group rate limiter not initialized — call initGroupRateLimiter() first');

  const now = Date.now();
  const hourCutoff = now - HOUR_WINDOW_MS;
  const dayCutoff = now - DAY_WINDOW_MS;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(HOUR_KEY, '-inf', hourCutoff);
  pipeline.zcard(HOUR_KEY);
  pipeline.zremrangebyscore(DAY_KEY, '-inf', dayCutoff);
  pipeline.zcard(DAY_KEY);
  const results = await pipeline.exec();

  const hourCount = (results![1][1] as number) || 0;
  const dayCount = (results![3][1] as number) || 0;

  return (
    hourCount < config.rateLimits.maxGroupPostsPerHour &&
    dayCount < config.rateLimits.maxGroupPostsPerDay
  );
}

async function recordGroupPost(): Promise<void> {
  if (!redis) return;

  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  const pipeline = redis.pipeline();
  pipeline.zadd(HOUR_KEY, now, member);
  pipeline.expire(HOUR_KEY, Math.ceil(HOUR_WINDOW_MS / 1000));
  pipeline.zadd(DAY_KEY, now, member);
  pipeline.expire(DAY_KEY, Math.ceil(DAY_WINDOW_MS / 1000));
  await pipeline.exec();
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function publishToGroup(
  browser: Browser,
  groupId: string,
  post: MarketingPost,
): Promise<PublishResult> {
  if (!(await checkGroupRateLimit())) {
    return { success: false, error: 'Group post rate limit exceeded' };
  }

  let context: BrowserContext | null = null;

  try {
    context = await loadSession(browser);

    if (!(await isSessionValid(context))) {
      await context.close();
      return { success: false, error: 'Facebook session expired. Please update session cookies.' };
    }

    const page = await context.newPage();
    const message = generatePostText(post, post.event_type);

    // Navigate to group
    await page.goto(`https://www.facebook.com/groups/${groupId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Check for login redirect
    if (page.url().includes('/login') || page.url().includes('checkpoint')) {
      await page.close();
      return { success: false, error: 'Session redirected to login' };
    }

    await randomDelay(2000, 4000);

    // Click the compose box (the "Write something..." area)
    const composeSelectors = [
      '[aria-label="Create a public post\u2026"]',
      '[aria-label="Write something\u2026"]',
      '[role="button"][tabindex="0"] span:has-text("Write something")',
      'div[role="button"]:has-text("Write something")',
    ];

    let clicked = false;
    for (const selector of composeSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        clicked = true;
        break;
      } catch {
        // Try next selector
      }
    }

    if (!clicked) {
      const screenshotPath = path.join(config.facebook.screenshotDir, `compose-fail-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      await page.close();
      return { success: false, error: 'Could not find compose box', screenshot_path: screenshotPath };
    }

    await randomDelay(2000, 3000);

    // Type the post text character by character with human-like delays
    const textbox = page.locator('[role="textbox"][contenteditable="true"]').first();
    await textbox.waitFor({ timeout: 10_000 });
    await textbox.click();
    await randomDelay(500, 1000);

    // Type in chunks for more natural behavior
    const chunks = message.match(/.{1,50}/gs) || [message];
    for (const chunk of chunks) {
      await textbox.type(chunk, { delay: 30 + Math.random() * 20 });
      await randomDelay(200, 500);
    }

    await randomDelay(2000, 4000);

    // Upload photos if available
    if (post.images.length > 0) {
      try {
        // Click the photo/video button
        const photoButton = page.locator('[aria-label="Photo/video"]').first();
        await photoButton.click({ timeout: 5000 });
        await randomDelay(1000, 2000);
      } catch {
        console.warn('[group-publisher] Could not find photo upload button, posting text only');
      }
    }

    // Click the Post button
    await randomDelay(2000, 5000);
    const postButton = page.locator('div[aria-label="Post"][role="button"]').first();
    await postButton.click({ timeout: 10_000 });

    await randomDelay(3000, 5000);

    // Take verification screenshot
    const screenshotPath = path.join(
      config.facebook.screenshotDir,
      `group-${groupId}-${Date.now()}.png`,
    );
    await page.screenshot({ path: screenshotPath });

    await saveSession(context);
    await page.close();

    await recordGroupPost();

    return { success: true, screenshot_path: screenshotPath };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Try to take a debug screenshot
    let screenshotPath: string | undefined;
    if (context) {
      try {
        const pages = context.pages();
        if (pages.length > 0) {
          screenshotPath = path.join(config.facebook.screenshotDir, `error-${Date.now()}.png`);
          await pages[0].screenshot({ path: screenshotPath });
        }
      } catch {
        // Screenshot failed, ignore
      }
    }

    return { success: false, error: errorMsg, screenshot_path: screenshotPath };
  } finally {
    if (context) {
      await context.close();
    }
  }
}
