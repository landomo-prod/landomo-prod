-- ============================================================
-- Migration 013: Category-Partitioned Architecture
--
-- Implements category-specific tables with Tier I columns and Tier II JSONB storage.
-- Replaces property_category nullable approach with dedicated partitioned tables.
--
-- Benefits:
-- - Type safety: Category-specific columns only (no nullable spam)
-- - Query performance: Partition pruning on property_category
-- - Storage efficiency: No NULL columns for irrelevant fields
-- - Maintainability: Clear separation of concerns
--
-- Date: 2026-02-10
-- ============================================================

-- ============================================================
-- STEP 1: Create new partitioned base table
-- ============================================================

CREATE TABLE IF NOT EXISTS properties_new (
  -- ============ Core Identification (non-nullable) ============
  id UUID DEFAULT gen_random_uuid(),
  portal_id VARCHAR(255) NOT NULL,
  portal VARCHAR(100) NOT NULL,

  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CZK',

  -- Category drives partitioning
  property_category VARCHAR(20) NOT NULL CHECK (property_category IN ('apartment', 'house', 'land', 'commercial')),
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('sale', 'rent')),

  -- ============ Location (shared, stored as JSONB) ============
  -- Schema: {city, street, region, postal_code, latitude, longitude, country}
  location JSONB NOT NULL,

  -- Extracted for querying (denormalized from location JSONB)
  city VARCHAR(255),
  region VARCHAR(255),
  country VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  latitude NUMERIC,
  longitude NUMERIC,
  geohash VARCHAR(20),

  -- ============ Status & Lifecycle ============
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ============ Tier I: Apartment Columns (prefix: apt_) ============
  apt_bedrooms INTEGER,
  apt_bathrooms INTEGER,
  apt_sqm NUMERIC,
  apt_floor INTEGER,
  apt_total_floors INTEGER,
  apt_rooms INTEGER,
  apt_has_elevator BOOLEAN,
  apt_has_balcony BOOLEAN,
  apt_balcony_area NUMERIC,
  apt_has_parking BOOLEAN,
  apt_parking_spaces INTEGER,
  apt_has_basement BOOLEAN,
  apt_cellar_area NUMERIC,
  apt_has_loggia BOOLEAN,
  apt_loggia_area NUMERIC,
  apt_has_terrace BOOLEAN,
  apt_terrace_area NUMERIC,
  apt_has_garage BOOLEAN,
  apt_garage_count INTEGER,
  apt_property_subtype VARCHAR(50),
  apt_year_built INTEGER,
  apt_construction_type VARCHAR(50),
  apt_condition VARCHAR(50),
  apt_heating_type VARCHAR(50),
  apt_energy_class VARCHAR(10),
  apt_floor_location VARCHAR(20),
  apt_hoa_fees NUMERIC,
  apt_deposit NUMERIC,
  apt_utility_charges NUMERIC,
  apt_service_charges NUMERIC,
  apt_available_from DATE,
  apt_min_rent_days INTEGER,
  apt_max_rent_days INTEGER,

  -- ============ Tier I: House Columns (prefix: house_) ============
  house_bedrooms INTEGER,
  house_bathrooms INTEGER,
  house_sqm_living NUMERIC,
  house_sqm_total NUMERIC,
  house_sqm_plot NUMERIC,
  house_stories INTEGER,
  house_rooms INTEGER,
  house_has_garden BOOLEAN,
  house_garden_area NUMERIC,
  house_has_garage BOOLEAN,
  house_garage_count INTEGER,
  house_has_parking BOOLEAN,
  house_parking_spaces INTEGER,
  house_has_basement BOOLEAN,
  house_cellar_area NUMERIC,
  house_has_pool BOOLEAN,
  house_has_fireplace BOOLEAN,
  house_has_terrace BOOLEAN,
  house_terrace_area NUMERIC,
  house_has_attic BOOLEAN,
  house_has_balcony BOOLEAN,
  house_balcony_area NUMERIC,
  house_property_subtype VARCHAR(50),
  house_year_built INTEGER,
  house_renovation_year INTEGER,
  house_construction_type VARCHAR(50),
  house_condition VARCHAR(50),
  house_heating_type VARCHAR(50),
  house_roof_type VARCHAR(50),
  house_energy_class VARCHAR(10),
  house_property_tax NUMERIC,
  house_hoa_fees NUMERIC,
  house_deposit NUMERIC,
  house_utility_charges NUMERIC,
  house_service_charges NUMERIC,
  house_available_from DATE,
  house_min_rent_days INTEGER,
  house_max_rent_days INTEGER,

  -- ============ Tier I: Land Columns (prefix: land_) ============
  land_area_plot_sqm NUMERIC,
  land_property_subtype VARCHAR(50),
  land_zoning VARCHAR(50),
  land_land_type VARCHAR(50),
  land_water_supply VARCHAR(50),
  land_sewage VARCHAR(50),
  land_electricity VARCHAR(50),
  land_gas VARCHAR(50),
  land_road_access VARCHAR(50),
  land_building_permit BOOLEAN,
  land_max_building_coverage NUMERIC,
  land_max_building_height NUMERIC,
  land_terrain VARCHAR(50),
  land_soil_quality VARCHAR(20),
  land_cadastral_number VARCHAR(100),
  land_ownership_type VARCHAR(50),
  land_available_from DATE,

  -- Deprecated land utility fields (backward compatibility)
  land_has_water_connection BOOLEAN,
  land_has_electricity_connection BOOLEAN,
  land_has_sewage_connection BOOLEAN,
  land_has_gas_connection BOOLEAN,

  -- ============ Tier I: Commercial Columns (prefix: comm_) ============
  comm_property_subtype VARCHAR(50),
  comm_floor_area NUMERIC,
  comm_total_floors INTEGER,
  comm_floor_number INTEGER,
  comm_office_spaces INTEGER,
  comm_meeting_rooms INTEGER,
  comm_parking_spaces INTEGER,
  comm_loading_docks INTEGER,
  comm_ceiling_height NUMERIC,
  comm_has_elevator BOOLEAN,
  comm_has_parking BOOLEAN,
  comm_has_loading_bay BOOLEAN,
  comm_has_reception BOOLEAN,
  comm_has_kitchen BOOLEAN,
  comm_has_conference_room BOOLEAN,
  comm_has_server_room BOOLEAN,
  comm_has_backup_power BOOLEAN,
  comm_has_security_system BOOLEAN,
  comm_has_hvac BOOLEAN,
  comm_has_fire_safety BOOLEAN,
  comm_zoning VARCHAR(50),
  comm_permitted_use TEXT[],
  comm_max_occupancy INTEGER,
  comm_year_built INTEGER,
  comm_renovation_year INTEGER,
  comm_construction_type VARCHAR(50),
  comm_condition VARCHAR(50),
  comm_heating_type VARCHAR(50),
  comm_cooling_type VARCHAR(50),
  comm_energy_class VARCHAR(10),
  comm_operating_costs NUMERIC,
  comm_service_charges NUMERIC,
  comm_property_tax NUMERIC,
  comm_hoa_fees NUMERIC,
  comm_deposit NUMERIC,
  comm_min_lease_months INTEGER,
  comm_available_from DATE,
  comm_accessibility_features TEXT[],
  comm_internet_speed VARCHAR(50),
  comm_utilities_included BOOLEAN,

  -- ============ Tier II: Country-Specific Data (JSONB) ============
  -- Czech examples: czech_disposition, czech_ownership, building_type, area_usable, cadastral_number
  country_specific JSONB DEFAULT '{}'::jsonb,

  -- ============ Tier III: Portal Metadata (JSONB) ============
  portal_metadata JSONB DEFAULT '{}'::jsonb,
  portal_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  portal_ui_config JSONB DEFAULT '{}'::jsonb,

  -- ============ Media & Agent (shared, stored as JSONB) ============
  -- Media schema: {images: string[], videos: string[], virtual_tour?: string}
  media JSONB,

  -- Agent schema: {name, phone, email, agency, agency_logo}
  agent JSONB,

  -- Additional features array
  features TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Full description
  description TEXT,
  description_language VARCHAR(10),

  -- ============ Portal & Lifecycle ============
  source_url TEXT NOT NULL,
  source_platform TEXT NOT NULL,

  -- Cross-portal deduplication
  canonical_property_id UUID,

  -- Raw data preservation
  raw_data JSONB NOT NULL,

  -- Published date (when listing was published on portal)
  published_date TIMESTAMPTZ,

  -- Energy rating (legacy compatibility)
  energy_rating VARCHAR(10),

  -- Universal amenities (legacy compatibility)
  has_parking BOOLEAN,
  has_garden BOOLEAN,
  has_balcony BOOLEAN,
  has_terrace BOOLEAN,
  has_pool BOOLEAN,
  has_elevator BOOLEAN,
  has_garage BOOLEAN,
  has_basement BOOLEAN,
  has_fireplace BOOLEAN,
  is_furnished BOOLEAN,
  is_new_construction BOOLEAN,
  is_luxury BOOLEAN,

  -- Universal attributes (legacy compatibility)
  condition VARCHAR(50),
  heating_type VARCHAR(50),
  furnished VARCHAR(30),
  construction_type VARCHAR(50),
  renovation_year INTEGER,
  available_from DATE,
  deposit NUMERIC,
  parking_spaces INTEGER,

  -- Financial (legacy compatibility)
  price_per_sqm NUMERIC,
  hoa_fees NUMERIC,
  property_tax NUMERIC,

  -- Legacy fields for backward compatibility
  address TEXT,
  property_type VARCHAR(50),
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqm NUMERIC,
  sqm_type VARCHAR(20),
  floor INTEGER,
  total_floors INTEGER,
  rooms INTEGER,
  year_built INTEGER,
  images JSONB,
  videos JSONB,
  agent_name VARCHAR(255),
  agent_phone VARCHAR(50),
  agent_email VARCHAR(255),
  agent_agency VARCHAR(255),
  agent_agency_logo TEXT,

  -- Country-specific columns (legacy)
  czech_disposition VARCHAR(10),
  czech_ownership VARCHAR(50),
  slovak_disposition VARCHAR(20),
  slovak_ownership VARCHAR(50),
  hungarian_room_count VARCHAR(20),
  hungarian_ownership VARCHAR(50),
  german_ownership VARCHAR(50),
  german_hausgeld NUMERIC,
  german_courtage NUMERIC,
  german_kfw_standard VARCHAR(20),
  german_is_denkmalschutz BOOLEAN DEFAULT FALSE,
  austrian_ownership VARCHAR(50),
  austrian_operating_costs NUMERIC,
  austrian_heating_costs NUMERIC,
  uk_tenure VARCHAR(20),
  uk_council_tax_band VARCHAR(5),
  uk_epc_rating VARCHAR(5),
  uk_leasehold_years_remaining INTEGER,
  usa_lot_size_sqft NUMERIC,
  usa_hoa_name VARCHAR(255),
  usa_mls_number VARCHAR(100),
  usa_property_tax_annual NUMERIC,
  usa_parcel_number VARCHAR(100),
  france_dpe_rating VARCHAR(5),
  france_ges_rating VARCHAR(5),
  france_copropriete BOOLEAN DEFAULT FALSE,
  france_charges_copro NUMERIC,
  spain_ibi_annual NUMERIC,
  spain_community_fees NUMERIC,
  spain_cedula_habitabilidad BOOLEAN DEFAULT FALSE,
  italy_cadastral_category VARCHAR(10),
  italy_cadastral_income NUMERIC,
  australia_land_size_sqm NUMERIC,
  australia_council_rates_annual NUMERIC,

  -- Constraints
  CONSTRAINT valid_status_new CHECK (status IN ('active', 'removed', 'sold', 'rented')),
  CONSTRAINT unique_portal_property_new UNIQUE (portal, portal_id, property_category),
  PRIMARY KEY (id, property_category)

) PARTITION BY LIST (property_category);

-- ============================================================
-- STEP 2: Create partitions
-- ============================================================

CREATE TABLE IF NOT EXISTS properties_apartment PARTITION OF properties_new
  FOR VALUES IN ('apartment');

CREATE TABLE IF NOT EXISTS properties_house PARTITION OF properties_new
  FOR VALUES IN ('house');

CREATE TABLE IF NOT EXISTS properties_land PARTITION OF properties_new
  FOR VALUES IN ('land');

CREATE TABLE IF NOT EXISTS properties_commercial PARTITION OF properties_new
  FOR VALUES IN ('commercial');

-- ============================================================
-- STEP 3: Create indexes on base table (inherited by partitions)
-- ============================================================

-- Common indexes (all categories)
CREATE INDEX IF NOT EXISTS idx_properties_new_portal ON properties_new (portal);
CREATE INDEX IF NOT EXISTS idx_properties_new_status ON properties_new (status);
CREATE INDEX IF NOT EXISTS idx_properties_new_transaction ON properties_new (transaction_type);
CREATE INDEX IF NOT EXISTS idx_properties_new_price ON properties_new (price);
CREATE INDEX IF NOT EXISTS idx_properties_new_city ON properties_new (city);
CREATE INDEX IF NOT EXISTS idx_properties_new_region ON properties_new (region);
CREATE INDEX IF NOT EXISTS idx_properties_new_postal ON properties_new (postal_code);
CREATE INDEX IF NOT EXISTS idx_properties_new_created ON properties_new (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_new_updated ON properties_new (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_new_last_seen ON properties_new (last_seen_at);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_lat_lon ON properties_new (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_new_geohash ON properties_new (geohash)
  WHERE geohash IS NOT NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_location ON properties_new USING GIN (location);
CREATE INDEX IF NOT EXISTS idx_properties_new_country_specific ON properties_new USING GIN (country_specific);
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_metadata ON properties_new USING GIN (portal_metadata);

-- Staleness detection
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_stale ON properties_new (portal, last_seen_at)
  WHERE status = 'active';

-- Search composite
CREATE INDEX IF NOT EXISTS idx_properties_new_search ON properties_new (
  status, property_category, transaction_type, price
) WHERE status = 'active';

-- City-based search
CREATE INDEX IF NOT EXISTS idx_properties_new_city_search ON properties_new (
  city, property_category, transaction_type, price
) WHERE status = 'active';

-- ============================================================
-- STEP 4: Category-specific indexes
-- ============================================================

-- Apartment indexes
CREATE INDEX IF NOT EXISTS idx_apt_bedrooms ON properties_apartment (apt_bedrooms)
  WHERE apt_bedrooms IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_sqm ON properties_apartment (apt_sqm)
  WHERE apt_sqm IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_floor ON properties_apartment (apt_floor)
  WHERE apt_floor IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_subtype ON properties_apartment (apt_property_subtype)
  WHERE apt_property_subtype IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_price ON properties_apartment (price)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_has_elevator ON properties_apartment (apt_has_elevator)
  WHERE apt_has_elevator = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_apt_has_parking ON properties_apartment (apt_has_parking)
  WHERE apt_has_parking = true AND status = 'active';

-- House indexes
CREATE INDEX IF NOT EXISTS idx_house_bedrooms ON properties_house (house_bedrooms)
  WHERE house_bedrooms IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_plot ON properties_house (house_sqm_plot)
  WHERE house_sqm_plot IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_living ON properties_house (house_sqm_living)
  WHERE house_sqm_living IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_subtype ON properties_house (house_property_subtype)
  WHERE house_property_subtype IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_price ON properties_house (price)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_has_garden ON properties_house (house_has_garden)
  WHERE house_has_garden = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_house_has_pool ON properties_house (house_has_pool)
  WHERE house_has_pool = true AND status = 'active';

-- Land indexes
CREATE INDEX IF NOT EXISTS idx_land_area ON properties_land (land_area_plot_sqm)
  WHERE land_area_plot_sqm IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_land_zoning ON properties_land (land_zoning)
  WHERE land_zoning IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_land_subtype ON properties_land (land_property_subtype)
  WHERE land_property_subtype IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_land_price ON properties_land (price)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_land_water ON properties_land (land_water_supply)
  WHERE land_water_supply IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_land_electricity ON properties_land (land_electricity)
  WHERE land_electricity IS NOT NULL AND status = 'active';

-- Commercial indexes
CREATE INDEX IF NOT EXISTS idx_comm_floor_area ON properties_commercial (comm_floor_area)
  WHERE comm_floor_area IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_zoning ON properties_commercial (comm_zoning)
  WHERE comm_zoning IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_subtype ON properties_commercial (comm_property_subtype)
  WHERE comm_property_subtype IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_price ON properties_commercial (price)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_parking ON properties_commercial (comm_parking_spaces)
  WHERE comm_parking_spaces IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_has_elevator ON properties_commercial (comm_has_elevator)
  WHERE comm_has_elevator = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_comm_has_parking ON properties_commercial (comm_has_parking)
  WHERE comm_has_parking = true AND status = 'active';

-- ============================================================
-- STEP 5: Add foreign key constraint for canonical_property_id
-- ============================================================

-- Note: Foreign key to partitioned table requires matching partition key
-- We'll skip this constraint for now as canonical_property_id is a future feature
-- For deduplication, we'll use the property_duplicates table instead

-- ALTER TABLE properties_new
--   ADD CONSTRAINT fk_canonical_property_new
--   FOREIGN KEY (canonical_property_id, property_category)
--   REFERENCES properties_new(id, property_category) ON DELETE SET NULL;

-- ============================================================
-- STEP 6: Create comments for documentation
-- ============================================================

COMMENT ON TABLE properties_new IS 'Category-partitioned properties table with Tier I columns and Tier II JSONB storage. Ready for atomic swap with properties table.';
COMMENT ON TABLE properties_apartment IS 'Partition for apartment properties (property_category = apartment)';
COMMENT ON TABLE properties_house IS 'Partition for house properties (property_category = house)';
COMMENT ON TABLE properties_land IS 'Partition for land properties (property_category = land)';
COMMENT ON TABLE properties_commercial IS 'Partition for commercial properties (property_category = commercial)';

COMMENT ON COLUMN properties_new.property_category IS 'Property category (drives partitioning): apartment, house, land, commercial';
COMMENT ON COLUMN properties_new.location IS 'Location data as JSONB: {city, street, region, postal_code, latitude, longitude, country}';
COMMENT ON COLUMN properties_new.country_specific IS 'Tier II: Country-specific fields as JSONB (e.g., czech_disposition, uk_tenure)';
COMMENT ON COLUMN properties_new.portal_metadata IS 'Tier III: Portal-specific metadata as JSONB';

-- Apartment field comments
COMMENT ON COLUMN properties_new.apt_bedrooms IS 'Apartment: Number of bedrooms (required)';
COMMENT ON COLUMN properties_new.apt_sqm IS 'Apartment: Living area in square meters (required)';
COMMENT ON COLUMN properties_new.apt_floor IS 'Apartment: Floor number (0 = ground floor)';
COMMENT ON COLUMN properties_new.apt_has_elevator IS 'Apartment: Building has elevator (required boolean)';
COMMENT ON COLUMN properties_new.apt_has_parking IS 'Apartment: Has parking space (required boolean)';

-- House field comments
COMMENT ON COLUMN properties_new.house_bedrooms IS 'House: Number of bedrooms (required)';
COMMENT ON COLUMN properties_new.house_sqm_living IS 'House: Living area in square meters (required)';
COMMENT ON COLUMN properties_new.house_sqm_plot IS 'House: Plot area in square meters (required)';
COMMENT ON COLUMN properties_new.house_has_garden IS 'House: Has garden/yard (required boolean)';
COMMENT ON COLUMN properties_new.house_has_garage IS 'House: Has garage (required boolean)';

-- Land field comments
COMMENT ON COLUMN properties_new.land_area_plot_sqm IS 'Land: Plot area in square meters (required)';
COMMENT ON COLUMN properties_new.land_water_supply IS 'Land: Water supply status (mains, well, connection_available, none)';
COMMENT ON COLUMN properties_new.land_sewage IS 'Land: Sewage system status (mains, septic, connection_available, none)';
COMMENT ON COLUMN properties_new.land_electricity IS 'Land: Electricity status (connected, connection_available, none)';

-- Commercial field comments
COMMENT ON COLUMN properties_new.comm_floor_area IS 'Commercial: Floor area in square meters (required)';
COMMENT ON COLUMN properties_new.comm_zoning IS 'Commercial: Zoning classification (office, retail, industrial, mixed-use, etc.)';
COMMENT ON COLUMN properties_new.comm_parking_spaces IS 'Commercial: Number of parking spaces available';
COMMENT ON COLUMN properties_new.comm_has_elevator IS 'Commercial: Building has elevator (required boolean)';
COMMENT ON COLUMN properties_new.comm_has_parking IS 'Commercial: Has dedicated parking (required boolean)';

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 013: Category-partitioned table created successfully';
  RAISE NOTICE '📊 Partitions: properties_apartment, properties_house, properties_land, properties_commercial';
  RAISE NOTICE '📋 Table: properties_new (ready for atomic swap)';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Test data ingestion into properties_new';
  RAISE NOTICE '   2. Verify partition pruning with EXPLAIN';
  RAISE NOTICE '   3. Migrate existing data: INSERT INTO properties_new SELECT * FROM properties';
  RAISE NOTICE '   4. Atomic swap: ALTER TABLE properties RENAME TO properties_old; ALTER TABLE properties_new RENAME TO properties';
  RAISE NOTICE '   5. Drop old table: DROP TABLE properties_old CASCADE';
END $$;
