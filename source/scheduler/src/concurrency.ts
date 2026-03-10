const MAX_CONCURRENT_SCRAPERS = Number(process.env.MAX_CONCURRENT_SCRAPERS) || 10;
const PER_COUNTRY_LIMIT = Number(process.env.PER_COUNTRY_CONCURRENT_LIMIT) || 3;
const MAX_WAIT_QUEUE = Number(process.env.SCHEDULER_MAX_WAIT_QUEUE) || 50;

/** Map of country suffix to set of currently running scrapers */
const runningByCountry = new Map<string, Set<string>>();
const allRunning = new Set<string>();

/**
 * Extract country from scraper name based on naming convention.
 * e.g., 'immowelt-de' -> 'de', 'nehnutelnosti-sk' -> 'sk'
 * For Czech scrapers without suffix (sreality, bezrealitky, etc.), return 'cz'.
 */
const CZECH_SCRAPERS = new Set([
  'sreality', 'bezrealitky', 'reality', 'idnes-reality', 'realingo', 'ulovdomov'
]);

function getCountry(scraperName: string): string {
  if (CZECH_SCRAPERS.has(scraperName)) return 'cz';
  const parts = scraperName.split('-');
  const suffix = parts[parts.length - 1];
  if (['de', 'at', 'sk', 'hu'].includes(suffix)) return suffix;
  // Fallback: treat as unknown country
  return 'unknown';
}

interface PendingTrigger {
  scraperName: string;
  resolve: () => void;
}

const waitQueue: PendingTrigger[] = [];

function tryRelease(): void {
  while (waitQueue.length > 0 && allRunning.size < MAX_CONCURRENT_SCRAPERS) {
    const next = waitQueue[0];
    const country = getCountry(next.scraperName);
    const countrySet = runningByCountry.get(country);
    const countryCount = countrySet ? countrySet.size : 0;

    if (countryCount < PER_COUNTRY_LIMIT) {
      waitQueue.shift();
      addRunning(next.scraperName);
      next.resolve();
    } else {
      // Try to find one from a different country that can proceed
      let foundIdx = -1;
      for (let i = 1; i < waitQueue.length; i++) {
        const candidate = waitQueue[i];
        const candCountry = getCountry(candidate.scraperName);
        const candSet = runningByCountry.get(candCountry);
        const candCount = candSet ? candSet.size : 0;
        if (candCount < PER_COUNTRY_LIMIT) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx >= 0) {
        const [candidate] = waitQueue.splice(foundIdx, 1);
        addRunning(candidate.scraperName);
        candidate.resolve();
      } else {
        // All waiting scrapers are from countries at their limit
        break;
      }
    }
  }
}

function addRunning(scraperName: string): void {
  allRunning.add(scraperName);
  const country = getCountry(scraperName);
  if (!runningByCountry.has(country)) {
    runningByCountry.set(country, new Set());
  }
  runningByCountry.get(country)!.add(scraperName);
}

/**
 * Acquire a concurrency slot. Resolves immediately if slots are available,
 * otherwise queues and waits.
 */
export function acquireSlot(scraperName: string): Promise<void> {
  const country = getCountry(scraperName);
  const countrySet = runningByCountry.get(country);
  const countryCount = countrySet ? countrySet.size : 0;

  if (allRunning.size < MAX_CONCURRENT_SCRAPERS && countryCount < PER_COUNTRY_LIMIT) {
    addRunning(scraperName);
    return Promise.resolve();
  }

  if (waitQueue.length >= MAX_WAIT_QUEUE) {
    console.warn(`[concurrency] Wait queue full (${waitQueue.length}/${MAX_WAIT_QUEUE}), dropping trigger for ${scraperName}`);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waitQueue.push({ scraperName, resolve });
  });
}

/**
 * Release a concurrency slot and unblock waiting triggers.
 */
export function releaseSlot(scraperName: string): void {
  allRunning.delete(scraperName);
  const country = getCountry(scraperName);
  const countrySet = runningByCountry.get(country);
  if (countrySet) {
    countrySet.delete(scraperName);
    if (countrySet.size === 0) runningByCountry.delete(country);
  }
  tryRelease();
}

export function getConcurrencyInfo(): {
  maxConcurrent: number;
  perCountryLimit: number;
  running: number;
  queued: number;
  byCountry: Record<string, number>;
} {
  const byCountry: Record<string, number> = {};
  for (const [country, set] of runningByCountry) {
    byCountry[country] = set.size;
  }
  return {
    maxConcurrent: MAX_CONCURRENT_SCRAPERS,
    perCountryLimit: PER_COUNTRY_LIMIT,
    running: allRunning.size,
    queued: waitQueue.length,
    byCountry,
  };
}
