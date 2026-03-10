import { randomUUID } from 'crypto';
import cron from 'node-cron';
import axios from 'axios';
import { retryWithBackoff, DEFAULT_RETRY_OPTIONS } from './retry';
import {
  shouldSkip,
  markRunStarted,
  markRunSuccess,
  markRunFailed,
  markRunSkipped,
  getAllStatuses,
  getStatus,
} from './scraper-status';
import { isBackpressured, getQueueDepth, getQueueThreshold, closeRedis } from './queue-monitor';
import { acquireSlot, releaseSlot, getConcurrencyInfo } from './concurrency';
import { cronLog, triggerLog, httpLog } from './logger';

interface ScraperConfig {
  name: string;
  url: string;
  schedule: string; // Cron expression
  enabled: boolean;
  body?: Record<string, any>; // POST body to send (e.g. { maxPages: 10 } for quick scans)
}

const HEALTH_CHECK_TIMEOUT = Number(process.env.HEALTH_CHECK_TIMEOUT) || 5000;
const startedAt = new Date().toISOString();
let shuttingDown = false;
const inFlightTriggers = new Set<string>();

// Configuration for all scrapers across 5 target countries
// URLs use Docker service names; schedules are staggered to avoid thundering herd
const scrapers: ScraperConfig[] = [
  // ========== Czech Republic — Quick scans (near real-time new listing detection) ==========
  {
    name: 'sreality-quick',
    url: process.env.SREALITY_URL || 'http://scraper-sreality:8102/scrape',
    schedule: process.env.SREALITY_QUICK_SCHEDULE || '*/2 * * * *',
    enabled: process.env.SREALITY_ENABLED !== 'false',
    body: { maxPages: 10 },
  },
  {
    name: 'idnes-quick',
    url: process.env.IDNES_REALITY_URL || 'http://scraper-idnes-reality:8105/scrape',
    schedule: process.env.IDNES_QUICK_SCHEDULE || '*/3 * * * *',
    enabled: process.env.IDNES_REALITY_ENABLED !== 'false',
    body: { maxPages: 5 },
  },
  {
    name: 'ceskereality-quick',
    url: process.env.CESKEREALITY_URL || 'http://scraper-ceskereality:8109/scrape',
    schedule: process.env.CESKEREALITY_QUICK_SCHEDULE || '*/5 * * * *',
    enabled: process.env.CESKEREALITY_ENABLED !== 'false',
    body: { maxPages: 5 },
  },

  // ========== Czech Republic — Full crawls (price changes, removals, deep pages) ==========
  {
    name: 'sreality',
    url: process.env.SREALITY_URL || 'http://scraper-sreality:8102/scrape',
    schedule: process.env.SREALITY_SCHEDULE || '0 * * * *',
    enabled: process.env.SREALITY_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'bezrealitky',
    url: process.env.BEZREALITKY_URL || 'http://scraper-bezrealitky:8103/scrape',
    schedule: process.env.BEZREALITKY_SCHEDULE || '10 */3 * * *',
    enabled: process.env.BEZREALITKY_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'reality',
    url: process.env.REALITY_URL || 'http://scraper-reality:8104/scrape',
    schedule: process.env.REALITY_SCHEDULE || '*/3 * * * *',
    enabled: process.env.REALITY_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'idnes-reality',
    url: process.env.IDNES_REALITY_URL || 'http://scraper-idnes-reality:8105/scrape',
    schedule: process.env.IDNES_REALITY_SCHEDULE || '20 * * * *',
    enabled: process.env.IDNES_REALITY_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'realingo',
    url: process.env.REALINGO_URL || 'http://scraper-realingo:8106/scrape',
    schedule: process.env.REALINGO_SCHEDULE || '*/5 * * * *',
    enabled: process.env.REALINGO_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'ulovdomov',
    url: process.env.ULOVDOMOV_URL || 'http://scraper-ulovdomov:8107/scrape',
    schedule: process.env.ULOVDOMOV_SCHEDULE || '*/3 * * * *',
    enabled: process.env.ULOVDOMOV_ENABLED !== 'false',
    body: {},
  },
  {
    name: 'ceskereality',
    url: process.env.CESKEREALITY_URL || 'http://scraper-ceskereality:8109/scrape',
    schedule: process.env.CESKEREALITY_SCHEDULE || '40 * * * *',
    enabled: process.env.CESKEREALITY_ENABLED !== 'false',
    body: {},
  },

  // ========== Germany (5 portals) ==========
  {
    name: 'immobilienscout24-de',
    url: process.env.IMMOBILIENSCOUT24_DE_URL || 'http://scraper-immobilienscout24-de:8092/scrape',
    schedule: process.env.IMMOBILIENSCOUT24_DE_SCHEDULE || '0 */3 * * *',
    enabled: process.env.IMMOBILIENSCOUT24_DE_ENABLED !== 'false'
  },
  {
    name: 'immonet-de',
    url: process.env.IMMONET_DE_URL || 'http://scraper-immonet-de:8093/scrape',
    schedule: process.env.IMMONET_DE_SCHEDULE || '12 */3 * * *',
    enabled: process.env.IMMONET_DE_ENABLED !== 'false'
  },
  {
    name: 'immowelt-de',
    url: process.env.IMMOWELT_DE_URL || 'http://scraper-immowelt-de:8094/scrape',
    schedule: process.env.IMMOWELT_DE_SCHEDULE || '24 */3 * * *',
    enabled: process.env.IMMOWELT_DE_ENABLED !== 'false'
  },
  {
    name: 'kleinanzeigen-de',
    url: process.env.KLEINANZEIGEN_DE_URL || 'http://scraper-kleinanzeigen-de:8095/scrape',
    schedule: process.env.KLEINANZEIGEN_DE_SCHEDULE || '36 */4 * * *',
    enabled: process.env.KLEINANZEIGEN_DE_ENABLED !== 'false'
  },
  {
    name: 'wg-gesucht-de',
    url: process.env.WG_GESUCHT_DE_URL || 'http://scraper-wg-gesucht-de:8096/scrape',
    schedule: process.env.WG_GESUCHT_DE_SCHEDULE || '48 */4 * * *',
    enabled: process.env.WG_GESUCHT_DE_ENABLED !== 'false'
  },

  // ========== Austria (5 portals) ==========
  {
    name: 'willhaben-at',
    url: process.env.WILLHABEN_AT_URL || 'http://scraper-willhaben-at:8097/scrape',
    schedule: process.env.WILLHABEN_AT_SCHEDULE || '5 */3 * * *',
    enabled: process.env.WILLHABEN_AT_ENABLED !== 'false'
  },
  {
    name: 'immobilienscout24-at',
    url: process.env.IMMOBILIENSCOUT24_AT_URL || 'http://scraper-immobilienscout24-at:8098/scrape',
    schedule: process.env.IMMOBILIENSCOUT24_AT_SCHEDULE || '15 */3 * * *',
    enabled: process.env.IMMOBILIENSCOUT24_AT_ENABLED !== 'false'
  },
  {
    name: 'wohnnet-at',
    url: process.env.WOHNNET_AT_URL || 'http://scraper-wohnnet-at:8099/scrape',
    schedule: process.env.WOHNNET_AT_SCHEDULE || '25 */4 * * *',
    enabled: process.env.WOHNNET_AT_ENABLED !== 'false'
  },
  {
    name: 'immowelt-at',
    url: process.env.IMMOWELT_AT_URL || 'http://scraper-immowelt-at:8100/scrape',
    schedule: process.env.IMMOWELT_AT_SCHEDULE || '35 */4 * * *',
    enabled: process.env.IMMOWELT_AT_ENABLED !== 'false'
  },
  {
    name: 'immodirekt-at',
    url: process.env.IMMODIREKT_AT_URL || 'http://scraper-immodirekt-at:8101/scrape',
    schedule: process.env.IMMODIREKT_AT_SCHEDULE || '45 */4 * * *',
    enabled: process.env.IMMODIREKT_AT_ENABLED !== 'false'
  },

  // ========== Slovakia (4 portals) ==========
  {
    name: 'nehnutelnosti-sk',
    url: process.env.NEHNUTELNOSTI_SK_URL || 'http://scraper-nehnutelnosti-sk:8082/scrape',
    schedule: process.env.NEHNUTELNOSTI_SK_SCHEDULE || '2 */3 * * *',
    enabled: process.env.NEHNUTELNOSTI_SK_ENABLED !== 'false'
  },
  {
    name: 'reality-sk',
    url: process.env.REALITY_SK_URL || 'http://scraper-reality-sk:8084/scrape',
    schedule: process.env.REALITY_SK_SCHEDULE || '17 */4 * * *',
    enabled: process.env.REALITY_SK_ENABLED !== 'false'
  },
  {
    name: 'topreality-sk',
    url: process.env.TOPREALITY_SK_URL || 'http://scraper-topreality-sk:8085/scrape',
    schedule: process.env.TOPREALITY_SK_SCHEDULE || '32 */4 * * *',
    enabled: process.env.TOPREALITY_SK_ENABLED !== 'false'
  },
  {
    name: 'byty-sk',
    url: process.env.BYTY_SK_URL || 'http://scraper-byty-sk:8086/scrape',
    schedule: process.env.BYTY_SK_SCHEDULE || '47 */4 * * *',
    enabled: process.env.BYTY_SK_ENABLED !== 'false'
  },

  // ========== Hungary (5 portals) ==========
  {
    name: 'ingatlan-com',
    url: process.env.INGATLAN_COM_URL || 'http://scraper-ingatlan-com:8087/scrape',
    schedule: process.env.INGATLAN_COM_SCHEDULE || '7 */3 * * *',
    enabled: process.env.INGATLAN_COM_ENABLED !== 'false'
  },
  {
    name: 'oc-hu',
    url: process.env.OC_HU_URL || 'http://scraper-oc-hu:8088/scrape',
    schedule: process.env.OC_HU_SCHEDULE || '22 */4 * * *',
    enabled: process.env.OC_HU_ENABLED !== 'false'
  },
  {
    name: 'dh-hu',
    url: process.env.DH_HU_URL || 'http://scraper-dh-hu:8089/scrape',
    schedule: process.env.DH_HU_SCHEDULE || '37 */4 * * *',
    enabled: process.env.DH_HU_ENABLED !== 'false'
  },
  {
    name: 'zenga-hu',
    url: process.env.ZENGA_HU_URL || 'http://scraper-zenga-hu:8090/scrape',
    schedule: process.env.ZENGA_HU_SCHEDULE || '52 */4 * * *',
    enabled: process.env.ZENGA_HU_ENABLED !== 'false'
  },
  {
    name: 'ingatlannet-hu',
    url: process.env.INGATLANNET_HU_URL || 'http://scraper-ingatlannet-hu:8091/scrape',
    schedule: process.env.INGATLANNET_HU_SCHEDULE || '57 */4 * * *',
    enabled: process.env.INGATLANNET_HU_ENABLED !== 'false'
  },
];

/**
 * Derive health URL from scrape URL.
 * e.g. http://scraper-sreality:8102/scrape -> http://scraper-sreality:8102/health
 */
function getHealthUrl(scrapeUrl: string): string {
  const url = new URL(scrapeUrl);
  url.pathname = '/health';
  return url.toString();
}

/**
 * Check if a scraper container is healthy before triggering.
 * Fails open (returns true) if the health check errors out.
 */
async function isScraperHealthy(scraper: ScraperConfig): Promise<boolean> {
  try {
    const healthUrl = getHealthUrl(scraper.url);
    const response = await axios.get(healthUrl, { timeout: HEALTH_CHECK_TIMEOUT });
    return response.status === 200;
  } catch {
    // Fail open: if health check fails, let the trigger attempt proceed
    // (the trigger itself will fail and be retried)
    return true;
  }
}

/**
 * Trigger a single scraper with pre-checks, retry, deduplication, circuit breaker,
 * backpressure awareness, and concurrency limiting.
 */
async function triggerScraper(scraper: ScraperConfig, manual: boolean = false): Promise<void> {
  const trigger = manual ? 'manual' : 'cron';

  // Don't start new triggers during shutdown
  if (shuttingDown) {
    triggerLog.warn({
      scraper: scraper.name,
      trigger,
      event: 'scraper_skipped',
      reason: 'shutdown_in_progress',
    }, `Skipping ${scraper.name}: scheduler is shutting down`);
    return;
  }

  // Check deduplication and circuit breaker
  const skipReason = shouldSkip(scraper.name);
  if (skipReason) {
    triggerLog.warn({
      scraper: scraper.name,
      trigger,
      event: 'scraper_skipped',
      reason: skipReason,
    }, `Skipping ${scraper.name}: ${skipReason}`);
    return;
  }

  // Backpressure check (fail-open if Redis unreachable)
  const bp = await isBackpressured();
  if (bp && bp.backpressured) {
    triggerLog.warn({
      scraper: scraper.name,
      trigger,
      event: 'scraper_skipped',
      reason: 'backpressure',
      queueDepth: bp.depth,
      threshold: getQueueThreshold(),
    }, `Skipping ${scraper.name}: backpressure detected (queue depth ${bp.depth.total} >= ${getQueueThreshold()})`);
    return;
  }

  // Pre-trigger health check
  const healthy = await isScraperHealthy(scraper);
  if (!healthy) {
    triggerLog.warn({
      scraper: scraper.name,
      trigger,
      event: 'scraper_skipped',
      reason: 'unhealthy',
    }, `Skipping ${scraper.name}: scraper unhealthy`);
    return;
  }

  // Wait for a concurrency slot
  await acquireSlot(scraper.name);

  markRunStarted(scraper.name);
  inFlightTriggers.add(scraper.name);

  // Generate a unique correlation ID for this trigger so the entire
  // flow (scheduler -> scraper -> ingest API -> queue -> worker -> DB) can be traced.
  const correlationId = randomUUID();

  triggerLog.info({
    scraper: scraper.name,
    trigger,
    event: 'scraper_trigger_start',
    url: scraper.url,
    correlationId,
  }, `Triggering ${scraper.name}`);

  try {
    const response = await retryWithBackoff(
      () => axios.post(scraper.url, scraper.body || {}, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': correlationId,
        },
      }),
      DEFAULT_RETRY_OPTIONS,
      (attempt, delay, error) => {
        const errMsg = error instanceof Error ? error.message : String(error);
        triggerLog.warn({
          scraper: scraper.name,
          trigger,
          event: 'scraper_retry',
          attempt,
          maxRetries: DEFAULT_RETRY_OPTIONS.maxRetries,
          delayMs: delay,
          error: errMsg,
        }, `Retry attempt ${attempt}/${DEFAULT_RETRY_OPTIONS.maxRetries} for ${scraper.name} in ${delay}ms`);
      }
    );

    markRunSuccess(scraper.name);

    triggerLog.info({
      scraper: scraper.name,
      trigger,
      event: 'scraper_trigger_success',
      correlationId,
      responseStatus: response.data?.status,
    }, `${scraper.name} triggered successfully`);
  } catch (error: unknown) {
    // 409 means a full crawl is already running — not a failure, just skip
    if (error instanceof axios.AxiosError && error.response?.status === 409) {
      markRunSkipped(scraper.name);
      triggerLog.info({
        scraper: scraper.name,
        trigger,
        event: 'scraper_already_running',
        correlationId,
      }, `${scraper.name} already running (409), skipping`);
    } else {
      const errMsg = error instanceof Error ? error.message : String(error);
      markRunFailed(scraper.name, errMsg);

      const updatedStatus = getStatus(scraper.name);

      triggerLog.error({
        scraper: scraper.name,
        trigger,
        event: 'scraper_trigger_failed',
        correlationId,
        error: errMsg,
        consecutiveFailures: updatedStatus.consecutiveFailures,
        circuitBreakerOpen: updatedStatus.circuitBreakerOpen,
        ...(error instanceof axios.AxiosError && error.response ? {
          httpStatus: error.response.status,
          responseData: error.response.data,
        } : {}),
      }, `${scraper.name} trigger failed after retries`);
    }
  } finally {
    releaseSlot(scraper.name);
    inFlightTriggers.delete(scraper.name);
  }
}

cronLog.info({ event: 'scheduler_start' }, 'Centralized Scheduler starting');

// Schedule each scraper
scrapers.forEach(scraper => {
  if (!scraper.enabled) {
    cronLog.info({
      scraper: scraper.name,
      event: 'scraper_disabled',
    }, `${scraper.name}: DISABLED`);
    return;
  }

  cron.schedule(scraper.schedule, () => {
    triggerScraper(scraper);
  });

  cronLog.info({
    scraper: scraper.name,
    event: 'scraper_scheduled',
    url: scraper.url,
    schedule: scraper.schedule,
  }, `Scheduled ${scraper.name}`);
});

cronLog.info({ event: 'scheduler_ready' }, 'Scheduler is running, waiting for scheduled tasks');

// HTTP server for manual triggers, status, and health dashboard
if (process.env.ENABLE_HTTP_TRIGGERS === 'true') {
  const express = require('express');
  const app = express();
  const PORT = process.env.SCHEDULER_PORT || 9000;

  app.use(express.json());

  // Basic health check
  app.get('/health', (_req: any, res: any) => {
    res.json({
      status: 'healthy',
      schedulers: scrapers.filter(s => s.enabled).map(s => ({
        name: s.name,
        schedule: s.schedule,
        enabled: s.enabled
      }))
    });
  });

  // Comprehensive health dashboard
  app.get('/api/v1/scheduler/health', async (_req: any, res: any) => {
    const statuses = getAllStatuses();
    const queueDepth = await getQueueDepth();
    const concurrency = getConcurrencyInfo();

    const uptimeMs = Date.now() - new Date(startedAt).getTime();
    const recentFailures = Object.entries(statuses)
      .filter(([, s]) => s.lastFailure && (Date.now() - new Date(s.lastFailure).getTime()) < 3600000)
      .map(([name, s]) => ({
        scraper: name,
        lastFailure: s.lastFailure,
        consecutiveFailures: s.consecutiveFailures,
        lastError: s.lastError,
      }));

    res.json({
      status: shuttingDown ? 'shutting_down' : 'healthy',
      startedAt,
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      scrapers: scrapers.map(s => ({
        name: s.name,
        enabled: s.enabled,
        schedule: s.schedule,
        status: statuses[s.name] || null,
      })),
      queueDepth,
      queueThreshold: getQueueThreshold(),
      concurrency,
      recentFailures,
      inFlightTriggers: Array.from(inFlightTriggers),
    });
  });

  // Status endpoint showing all scraper statuses with retry/circuit breaker info
  app.get('/api/v1/scheduler/status', (_req: any, res: any) => {
    const statuses = getAllStatuses();
    const scraperList = scrapers.map(s => ({
      name: s.name,
      enabled: s.enabled,
      schedule: s.schedule,
      status: statuses[s.name] || null,
    }));

    const openCircuitBreakers = scraperList.filter(
      s => s.status?.circuitBreakerOpen
    ).length;
    const runningNow = scraperList.filter(
      s => s.status?.runInProgress
    ).length;

    res.json({
      summary: {
        totalScrapers: scrapers.length,
        enabled: scrapers.filter(s => s.enabled).length,
        openCircuitBreakers,
        runningNow,
      },
      retryConfig: {
        maxRetries: DEFAULT_RETRY_OPTIONS.maxRetries,
        initialDelayMs: DEFAULT_RETRY_OPTIONS.initialDelay,
        maxDelayMs: DEFAULT_RETRY_OPTIONS.maxDelay,
        jitter: DEFAULT_RETRY_OPTIONS.jitter,
      },
      scrapers: scraperList,
    });
  });

  app.post('/trigger/:scraper', async (req: any, res: any) => {
    const scraperName = req.params.scraper;
    const scraper = scrapers.find(s => s.name === scraperName);

    if (!scraper) {
      return res.status(404).json({ error: `Scraper ${scraperName} not found` });
    }

    if (!scraper.enabled) {
      return res.status(400).json({ error: `Scraper ${scraperName} is disabled` });
    }

    if (shuttingDown) {
      return res.status(503).json({ error: 'Scheduler is shutting down' });
    }

    httpLog.info({
      scraper: scraper.name,
      event: 'manual_trigger_request',
    }, `Manual trigger requested for ${scraper.name}`);

    const skipReason = shouldSkip(scraper.name);
    if (skipReason) {
      return res.status(409).json({
        error: `Cannot trigger ${scraperName}`,
        reason: skipReason,
        status: getStatus(scraperName),
      });
    }

    // Trigger async -- don't block the HTTP response
    triggerScraper(scraper, true);

    res.json({
      status: 'triggered',
      scraper: scraperName,
      message: 'Scraper trigger initiated with retry support',
    });
  });

  app.listen(PORT, () => {
    httpLog.info({
      event: 'http_server_start',
      port: PORT,
      endpoints: [
        'GET /health',
        'GET /api/v1/scheduler/health',
        'GET /api/v1/scheduler/status',
        'POST /trigger/:scraper',
      ],
    }, `HTTP server listening on port ${PORT}`);
  });
}

// Graceful shutdown: wait for in-flight triggers, then exit
const SHUTDOWN_TIMEOUT_MS = 30000;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  cronLog.info({
    event: 'scheduler_shutdown_start',
    signal,
    inFlight: Array.from(inFlightTriggers),
    inFlightCount: inFlightTriggers.size,
  }, `${signal} received, starting graceful shutdown`);

  if (inFlightTriggers.size > 0) {
    cronLog.info({
      event: 'scheduler_shutdown_waiting',
      scrapers: Array.from(inFlightTriggers),
    }, `Waiting for ${inFlightTriggers.size} in-flight trigger(s) to complete (max ${SHUTDOWN_TIMEOUT_MS}ms)`);

    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    while (inFlightTriggers.size > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (inFlightTriggers.size > 0) {
      cronLog.warn({
        event: 'scheduler_shutdown_timeout',
        remaining: Array.from(inFlightTriggers),
      }, `Shutdown timeout reached with ${inFlightTriggers.size} trigger(s) still in flight`);
    }
  }

  await closeRedis();

  cronLog.info({ event: 'scheduler_shutdown_complete', signal }, 'Scheduler shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
