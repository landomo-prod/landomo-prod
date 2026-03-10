/**
 * Monitoring Dashboard Route
 * GET /api/v1/monitoring/dashboard - Real-time ingestion stats
 */

import { FastifyInstance } from 'fastify';
import { getCoreDatabase } from '../database/manager';
import { config } from '../config';
import { getInternalQueue } from '../queue/internal-queue';
import { workerLog } from '../logger';

interface PortalStats {
  portal: string;
  total_active: number;
  ingested_last_1h: number;
  ingested_last_24h: number;
  last_ingestion_at: string | null;
  freshness_hours: number | null;
}

interface DashboardResponse {
  timestamp: string;
  country: string;
  uptime_seconds: number;
  ingestion: {
    total_active_listings: number;
    ingested_last_1h: number;
    ingested_last_24h: number;
    per_portal: PortalStats[];
  };
  queue: {
    waiting: number;
    active: number;
    completed_24h: number;
    failed_24h: number;
    delayed: number;
    paused: boolean;
  };
  database: {
    total_properties: number;
    by_category: Record<string, number>;
    by_status: Record<string, number>;
    db_size_mb: number | null;
  };
  alerts: AlertStatus[];
}

interface AlertStatus {
  name: string;
  severity: 'warning' | 'critical';
  triggered: boolean;
  message: string;
  value: number | string;
  threshold: number | string;
}

export async function monitoringDashboardRoute(fastify: FastifyInstance) {
  fastify.get('/api/v1/monitoring/dashboard', async (_request, reply) => {
    const country = config.instance.country;
    const db = getCoreDatabase(country);

    try {
      const [ingestionStats, queueStats, dbStats, alerts] = await Promise.all([
        getIngestionStats(db),
        getQueueStats(country),
        getDatabaseStats(db),
        evaluateAlerts(db, country),
      ]);

      const response: DashboardResponse = {
        timestamp: new Date().toISOString(),
        country,
        uptime_seconds: Math.floor(process.uptime()),
        ingestion: ingestionStats,
        queue: queueStats,
        database: dbStats,
        alerts,
      };

      return reply.send(response);
    } catch (err) {
      workerLog.error({ err }, 'Failed to build monitoring dashboard');
      return reply.status(500).send({ error: 'Failed to gather monitoring data' });
    }
  });
}

async function getIngestionStats(db: ReturnType<typeof getCoreDatabase>) {
  const portalQuery = `
    SELECT
      portal,
      COUNT(*) FILTER (WHERE status = 'active') AS total_active,
      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '1 hour') AS ingested_last_1h,
      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS ingested_last_24h,
      MAX(last_seen_at) AS last_ingestion_at,
      EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at))) / 3600 AS freshness_hours
    FROM properties
    GROUP BY portal
    ORDER BY total_active DESC
  `;

  const totalsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS total_active,
      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '1 hour') AS ingested_last_1h,
      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS ingested_last_24h
    FROM properties
  `;

  const [portalResult, totalsResult] = await Promise.all([
    db.query(portalQuery),
    db.query(totalsQuery),
  ]);

  const totals = totalsResult.rows[0] || { total_active: 0, ingested_last_1h: 0, ingested_last_24h: 0 };

  return {
    total_active_listings: parseInt(totals.total_active) || 0,
    ingested_last_1h: parseInt(totals.ingested_last_1h) || 0,
    ingested_last_24h: parseInt(totals.ingested_last_24h) || 0,
    per_portal: portalResult.rows.map((r: Record<string, unknown>) => ({
      portal: r.portal as string,
      total_active: parseInt(r.total_active as string) || 0,
      ingested_last_1h: parseInt(r.ingested_last_1h as string) || 0,
      ingested_last_24h: parseInt(r.ingested_last_24h as string) || 0,
      last_ingestion_at: r.last_ingestion_at ? (r.last_ingestion_at as Date).toISOString() : null,
      freshness_hours: r.freshness_hours ? parseFloat(r.freshness_hours as string) : null,
    })),
  };
}

async function getQueueStats(country: string) {
  try {
    const queue = getInternalQueue();
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return { waiting, active, completed_24h: completed, failed_24h: failed, delayed, paused: isPaused };
  } catch {
    return { waiting: 0, active: 0, completed_24h: 0, failed_24h: 0, delayed: 0, paused: false };
  }
}

async function getDatabaseStats(db: ReturnType<typeof getCoreDatabase>) {
  const statsQuery = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE property_category = 'apartment') AS apartments,
      COUNT(*) FILTER (WHERE property_category = 'house') AS houses,
      COUNT(*) FILTER (WHERE property_category = 'land') AS land,
      COUNT(*) FILTER (WHERE property_category = 'commercial') AS commercial,
      COUNT(*) FILTER (WHERE status = 'active') AS status_active,
      COUNT(*) FILTER (WHERE status = 'removed') AS status_removed,
      COUNT(*) FILTER (WHERE status = 'sold') AS status_sold,
      COUNT(*) FILTER (WHERE status = 'rented') AS status_rented
    FROM properties
  `;

  const sizeQuery = `
    SELECT pg_database_size(current_database()) / (1024 * 1024) AS size_mb
  `;

  const [statsResult, sizeResult] = await Promise.all([
    db.query(statsQuery),
    db.query(sizeQuery).catch(() => ({ rows: [{ size_mb: null }] })),
  ]);

  const s = statsResult.rows[0] || {};

  return {
    total_properties: parseInt(s.total) || 0,
    by_category: {
      apartment: parseInt(s.apartments) || 0,
      house: parseInt(s.houses) || 0,
      land: parseInt(s.land) || 0,
      commercial: parseInt(s.commercial) || 0,
    },
    by_status: {
      active: parseInt(s.status_active) || 0,
      removed: parseInt(s.status_removed) || 0,
      sold: parseInt(s.status_sold) || 0,
      rented: parseInt(s.status_rented) || 0,
    },
    db_size_mb: sizeResult.rows[0]?.size_mb ? parseFloat(sizeResult.rows[0].size_mb) : null,
  };
}

async function evaluateAlerts(db: ReturnType<typeof getCoreDatabase>, country: string): Promise<AlertStatus[]> {
  const alerts: AlertStatus[] = [];

  // Alert: Queue backlog > 1000
  try {
    const queue = getInternalQueue();
    const waiting = await queue.getWaitingCount();
    alerts.push({
      name: 'queue_backlog',
      severity: waiting > 5000 ? 'critical' : 'warning',
      triggered: waiting > 1000,
      message: `Queue has ${waiting} waiting jobs`,
      value: waiting,
      threshold: 1000,
    });

    const failed = await queue.getFailedCount();
    alerts.push({
      name: 'failed_jobs',
      severity: failed > 100 ? 'critical' : 'warning',
      triggered: failed > 10,
      message: `${failed} failed jobs in queue`,
      value: failed,
      threshold: 10,
    });
  } catch {
    // Queue unavailable
  }

  // Alert: Scraper freshness (no data in 24h)
  try {
    const stalePortals = await db.query(`
      SELECT portal, MAX(last_seen_at) AS last_seen
      FROM properties
      WHERE status = 'active'
      GROUP BY portal
      HAVING MAX(last_seen_at) < NOW() - INTERVAL '24 hours'
    `);

    for (const row of stalePortals.rows) {
      const hours = Math.floor(
        (Date.now() - new Date(row.last_seen).getTime()) / (1000 * 60 * 60)
      );
      alerts.push({
        name: `scraper_stale_${row.portal}`,
        severity: hours > 72 ? 'critical' : 'warning',
        triggered: true,
        message: `Portal ${row.portal} has not sent data for ${hours}h`,
        value: hours,
        threshold: 24,
      });
    }
  } catch {
    // DB unavailable
  }

  return alerts;
}
