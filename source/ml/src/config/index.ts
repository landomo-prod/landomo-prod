import dotenv from 'dotenv';
import pino from 'pino';
import { readFileSync, existsSync } from 'fs';

const bootLog = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level(label) { return { level: label }; } },
  base: { service: 'ml-pricing-service', module: 'config' },
});

dotenv.config();

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

/** Country database configuration */
interface CountryDbConfig {
  code: string;
  database: string;
}

/** Optional per-country DB name overrides: "czech=landomo_cz,uk=landomo_uk" */
function parseDbOverrides(): Map<string, string> {
  const raw = process.env.COUNTRY_DB_OVERRIDES || '';
  const map = new Map<string, string>();
  raw.split(',').filter(Boolean).forEach((entry) => {
    const [code, db] = entry.split('=');
    if (code && db) map.set(code.trim().toLowerCase(), db.trim());
  });
  return map;
}

function parseSupportedCountries(): CountryDbConfig[] {
  const raw = process.env.SUPPORTED_COUNTRIES || 'czech';
  const overrides = parseDbOverrides();
  return raw.split(',').filter(Boolean).map((code) => {
    const trimmed = code.trim().toLowerCase();
    return {
      code: trimmed,
      database: overrides.get(trimmed) ?? `landomo_${trimmed}`,
    };
  });
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3500', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  auth: {
    apiKeys: parseApiKeys(readSecret('api_keys', process.env.API_KEYS) || ''),
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    readUser: process.env.DB_READ_USER || 'ml_pricing_readonly',
    readPassword: readSecret('db_read_password', process.env.DB_READ_PASSWORD) || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    readReplicaHost: process.env.DB_READ_REPLICA_HOST,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: readSecret('redis_password', process.env.REDIS_PASSWORD) || undefined,
  },

  models: {
    storagePath: process.env.MODEL_STORAGE_PATH || '/app/models',
  },

  countries: parseSupportedCountries(),

  python: {
    path: process.env.PYTHON_PATH || 'python3',
  },

  cache: {
    ttlModel: 86400,       // 24h for cached models
    ttlPrediction: 3600,   // 1h for cached predictions
  },
};

if (config.auth.apiKeys.length === 0) {
  bootLog.warn('No API keys configured - all authenticated requests will be rejected');
}

if (config.countries.length === 0) {
  bootLog.warn('No supported countries configured');
}

bootLog.info({
  host: config.server.host,
  port: config.server.port,
  countries: config.countries.map(c => c.code),
  modelStorage: config.models.storagePath,
}, 'ML Pricing Service configured');
