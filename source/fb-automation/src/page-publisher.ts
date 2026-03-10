import https from 'https';
import Redis from 'ioredis';
import { config } from './config';
import { PublishResult } from './types';
import { PageConfig } from './page-configs';

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

/**
 * Per-page sliding window rate limiter backed by Redis sorted sets.
 * Each page has a sorted set at key `fb:rate:{pageId}` where scores are timestamps.
 * Survives process restarts.
 */
let redis: Redis | null = null;

/** Set of pageIds we've seen, used to enumerate keys for stats. */
const trackedPages = new Set<string>();

export function initRateLimiter(redisClient: Redis): void {
  redis = redisClient;
  console.log('[page-publisher] Rate limiter initialized with Redis');
}

function getRateLimitKey(pageId: string): string {
  return `fb:rate:${pageId}`;
}

async function checkPageRateLimit(pageId: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const maxPerHour = config.rateLimits.maxPagePostsPerHour;
  const now = Date.now();
  const windowMs = 3600_000;

  if (!redis) {
    throw new Error('Rate limiter not initialized — call initRateLimiter() first');
  }

  const key = getRateLimitKey(pageId);
  trackedPages.add(pageId);

  // Pipeline: trim expired entries + count remaining in one round-trip
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, '-inf', now - windowMs);
  pipeline.zcard(key);
  const results = await pipeline.exec();

  // results: [[err, trimCount], [err, cardCount]]
  const cardErr = results![1][0];
  if (cardErr) throw cardErr;
  const count = results![1][1] as number;

  if (count >= maxPerHour) {
    // Get the oldest entry's score to calculate retry delay
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    if (oldest.length >= 2) {
      const oldestTs = parseInt(oldest[1], 10);
      const retryAfterMs = oldestTs + windowMs - now + 1000; // +1s buffer
      return { allowed: false, retryAfterMs };
    }
    // Fallback: retry after full window
    return { allowed: false, retryAfterMs: windowMs };
  }

  return { allowed: true };
}

async function recordPost(pageId: string): Promise<void> {
  if (!redis) return;
  const key = getRateLimitKey(pageId);
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  const pipeline = redis.pipeline();
  pipeline.zadd(key, now, member);
  pipeline.expire(key, 3700);
  await pipeline.exec();
  trackedPages.add(pageId);
}

/** Get current post counts per page (for health endpoint). */
export async function getRateLimitStats(): Promise<Record<string, { postsInWindow: number; maxPerHour: number }>> {
  const now = Date.now();
  const windowMs = 3600_000;
  const stats: Record<string, { postsInWindow: number; maxPerHour: number }> = {};

  if (!redis) {
    return stats;
  }

  const pipeline = redis.pipeline();
  const pageIds = Array.from(trackedPages);
  for (const pageId of pageIds) {
    const key = getRateLimitKey(pageId);
    pipeline.zremrangebyscore(key, '-inf', now - windowMs);
    pipeline.zcard(key);
  }
  const results = await pipeline.exec();
  if (!results) return stats;

  for (let i = 0; i < pageIds.length; i++) {
    const zcardResult = results[i * 2 + 1];
    stats[pageIds[i]] = {
      postsInWindow: (zcardResult?.[1] as number) || 0,
      maxPerHour: config.rateLimits.maxPagePostsPerHour,
    };
  }
  return stats;
}

function graphApiRequest(path: string, body: Record<string, unknown>): Promise<{ id?: string; success?: boolean; error?: { message: string } }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const url = new URL(`${GRAPH_API_BASE}${path}`);

    const req = https.request(url, {
      method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Facebook API request timed out after 15s'));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function uploadUnpublishedPhoto(page: PageConfig, imageUrl: string): Promise<string | null> {
  const result = await graphApiRequest(`/${page.pageId}/photos`, {
    url: imageUrl,
    published: false,
    access_token: page.accessToken,
  });

  if (result.error) {
    console.error(`[page-publisher] Photo upload failed for ${page.pageName}: ${result.error.message}`);
    return null;
  }
  return result.id || null;
}

export interface PublishToPageResult extends PublishResult {
  rateLimited?: boolean;
  retryAfterMs?: number;
}

export async function publishToPage(
  page: PageConfig,
  message: string,
  images: string[],
): Promise<PublishToPageResult> {
  if (!page.accessToken || !page.pageId) {
    return { success: false, error: `Page ${page.pageId} has no access token` };
  }

  const rateCheck = await checkPageRateLimit(page.pageId);
  if (!rateCheck.allowed) {
    return {
      success: false,
      rateLimited: true,
      retryAfterMs: rateCheck.retryAfterMs,
      error: `Rate limit: ${page.pageName} at ${config.rateLimits.maxPagePostsPerHour} posts/hour`,
    };
  }

  try {
    // Multi-photo post: upload unpublished photos, then create post referencing them
    if (images.length > 0) {
      const photoIds: string[] = [];
      const imagesToUpload = images.slice(0, 10);

      for (const imageUrl of imagesToUpload) {
        const photoId = await uploadUnpublishedPhoto(page, imageUrl);
        if (photoId) {
          photoIds.push(photoId);
        }
      }

      if (photoIds.length > 0) {
        const body: Record<string, unknown> = {
          message,
          access_token: page.accessToken,
        };
        photoIds.forEach((id, i) => {
          body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
        });

        const result = await graphApiRequest(`/${page.pageId}/feed`, body);

        if (result.error) {
          return { success: false, error: result.error.message };
        }

        await recordPost(page.pageId);
        return { success: true, post_id: result.id };
      }
    }

    // Text-only post (fallback if no images or all uploads failed)
    const body: Record<string, unknown> = {
      message,
      access_token: page.accessToken,
    };

    const result = await graphApiRequest(`/${page.pageId}/feed`, body);

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    await recordPost(page.pageId);
    return { success: true, post_id: result.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export async function addComment(
  page: PageConfig,
  postId: string,
  text: string,
): Promise<{ success: boolean; comment_id?: string; error?: string }> {
  try {
    const result = await graphApiRequest(`/${postId}/comments`, {
      message: text,
      access_token: page.accessToken,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, comment_id: result.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export async function editPost(
  page: PageConfig,
  postId: string,
  newText: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await graphApiRequest(`/${postId}`, {
      message: newText,
      access_token: page.accessToken,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
