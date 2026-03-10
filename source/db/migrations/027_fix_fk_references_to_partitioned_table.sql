-- Migration 027: Fix FK references from old properties table to properties_new (partitioned)
--
-- Problem: property_changes, price_history, and listing_status_history have FKs
-- referencing the old "properties" table, but data now lives in "properties_new"
-- (partitioned by property_category). The PK on properties_new is (id, property_category),
-- so a single-column FK on property_id alone cannot reference it directly.
--
-- Solution: Drop the stale FK constraints. The application already handles integrity
-- via try/catch with warn-level logging. These tables are append-only audit logs
-- where referential integrity is nice-to-have, not critical.

BEGIN;

-- Drop FK from property_changes → old properties table
ALTER TABLE property_changes
  DROP CONSTRAINT IF EXISTS property_changes_property_id_fkey;

-- Drop FK from price_history → old properties table
ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_property_id_fkey;

-- Drop FK from listing_status_history → old properties table
ALTER TABLE listing_status_history
  DROP CONSTRAINT IF EXISTS listing_status_history_property_id_fkey;

-- Drop self-referential FK on old properties table (canonical dedup)
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS fk_canonical_property;

-- Drop property_duplicates FKs to old properties table
ALTER TABLE property_duplicates
  DROP CONSTRAINT IF EXISTS property_duplicates_canonical_id_fkey;

ALTER TABLE property_duplicates
  DROP CONSTRAINT IF EXISTS property_duplicates_duplicate_id_fkey;

COMMIT;
