# Data Model

Complete reference for Landomo's category-partitioned database schema and three-tier data architecture.

## Overview

Landomo uses a **category-partitioned three-tier architecture** that balances type safety, query performance, and flexibility across 200+ countries and 600+ portals.

### Architecture Benefits

- **Partition Pruning**: 40-60% storage reduction, queries only touch relevant partitions
- **Type Safety**: Category-specific columns eliminate nullable spam
- **Performance**: 42 indexes per partition, <50ms typical query time
- **Flexibility**: JSONB tiers handle country/portal variations without schema changes

## Three-Tier Data Model

```
┌─────────────────────────────────────────────────────────────┐
│ TIER I: Category-Specific Columns (apartment/house/land)   │
│ Purpose: Fast queries, type safety, ML features            │
│ Examples: apt_bedrooms, house_sqm_plot, land_area          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER II: Country-Specific JSONB (country_specific)         │
│ Purpose: Country regulations, terminology                   │
│ Examples: czech_disposition, uk_tenure, france_dpe         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER III: Portal Metadata JSONB (portal_metadata)          │
│ Purpose: Portal-specific features, raw IDs, UI config      │
│ Examples: internal_ids, portal_features, ui_display        │
└─────────────────────────────────────────────────────────────┘
```

## Category Partitioning

### Base Table (properties_new)

Partitioned by `property_category` with automatic routing:

```sql
CREATE TABLE properties_new (
  -- Core identification
  id UUID DEFAULT gen_random_uuid(),
  portal_id VARCHAR(255) NOT NULL,
  portal VARCHAR(100) NOT NULL,

  -- Category drives partitioning
  property_category VARCHAR(20) NOT NULL
    CHECK (property_category IN ('apartment', 'house', 'land', 'commercial', 'other')),

  -- All category columns...

  PRIMARY KEY (id, property_category)
) PARTITION BY LIST (property_category);
```

### Partitions

| Category | Partition Table | Prefix | Required Fields | Count |
|----------|----------------|---------|-----------------|-------|
| Apartment | `properties_apartment` | `apt_*` | bedrooms, sqm, has_elevator/balcony/parking/basement | 42 fields |
| House | `properties_house` | `house_*` | bedrooms, sqm_living, sqm_plot, has_garden/garage/parking/basement | 41 fields |
| Land | `properties_land` | `land_*` | area_plot_sqm | 26 fields |
| Commercial | `properties_commercial` | `comm_*` | sqm_total, has_elevator/parking/bathrooms | 60 fields |
| Other | `properties_other` | `other_*` | Flexible catch-all | 15 fields |

### Query Examples

```sql
-- ✅ FAST: Partition pruning + partial index
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND apt_bedrooms = 2
  AND price < 500000
  AND status = 'active';
-- Query Planner: Scan ONLY properties_apartment partition

-- ❌ SLOW: Full table scan across all partitions
SELECT * FROM properties_new
WHERE price < 500000;
-- Query Planner: Scan ALL partitions (apartment + house + land + commercial)

-- ✅ FAST: Category-specific column access
SELECT apt_bedrooms, apt_sqm, apt_floor
FROM properties_new
WHERE property_category = 'apartment'
  AND city = 'Prague';
-- Returns only relevant columns, partition pruning active

-- ✅ FAST: Multi-category query with explicit filtering
SELECT * FROM properties_new
WHERE property_category IN ('apartment', 'house')
  AND city = 'Vienna'
  AND status = 'active';
-- Query Planner: Scan ONLY apartment + house partitions
```

## Tier I: Category-Specific Columns

### Apartment (apt_*)

**Focus**: Multi-family residential units in buildings

```sql
-- Required fields
apt_bedrooms INTEGER NOT NULL,
apt_sqm NUMERIC NOT NULL,
apt_has_elevator BOOLEAN NOT NULL,
apt_has_balcony BOOLEAN NOT NULL,
apt_has_parking BOOLEAN NOT NULL,
apt_has_basement BOOLEAN NOT NULL,

-- Optional details
apt_bathrooms INTEGER,
apt_floor INTEGER,
apt_total_floors INTEGER,
apt_rooms INTEGER,
apt_balcony_area NUMERIC,
apt_parking_spaces INTEGER,
apt_cellar_area NUMERIC,

-- Building context
apt_year_built INTEGER,
apt_construction_type VARCHAR(50), -- 'panel', 'brick', 'concrete', 'mixed'
apt_condition VARCHAR(50), -- 'new', 'excellent', 'good', 'after_renovation', 'requires_renovation'
apt_heating_type VARCHAR(50),
apt_energy_class VARCHAR(10),
apt_floor_location VARCHAR(20), -- 'ground_floor', 'middle_floor', 'top_floor'

-- Financials
apt_hoa_fees NUMERIC,
apt_deposit NUMERIC,
apt_utility_charges NUMERIC,
apt_service_charges NUMERIC,

-- Rental-specific
apt_available_from DATE,
apt_min_rent_days INTEGER,
apt_max_rent_days INTEGER,

-- Subtypes
apt_property_subtype VARCHAR(50), -- 'standard', 'penthouse', 'loft', 'atelier', 'maisonette', 'studio'

-- Special features
apt_has_loggia BOOLEAN,
apt_loggia_area NUMERIC,
apt_has_terrace BOOLEAN,
apt_terrace_area NUMERIC,
apt_has_garage BOOLEAN,
apt_garage_count INTEGER
```

### House (house_*)

**Focus**: Single-family residential with land

```sql
-- Required fields
house_bedrooms INTEGER NOT NULL,
house_sqm_living NUMERIC NOT NULL,  -- Interior living space
house_sqm_plot NUMERIC NOT NULL,    -- Land area (critical for houses)
house_has_garden BOOLEAN NOT NULL,
house_has_garage BOOLEAN NOT NULL,
house_has_parking BOOLEAN NOT NULL,
house_has_basement BOOLEAN NOT NULL,

-- Optional details
house_bathrooms INTEGER,
house_sqm_total NUMERIC,  -- Total built area (including walls, structures)
house_stories INTEGER,
house_rooms INTEGER,
house_garden_area NUMERIC,
house_garage_count INTEGER,
house_parking_spaces INTEGER,
house_cellar_area NUMERIC,

-- House-specific amenities
house_has_pool BOOLEAN,
house_has_fireplace BOOLEAN,
house_has_terrace BOOLEAN,
house_terrace_area NUMERIC,
house_has_attic BOOLEAN,
house_has_balcony BOOLEAN,
house_balcony_area NUMERIC,

-- Building context
house_year_built INTEGER,
house_renovation_year INTEGER,
house_construction_type VARCHAR(50), -- 'brick', 'wood', 'stone', 'concrete', 'mixed'
house_condition VARCHAR(50),
house_heating_type VARCHAR(50),
house_roof_type VARCHAR(50), -- 'flat', 'gable', 'hip', 'mansard', 'gambrel'
house_energy_class VARCHAR(10),

-- Financials
house_property_tax NUMERIC,
house_hoa_fees NUMERIC,
house_deposit NUMERIC,
house_utility_charges NUMERIC,
house_service_charges NUMERIC,

-- Rental-specific
house_available_from DATE,
house_min_rent_days INTEGER,
house_max_rent_days INTEGER,

-- Subtypes
house_property_subtype VARCHAR(50) -- 'detached', 'semi_detached', 'terraced', 'villa', 'cottage', 'farmhouse', 'townhouse', 'bungalow'
```

### Land (land_*)

**Focus**: Undeveloped or agricultural plots

```sql
-- Required field
land_area_plot_sqm NUMERIC NOT NULL,

-- Land characteristics
land_zoning VARCHAR(50), -- 'residential', 'commercial', 'agricultural', 'industrial', 'mixed'
land_land_type VARCHAR(50), -- 'buildable', 'agricultural', 'forest', 'recreational'
land_terrain VARCHAR(50), -- 'flat', 'sloped', 'hillside', 'valley'
land_soil_quality VARCHAR(20), -- 'excellent', 'good', 'average', 'poor'

-- Utilities (new structure)
land_water_supply VARCHAR(50), -- 'connected', 'available', 'none', 'well'
land_sewage VARCHAR(50), -- 'connected', 'available', 'none', 'septic_tank'
land_electricity VARCHAR(50), -- 'connected', 'available', 'none'
land_gas VARCHAR(50), -- 'connected', 'available', 'none'
land_road_access VARCHAR(50), -- 'paved', 'gravel', 'dirt', 'none'

-- Deprecated utility flags (backward compatibility)
land_has_water_connection BOOLEAN,
land_has_electricity_connection BOOLEAN,
land_has_sewage_connection BOOLEAN,
land_has_gas_connection BOOLEAN,

-- Building potential
land_building_permit BOOLEAN,
land_max_building_coverage NUMERIC, -- Percentage (e.g., 40.0 = 40%)
land_max_building_height NUMERIC, -- Meters

-- Administrative
land_cadastral_number VARCHAR(100),
land_ownership_type VARCHAR(50), -- 'freehold', 'leasehold', 'cooperative'

-- Rental-specific
land_available_from DATE,

-- Subtypes
land_property_subtype VARCHAR(50) -- 'residential_plot', 'agricultural_land', 'commercial_plot', 'forest', 'recreational'
```

### Commercial (comm_*)

**Focus**: Business, office, retail, industrial properties

```sql
-- Required fields
comm_sqm_total NUMERIC NOT NULL,
comm_has_elevator BOOLEAN NOT NULL,
comm_has_parking BOOLEAN NOT NULL,
comm_has_bathrooms BOOLEAN NOT NULL,

-- Space configuration
comm_floor_area NUMERIC,
comm_total_floors INTEGER,
comm_floor_number INTEGER,
comm_office_spaces INTEGER,
comm_meeting_rooms INTEGER,
comm_parking_spaces INTEGER,
comm_loading_docks INTEGER,
comm_ceiling_height NUMERIC,

-- Amenities
comm_has_loading_bay BOOLEAN,
comm_has_reception BOOLEAN,
comm_has_kitchen BOOLEAN,
comm_has_conference_room BOOLEAN,
comm_has_server_room BOOLEAN,
comm_has_backup_power BOOLEAN,
comm_has_security_system BOOLEAN,
comm_has_hvac BOOLEAN,
comm_has_fire_safety BOOLEAN,

-- Zoning & use
comm_zoning VARCHAR(50),
comm_permitted_use TEXT[],
comm_max_occupancy INTEGER,

-- Building context
comm_year_built INTEGER,
comm_renovation_year INTEGER,
comm_construction_type VARCHAR(50),
comm_condition VARCHAR(50),
comm_heating_type VARCHAR(50),
comm_cooling_type VARCHAR(50),
comm_energy_class VARCHAR(10),

-- Financials
comm_operating_costs NUMERIC,
comm_service_charges NUMERIC,
comm_property_tax NUMERIC,
comm_hoa_fees NUMERIC,
comm_deposit NUMERIC,

-- Lease terms
comm_min_lease_months INTEGER,
comm_available_from DATE,

-- Accessibility & infrastructure
comm_accessibility_features TEXT[],
comm_internet_speed VARCHAR(50),
comm_utilities_included BOOLEAN,

-- Subtypes
comm_property_subtype VARCHAR(50) -- 'office', 'retail', 'warehouse', 'industrial', 'restaurant', 'hotel', 'mixed_use'
```

### Other (other_*)

**Focus**: Catch-all for properties that don't fit standard categories (garages, storage units, parking spaces, etc.)

```sql
-- Required field
other_sqm NUMERIC,

-- Type classification
other_subtype VARCHAR(50), -- 'garage', 'parking_space', 'storage_unit', 'shed', 'boat_slip', etc.

-- Basic amenities
other_has_electricity BOOLEAN,
other_has_water BOOLEAN,
other_has_security BOOLEAN,
other_is_covered BOOLEAN,
other_is_heated BOOLEAN,

-- Dimensions
other_width NUMERIC,
other_height NUMERIC,
other_depth NUMERIC,

-- Access
other_access_type VARCHAR(50), -- 'drive_in', 'walk_in', 'elevator', 'stairs'
other_floor INTEGER,

-- Financials
other_monthly_fee NUMERIC,
other_deposit NUMERIC,

-- Rental-specific
other_available_from DATE,
other_min_rent_days INTEGER
```

## Tier II: Country-Specific Data

Stored in `country_specific` JSONB column for flexibility without schema changes.

### Czech Republic

```json
{
  "czech_disposition": "2+kk",
  "czech_ownership": "osobní",
  "building_type": "cihlový",
  "area_usable": 65,
  "cadastral_number": "123/456",
  "energy_certificate": "G - mimořádně nehospodárná"
}
```

**Common Czech Fields**:
- `czech_disposition`: "1+kk", "2+1", "3+kk", "4+1", etc.
- `czech_ownership`: "osobní" (personal), "družstevní" (cooperative)
- `building_type`: "cihlový", "panelový", "smíšený"
- `area_usable`: Usable area (may differ from total sqm)

### United Kingdom

```json
{
  "uk_tenure": "freehold",
  "uk_council_tax_band": "D",
  "uk_epc_rating": "C",
  "uk_leasehold_years_remaining": 95,
  "ground_rent": 150
}
```

### France

```json
{
  "france_dpe_rating": "C",
  "france_ges_rating": "B",
  "france_copropriete": true,
  "france_charges_copro": 1200,
  "loi_carrez": 72
}
```

### Germany

```json
{
  "german_ownership": "Eigentum",
  "german_hausgeld": 250,
  "german_courtage": 3.57,
  "german_kfw_standard": "KfW 55",
  "german_is_denkmalschutz": false,
  "energieausweis": "Bedarfsausweis"
}
```

### Spain

```json
{
  "spain_ibi_annual": 450,
  "spain_community_fees": 80,
  "spain_cedula_habitabilidad": true,
  "certificado_energetico": "E"
}
```

## Tier III: Portal Metadata

Stored in `portal_metadata` JSONB column for portal-specific data.

### Structure

```json
{
  "internal_id": "portal_abc123",
  "listing_id": "xyz789",
  "portal_category": "byty",
  "portal_features": ["new_listing", "verified", "360_tour"],
  "ui_badges": ["TOP", "EXCLUSIVE"],
  "refresh_date": "2026-02-15T10:30:00Z",
  "view_count": 145,
  "favorite_count": 12
}
```

### Common Portal Fields

- `internal_id`: Portal's internal database ID
- `listing_id`: Portal's public-facing listing ID
- `portal_category`: Portal's original category name
- `portal_features`: Portal-specific feature flags
- `ui_badges`: Display badges (TOP, EXCLUSIVE, etc.)
- `refresh_date`: When listing was last refreshed on portal
- `view_count`: Number of views (if available)
- `favorite_count`: Number of favorites (if available)

## Shared Columns (All Categories)

### Core Identification

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
portal_id VARCHAR(255) NOT NULL,
portal VARCHAR(100) NOT NULL,
title TEXT NOT NULL,
price NUMERIC NOT NULL,
currency VARCHAR(10) NOT NULL DEFAULT 'CZK',
transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('sale', 'rent')),
```

### Location (JSONB + Denormalized)

```sql
-- JSONB storage (full location object)
location JSONB NOT NULL,
/*
{
  "city": "Prague",
  "street": "Vinohradská 123",
  "region": "Prague",
  "postal_code": "130 00",
  "country": "Czech Republic",
  "coordinates": {
    "lat": 50.0755,
    "lon": 14.4378
  }
}
*/

-- Denormalized for fast queries
city VARCHAR(255),
region VARCHAR(255),
country VARCHAR(100) NOT NULL,
postal_code VARCHAR(20),
latitude NUMERIC,
longitude NUMERIC,
geohash VARCHAR(20),
```

### Media (JSONB)

```sql
media JSONB,
/*
{
  "images": [
    {
      "url": "https://...",
      "caption": "Living room",
      "order": 1
    }
  ],
  "videos": [
    {
      "url": "https://...",
      "type": "virtual_tour"
    }
  ],
  "floor_plan": "https://..."
}
*/
```

### Agent (JSONB)

```sql
agent JSONB,
/*
{
  "name": "John Smith",
  "phone": "+420 123 456 789",
  "email": "john@realestate.cz",
  "agency": "Premium Real Estate",
  "agency_logo": "https://...",
  "license_number": "RE12345"
}
*/
```

### Status & Lifecycle

```sql
status VARCHAR(20) NOT NULL DEFAULT 'active',
  CHECK (status IN ('active', 'removed', 'sold', 'rented')),
first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
```

### Raw Data

```sql
source_url TEXT NOT NULL,
source_platform TEXT NOT NULL,
raw_data JSONB NOT NULL, -- Complete portal response for debugging
```

## Supporting Tables

### listing_status_history

Tracks status changes over time for market analysis.

```sql
CREATE TABLE listing_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  property_category VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reason VARCHAR(50), -- 'scraper_ingest', 'staleness_check', 'manual'

  CONSTRAINT fk_property
    FOREIGN KEY (property_id, property_category)
    REFERENCES properties_new(id, property_category)
);

-- Indexes
CREATE INDEX idx_lsh_property_id ON listing_status_history(property_id);
CREATE INDEX idx_lsh_open_periods ON listing_status_history(property_id)
  WHERE ended_at IS NULL;
CREATE INDEX idx_lsh_status_started ON listing_status_history(status, started_at DESC);
```

### property_changes

Audit trail for all property modifications.

```sql
CREATE TABLE property_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  property_category VARCHAR(20) NOT NULL,
  change_type VARCHAR(20) NOT NULL,
    CHECK (change_type IN ('price_change', 'status_change', 'data_update', 'removed', 'reactivated')),
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_property
    FOREIGN KEY (property_id, property_category)
    REFERENCES properties_new(id, property_category)
);

-- Indexes
CREATE INDEX idx_property_changes_property_id ON property_changes(property_id);
CREATE INDEX idx_property_changes_type ON property_changes(change_type);
CREATE INDEX idx_property_changes_property_recent
  ON property_changes(property_id, changed_at DESC);
```

### price_history

Denormalized price tracking for fast time-series queries.

```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  property_category VARCHAR(20) NOT NULL,
  price NUMERIC NOT NULL,
  currency VARCHAR(10),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_property
    FOREIGN KEY (property_id, property_category)
    REFERENCES properties_new(id, property_category)
);

-- Indexes
CREATE INDEX idx_price_history_property_id ON price_history(property_id);
CREATE INDEX idx_price_history_property_recent
  ON price_history(property_id, recorded_at DESC);
```

### scrape_runs

Tracks scraper execution for monitoring and debugging.

```sql
CREATE TABLE scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_scrape_runs_portal ON scrape_runs(portal, started_at DESC);
CREATE INDEX idx_scrape_runs_status_started ON scrape_runs(status, started_at)
  WHERE status = 'running';
CREATE INDEX idx_scrape_runs_portal_status
  ON scrape_runs(portal, status, finished_at DESC);
```

### staleness_thresholds

Per-portal staleness configuration (overrides default 72h).

```sql
CREATE TABLE staleness_thresholds (
  portal VARCHAR(100) PRIMARY KEY,
  threshold_hours INTEGER NOT NULL DEFAULT 72,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ingestion_log

Complete ingestion audit trail with raw payloads.

```sql
CREATE TABLE ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  portal_listing_id VARCHAR(255) NOT NULL,
  property_category VARCHAR(20),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20),
    CHECK (status IN ('success', 'validation_error', 'duplicate', 'rejected')),
  error_message TEXT,
  raw_payload JSONB,
  request_id VARCHAR(255) -- Correlation ID for tracing
);

-- Indexes
CREATE INDEX idx_ingestion_log_portal ON ingestion_log(portal);
CREATE INDEX idx_ingestion_log_portal_listing
  ON ingestion_log(portal, portal_listing_id, ingested_at DESC);
CREATE INDEX idx_ingestion_log_status ON ingestion_log(status)
  WHERE status != 'success';
CREATE INDEX idx_ingestion_log_request_id ON ingestion_log(request_id)
  WHERE request_id IS NOT NULL;
```

## Indexes

Each partition has 42 optimized indexes for common query patterns.

### Apartment Partition Indexes

```sql
-- Primary filters
CREATE INDEX idx_apt_bedrooms ON properties_apartment(apt_bedrooms)
  WHERE status = 'active';
CREATE INDEX idx_apt_price ON properties_apartment(price)
  WHERE status = 'active' AND price IS NOT NULL;
CREATE INDEX idx_apt_city ON properties_apartment(city)
  WHERE status = 'active';
CREATE INDEX idx_apt_sqm ON properties_apartment(apt_sqm)
  WHERE status = 'active' AND apt_sqm IS NOT NULL;

-- Composite filters
CREATE INDEX idx_apt_city_bedrooms ON properties_apartment(city, apt_bedrooms)
  WHERE status = 'active';
CREATE INDEX idx_apt_city_price ON properties_apartment(city, price)
  WHERE status = 'active';
CREATE INDEX idx_apt_bedrooms_sqm ON properties_apartment(apt_bedrooms, apt_sqm)
  WHERE status = 'active';

-- Amenities
CREATE INDEX idx_apt_has_elevator ON properties_apartment(apt_has_elevator)
  WHERE status = 'active' AND apt_has_elevator = true;
CREATE INDEX idx_apt_has_balcony ON properties_apartment(apt_has_balcony)
  WHERE status = 'active' AND apt_has_balcony = true;
CREATE INDEX idx_apt_has_parking ON properties_apartment(apt_has_parking)
  WHERE status = 'active' AND apt_has_parking = true;

-- Lifecycle
CREATE INDEX idx_apt_status ON properties_apartment(status);
CREATE INDEX idx_apt_created_at ON properties_apartment(created_at DESC);
CREATE INDEX idx_apt_last_seen ON properties_apartment(last_seen_at)
  WHERE status = 'active';

-- Geospatial
CREATE INDEX idx_apt_lat_lon ON properties_apartment(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';
```

### House Partition Indexes

```sql
-- Primary filters
CREATE INDEX idx_house_bedrooms ON properties_house(house_bedrooms)
  WHERE status = 'active';
CREATE INDEX idx_house_sqm_living ON properties_house(house_sqm_living)
  WHERE status = 'active';
CREATE INDEX idx_house_sqm_plot ON properties_house(house_sqm_plot)
  WHERE status = 'active';
CREATE INDEX idx_house_price ON properties_house(price)
  WHERE status = 'active';

-- Composite filters
CREATE INDEX idx_house_city_bedrooms ON properties_house(city, house_bedrooms)
  WHERE status = 'active';
CREATE INDEX idx_house_city_plot ON properties_house(city, house_sqm_plot)
  WHERE status = 'active';

-- Amenities
CREATE INDEX idx_house_has_garden ON properties_house(house_has_garden)
  WHERE status = 'active' AND house_has_garden = true;
CREATE INDEX idx_house_has_pool ON properties_house(house_has_pool)
  WHERE status = 'active' AND house_has_pool = true;
CREATE INDEX idx_house_has_garage ON properties_house(house_has_garage)
  WHERE status = 'active' AND house_has_garage = true;
```

### Land Partition Indexes

```sql
-- Primary filters
CREATE INDEX idx_land_area ON properties_land(land_area_plot_sqm)
  WHERE status = 'active';
CREATE INDEX idx_land_price ON properties_land(price)
  WHERE status = 'active';
CREATE INDEX idx_land_zoning ON properties_land(land_zoning)
  WHERE status = 'active';

-- Composite filters
CREATE INDEX idx_land_city_area ON properties_land(city, land_area_plot_sqm)
  WHERE status = 'active';
CREATE INDEX idx_land_city_zoning ON properties_land(city, land_zoning)
  WHERE status = 'active';
```

### Commercial Partition Indexes

```sql
-- Primary filters
CREATE INDEX idx_comm_sqm ON properties_commercial(comm_sqm_total)
  WHERE status = 'active';
CREATE INDEX idx_comm_subtype ON properties_commercial(comm_property_subtype)
  WHERE status = 'active';
CREATE INDEX idx_comm_price ON properties_commercial(price)
  WHERE status = 'active';

-- Composite filters
CREATE INDEX idx_comm_city_subtype ON properties_commercial(city, comm_property_subtype)
  WHERE status = 'active';
CREATE INDEX idx_comm_city_sqm ON properties_commercial(city, comm_sqm_total)
  WHERE status = 'active';
```

## Migration Path

### From Old Schema to Category-Partitioned

See `ingest-service/migrations/013_category_partitioning.sql` for complete migration.

**Key steps**:

1. Create new partitioned base table `properties_new`
2. Create category partitions (apartment, house, land, commercial)
3. Migrate data with category classification
4. Create 168 category-specific indexes (42 per partition)
5. Update application code to use new table
6. Drop old `properties` table

### Status

- ✅ Applied to: `landomo_czech_republic` (2026-02-10)
- ⏳ Pending: 200+ other country databases
- 📊 Result: 40-60% storage reduction, <50ms query times

## Best Practices

### TypeScript Types

Always use category-specific types from `@landomo/core`:

```typescript
import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';

// ✅ Good: Type-safe apartment
const apartment: ApartmentPropertyTierI = {
  property_category: 'apartment',
  bedrooms: 2,
  sqm: 65,
  has_elevator: true,
  has_balcony: true,
  has_parking: false,
  has_basement: true,
  // ...
};

// ❌ Bad: Generic property with nullable spam
const property: StandardProperty = {
  property_type: 'apartment',
  bedrooms: 2,
  sqm: 65,
  sqm_plot: null, // Irrelevant for apartments
  has_garden: null, // Irrelevant for apartments
  // ...
};
```

### Query Optimization

Always include `property_category` and `status` for partition pruning:

```sql
-- ✅ FAST: Partition pruning + partial index
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND status = 'active'
  AND city = 'Prague';

-- ❌ SLOW: Full table scan
SELECT * FROM properties_new
WHERE city = 'Prague';
```

### Transformer Guidelines

```typescript
// ✅ Good: Category-specific transformer
export function transformApartment(raw: any): ApartmentPropertyTierI {
  return {
    property_category: 'apartment', // REQUIRED
    bedrooms: raw.rooms - 1,
    sqm: raw.area,
    has_elevator: raw.elevator === 'ano',
    has_balcony: raw.features.includes('balkon'),
    has_parking: raw.features.includes('parkování'),
    has_basement: raw.features.includes('sklep'),
    // ... apartment-specific fields only
  };
}

// ❌ Bad: Property-agnostic transformer
export function transformProperty(raw: any): StandardProperty {
  return {
    property_type: 'apartment',
    bedrooms: raw.rooms - 1,
    sqm: raw.area,
    sqm_plot: null, // Waste of storage
    has_garden: null, // Waste of storage
    // ...
  };
}
```

## Related Documentation

- **Architecture**: `/docs/ARCHITECTURE.md`
- **API Reference**: `/docs/API_REFERENCE.md`
- **TypeScript Types**: `/shared-components/src/types/`
- **Migrations**: `/ingest-service/migrations/`

---

**Last Updated**: 2026-02-16
