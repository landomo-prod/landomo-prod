import client, { Registry } from 'prom-client';

export const register = client.register;

// Collect default Node.js metrics (GC, event loop, memory, etc.)
client.collectDefaultMetrics({ register });

// --- Counters ---

export const eventsReceivedTotal = new client.Counter({
  name: 'notification_events_received_total',
  help: 'Total property change events received from Redis stream',
  labelNames: ['country', 'portal', 'event_type'] as const,
});

export const watchdogMatchesTotal = new client.Counter({
  name: 'notification_watchdog_matches_total',
  help: 'Total watchdog matches found during evaluation',
  labelNames: ['country', 'event_type'] as const,
});

export const dispatchedTotal = new client.Counter({
  name: 'notification_dispatched_total',
  help: 'Total notifications dispatched (success or failed)',
  labelNames: ['country', 'channel', 'status'] as const,
});

export const dedupedTotal = new client.Counter({
  name: 'notification_deduped_total',
  help: 'Total notifications suppressed by deduplication',
  labelNames: ['country'] as const,
});

// --- Histograms ---

export const evaluationDuration = new client.Histogram({
  name: 'notification_evaluation_duration_seconds',
  help: 'Time spent evaluating a batch of property changes against watchdogs',
  labelNames: ['country'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const dispatchDuration = new client.Histogram({
  name: 'notification_dispatch_duration_seconds',
  help: 'Time spent dispatching a single notification via a channel',
  labelNames: ['country', 'channel'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// --- Gauges ---

export const watchdogsLoaded = new client.Gauge({
  name: 'notification_watchdogs_loaded',
  help: 'Number of active watchdogs currently loaded in memory',
  labelNames: ['country'] as const,
});

