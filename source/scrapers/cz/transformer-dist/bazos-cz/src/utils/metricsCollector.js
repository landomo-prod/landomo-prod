"use strict";
/**
 * Metrics Collector
 *
 * Tracks LLM extraction performance, costs, and cache efficiency.
 * Stores metrics in PostgreSQL extraction_metrics table for historical analysis.
 *
 * Tracks:
 * - Cache hits/misses (L1 Redis, L2 PostgreSQL)
 * - LLM extraction counts and costs
 * - Validation failures
 * - Total cost vs. cost saved
 *
 * Usage:
 * 1. Call startRun() at beginning of scrape
 * 2. Call recordCacheHit/Miss/Extraction/ValidationFailure during scrape
 * 3. Call saveRun() at end to persist metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
exports.createMetricsCollector = createMetricsCollector;
const pg_1 = require("pg");
class MetricsCollector {
    constructor(connectionString) {
        this.currentMetrics = {};
        this.enabled = false;
        this.extractionDurations = [];
        // Only initialize PostgreSQL connection if provided
        if (connectionString) {
            try {
                this.pool = new pg_1.Pool({
                    connectionString,
                    max: 2, // Small pool for metrics
                    idleTimeoutMillis: 30000,
                    application_name: 'bazos-metrics-collector',
                });
                this.enabled = true;
                console.log('[MetricsCollector] Initialized with database persistence');
            }
            catch (error) {
                console.error('[MetricsCollector] Failed to initialize pool:', error.message);
                console.warn('[MetricsCollector] Metrics will be tracked in memory only');
                this.enabled = false;
            }
        }
        else {
            console.log('[MetricsCollector] In-memory mode (no database persistence)');
            this.enabled = false;
        }
    }
    /**
     * Start a new metrics run
     *
     * @param portal - Portal name (e.g., "bazos")
     * @param totalListings - Total number of listings being processed
     */
    startRun(portal, totalListings = 0) {
        this.currentMetrics = {
            timestamp: new Date(),
            portal,
            total_listings: totalListings,
            cache_hits: 0,
            cache_misses: 0,
            llm_extractions: 0,
            validation_failures: 0,
            total_cost_usd: 0,
            cost_saved_usd: 0,
        };
        this.extractionDurations = [];
        console.log(`[MetricsCollector] Started run for ${portal} (${totalListings} listings)`);
    }
    /**
     * Record a cache hit
     * Each hit saves ~$0.000634 (cost of one DeepSeek-V3.2 extraction)
     */
    recordCacheHit() {
        if (!this.currentMetrics.cache_hits) {
            this.currentMetrics.cache_hits = 0;
        }
        if (!this.currentMetrics.cost_saved_usd) {
            this.currentMetrics.cost_saved_usd = 0;
        }
        this.currentMetrics.cache_hits++;
        this.currentMetrics.cost_saved_usd += 0.000634; // DeepSeek-V3.2 cost per extraction
    }
    /**
     * Record a cache miss
     */
    recordCacheMiss() {
        if (!this.currentMetrics.cache_misses) {
            this.currentMetrics.cache_misses = 0;
        }
        this.currentMetrics.cache_misses++;
    }
    /**
     * Record an LLM extraction
     *
     * @param costUsd - Cost of this extraction (default $0.000634)
     * @param durationMs - Time taken for extraction
     */
    recordExtraction(costUsd = 0.000634, durationMs) {
        if (!this.currentMetrics.llm_extractions) {
            this.currentMetrics.llm_extractions = 0;
        }
        if (!this.currentMetrics.total_cost_usd) {
            this.currentMetrics.total_cost_usd = 0;
        }
        this.currentMetrics.llm_extractions++;
        this.currentMetrics.total_cost_usd += costUsd;
        if (durationMs !== undefined) {
            this.extractionDurations.push(durationMs);
        }
    }
    /**
     * Record a validation failure
     */
    recordValidationFailure() {
        if (!this.currentMetrics.validation_failures) {
            this.currentMetrics.validation_failures = 0;
        }
        this.currentMetrics.validation_failures++;
    }
    /**
     * Update total listings count
     *
     * @param total - Total number of listings
     */
    setTotalListings(total) {
        this.currentMetrics.total_listings = total;
    }
    /**
     * Save current run metrics to database
     *
     * @returns true if saved successfully, false otherwise
     */
    async saveRun() {
        if (!this.enabled || !this.pool) {
            console.warn('[MetricsCollector] Database not available - metrics not persisted');
            return false;
        }
        try {
            // Calculate average extraction duration
            let avgExtractionMs;
            if (this.extractionDurations.length > 0) {
                const sum = this.extractionDurations.reduce((a, b) => a + b, 0);
                avgExtractionMs = Math.round(sum / this.extractionDurations.length);
            }
            await this.pool.query(`INSERT INTO extraction_metrics (
           timestamp,
           portal,
           total_listings,
           cache_hits,
           cache_misses,
           llm_extractions,
           validation_failures,
           total_cost_usd,
           cost_saved_usd,
           avg_extraction_ms
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                this.currentMetrics.timestamp,
                this.currentMetrics.portal,
                this.currentMetrics.total_listings,
                this.currentMetrics.cache_hits || 0,
                this.currentMetrics.cache_misses || 0,
                this.currentMetrics.llm_extractions || 0,
                this.currentMetrics.validation_failures || 0,
                this.currentMetrics.total_cost_usd || 0,
                this.currentMetrics.cost_saved_usd || 0,
                avgExtractionMs,
            ]);
            console.log('[MetricsCollector] Metrics saved to database');
            return true;
        }
        catch (error) {
            console.error('[MetricsCollector] Failed to save metrics:', error.message);
            return false;
        }
    }
    /**
     * Get current run summary
     *
     * @returns Summary of current metrics
     */
    getSummary() {
        const hits = this.currentMetrics.cache_hits || 0;
        const misses = this.currentMetrics.cache_misses || 0;
        const total = hits + misses;
        const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0';
        const totalCost = this.currentMetrics.total_cost_usd || 0;
        const savedCost = this.currentMetrics.cost_saved_usd || 0;
        const netCost = totalCost; // Already accounts for cache savings
        let avgExtractionMs;
        if (this.extractionDurations.length > 0) {
            const sum = this.extractionDurations.reduce((a, b) => a + b, 0);
            avgExtractionMs = Math.round(sum / this.extractionDurations.length);
        }
        return {
            portal: this.currentMetrics.portal || 'unknown',
            total_listings: this.currentMetrics.total_listings || 0,
            cache_hits: hits,
            cache_misses: misses,
            cache_hit_rate: `${hitRate}%`,
            llm_extractions: this.currentMetrics.llm_extractions || 0,
            validation_failures: this.currentMetrics.validation_failures || 0,
            total_cost_usd: `$${totalCost.toFixed(6)}`,
            cost_saved_usd: `$${savedCost.toFixed(6)}`,
            net_cost_usd: `$${netCost.toFixed(6)}`,
            avg_extraction_ms: avgExtractionMs,
        };
    }
    /**
     * Get latest metrics from database for a portal
     *
     * @param portal - Portal name
     * @param limit - Number of recent runs to fetch (default 1)
     * @returns Array of recent metrics
     */
    async getLatestMetrics(portal, limit = 1) {
        if (!this.enabled || !this.pool) {
            return [];
        }
        try {
            const result = await this.pool.query(`SELECT
           timestamp,
           portal,
           total_listings,
           cache_hits,
           cache_misses,
           llm_extractions,
           validation_failures,
           total_cost_usd,
           cost_saved_usd,
           avg_extraction_ms
         FROM extraction_metrics
         WHERE portal = $1
         ORDER BY timestamp DESC
         LIMIT $2`, [portal, limit]);
            return result.rows.map(row => ({
                timestamp: row.timestamp,
                portal: row.portal,
                total_listings: row.total_listings,
                cache_hits: row.cache_hits,
                cache_misses: row.cache_misses,
                llm_extractions: row.llm_extractions,
                validation_failures: row.validation_failures,
                total_cost_usd: parseFloat(row.total_cost_usd),
                cost_saved_usd: parseFloat(row.cost_saved_usd),
                avg_extraction_ms: row.avg_extraction_ms,
            }));
        }
        catch (error) {
            console.error('[MetricsCollector] Failed to fetch latest metrics:', error.message);
            return [];
        }
    }
    /**
     * Get aggregated metrics for a portal over time period
     *
     * @param portal - Portal name
     * @param days - Number of days to aggregate (default 30)
     * @returns Aggregated metrics
     */
    async getAggregatedMetrics(portal, days = 30) {
        if (!this.enabled || !this.pool) {
            return null;
        }
        try {
            const result = await this.pool.query(`SELECT
           COUNT(*) AS total_runs,
           SUM(total_listings) AS total_listings,
           SUM(cache_hits) AS total_cache_hits,
           SUM(cache_misses) AS total_cache_misses,
           SUM(llm_extractions) AS total_extractions,
           SUM(validation_failures) AS total_validation_failures,
           SUM(total_cost_usd) AS total_cost_usd,
           SUM(cost_saved_usd) AS total_saved_usd
         FROM extraction_metrics
         WHERE portal = $1
           AND timestamp > NOW() - INTERVAL '${days} days'`, [portal]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            const totalHits = parseInt(row.total_cache_hits, 10) || 0;
            const totalMisses = parseInt(row.total_cache_misses, 10) || 0;
            const totalRequests = totalHits + totalMisses;
            const avgHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
            return {
                total_runs: parseInt(row.total_runs, 10),
                total_listings: parseInt(row.total_listings, 10),
                total_cache_hits: totalHits,
                total_cache_misses: totalMisses,
                avg_cache_hit_rate: parseFloat(avgHitRate.toFixed(1)),
                total_extractions: parseInt(row.total_extractions, 10) || 0,
                total_validation_failures: parseInt(row.total_validation_failures, 10) || 0,
                total_cost_usd: parseFloat(row.total_cost_usd) || 0,
                total_saved_usd: parseFloat(row.total_saved_usd) || 0,
            };
        }
        catch (error) {
            console.error('[MetricsCollector] Failed to fetch aggregated metrics:', error.message);
            return null;
        }
    }
    /**
     * Close database connection
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            console.log('[MetricsCollector] Disconnected from database');
        }
    }
}
exports.MetricsCollector = MetricsCollector;
/**
 * Create metrics collector from environment variables
 *
 * @returns MetricsCollector instance
 */
function createMetricsCollector() {
    const connectionString = process.env.DATABASE_URL || buildConnectionString();
    return new MetricsCollector(connectionString);
}
/**
 * Build connection string from individual env vars
 */
function buildConnectionString() {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || '5432';
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;
    if (!host || !user || !password || !database) {
        return undefined; // Missing required connection params
    }
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
