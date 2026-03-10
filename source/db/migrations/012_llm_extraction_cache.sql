-- Migration 012: LLM Extraction Cache & Metrics
-- Purpose: Persistent cache for DeepSeek-V3.2 extractions to avoid duplicate AI calls
-- Supports: Hybrid Redis (L1) + PostgreSQL (L2) cache strategy
-- TTL: Redis 7 days, PostgreSQL 90 days

-- =============================================================================
-- LLM Extraction Cache Table
-- =============================================================================
-- Stores extracted property data from LLM to avoid re-extracting same listings
-- Cache key: (portal, portal_listing_id, content_hash)
-- Content hash: MD5 of normalized listing text (detects listing changes)

CREATE TABLE IF NOT EXISTS llm_extraction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Listing identification
  portal VARCHAR(100) NOT NULL,
  portal_listing_id VARCHAR(255) NOT NULL,
  content_hash VARCHAR(32) NOT NULL,  -- MD5 hash of normalized listing text

  -- Extracted data
  extracted_data JSONB NOT NULL,

  -- Extraction metadata
  extraction_model VARCHAR(100) DEFAULT 'deepseek-v3.2',
  extraction_cost_usd NUMERIC(10, 6) DEFAULT 0.000634,  -- Cost per extraction
  extraction_duration_ms INTEGER,  -- Time taken to extract

  -- Access tracking
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,

  -- Ensure uniqueness per portal/listing/content
  CONSTRAINT unique_cache_entry UNIQUE (portal, portal_listing_id, content_hash)
);

-- Index for fast cache lookups (primary use case)
CREATE INDEX idx_llm_cache_lookup
  ON llm_extraction_cache(portal, portal_listing_id, content_hash);

-- Index for cleanup queries (delete entries older than 90 days)
CREATE INDEX idx_llm_cache_created_at
  ON llm_extraction_cache(created_at);

-- Index for analytics (find most accessed entries)
CREATE INDEX idx_llm_cache_access_count
  ON llm_extraction_cache(access_count DESC)
  WHERE access_count > 5;

COMMENT ON TABLE llm_extraction_cache IS 'Persistent cache for LLM-extracted property data';
COMMENT ON COLUMN llm_extraction_cache.content_hash IS 'MD5 hash of normalized listing text - detects content changes';
COMMENT ON COLUMN llm_extraction_cache.extracted_data IS 'LLMExtractedProperty JSONB - standardized property data from AI extraction';
COMMENT ON COLUMN llm_extraction_cache.access_count IS 'Number of times this cached entry was accessed - indicates cache value';

-- =============================================================================
-- Extraction Metrics Table
-- =============================================================================
-- Tracks LLM extraction performance, costs, and cache efficiency per scrape run

CREATE TABLE IF NOT EXISTS extraction_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Run identification
  timestamp TIMESTAMP NOT NULL,
  portal VARCHAR(100) NOT NULL,

  -- Extraction statistics
  total_listings INTEGER,
  cache_hits INTEGER,
  cache_misses INTEGER,
  llm_extractions INTEGER,
  validation_failures INTEGER,

  -- Cost tracking
  total_cost_usd NUMERIC(10, 6),  -- Total LLM extraction costs
  cost_saved_usd NUMERIC(10, 6),  -- Savings from cache hits

  -- Performance metrics
  avg_extraction_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for portal-specific queries (dashboard per portal)
CREATE INDEX idx_extraction_metrics_portal_timestamp
  ON extraction_metrics(portal, timestamp DESC);

-- Index for recent metrics (last 7 days)
CREATE INDEX idx_extraction_metrics_recent
  ON extraction_metrics(timestamp DESC)
  WHERE timestamp > NOW() - INTERVAL '7 days';

COMMENT ON TABLE extraction_metrics IS 'Tracks LLM extraction performance and costs per scrape run';
COMMENT ON COLUMN extraction_metrics.cache_hits IS 'Number of cached extractions reused (cost savings)';
COMMENT ON COLUMN extraction_metrics.cost_saved_usd IS 'Money saved by using cache instead of LLM calls';

-- =============================================================================
-- Cleanup Function
-- =============================================================================
-- Automatically delete cache entries older than 90 days
-- Run daily via cron or scheduled job

CREATE OR REPLACE FUNCTION cleanup_llm_extraction_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM llm_extraction_cache
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % expired cache entries (>90 days)', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_llm_extraction_cache IS 'Delete cache entries older than 90 days - run daily';

-- =============================================================================
-- Cost Analysis View
-- =============================================================================
-- Aggregated view of cache performance and cost savings

CREATE OR REPLACE VIEW extraction_cache_performance AS
SELECT
  portal,
  DATE_TRUNC('day', timestamp) AS date,
  SUM(total_listings) AS total_listings,
  SUM(cache_hits) AS total_cache_hits,
  SUM(cache_misses) AS total_cache_misses,
  SUM(llm_extractions) AS total_extractions,
  ROUND(
    (SUM(cache_hits)::NUMERIC / NULLIF(SUM(cache_hits) + SUM(cache_misses), 0)) * 100,
    1
  ) AS cache_hit_rate_pct,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(cost_saved_usd) AS total_saved_usd,
  SUM(total_cost_usd) - SUM(cost_saved_usd) AS net_cost_usd
FROM extraction_metrics
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY portal, DATE_TRUNC('day', timestamp)
ORDER BY date DESC, portal;

COMMENT ON VIEW extraction_cache_performance IS 'Daily cache performance and cost analysis (last 30 days)';

-- =============================================================================
-- Example Queries
-- =============================================================================

-- Check cache size and oldest entry
COMMENT ON TABLE llm_extraction_cache IS E'
Example queries:
-- Cache size and age
SELECT
  COUNT(*) AS entries,
  pg_size_pretty(pg_total_relation_size(''llm_extraction_cache'')) AS size,
  MIN(created_at) AS oldest_entry,
  MAX(created_at) AS newest_entry
FROM llm_extraction_cache;

-- Most valuable cache entries (highest access count)
SELECT
  portal,
  portal_listing_id,
  access_count,
  created_at,
  last_accessed_at,
  AGE(NOW(), created_at) AS cache_age
FROM llm_extraction_cache
ORDER BY access_count DESC
LIMIT 20;

-- Cache hit rate by portal (last 7 days)
SELECT
  portal,
  SUM(cache_hits) AS hits,
  SUM(cache_misses) AS misses,
  ROUND((SUM(cache_hits)::NUMERIC / NULLIF(SUM(cache_hits) + SUM(cache_misses), 0)) * 100, 1) AS hit_rate_pct,
  SUM(cost_saved_usd) AS total_saved
FROM extraction_metrics
WHERE timestamp > NOW() - INTERVAL ''7 days''
GROUP BY portal
ORDER BY hit_rate_pct DESC;

-- Cost trends (last 30 days)
SELECT * FROM extraction_cache_performance
WHERE portal = ''bazos''
ORDER BY date DESC;
';

-- =============================================================================
-- Verification
-- =============================================================================

-- Verify tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_extraction_cache') THEN
    RAISE EXCEPTION 'llm_extraction_cache table was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extraction_metrics') THEN
    RAISE EXCEPTION 'extraction_metrics table was not created';
  END IF;

  RAISE NOTICE 'Migration 012 completed successfully';
  RAISE NOTICE '✓ llm_extraction_cache table created';
  RAISE NOTICE '✓ extraction_metrics table created';
  RAISE NOTICE '✓ Indexes created for fast lookups';
  RAISE NOTICE '✓ Cleanup function created';
  RAISE NOTICE '✓ Performance view created';
END;
$$;
