-- Migration 031: Add JSONB history columns to properties_new
--
-- Replaces the separate price_history and listing_status_history tables
-- with JSONB arrays stored directly on each property row.
--
-- price_history: [{"date": "2025-01-15T10:00:00Z", "price": 5900000}, ...]
-- status_history: [{"status": "active", "from": "2024-12-01T00:00:00Z", "to": "2025-01-31T12:00:00Z"}, ...]
--
-- The old tables (price_history, listing_status_history) are kept but no longer written to.

BEGIN;

ALTER TABLE properties_new
  ADD COLUMN IF NOT EXISTS price_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Indexes to support querying history
CREATE INDEX IF NOT EXISTS idx_apt_price_history  ON properties_apartment  USING GIN (price_history);
CREATE INDEX IF NOT EXISTS idx_apt_status_history ON properties_apartment  USING GIN (status_history);
CREATE INDEX IF NOT EXISTS idx_house_price_history  ON properties_house    USING GIN (price_history);
CREATE INDEX IF NOT EXISTS idx_house_status_history ON properties_house    USING GIN (status_history);
CREATE INDEX IF NOT EXISTS idx_land_price_history  ON properties_land      USING GIN (price_history);
CREATE INDEX IF NOT EXISTS idx_land_status_history ON properties_land      USING GIN (status_history);
CREATE INDEX IF NOT EXISTS idx_comm_price_history  ON properties_commercial USING GIN (price_history);
CREATE INDEX IF NOT EXISTS idx_comm_status_history ON properties_commercial USING GIN (status_history);

COMMIT;
