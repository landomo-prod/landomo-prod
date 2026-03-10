-- Migration 035: Terminal status protection trigger
-- Replaces application-level CASE logic in bulk-operations.ts
-- Prevents overwriting 'sold' or 'rented' status with non-terminal values

CREATE OR REPLACE FUNCTION prevent_terminal_status_overwrite()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('sold', 'rented') AND NEW.status NOT IN ('sold', 'rented') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each category partition explicitly
-- (Triggers on partitioned parent tables require per-partition triggers in PostgreSQL)
CREATE TRIGGER terminal_status_guard_apartment
  BEFORE UPDATE ON properties_apartment
  FOR EACH ROW EXECUTE FUNCTION prevent_terminal_status_overwrite();

CREATE TRIGGER terminal_status_guard_house
  BEFORE UPDATE ON properties_house
  FOR EACH ROW EXECUTE FUNCTION prevent_terminal_status_overwrite();

CREATE TRIGGER terminal_status_guard_land
  BEFORE UPDATE ON properties_land
  FOR EACH ROW EXECUTE FUNCTION prevent_terminal_status_overwrite();

CREATE TRIGGER terminal_status_guard_commercial
  BEFORE UPDATE ON properties_commercial
  FOR EACH ROW EXECUTE FUNCTION prevent_terminal_status_overwrite();

CREATE TRIGGER terminal_status_guard_other
  BEFORE UPDATE ON properties_other
  FOR EACH ROW EXECUTE FUNCTION prevent_terminal_status_overwrite();
