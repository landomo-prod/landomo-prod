-- Migration 008: Data quality snapshots table
-- Stores periodic data quality check results per country/portal for monitoring and alerting

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(100) NOT NULL,
  portal VARCHAR(100) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Counts
  total_properties INTEGER NOT NULL DEFAULT 0,
  active_properties INTEGER NOT NULL DEFAULT 0,

  -- Completeness (percentage of active properties missing key fields)
  missing_price_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  missing_coordinates_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  missing_images_pct NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Suspicious data
  suspicious_price_pct NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Freshness
  updated_last_7d_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  oldest_listing_days INTEGER,
  newest_listing_age_hours NUMERIC(8,2),

  -- Overall score (0-100)
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,

  CONSTRAINT data_quality_snapshots_score_range CHECK (quality_score >= 0 AND quality_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_dq_snapshots_country_portal ON data_quality_snapshots(country, portal, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_snapshots_checked_at ON data_quality_snapshots(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_snapshots_quality_score ON data_quality_snapshots(quality_score) WHERE quality_score < 70;
