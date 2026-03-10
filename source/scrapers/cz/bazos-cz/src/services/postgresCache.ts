/**
 * PostgreSQL Cache Client
 *
 * Persistent L2 cache for LLM extractions using PostgreSQL
 * - 90-day TTL (rows older than 90 days filtered out)
 * - UPSERT on (portal, portal_listing_id, content_hash)
 * - Async operations (never block extraction)
 * - Access stats tracking (last_accessed_at, access_count)
 * - Graceful degradation on failures
 */

import { Pool, PoolClient } from 'pg';
import { LLMExtractedProperty } from '../types/llmExtraction';

export interface PostgresCacheConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
}

export class PostgresCacheClient {
  private pool: Pool;
  private connected: boolean = false;

  constructor(config: PostgresCacheConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 5,
      idleTimeoutMillis: config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: 5000,
      // Graceful error handling
      application_name: 'bazos-llm-cache',
    });

    // Connection event handlers
    this.pool.on('connect', (client: PoolClient) => {
      console.log('[PostgreSQL Cache] Client connected from pool');
      this.connected = true;
    });

    this.pool.on('error', (error: Error, client: PoolClient) => {
      console.error('[PostgreSQL Cache] Pool error:', error.message);
      this.connected = false;
    });

    this.pool.on('remove', (client: PoolClient) => {
      console.log('[PostgreSQL Cache] Client removed from pool');
    });

    // Test connection
    this.testConnection();
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      console.log('[PostgreSQL Cache] Connection test successful');
    } catch (error: any) {
      console.error('[PostgreSQL Cache] Connection test failed:', error.message);
      this.connected = false;
      // Don't throw - graceful degradation
    }
  }

  /**
   * Get cached extraction from PostgreSQL
   *
   * @param portal - Portal name (e.g., "bazos")
   * @param listingId - Portal listing ID
   * @param contentHash - MD5 hash of listing content
   * @returns Cached extraction or null if miss/error
   */
  public async get(
    portal: string,
    listingId: string,
    contentHash: string
  ): Promise<LLMExtractedProperty | null> {
    if (!this.connected) {
      console.warn('[PostgreSQL Cache] Not connected - skipping cache read');
      return null;
    }

    try {
      const result = await this.pool.query(
        `SELECT extracted_data
         FROM llm_extraction_cache
         WHERE portal = $1
           AND portal_listing_id = $2
           AND content_hash = $3
           AND created_at > NOW() - INTERVAL '90 days'
         LIMIT 1`,
        [portal, listingId, contentHash]
      );

      if (result.rows.length === 0) {
        return null; // Cache miss
      }

      const cachedData = result.rows[0].extracted_data;

      // Update access stats asynchronously (don't wait)
      setImmediate(async () => {
        await this.updateAccessStats(portal, listingId, contentHash);
      });

      return cachedData as LLMExtractedProperty;

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Get error:', error.message);
      return null; // Graceful degradation - treat as cache miss
    }
  }

  /**
   * Store extraction in PostgreSQL cache
   *
   * @param portal - Portal name
   * @param listingId - Portal listing ID
   * @param contentHash - MD5 hash of listing content
   * @param extraction - Extraction data to cache
   * @param metadata - Extraction metadata (duration, tokens)
   */
  public async set(
    portal: string,
    listingId: string,
    contentHash: string,
    extraction: LLMExtractedProperty,
    metadata: { durationMs: number; tokensUsed: number }
  ): Promise<void> {
    if (!this.connected) {
      console.warn('[PostgreSQL Cache] Not connected - skipping cache write');
      return;
    }

    try {
      await this.pool.query(
        `INSERT INTO llm_extraction_cache (
           portal,
           portal_listing_id,
           content_hash,
           extracted_data,
           extraction_duration_ms,
           created_at,
           last_accessed_at,
           access_count
         ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)
         ON CONFLICT (portal, portal_listing_id, content_hash) DO UPDATE SET
           extracted_data = EXCLUDED.extracted_data,
           extraction_duration_ms = EXCLUDED.extraction_duration_ms,
           last_accessed_at = NOW(),
           access_count = llm_extraction_cache.access_count + 1`,
        [
          portal,
          listingId,
          contentHash,
          JSON.stringify(extraction),
          metadata.durationMs,
        ]
      );

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Set error:', error.message);
      // Don't throw - caching is optional, async operation
    }
  }

  /**
   * Update access statistics for a cache entry
   *
   * @param portal - Portal name
   * @param listingId - Portal listing ID
   * @param contentHash - Content hash
   */
  private async updateAccessStats(
    portal: string,
    listingId: string,
    contentHash: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE llm_extraction_cache
         SET last_accessed_at = NOW(),
             access_count = access_count + 1
         WHERE portal = $1
           AND portal_listing_id = $2
           AND content_hash = $3`,
        [portal, listingId, contentHash]
      );
    } catch (error: any) {
      console.error('[PostgreSQL Cache] Update access stats error:', error.message);
      // Ignore errors - stats are optional
    }
  }

  /**
   * Check if entry exists in cache
   *
   * @param portal - Portal name
   * @param listingId - Portal listing ID
   * @param contentHash - Content hash
   * @returns true if exists, false otherwise
   */
  public async has(
    portal: string,
    listingId: string,
    contentHash: string
  ): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const result = await this.pool.query(
        `SELECT 1
         FROM llm_extraction_cache
         WHERE portal = $1
           AND portal_listing_id = $2
           AND content_hash = $3
           AND created_at > NOW() - INTERVAL '90 days'
         LIMIT 1`,
        [portal, listingId, contentHash]
      );

      return result.rows.length > 0;

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Has error:', error.message);
      return false;
    }
  }

  /**
   * Delete cache entry
   *
   * @param portal - Portal name
   * @param listingId - Portal listing ID
   * @param contentHash - Content hash
   */
  public async delete(
    portal: string,
    listingId: string,
    contentHash: string
  ): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.pool.query(
        `DELETE FROM llm_extraction_cache
         WHERE portal = $1
           AND portal_listing_id = $2
           AND content_hash = $3`,
        [portal, listingId, contentHash]
      );

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Delete error:', error.message);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats or null if unavailable
   */
  public async getStats(): Promise<{
    totalEntries: number;
    totalSize: string;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    avgAccessCount: number;
  } | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) AS total_entries,
          pg_size_pretty(pg_total_relation_size('llm_extraction_cache')) AS total_size,
          MIN(created_at) AS oldest_entry,
          MAX(created_at) AS newest_entry,
          AVG(access_count) AS avg_access_count
        FROM llm_extraction_cache
      `);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        totalEntries: parseInt(row.total_entries, 10),
        totalSize: row.total_size,
        oldestEntry: row.oldest_entry,
        newestEntry: row.newest_entry,
        avgAccessCount: parseFloat(row.avg_access_count) || 0,
      };

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Stats error:', error.message);
      return null;
    }
  }

  /**
   * Clean up expired cache entries (older than 90 days)
   *
   * @returns Number of entries deleted
   */
  public async cleanup(): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const result = await this.pool.query(`
        DELETE FROM llm_extraction_cache
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        console.log(`[PostgreSQL Cache] Cleaned up ${deletedCount} expired entries`);
      }

      return deletedCount;

    } catch (error: any) {
      console.error('[PostgreSQL Cache] Cleanup error:', error.message);
      return 0;
    }
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  public async clear(): Promise<void> {
    if (!this.connected) {
      console.warn('[PostgreSQL Cache] Not connected - cannot clear cache');
      return;
    }

    try {
      await this.pool.query('TRUNCATE TABLE llm_extraction_cache');
      console.log('[PostgreSQL Cache] Cache cleared');
    } catch (error: any) {
      console.error('[PostgreSQL Cache] Clear error:', error.message);
    }
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close connection pool gracefully
   */
  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.connected = false;
      console.log('[PostgreSQL Cache] Connection pool closed');
    } catch (error: any) {
      console.error('[PostgreSQL Cache] Disconnect error:', error.message);
    }
  }
}

/**
 * Create PostgreSQL cache client from environment variables
 */
export function createPostgresCacheClient(): PostgresCacheClient {
  const connectionString = process.env.DATABASE_URL || buildConnectionString();

  console.log('[PostgreSQL Cache] Initializing cache client...');
  console.log(`  Database: ${extractDatabaseName(connectionString)}`);

  return new PostgresCacheClient({
    connectionString,
    maxConnections: 5,
    idleTimeoutMs: 30000,
  });
}

/**
 * Build connection string from individual env vars
 */
function buildConnectionString(): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || 'landomo';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'landomo_czech'; // Default to Czech database

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Extract database name from connection string for logging
 */
function extractDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return url.pathname.slice(1); // Remove leading slash
  } catch {
    return 'unknown';
  }
}
