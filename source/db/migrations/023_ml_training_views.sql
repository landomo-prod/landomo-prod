-- ============================================================
-- Migration 023: ML Training Feature Materialized Views
--
-- Creates materialized views that pre-compute training features
-- for the ML pricing service. One view per property category.
--
-- Refresh Strategy: Weekly via BullMQ scheduled job (Sunday 2 AM)
--
-- Date: 2026-02-14
-- ============================================================

BEGIN;

-- ============================================================
-- Apartment training features
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_training_features_apartment AS
SELECT
  id,
  price,
  currency,
  transaction_type,
  city,
  region,
  country,
  latitude,
  longitude,
  status,
  created_at,
  first_seen_at,
  last_seen_at,
  published_date,
  -- Category-specific Tier I fields
  apt_bedrooms AS bedrooms,
  apt_bathrooms AS bathrooms,
  apt_sqm AS sqm,
  apt_floor AS floor,
  apt_total_floors AS total_floors,
  apt_rooms AS rooms,
  apt_has_elevator AS has_elevator,
  apt_has_balcony AS has_balcony,
  apt_has_parking AS has_parking,
  apt_has_basement AS has_basement,
  apt_has_terrace AS has_terrace,
  apt_has_garage AS has_garage,
  apt_has_loggia AS has_loggia,
  apt_year_built AS year_built,
  apt_construction_type AS construction_type,
  apt_condition AS condition,
  apt_heating_type AS heating_type,
  apt_energy_class AS energy_class,
  apt_property_subtype AS property_subtype,
  apt_floor_location AS floor_location,
  apt_hoa_fees AS hoa_fees,
  -- Universal fields
  condition AS universal_condition,
  heating_type AS universal_heating_type,
  furnished,
  -- Derived
  CASE WHEN apt_sqm > 0 THEN price / apt_sqm ELSE NULL END AS price_per_sqm,
  EXTRACT(YEAR FROM AGE(NOW(), make_date(COALESCE(apt_year_built, 2000), 1, 1))) AS property_age,
  portal,
  source_url
FROM properties_apartment
WHERE transaction_type = 'sale'
  AND price >= 100000
  AND status IN ('active', 'sold', 'rented')
WITH NO DATA;

-- ============================================================
-- House training features
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_training_features_house AS
SELECT
  id,
  price,
  currency,
  transaction_type,
  city,
  region,
  country,
  latitude,
  longitude,
  status,
  created_at,
  first_seen_at,
  last_seen_at,
  published_date,
  -- Category-specific Tier I fields
  house_bedrooms AS bedrooms,
  house_bathrooms AS bathrooms,
  house_sqm_living AS sqm_living,
  house_sqm_total AS sqm_total,
  house_sqm_plot AS sqm_plot,
  house_stories AS stories,
  house_rooms AS rooms,
  house_has_garden AS has_garden,
  house_garden_area AS garden_area,
  house_has_garage AS has_garage,
  house_garage_count AS garage_count,
  house_has_parking AS has_parking,
  house_has_basement AS has_basement,
  house_has_pool AS has_pool,
  house_has_fireplace AS has_fireplace,
  house_has_terrace AS has_terrace,
  house_has_attic AS has_attic,
  house_has_balcony AS has_balcony,
  house_year_built AS year_built,
  house_renovation_year AS renovation_year,
  house_construction_type AS construction_type,
  house_condition AS condition,
  house_heating_type AS heating_type,
  house_energy_class AS energy_class,
  house_property_subtype AS property_subtype,
  house_hoa_fees AS hoa_fees,
  -- Universal fields
  furnished,
  -- Derived
  CASE WHEN house_sqm_living > 0 THEN price / house_sqm_living ELSE NULL END AS price_per_sqm_living,
  CASE WHEN house_sqm_plot > 0 THEN price / house_sqm_plot ELSE NULL END AS price_per_sqm_plot,
  EXTRACT(YEAR FROM AGE(NOW(), make_date(COALESCE(house_year_built, 2000), 1, 1))) AS property_age,
  portal,
  source_url
FROM properties_house
WHERE transaction_type = 'sale'
  AND price >= 100000
  AND status IN ('active', 'sold', 'rented')
WITH NO DATA;

-- ============================================================
-- Land training features
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_training_features_land AS
SELECT
  id,
  price,
  currency,
  transaction_type,
  city,
  region,
  country,
  latitude,
  longitude,
  status,
  created_at,
  first_seen_at,
  last_seen_at,
  published_date,
  -- Category-specific Tier I fields
  land_area_plot_sqm AS area_plot_sqm,
  land_property_subtype AS property_subtype,
  land_zoning AS zoning,
  land_land_type AS land_type,
  land_water_supply AS water_supply,
  land_sewage AS sewage,
  land_electricity AS electricity,
  land_gas AS gas,
  land_road_access AS road_access,
  land_building_permit AS building_permit,
  land_max_building_coverage AS max_building_coverage,
  land_terrain AS terrain,
  land_soil_quality AS soil_quality,
  land_ownership_type AS ownership_type,
  -- Derived
  CASE WHEN land_area_plot_sqm > 0 THEN price / land_area_plot_sqm ELSE NULL END AS price_per_sqm,
  portal,
  source_url
FROM properties_land
WHERE transaction_type = 'sale'
  AND price >= 10000
  AND status IN ('active', 'sold', 'rented')
WITH NO DATA;

-- ============================================================
-- Commercial training features
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_training_features_commercial AS
SELECT
  id,
  price,
  currency,
  transaction_type,
  city,
  region,
  country,
  latitude,
  longitude,
  status,
  created_at,
  first_seen_at,
  last_seen_at,
  published_date,
  -- Category-specific Tier I fields
  comm_property_subtype AS property_subtype,
  comm_floor_area AS floor_area,
  comm_total_floors AS total_floors,
  comm_floor_number AS floor_number,
  comm_office_spaces AS office_spaces,
  comm_parking_spaces AS parking_spaces,
  comm_ceiling_height AS ceiling_height,
  comm_has_elevator AS has_elevator,
  comm_has_parking AS has_parking,
  comm_has_loading_bay AS has_loading_bay,
  comm_has_reception AS has_reception,
  comm_has_hvac AS has_hvac,
  comm_has_security_system AS has_security_system,
  comm_year_built AS year_built,
  comm_renovation_year AS renovation_year,
  comm_construction_type AS construction_type,
  comm_condition AS condition,
  comm_heating_type AS heating_type,
  comm_energy_class AS energy_class,
  comm_zoning AS zoning,
  comm_operating_costs AS operating_costs,
  comm_service_charges AS service_charges,
  -- Derived
  CASE WHEN comm_floor_area > 0 THEN price / comm_floor_area ELSE NULL END AS price_per_sqm,
  EXTRACT(YEAR FROM AGE(NOW(), make_date(COALESCE(comm_year_built, 2000), 1, 1))) AS property_age,
  portal,
  source_url
FROM properties_commercial
WHERE transaction_type = 'sale'
  AND price >= 100000
  AND status IN ('active', 'sold', 'rented')
WITH NO DATA;

-- ============================================================
-- Indexes on materialized views
-- ============================================================

-- Apartment view indexes
CREATE INDEX idx_ml_apt_created_at ON ml_training_features_apartment (created_at);
CREATE INDEX idx_ml_apt_status ON ml_training_features_apartment (status);
CREATE INDEX idx_ml_apt_city ON ml_training_features_apartment (city);
CREATE INDEX idx_ml_apt_country ON ml_training_features_apartment (country);
CREATE INDEX idx_ml_apt_transaction ON ml_training_features_apartment (transaction_type);

-- House view indexes
CREATE INDEX idx_ml_house_created_at ON ml_training_features_house (created_at);
CREATE INDEX idx_ml_house_status ON ml_training_features_house (status);
CREATE INDEX idx_ml_house_city ON ml_training_features_house (city);
CREATE INDEX idx_ml_house_country ON ml_training_features_house (country);
CREATE INDEX idx_ml_house_transaction ON ml_training_features_house (transaction_type);

-- Land view indexes
CREATE INDEX idx_ml_land_created_at ON ml_training_features_land (created_at);
CREATE INDEX idx_ml_land_status ON ml_training_features_land (status);
CREATE INDEX idx_ml_land_city ON ml_training_features_land (city);
CREATE INDEX idx_ml_land_country ON ml_training_features_land (country);
CREATE INDEX idx_ml_land_transaction ON ml_training_features_land (transaction_type);

-- Commercial view indexes
CREATE INDEX idx_ml_comm_created_at ON ml_training_features_commercial (created_at);
CREATE INDEX idx_ml_comm_status ON ml_training_features_commercial (status);
CREATE INDEX idx_ml_comm_city ON ml_training_features_commercial (city);
CREATE INDEX idx_ml_comm_country ON ml_training_features_commercial (country);
CREATE INDEX idx_ml_comm_transaction ON ml_training_features_commercial (transaction_type);

-- ============================================================
-- Initial refresh (populate the views)
-- ============================================================
REFRESH MATERIALIZED VIEW ml_training_features_apartment;
REFRESH MATERIALIZED VIEW ml_training_features_house;
REFRESH MATERIALIZED VIEW ml_training_features_land;
REFRESH MATERIALIZED VIEW ml_training_features_commercial;

COMMIT;
