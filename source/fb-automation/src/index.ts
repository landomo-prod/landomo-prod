import express from 'express';
import Redis from 'ioredis';
import { Worker, Queue, DelayedError } from 'bullmq';
import { chromium, Browser } from 'playwright';
import { config } from './config';
import { MarketingJobData } from './types';
import { publishToPage, addComment, editPost, getRateLimitStats, initRateLimiter, PublishToPageResult } from './page-publisher';
import { publishToGroup, initGroupRateLimiter } from './group-publisher';
import { generateContent } from './ai-content-generator';
import { getPageConfig, getAllPageConfigs } from './page-configs';
import { RuleEvaluator } from './rule-evaluator';

async function main() {
  console.log(`[fb-automation] Starting for country=${config.country}`);

  let browser: Browser | null = null;

  const redisConnection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  };

  // Dedicated Redis client for rate limiter (separate from BullMQ connections)
  const rateLimitRedis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });
  initRateLimiter(rateLimitRedis);
  initGroupRateLimiter(rateLimitRedis);

  const queueName = `notify-marketing-${config.country}`;
  const queue = new Queue<MarketingJobData>(queueName, { connection: redisConnection });

  // ── Rule evaluator: reads property:changes stream → enqueues marketing jobs ──
  const ruleEvaluator = new RuleEvaluator(queue);
  await ruleEvaluator.start();

  // ── Worker: processes marketing jobs → publishes to Facebook ──
  const worker = new Worker<MarketingJobData>(
    queueName,
    async (job) => {
      const { post, target_type, target_id } = job.data;
      console.log(`[fb-automation] Processing job ${job.id}: ${target_type} -> ${target_id}`);

      if (target_type === 'page') {
        const pageConfig = getPageConfig(target_id);
        if (!pageConfig) {
          throw new Error(`No page config found for target_id=${target_id}. Add it to page-configs.ts`);
        }

        // Generate AI content
        const content = await generateContent(post);

        console.log(`[fb-automation] Publishing to "${pageConfig.pageName}" (${pageConfig.pageId})`);

        // 1. Publish post with AI-generated text (no link in body)
        const result: PublishToPageResult = await publishToPage(pageConfig, content.postText, post.images);

        // Rate limited → re-delay the job instead of failing
        if (result.rateLimited && result.retryAfterMs) {
          console.log(`[fb-automation] Rate limited for ${pageConfig.pageName}, re-delaying ${result.retryAfterMs}ms`);
          await job.moveToDelayed(Date.now() + result.retryAfterMs, job.token!);
          throw new DelayedError();
        }

        if (!result.success) {
          console.error(`[fb-automation] Page publish failed: ${result.error}`);
          throw new Error(result.error);
        }

        console.log(`[fb-automation] Page post created: ${result.post_id}`);

        // 2. Add comment with property link
        if (result.post_id) {
          const commentResult = await addComment(pageConfig, result.post_id, content.commentText);
          if (commentResult.success) {
            console.log(`[fb-automation] Comment added: ${commentResult.comment_id}`);
          } else {
            // 3. Fallback: edit post to include link directly
            console.warn(`[fb-automation] Comment failed (${commentResult.error}), editing post to include link`);
            const editResult = await editPost(pageConfig, result.post_id, content.fallbackText);
            if (!editResult.success) {
              console.error(`[fb-automation] Edit fallback also failed: ${editResult.error}`);
            }
          }
        }

        return result;
      }

      if (target_type === 'group') {
        const content = await generateContent(post);

        if (!browser) {
          browser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
          });
        }

        // Groups use fallback text (with link embedded) since we can't add comments via Playwright
        const result = await publishToGroup(browser, target_id, post);
        if (!result.success) {
          console.error(`[fb-automation] Group publish failed: ${result.error}`);
          throw new Error(result.error);
        }
        console.log(`[fb-automation] Group post completed, screenshot: ${result.screenshot_path}`);
        return result;
      }

      throw new Error(`Unknown target_type: ${target_type}`);
    },
    {
      connection: redisConnection,
      concurrency: 1,
      removeOnComplete: { count: 10000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError) return; // expected, not a real failure
    console.error(`[fb-automation] Job ${job?.id} failed:`, err.message);
  });

  // ── HTTP server ──
  const app = express();
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const delayed = await queue.getDelayedCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const pages = getAllPageConfigs().map((p) => ({
      id: p.pageId,
      name: p.pageName,
      active: p.isActive,
    }));
    res.json({
      status: 'healthy',
      country: config.country,
      uptime: process.uptime(),
      queue: { waiting, active, delayed, completed, failed },
      rateLimit: await getRateLimitStats(),
      ruleEvaluator: ruleEvaluator.stats,
      browser: browser ? 'running' : 'not started',
      ai: config.ai.endpoint ? 'configured' : 'not configured',
      pages: { count: pages.length, list: pages },
    });
  });

  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`[fb-automation] HTTP server listening on ${config.server.host}:${config.server.port}`);
    console.log(`[fb-automation] ${getAllPageConfigs().filter((p) => p.isActive).length} active pages configured`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[fb-automation] Received ${signal}, shutting down...`);
    await ruleEvaluator.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await worker.close();
    await queue.close();
    await rateLimitRedis.quit();
    if (browser) {
      await browser.close();
    }
    console.log('[fb-automation] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[fb-automation] Fatal error:', err);
  process.exit(1);
});
