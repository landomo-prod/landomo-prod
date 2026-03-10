/**
 * Configuration for polygon-service
 * Follows ingest-service patterns
 */

import dotenv from 'dotenv';
import pino from 'pino';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

const bootLog = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level(label) { return { level: label }; } },
  base: { service: 'polygon-service', module: 'config' },
});

/**
 * Read Docker secret from /run/secrets/<name>
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

export const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT || '3100', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  // Authentication
  auth: {
    apiKeys: (readSecret('api_keys', process.env.API_KEYS) || '').split(',').filter(Boolean),
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'landomo',
    password: readSecret('db_password', process.env.DB_PASSWORD) || '',
    database: process.env.DB_NAME || 'landomo_geocoding',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },

  // Overpass API
  overpass: {
    apiUrl: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
    timeout: parseInt(process.env.OVERPASS_TIMEOUT || '6000', 10),
    retryDelay: parseInt(process.env.OVERPASS_RETRY_DELAY || '5000', 10),
    maxRetries: parseInt(process.env.OVERPASS_MAX_RETRIES || '3', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validation
if (config.auth.apiKeys.length === 0) {
  bootLog.warn('No API keys configured - all authenticated requests will be rejected. Set API_KEYS env var');
}

if (!config.database.password) {
  bootLog.warn('DB_PASSWORD not set - database connection may fail in production');
} else {
  bootLog.info({ passwordLength: config.database.password.length }, 'DB password loaded');
}

bootLog.info({
  database: config.database.database,
  host: config.server.host,
  port: config.server.port,
  dbHost: config.database.host,
  dbUser: config.database.user,
}, 'Polygon service configured');
