-- Migration 037: ingestion_log cleanup — TTL maintenance function + index
--
-- The ingestion_log table grows unbounded. raw_payload (JSONB) accounts for
-- ~685 MB of the 820 MB table. This migration:
--   1. Nulls out raw_payload on rows older than 7 days (keeps audit trail, reclaims space)
--   2. Deletes rows older than 30 days entirely
--   3. Creates a maintenance function to be called by the scheduler
--   4. Adds a partial index on ingested_at for efficient TTL queries
--
-- Run the maintenance function periodically (e.g. daily):
--   SELECT fn_cleanup_ingestion_log();

BEGIN;

-- Index to make TTL scans fast (ingested_at is used for dedup checks too)
CREATE INDEX IF NOT EXISTS idx_ingestion_log_ingested_at
  ON ingestion_log (ingested_at DESC);

-- Cleanup function: null out raw_payload after 7 days, delete after 30 days
CREATE OR REPLACE FUNCTION fn_cleanup_ingestion_log(
  nullify_after_days INT DEFAULT 7,
  delete_after_days  INT DEFAULT 30
)
RETURNS TABLE(nullified_rows BIGINT, deleted_rows BIGINT) AS $$
DECLARE
  _nullified BIGINT;
  _deleted   BIGINT;
BEGIN
  -- Null out raw_payload for rows older than nullify_after_days
  UPDATE ingestion_log
  SET raw_payload = NULL
  WHERE ingested_at < NOW() - (nullify_after_days || ' days')::INTERVAL
    AND raw_payload IS NOT NULL;
  GET DIAGNOSTICS _nullified = ROW_COUNT;

  -- Delete rows older than delete_after_days
  DELETE FROM ingestion_log
  WHERE ingested_at < NOW() - (delete_after_days || ' days')::INTERVAL;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN QUERY SELECT _nullified, _deleted;
END;
$$ LANGUAGE plpgsql;

-- Run an initial cleanup to reclaim the current 685 MB of raw_payload bloat
SELECT fn_cleanup_ingestion_log(7, 30);

COMMIT;
