/**
 * Configuration Manager
 *
 * Loads and validates configuration from environment variables.
 */

import * as dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { configLog } from '../logger';

// Load environment variables
dotenv.config();

/**
 * Read a Docker secret from /run/secrets/<name>.
 * Falls back to the given environment variable value if the file does not exist.
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

export interface Config {
  server: {
    port: number;
    host: string;
    env: string;
  };
  database: {
    host: string;
    port: number;
    readOnlyUser: string;
    readOnlyPassword: string;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  search: {
    defaultLimit: number;
    maxLimit: number;
  };
  cache: {
    ttlSearch: number;
    ttlProperty: number;
    ttlAggregations: number;
    ttlFilters: number;
    invalidationChannel: string;
  };
  geo: {
    defaultRadiusKm: number;
    maxRadiusKm: number;
  };
  countries: {
    supported: string[];
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export const config: Config = {
  server: {
    port: getEnvNumber('PORT', 4000),
    host: getEnvVar('HOST', '0.0.0.0'),
    env: getEnvVar('NODE_ENV', 'development')
  },
  database: {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    readOnlyUser: getEnvVar('DB_READ_USER', 'search_readonly'),
    readOnlyPassword: readSecret('db_read_password', getEnvVar('DB_READ_PASSWORD', '')) || '',
    maxConnections: getEnvNumber('DB_MAX_CONNECTIONS', 10)
  },
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: readSecret('redis_password', process.env.REDIS_PASSWORD) || undefined
  },
  search: {
    defaultLimit: getEnvNumber('DEFAULT_SEARCH_LIMIT', 20),
    maxLimit: getEnvNumber('MAX_SEARCH_LIMIT', 100)
  },
  cache: {
    ttlSearch: getEnvNumber('CACHE_SEARCH_TTL', getEnvNumber('CACHE_TTL_SEARCH', 300)),
    ttlProperty: getEnvNumber('CACHE_DETAIL_TTL', getEnvNumber('CACHE_TTL_PROPERTY', 1800)),
    ttlAggregations: getEnvNumber('CACHE_AGGREGATION_TTL', getEnvNumber('CACHE_TTL_AGGREGATIONS', 3600)),
    ttlFilters: getEnvNumber('CACHE_TTL_FILTERS', 86400),
    invalidationChannel: getEnvVar('CACHE_INVALIDATION_CHANNEL', 'property:updated'),
  },
  geo: {
    defaultRadiusKm: getEnvNumber('DEFAULT_GEO_RADIUS_KM', 10),
    maxRadiusKm: getEnvNumber('MAX_GEO_RADIUS_KM', 100)
  },
  countries: {
    supported: (process.env.SUPPORTED_COUNTRIES || '').split(',').map(s => s.trim()).filter(Boolean)
  }
};

// Validate configuration
export function validateConfig(): void {
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid port number');
  }

  if (config.database.maxConnections < 1) {
    throw new Error('Invalid max connections');
  }

  if (config.search.maxLimit < config.search.defaultLimit) {
    throw new Error('Max limit must be greater than or equal to default limit');
  }

  configLog.info('Configuration validated successfully');
}

// Log configuration (without sensitive data)
export function logConfig(): void {
  configLog.info({
    server: `${config.server.host}:${config.server.port}`,
    env: config.server.env,
    database: `${config.database.host}:${config.database.port}`,
    dbUser: config.database.readOnlyUser,
    redis: `${config.redis.host}:${config.redis.port}`,
    searchLimits: `${config.search.defaultLimit}/${config.search.maxLimit}`,
    geoRadius: `${config.geo.defaultRadiusKm}km (max: ${config.geo.maxRadiusKm}km)`,
  }, 'Configuration loaded');
}
