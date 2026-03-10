import { Pool, QueryResult } from 'pg';
import { config } from '../config';
import { dbLog } from '../logger';

const countryPools = new Map<string, Pool>();

export function initializeConnections(): void {
  dbLog.info({ count: config.countries.length }, 'Initializing read-only database connections');

  config.countries.forEach((country) => {
    const host = config.database.readReplicaHost || config.database.host;

    const pool = new Pool({
      host,
      port: config.database.port,
      user: config.database.readUser,
      password: config.database.readPassword,
      database: country.database,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      dbLog.error({ err, country: country.code }, 'Database pool error');
    });

    countryPools.set(country.code, pool);
    dbLog.info({ country: country.code, database: country.database, host }, 'Connected to database');
  });
}

export function getCountryPool(countryCode: string): Pool {
  const pool = countryPools.get(countryCode.toLowerCase());
  if (!pool) {
    throw new Error(`No database connection for country: ${countryCode}`);
  }
  return pool;
}

export async function queryCountry(
  countryCode: string,
  sql: string,
  params: unknown[]
): Promise<QueryResult> {
  const pool = getCountryPool(countryCode);
  return pool.query(sql, params);
}

export async function testConnections(): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};

  for (const country of config.countries) {
    try {
      const pool = getCountryPool(country.code);
      await pool.query('SELECT 1');
      status[country.code] = true;
    } catch (error) {
      dbLog.error({ err: error, country: country.code }, 'Connection test failed');
      status[country.code] = false;
    }
  }

  return status;
}

export async function closeAllConnections(): Promise<void> {
  dbLog.info('Closing all database connections');

  const closePromises = Array.from(countryPools.entries()).map(
    async ([country, pool]) => {
      try {
        await pool.end();
        dbLog.info({ country }, 'Closed connection');
      } catch (error) {
        dbLog.error({ err: error, country }, 'Error closing connection');
      }
    }
  );

  await Promise.all(closePromises);
  countryPools.clear();
}

export function getPoolStats(): Record<string, { total: number; idle: number; waiting: number }> {
  const stats: Record<string, { total: number; idle: number; waiting: number }> = {};

  countryPools.forEach((pool, country) => {
    stats[country] = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  });

  return stats;
}
