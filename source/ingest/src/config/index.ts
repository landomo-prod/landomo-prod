/**
 * Configuration
 * Enhanced for multi-instance deployment support
 */

import dotenv from 'dotenv';
import pino from 'pino';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Boot-time logger (before the full logger module is available, since it depends on config)
const bootLog = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level(label) { return { level: label }; } },
  base: { service: 'ingest-service', module: 'config' },
});

// Load base .env
dotenv.config();

// Load country-specific .env if INSTANCE_COUNTRY is set
const instanceCountry = process.env.INSTANCE_COUNTRY;
if (instanceCountry) {
  const countryEnvPath = resolve(process.cwd(), `.env.${instanceCountry}`);
  dotenv.config({ path: countryEnvPath, override: true });
}

/**
 * Read a Docker secret from /run/secrets/<name>.
 * Falls back to the given environment variable value if the file does not exist.
 * This allows the same config to work both in Docker (with secrets) and in
 * local development (with plain env vars).
 */
function readSecret(name: string, envFallback?: string): string | undefined {
  const secretPath = `/run/secrets/${name}`;
  try {
    if (existsSync(secretPath)) {
      return readFileSync(secretPath, 'utf-8').trim();
    }
  } catch {
    // Fall through to env var
  }
  return envFallback;
}

export interface ApiKeyEntry {
  key: string;
  version: string;
  expiresAt: Date | null;
}

/**
 * Parse API keys from env var.
 * Supports formats:
 *   "plain_key"          -> { key: "plain_key", version: "v1", expiresAt: null }
 *   "key:v2"             -> { key: "key", version: "v2", expiresAt: null }
 *   "key:v2:2026-12-31"  -> { key: "key", version: "v2", expiresAt: Date }
 */
function parseApiKeys(raw: string): ApiKeyEntry[] {
  return raw
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.trim().split(':');
      if (parts.length >= 3) {
        return {
          key: parts[0],
          version: parts[1],
          expiresAt: new Date(parts.slice(2).join(':')),
        };
      }
      if (parts.length === 2) {
        return { key: parts[0], version: parts[1], expiresAt: null };
      }
      return { key: parts[0], version: 'v1', expiresAt: null };
    });
}

export const config = {
  // Instance identity
  instance: {
    country: process.env.INSTANCE_COUNTRY || process.env.COUNTRY || 'unknown',
    region: process.env.INSTANCE_REGION,
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  // Authentication
  // API_KEYS format: comma-separated, optionally versioned as "key:v1:2026-12-31"
  // Plain keys (no colon) are treated as v1 with no expiry for backwards compatibility
  auth: {
    apiKeys: parseApiKeys(readSecret('api_keys', process.env.API_KEYS) || ''),
    rawApiKeys: (readSecret('api_keys', process.env.API_KEYS) || '').split(',').filter(Boolean),
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'landomo',
    password: readSecret('db_password', process.env.DB_PASSWORD) || '',
    // Auto-generate database name from country if not specified
    database: process.env.DB_NAME ||
              `landomo_${(process.env.INSTANCE_COUNTRY || 'unknown').toLowerCase()}`,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    readReplicaHost: process.env.DB_READ_REPLICA_HOST || process.env.DB_HOST || 'localhost',
    readReplicaPort: parseInt(process.env.DB_READ_REPLICA_PORT || process.env.DB_PORT || '5432', 10),
  },

  // PgBouncer connection pooling (optional, sits between app and PostgreSQL)
  pgbouncer: {
    enabled: process.env.PGBOUNCER_ENABLED === 'true',
    host: process.env.PGBOUNCER_HOST || 'pgbouncer',
    port: parseInt(process.env.PGBOUNCER_PORT || '6432', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: readSecret('redis_password', process.env.REDIS_PASSWORD),
  },

  // Batch processing
  batch: {
    size: parseInt(process.env.BATCH_SIZE || '100', 10),
    timeout: parseInt(process.env.BATCH_TIMEOUT || '10000', 10),
    workers: parseInt(process.env.BATCH_WORKERS || '5', 10),
  },

  // Staleness detection
  staleness: {
    defaultThresholdHours: parseInt(process.env.STALENESS_THRESHOLD_HOURS || '72', 10),
    checkCronPattern: process.env.STALENESS_CRON || '0 */6 * * *',
    batchSize: parseInt(process.env.STALENESS_BATCH_SIZE || '500', 10),
  },

  // Legacy alias for backwards compatibility
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiKeys: parseApiKeys(readSecret('api_keys', process.env.API_KEYS) || '').map((e) => e.key),
};

// Validation
if (config.instance.country === 'unknown') {
  bootLog.warn('INSTANCE_COUNTRY not set - this instance will not know which country it serves');
}

if (config.auth.apiKeys.length === 0) {
  bootLog.warn('No API keys configured - all authenticated requests will be rejected. Set API_KEYS env var');
}

// Warn about keys approaching expiry (within 30 days)
const expiryWarningMs = 30 * 24 * 60 * 60 * 1000;
for (const entry of config.auth.apiKeys) {
  if (entry.expiresAt) {
    const remaining = entry.expiresAt.getTime() - Date.now();
    if (remaining < 0) {
      bootLog.warn({ keyVersion: entry.version, expiresAt: entry.expiresAt.toISOString() }, 'API key has EXPIRED');
    } else if (remaining < expiryWarningMs) {
      const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
      bootLog.warn({ keyVersion: entry.version, expiresAt: entry.expiresAt.toISOString(), daysRemaining: days }, 'API key expiring soon');
    }
  }
}

if (!config.database.password) {
  bootLog.warn('DB_PASSWORD not set (no secret file or env var) - database connection may fail in production');
}

bootLog.info({
  country: config.instance.country,
  database: config.database.database,
  host: config.server.host,
  port: config.server.port,
}, 'Instance configured');
