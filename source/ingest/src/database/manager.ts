/**
 * Multi-Database Connection Manager
 * Manages connections to Core DBs (one per country)
 * Enhanced for multi-instance deployment support
 * Supports optional PgBouncer connection pooling proxy
 */

import { Pool } from 'pg';
import { config } from '../config';

const pools: Map<string, Pool> = new Map();
const readPools: Map<string, Pool> = new Map();

/**
 * Normalize country name/code to the canonical short code used in INSTANCE_COUNTRY
 * and database names. Handles full names, underscored variants, and existing codes.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  'czech republic': 'cz',
  'czech_republic': 'cz',
  'czechia': 'cz',
  'czech': 'cz',
  'slovakia': 'sk',
  'slovak republic': 'sk',
  'slovak_republic': 'sk',
  'austria': 'at',
  'germany': 'de',
  'deutschland': 'de',
  'hungary': 'hu',
  'australia': 'au',
  'united kingdom': 'uk',
  'united_kingdom': 'uk',
  'great britain': 'uk',
  'italy': 'it',
  'spain': 'es',
  'france': 'fr',
  'poland': 'pl',
  'netherlands': 'nl',
  'belgium': 'be',
  'switzerland': 'ch',
  'portugal': 'pt',
  'romania': 'ro',
  'bulgaria': 'bg',
  'croatia': 'hr',
  'slovenia': 'si',
  'serbia': 'rs',
  'greece': 'gr',
  'denmark': 'dk',
  'sweden': 'se',
  'norway': 'no',
  'finland': 'fi',
};

function normalizeCountry(country: string): string {
  const lower = country.toLowerCase().trim();
  return COUNTRY_ALIASES[lower] ?? lower;
}

/**
 * Resolve the write database host/port.
 * When PgBouncer is enabled, connections route through the pooler.
 */
function getWriteConnectionParams() {
  if (config.pgbouncer.enabled) {
    return { host: config.pgbouncer.host, port: config.pgbouncer.port };
  }
  return { host: config.database.host, port: config.database.port };
}

/**
 * Get database connection for a specific country
 * In multi-instance mode, validates country matches instance configuration
 */
export function getCoreDatabase(country: string): Pool {
  const normalizedCountry = normalizeCountry(country);
  // Validate country matches instance configuration
  if (config.instance.country !== 'unknown' &&
      normalizedCountry !== config.instance.country.toLowerCase()) {
    throw new Error(
      `Instance configured for "${config.instance.country}" but received request for "${country}"`
    );
  }

  const dbName = `landomo_${normalizedCountry}`;

  if (!pools.has(dbName)) {
    const { host, port } = getWriteConnectionParams();
    const pool = new Pool({
      host,
      port,
      user: config.database.user,
      password: config.database.password,
      database: dbName,
      max: config.database.maxConnections,
    });

    pools.set(dbName, pool);
  }

  return pools.get(dbName)!;
}

/**
 * Get read-replica database connection for a specific country.
 * Falls back to primary when DB_READ_REPLICA_HOST is not set.
 */
export function getReadDatabase(country: string): Pool {
  const normalizedCountry = normalizeCountry(country);
  if (config.instance.country !== 'unknown' &&
      normalizedCountry !== config.instance.country.toLowerCase()) {
    throw new Error(
      `Instance configured for "${config.instance.country}" but received request for "${country}"`
    );
  }

  const dbName = `landomo_${normalizedCountry}`;

  if (!readPools.has(dbName)) {
    readPools.set(dbName, new Pool({
      host: config.database.readReplicaHost,
      port: config.database.readReplicaPort,
      user: config.database.user,
      password: config.database.password,
      database: dbName,
      max: config.database.maxConnections,
    }));
  }

  return readPools.get(dbName)!;
}

/**
 * Get instance country
 */
export function getInstanceCountry(): string {
  return config.instance.country;
}

/**
 * Check if instance is configured for a specific country
 */
export function isInstanceForCountry(country: string): boolean {
  return config.instance.country.toLowerCase() === country.toLowerCase();
}

/**
 * Check PgBouncer health by running a simple query through it.
 * Returns connection info or null if PgBouncer is not enabled.
 */
export async function checkPgBouncerHealth(): Promise<{
  healthy: boolean;
  host: string;
  port: number;
  latencyMs: number;
} | null> {
  if (!config.pgbouncer.enabled) {
    return null;
  }

  const start = Date.now();
  const pool = new Pool({
    host: config.pgbouncer.host,
    port: config.pgbouncer.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query('SELECT 1 AS ok');
    return {
      healthy: result.rows[0]?.ok === 1,
      host: config.pgbouncer.host,
      port: config.pgbouncer.port,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      healthy: false,
      host: config.pgbouncer.host,
      port: config.pgbouncer.port,
      latencyMs: Date.now() - start,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Close all database connections
 */
export async function closeAllDatabases() {
  const closePromises = [
    ...Array.from(pools.values()).map((pool) => pool.end()),
    ...Array.from(readPools.values()).map((pool) => pool.end()),
  ];
  await Promise.all(closePromises);
  pools.clear();
  readPools.clear();
}
