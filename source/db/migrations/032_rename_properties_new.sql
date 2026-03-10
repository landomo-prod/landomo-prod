-- ============================================================
-- Migration 032: Rename properties_new → properties
-- Adds last_scrape_run_id for run-aware staleness detection
-- ============================================================

-- Rename base partitioned table (partitions auto-update their parent reference)
ALTER TABLE properties_new RENAME TO properties;

-- Add scrape run tracking column for staleness detection
-- Stamped on every UPSERT with the current scrape run ID
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_scrape_run_id UUID;

-- Index for staleness checker to quickly find listings by run
CREATE INDEX IF NOT EXISTS idx_properties_last_scrape_run
  ON properties (portal, last_scrape_run_id)
  WHERE status = 'active';
