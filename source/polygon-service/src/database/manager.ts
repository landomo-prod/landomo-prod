/**
 * Database Connection Manager
 * Single PostgreSQL/PostGIS database for polygon storage
 */

import { Pool, PoolClient } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

/**
 * Get database connection pool
 */
export function getDatabase(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      max: config.database.maxConnections,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  return pool;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Get client for transaction
 */
export async function getClient(): Promise<PoolClient> {
  const db = getDatabase();
  return db.connect();
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
  const db = getDatabase();

  // Enable PostGIS extension
  await db.query('CREATE EXTENSION IF NOT EXISTS postgis');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  // Check if boundaries table exists
  const tableExists = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'boundaries'
    );
  `);

  if (!tableExists.rows[0].exists) {
    console.log('Boundaries table does not exist. Please run 010_boundaries_schema.sql migration.');
  }
}
