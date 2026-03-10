-- Migration 021: Aggressively widen all potentially problematic VARCHAR fields
-- This ensures we don't hit length constraints during ingestion

BEGIN;

-- Widen all VARCHAR fields that could potentially contain longer strings
-- Status fields
ALTER TABLE properties ALTER COLUMN status TYPE VARCHAR(50);

-- Property subtype fields (can have long descriptive names)
ALTER TABLE properties ALTER COLUMN house_property_subtype TYPE VARCHAR(100);
ALTER TABLE properties ALTER COLUMN apt_property_subtype TYPE VARCHAR(100);
ALTER TABLE properties ALTER COLUMN comm_property_subtype TYPE VARCHAR(100);

-- Roof type (can have descriptive names)
ALTER TABLE properties ALTER COLUMN house_roof_type TYPE VARCHAR(100);

-- Zoning (can be complex descriptions)
ALTER TABLE properties ALTER COLUMN land_zoning TYPE VARCHAR(100);

-- Infrastructure fields (can have descriptive values)
-- (skip fields that don't exist)

-- Just to be absolutely sure, widen status field in related tables too
ALTER TABLE listing_status_history ALTER COLUMN status TYPE VARCHAR(50);

COMMIT;
