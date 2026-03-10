-- ============================================================
-- Migration 004: Listing Lifecycle, Status History & Scrape Runs
-- Adds tables for tracking listing status periods, scrape runs,
-- and per-portal staleness thresholds.
-- Date: 2026-02-08
-- ============================================================

-- Track status periods for each listing
CREATE TABLE IF NOT EXISTS listing_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reason VARCHAR(50),  -- 'scraper_ingest', 'staleness_check', 'manual'
  CONSTRAINT valid_lsh_status CHECK (status IN ('active', 'removed', 'sold', 'rented'))
);
CREATE INDEX IF NOT EXISTS idx_lsh_property_id ON listing_status_history(property_id);
CREATE INDEX IF NOT EXISTS idx_lsh_open_periods ON listing_status_history(property_id) WHERE ended_at IS NULL;

-- Track when each portal was last scraped
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',
  CONSTRAINT valid_run_status CHECK (status IN ('running', 'completed', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_portal ON scrape_runs(portal, started_at DESC);

-- Per-portal staleness thresholds (overrides default)
CREATE TABLE IF NOT EXISTS staleness_thresholds (
  portal VARCHAR(100) PRIMARY KEY,
  threshold_hours INTEGER NOT NULL DEFAULT 72,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for staleness query on properties
CREATE INDEX IF NOT EXISTS idx_properties_stale
  ON properties(last_seen_at) WHERE status = 'active';

-- Index for ingestion_log history lookups
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal_listing
  ON ingestion_log(portal, portal_listing_id, ingested_at DESC);

-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004: Listing lifecycle tables created successfully';
END $$;
