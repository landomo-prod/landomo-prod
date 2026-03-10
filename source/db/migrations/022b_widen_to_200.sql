-- Migration 022: Aggressively widen all VARCHAR(50) fields to VARCHAR(200)
-- This ensures we don't hit length constraints during ingestion

BEGIN;

-- Widen all VARCHAR(50) fields to VARCHAR(200)
ALTER TABLE properties ALTER COLUMN agent_phone TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN apt_condition TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN apt_construction_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN apt_energy_class TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN apt_heating_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN austrian_ownership TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_condition TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_construction_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_cooling_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_energy_class TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_heating_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_internet_speed TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN comm_zoning TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN condition TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN construction_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN czech_disposition TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN czech_ownership TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN energy_rating TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN furnished TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN german_ownership TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN heating_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN house_condition TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN house_construction_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN house_energy_class TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN house_heating_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN hungarian_ownership TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN italy_cadastral_category TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_electricity TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_gas TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_land_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_ownership_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_property_subtype TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_road_access TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_sewage TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_terrain TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN land_water_supply TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN property_type TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN slovak_ownership TYPE VARCHAR(200);
ALTER TABLE properties ALTER COLUMN status TYPE VARCHAR(200);

COMMIT;
