# Database Architecture

## Connection Management

The database manager (`src/database/manager.ts`) maintains two connection pool maps:

- **Write pools** (`getCoreDatabase(country)`) - Route through PgBouncer when enabled, otherwise direct to PostgreSQL
- **Read pools** (`getReadDatabase(country)`) - Route to read replica host, falls back to primary

Country names are normalized via `COUNTRY_ALIASES` (e.g., `czech_republic` -> `cz`). Instance country validation ensures requests only target the configured country.

Database naming convention: `landomo_{country_code}` (e.g., `landomo_cz`, `landomo_sk`, `landomo_at`).

## Category-Partitioned Table

The main `properties` table is partitioned by `property_category` using PostgreSQL declarative partitioning (LIST).

```sql
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid(),
  ...
  property_category VARCHAR(20) NOT NULL
    CHECK (property_category IN ('apartment', 'house', 'land', 'commercial', 'other')),
  ...
  PRIMARY KEY (id, property_category)
) PARTITION BY LIST (property_category);

CREATE TABLE properties_apartment  PARTITION OF properties FOR VALUES IN ('apartment');
CREATE TABLE properties_house      PARTITION OF properties FOR VALUES IN ('house');
CREATE TABLE properties_land       PARTITION OF properties FOR VALUES IN ('land');
CREATE TABLE properties_commercial PARTITION OF properties FOR VALUES IN ('commercial');
CREATE TABLE properties_other      PARTITION OF properties FOR VALUES IN ('other');
```

### Core Columns (All Categories)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated primary key |
| `portal` | VARCHAR(100) | Source portal name |
| `portal_id` | VARCHAR(255) | Portal-specific listing ID |
| `source_url` | TEXT | Original listing URL |
| `source_platform` | TEXT | Platform identifier |
| `title` | TEXT | Listing title |
| `price` | NUMERIC | Price |
| `currency` | VARCHAR(10) | Currency code (default `CZK`) |
| `property_category` | VARCHAR(20) | Partition key |
| `transaction_type` | VARCHAR(10) | `sale` or `rent` |
| `location` | JSONB | Full location object |
| `city` | VARCHAR(255) | Denormalized city |
| `region` | VARCHAR | Denormalized region |
| `country` | VARCHAR(100) | Country name |
| `postal_code` | VARCHAR | Postal/zip code |
| `latitude` | NUMERIC | Coordinates |
| `longitude` | NUMERIC | Coordinates |
| `status` | VARCHAR(20) | `active`, `removed`, `sold`, `rented` |
| `first_seen_at` | TIMESTAMPTZ | First ingestion timestamp |
| `last_seen_at` | TIMESTAMPTZ | Most recent ingestion |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |
| `last_updated_at` | TIMESTAMPTZ | Last update time (alias) |
| `description` | TEXT | Listing description |
| `images` | JSONB | Image URLs array |
| `videos` | JSONB | Video URLs array |
| `features` | TEXT[] | Feature tags |
| `media` | JSONB | Media object |
| `agent` | JSONB | Agent/agency info |
| `raw_data` | JSONB | Complete original payload |
| `country_specific` | JSONB | Tier II country-specific data |
| `portal_metadata` | JSONB | Tier III portal metadata |
| `canonical_property_id` | UUID | Reference to canonical property (dedup) |
| `last_scrape_run_id` | UUID | Last scrape run that touched this property |
| `price_history` | JSONB | Array of `{date, price}` entries |
| `status_history` | JSONB | Array of `{status, from, to}` periods |
| `external_source_url` | TEXT | External source URL |

### Universal Tier I Fields (All Categories)

| Column | Type | Description |
|--------|------|-------------|
| `condition` | VARCHAR(100) | Property condition |
| `heating_type` | VARCHAR(100) | Heating type |
| `furnished` | VARCHAR | Furnished status |
| `construction_type` | VARCHAR(100) | Construction material/type |
| `renovation_year` | INTEGER | Year of last renovation |
| `available_from` | TIMESTAMPTZ | Availability date |
| `published_date` | TIMESTAMPTZ | Publication date |
| `deposit` | NUMERIC | Deposit amount |
| `parking_spaces` | INTEGER | Number of parking spaces |

### Apartment Columns (`apt_*`)

| Column | Type | Description |
|--------|------|-------------|
| `apt_bedrooms` | INTEGER | Number of bedrooms |
| `apt_bathrooms` | INTEGER | Number of bathrooms |
| `apt_sqm` | NUMERIC | Total area in sqm |
| `apt_floor` | INTEGER | Floor number |
| `apt_total_floors` | INTEGER | Total floors in building |
| `apt_rooms` | INTEGER | Total rooms |
| `apt_has_elevator` | BOOLEAN | Elevator available |
| `apt_has_balcony` | BOOLEAN | Has balcony |
| `apt_balcony_area` | NUMERIC | Balcony area sqm |
| `apt_has_parking` | BOOLEAN | Parking available |
| `apt_parking_spaces` | INTEGER | Number of parking spaces |
| `apt_has_basement` | BOOLEAN | Has basement/cellar |
| `apt_cellar_area` | NUMERIC | Cellar area sqm |
| `apt_has_loggia` | BOOLEAN | Has loggia |
| `apt_loggia_area` | NUMERIC | Loggia area sqm |
| `apt_has_terrace` | BOOLEAN | Has terrace |
| `apt_terrace_area` | NUMERIC | Terrace area sqm |
| `apt_has_garage` | BOOLEAN | Has garage |
| `apt_garage_count` | INTEGER | Number of garages |
| `apt_property_subtype` | VARCHAR(100) | Subtype (studio, penthouse, etc.) |
| `apt_year_built` | INTEGER | Year built |
| `apt_construction_type` | VARCHAR(100) | Construction type |
| `apt_condition` | VARCHAR(100) | Condition |
| `apt_heating_type` | VARCHAR(100) | Heating type |
| `apt_energy_class` | VARCHAR(100) | Energy class |
| `apt_floor_location` | VARCHAR(20) | Floor location description |
| `apt_hoa_fees` | NUMERIC | HOA/maintenance fees |
| `apt_deposit` | NUMERIC | Deposit |
| `apt_utility_charges` | NUMERIC | Utility charges |
| `apt_service_charges` | NUMERIC | Service charges |
| `apt_available_from` | TIMESTAMPTZ | Available from date |
| `apt_min_rent_days` | INTEGER | Minimum rental days |
| `apt_max_rent_days` | INTEGER | Maximum rental days |

### House Columns (`house_*`)

| Column | Type | Description |
|--------|------|-------------|
| `house_bedrooms` | INTEGER | Bedrooms |
| `house_bathrooms` | INTEGER | Bathrooms |
| `house_sqm_living` | NUMERIC | Living area sqm |
| `house_sqm_total` | NUMERIC | Total area sqm |
| `house_sqm_plot` | NUMERIC | Plot area sqm |
| `house_stories` | INTEGER | Number of stories |
| `house_rooms` | INTEGER | Total rooms |
| `house_has_garden` | BOOLEAN | Has garden |
| `house_garden_area` | NUMERIC | Garden area sqm |
| `house_has_garage` | BOOLEAN | Has garage |
| `house_garage_count` | INTEGER | Garage count |
| `house_has_parking` | BOOLEAN | Has parking |
| `house_parking_spaces` | INTEGER | Parking spaces |
| `house_has_basement` | BOOLEAN | Has basement |
| `house_cellar_area` | NUMERIC | Cellar area sqm |
| `house_has_pool` | BOOLEAN | Has pool |
| `house_has_fireplace` | BOOLEAN | Has fireplace |
| `house_has_terrace` | BOOLEAN | Has terrace |
| `house_terrace_area` | NUMERIC | Terrace area sqm |
| `house_has_attic` | BOOLEAN | Has attic |
| `house_has_balcony` | BOOLEAN | Has balcony |
| `house_balcony_area` | NUMERIC | Balcony area sqm |
| `house_property_subtype` | VARCHAR(100) | Subtype |
| `house_year_built` | INTEGER | Year built |
| `house_renovation_year` | INTEGER | Renovation year |
| `house_construction_type` | VARCHAR(100) | Construction type |
| `house_condition` | VARCHAR(100) | Condition |
| `house_heating_type` | VARCHAR(100) | Heating type |
| `house_roof_type` | VARCHAR(100) | Roof type |
| `house_energy_class` | VARCHAR(100) | Energy class |
| `house_property_tax` | NUMERIC | Property tax |
| `house_hoa_fees` | NUMERIC | HOA fees |
| `house_deposit` | NUMERIC | Deposit |
| `house_utility_charges` | NUMERIC | Utility charges |
| `house_service_charges` | NUMERIC | Service charges |
| `house_available_from` | TIMESTAMPTZ | Available from |
| `house_min_rent_days` | INTEGER | Min rental days |
| `house_max_rent_days` | INTEGER | Max rental days |

### Land Columns (`land_*`)

| Column | Type | Description |
|--------|------|-------------|
| `land_area_plot_sqm` | NUMERIC | Plot area in sqm |
| `land_property_subtype` | VARCHAR | Subtype |
| `land_zoning` | VARCHAR(50) | Zoning classification |
| `land_land_type` | VARCHAR | Land type |
| `land_water_supply` | VARCHAR(50) | Water supply status |
| `land_sewage` | VARCHAR(50) | Sewage status |
| `land_electricity` | VARCHAR(50) | Electricity status |
| `land_gas` | VARCHAR | Gas status |
| `land_road_access` | VARCHAR | Road access type |
| `land_building_permit` | VARCHAR | Building permit status |
| `land_max_building_coverage` | NUMERIC | Max building coverage |
| `land_max_building_height` | NUMERIC | Max building height |
| `land_terrain` | VARCHAR | Terrain type |
| `land_soil_quality` | VARCHAR | Soil quality |
| `land_cadastral_number` | VARCHAR | Cadastral number |
| `land_ownership_type` | VARCHAR | Ownership type |
| `land_available_from` | TIMESTAMPTZ | Available from |
| `land_has_water_connection` | BOOLEAN | Has water connection |
| `land_has_electricity_connection` | BOOLEAN | Has electricity |
| `land_has_sewage_connection` | BOOLEAN | Has sewage |
| `land_has_gas_connection` | BOOLEAN | Has gas |

### Commercial Columns (`comm_*`)

| Column | Type | Description |
|--------|------|-------------|
| `comm_property_subtype` | VARCHAR(50) | Subtype (office, retail, warehouse, etc.) |
| `comm_floor_area` | NUMERIC | Floor area sqm |
| `comm_total_floors` | INTEGER | Total floors |
| `comm_floor_number` | INTEGER | Floor number |
| `comm_office_spaces` | INTEGER | Office spaces count |
| `comm_meeting_rooms` | INTEGER | Meeting rooms |
| `comm_ceiling_height` | NUMERIC | Ceiling height |
| `comm_parking_spaces` | INTEGER | Parking spaces |
| `comm_loading_docks` | INTEGER | Loading docks |
| `comm_has_elevator` | BOOLEAN | Has elevator |
| `comm_has_parking` | BOOLEAN | Has parking |
| `comm_has_loading_bay` | BOOLEAN | Has loading bay |
| `comm_has_reception` | BOOLEAN | Has reception |
| `comm_has_kitchen` | BOOLEAN | Has kitchen |
| `comm_has_conference_room` | BOOLEAN | Has conference room |
| `comm_has_server_room` | BOOLEAN | Has server room |
| `comm_has_backup_power` | BOOLEAN | Has backup power |
| `comm_has_security_system` | BOOLEAN | Has security system |
| `comm_has_hvac` | BOOLEAN | Has HVAC |
| `comm_has_fire_safety` | BOOLEAN | Has fire safety |
| `comm_year_built` | INTEGER | Year built |
| `comm_renovation_year` | INTEGER | Renovation year |
| `comm_construction_type` | VARCHAR | Construction type |
| `comm_condition` | VARCHAR | Condition |
| `comm_heating_type` | VARCHAR | Heating type |
| `comm_cooling_type` | VARCHAR | Cooling type |
| `comm_energy_class` | VARCHAR | Energy class |
| `comm_operating_costs` | NUMERIC | Operating costs |
| `comm_service_charges` | NUMERIC | Service charges |
| `comm_property_tax` | NUMERIC | Property tax |
| `comm_hoa_fees` | NUMERIC | HOA fees |
| `comm_deposit` | NUMERIC | Deposit |
| `comm_min_lease_months` | INTEGER | Min lease months |
| `comm_available_from` | TIMESTAMPTZ | Available from |
| `comm_zoning` | VARCHAR | Zoning |
| `comm_permitted_use` | VARCHAR | Permitted use |
| `comm_max_occupancy` | INTEGER | Max occupancy |
| `comm_accessibility_features` | TEXT[] | Accessibility features |
| `comm_internet_speed` | VARCHAR | Internet speed |
| `comm_utilities_included` | TEXT[] | Included utilities |

### Other Columns (`other_*`)

| Column | Type | Description |
|--------|------|-------------|
| `other_property_subtype` | VARCHAR | Subtype (garage, storage, etc.) |
| `other_sqm_total` | NUMERIC | Total area sqm |
| `other_has_parking` | BOOLEAN | Has parking |
| `other_parking_spaces` | INTEGER | Parking spaces |
| `other_has_electricity` | BOOLEAN | Has electricity |
| `other_has_water_connection` | BOOLEAN | Has water |
| `other_has_heating` | BOOLEAN | Has heating |
| `other_security_type` | VARCHAR | Security type |
| `other_access_type` | VARCHAR | Access type |
| `other_year_built` | INTEGER | Year built |
| `other_construction_type` | VARCHAR | Construction type |
| `other_condition` | VARCHAR | Condition |
| `other_deposit` | NUMERIC | Deposit |
| `other_service_charges` | NUMERIC | Service charges |
| `other_available_from` | TIMESTAMPTZ | Available from |

### Country-Specific Columns

| Column | Type | Countries |
|--------|------|-----------|
| `czech_disposition` | VARCHAR | CZ |
| `czech_ownership` | VARCHAR | CZ |
| `slovak_disposition` | VARCHAR | SK |
| `slovak_ownership` | VARCHAR | SK |
| `hungarian_room_count` | INTEGER | HU |
| `hungarian_ownership` | VARCHAR | HU |
| `german_ownership` | VARCHAR | DE |
| `german_hausgeld` | NUMERIC | DE |
| `german_courtage` | VARCHAR | DE |
| `german_kfw_standard` | VARCHAR | DE |
| `german_is_denkmalschutz` | BOOLEAN | DE |
| `austrian_ownership` | VARCHAR | AT |
| `austrian_operating_costs` | NUMERIC | AT |
| `austrian_heating_costs` | NUMERIC | AT |
| `france_dpe_rating` | VARCHAR | FR |
| `france_ges_rating` | VARCHAR | FR |
| `france_copropriete` | BOOLEAN | FR |
| `france_charges_copro` | NUMERIC | FR |
| `spain_ibi_annual` | NUMERIC | ES |
| `spain_community_fees` | NUMERIC | ES |
| `spain_cedula_habitabilidad` | BOOLEAN | ES |
| `uk_tenure` | VARCHAR | UK |
| `uk_council_tax_band` | VARCHAR | UK |
| `uk_epc_rating` | VARCHAR | UK |
| `uk_leasehold_years_remaining` | INTEGER | UK |

## Constraints

```sql
UNIQUE (portal, portal_id, property_category)
PRIMARY KEY (id, property_category)
```

## Supporting Tables

### `scrape_runs`

Tracks scraper execution sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `portal` | VARCHAR | Portal name |
| `started_at` | TIMESTAMPTZ | Run start time |
| `finished_at` | TIMESTAMPTZ | Run end time |
| `status` | VARCHAR | `running`, `completed`, `failed` |
| `listings_found` | INTEGER | Total listings found |
| `listings_new` | INTEGER | New listings |
| `listings_updated` | INTEGER | Updated listings |

### `listing_checksums`

Stores content hashes for change detection.

| Column | Type | Description |
|--------|------|-------------|
| `portal` | VARCHAR | Portal name |
| `portal_id` | VARCHAR | Portal listing ID |
| `checksum` | VARCHAR | Content hash |
| `last_seen_at` | TIMESTAMPTZ | Last time checksum was refreshed |

Unique constraint: `(portal, portal_id)`.

### `ingestion_log`

Audit trail for every UPSERT operation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `portal` | VARCHAR(100) | Portal name |
| `portal_listing_id` | VARCHAR(255) | Portal listing ID |
| `property_category` | VARCHAR(20) | Category |
| `ingested_at` | TIMESTAMPTZ | Ingestion time |
| `status` | VARCHAR(20) | `success` or `error` |
| `error_message` | TEXT | Error details |
| `raw_payload` | JSONB | Complete ingested payload |
| `request_id` | VARCHAR | Correlation ID |

### `property_changes`

Change detection audit trail.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `property_id` | UUID | Reference to property |
| `change_type` | VARCHAR(20) | Type of change (`data_update`) |
| `changed_fields` | JSONB | Changed field metadata |
| `old_values` | JSONB | Previous values |
| `new_values` | JSONB | New values |
| `changed_at` | TIMESTAMPTZ | Change timestamp |

### `property_duplicates`

Cross-portal duplicate relationships.

| Column | Type | Description |
|--------|------|-------------|
| `canonical_id` | UUID | Canonical property ID |
| `duplicate_id` | UUID | Duplicate property ID |
| `confidence_score` | NUMERIC | Match confidence (0-100) |
| `match_method` | VARCHAR | Detection method used |

Unique constraint: `(canonical_id, duplicate_id)`.

### `staleness_thresholds`

Per-portal staleness threshold overrides.

| Column | Type | Description |
|--------|------|-------------|
| `portal` | VARCHAR | Portal name |
| `threshold_hours` | INTEGER | Override threshold in hours |

### Data Quality Tables

| Table | Description |
|-------|-------------|
| `data_quality_snapshots` | Per-portal quality scores over time |
| `data_quality_duplicates` | Duplicate detection reports |
| `data_quality_price_outliers` | Price outlier analysis results |
| `data_quality_field_completion` | Field completion rates by portal/category |
| `data_quality_scraper_alerts` | Active and resolved scraper alerts |
| `data_quality_cleansing_log` | Automated cleansing action log |

## UPSERT Logic

### Category-Specific UPSERT (Primary Path)

The worker routes properties to category-specific upsert functions:

1. **`upsertApartmentsBulk()`** - Bulk multi-row INSERT for apartments (most optimized)
2. **`upsertHouses()`** - Row-by-row INSERT for houses
3. **`upsertLand()`** - Row-by-row INSERT for land
4. **`upsertCommercial()`** - Row-by-row INSERT for commercial
5. **`upsertOther()`** - Row-by-row INSERT for other

All use `ON CONFLICT (portal, portal_id, property_category) DO UPDATE SET ...`.

### Terminal Status Protection

```sql
status = CASE
  WHEN properties.status IN ('sold', 'rented') THEN properties.status
  ELSE 'active'
END
```

Properties with terminal statuses (`sold`, `rented`) are never overwritten back to `active`.

### Universal Tier I Field Merging

Universal fields use `COALESCE` to preserve existing values when the incoming value is null:

```sql
condition = COALESCE(EXCLUDED.condition, properties.condition),
heating_type = COALESCE(EXCLUDED.heating_type, properties.heating_type),
...
```

### Insert vs Update Detection

With partitioned tables, the `xmax` trick is not available. Instead, a pre-UPSERT `SELECT` captures existing rows:

```sql
SELECT id, portal, portal_id, price, status
FROM properties
WHERE (portal, portal_id) IN (SELECT * FROM UNNEST($1::varchar[], $2::varchar[]))
```

Properties not found in this lookup are counted as inserts.

### Lifecycle Tracking (Best-Effort)

After each UPSERT, the following tracking operations run in try/catch blocks (never fail the batch):

1. **Initial status period** - New properties get a `status_history` entry
2. **Status change detection** - Reactivation (`removed` -> `active`) or scraper-detected status changes
3. **Ingestion log** - Every property logged with raw payload
4. **Price history** - Appended to `price_history` JSONB when price changes
5. **Property changes** - `property_changes` table entry for updated properties
6. **Cross-portal dedup** - Async (fire-and-forget) duplicate detection for new properties

### Cross-Portal Deduplication

Three detection strategies with decreasing confidence:

| Strategy | Confidence | Method |
|----------|-----------|--------|
| Exact coordinates (within 50m) + same price | 95% | `exact_coordinates_price` |
| Same postal code + similar address (Levenshtein < 3) + similar price (+-5%) | 85% | `postal_code_address_price` |
| Same city + bedrooms + sqm (+-2%) + price (+-10%) | 70% | `city_details_price` |

Auto-links if confidence > 80%. Sets `canonical_property_id` on the duplicate.

### Cache Invalidation

After successful ingestion, the worker publishes a Redis message on channel `property:updated:{country}` to notify the search-service to invalidate caches.

## Migration History

| Migration | Description |
|-----------|-------------|
| 001 | Multi-tier schema (base properties table) |
| 002 | Central European country-specific columns |
| 003 | Western European country-specific columns |
| 004 | Listing lifecycle (scrape_runs, staleness_thresholds, listing_status_history) |
| 005 | Request correlation ID |
| 006 | Property deduplication (property_duplicates, canonical_property_id) |
| 007 | Comprehensive indexes |
| 008 | Data quality tables |
| 009 | Universal Tier I fields (condition, heating_type, furnished, etc.) |
| 010 | Boundaries schema |
| 011 | Security monitoring tables |
| 012 | LLM extraction cache |
| 013 | Category partitioning (properties partitioned by property_category) |
| 014 | Country-specific Tier II columns |
| 015 | Comprehensive indexes for partitioned tables |
| 016 | Expand VARCHAR constraints |
| 017 | Expand descriptive VARCHAR(50) |
| 018 | Expand all remaining VARCHAR(50) |
| 019 | Final VARCHAR(50) expansion |
| 020 | Add other category + widen VARCHAR constraints |
| 021 | Create listing_checksums + widen all VARCHAR |
| 022 | Cluster indexes + widen to 200 |
| 023 | ML training materialized views |
| 024 | ML model registry |
| 025 | ML pricing read-only user |
| 026 | Populate geohash + search read-only user |
| 027 | Fix FK references to partitioned table |
| 028 | Enhanced data quality tables |
| 029 | Fix other category columns |
| 030 | Add other partition |
| 031 | JSONB history columns (price_history, status_history) |
| 032 | Rename properties_new to properties |
| 033 | Filter options precomputed table |
| 034 | External source URL column |

## Performance Notes

Always include `property_category` in queries for partition pruning:

```sql
-- Fast (partition pruning)
SELECT * FROM properties
WHERE property_category = 'apartment'
  AND price < 5000000
  AND status = 'active';

-- Slow (scans all partitions)
SELECT * FROM properties
WHERE price < 5000000;
```
