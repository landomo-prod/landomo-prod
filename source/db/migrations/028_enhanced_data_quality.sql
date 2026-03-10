-- Migration 028: Enhanced data quality monitoring
-- Adds tables for duplicate reports, price outliers, field completion rates,
-- scraper staleness alerts, and data cleansing logs.

-- 1. Duplicate detection summary per snapshot
CREATE TABLE IF NOT EXISTS data_quality_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  portal VARCHAR(100) NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  cross_portal_duplicate_count INTEGER NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dq_duplicates_snapshot ON data_quality_duplicates(snapshot_id);

-- 2. Price outlier snapshots
CREATE TABLE IF NOT EXISTS data_quality_price_outliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  portal VARCHAR(100) NOT NULL,
  property_category VARCHAR(20) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  mean_price NUMERIC NOT NULL,
  stddev_price NUMERIC NOT NULL,
  outlier_count INTEGER NOT NULL DEFAULT 0,
  outlier_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dq_price_outliers_snapshot ON data_quality_price_outliers(snapshot_id);

-- 3. Field completion rates per portal/category
CREATE TABLE IF NOT EXISTS data_quality_field_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  portal VARCHAR(100) NOT NULL,
  property_category VARCHAR(20) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  filled_count INTEGER NOT NULL DEFAULT 0,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dq_field_completion_snapshot ON data_quality_field_completion(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_dq_field_completion_portal ON data_quality_field_completion(portal, property_category);

-- 4. Scraper staleness alerts
CREATE TABLE IF NOT EXISTS data_quality_scraper_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,  -- 'scraper_stale', 'quality_drop', 'high_outliers'
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dq_alerts_portal ON data_quality_scraper_alerts(portal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_alerts_unresolved ON data_quality_scraper_alerts(resolved_at) WHERE resolved_at IS NULL;

-- 5. Data cleansing log
CREATE TABLE IF NOT EXISTS data_quality_cleansing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  portal VARCHAR(100) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  cleansing_rule VARCHAR(100) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dq_cleansing_property ON data_quality_cleansing_log(property_id);
CREATE INDEX IF NOT EXISTS idx_dq_cleansing_applied ON data_quality_cleansing_log(applied_at DESC);

-- Add snapshot_id to existing snapshots table for linking
ALTER TABLE data_quality_snapshots ADD COLUMN IF NOT EXISTS snapshot_group_id UUID;
