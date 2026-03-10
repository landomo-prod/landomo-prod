# Database

The search service connects to multiple PostgreSQL databases (one per country) with read-only access. All queries target the `properties` table, which is partitioned by `property_category`.

## Connection Architecture

```
Search Service
    │
    ├── Pool: landomo_cz       (Czech Republic)
    ├── Pool: landomo_uk       (United Kingdom)
    ├── Pool: landomo_australia (Australia)
    ├── Pool: landomo_usa      (USA)
    ├── Pool: landomo_france   (France)
    ├── Pool: landomo_spain    (Spain)
    ├── Pool: landomo_italy    (Italy)
    ├── Pool: landomo_germany  (Germany)
    ├── Pool: landomo_austria  (Austria)
    ├── Pool: landomo_slovakia (Slovakia)
    └── Pool: landomo_hungary  (Hungary)
```

Each pool uses:
- User: `search_readonly` (read-only database user)
- Max connections: configurable via `DB_MAX_CONNECTIONS` (default: 10)
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

The `multi-db-manager.ts` module provides:
- `queryCountry(code, sql, params)` - query a single country
- `queryCountries(codes, sql, params)` - query multiple countries in parallel
- `queryAllCountries(sql, params)` - query all countries in parallel
- `getPropertyById(code, id)` - fetch single property
- `findPropertyByPortalId(portal, portalId)` - search across all countries

## Table: properties

Category-partitioned table with 4 partitions:

| Partition | Category | Prefix | Key Required Fields |
|-----------|----------|--------|-------------------|
| `properties_apartment` | `apartment` | `apt_*` | bedrooms, sqm, has_elevator/balcony/parking/basement |
| `properties_house` | `house` | `house_*` | bedrooms, sqm_living, sqm_plot, has_garden/garage/parking/basement |
| `properties_land` | `land` | `land_*` | area_plot_sqm |
| `properties_commercial` | `commercial` | `comm_*` | sqm_total, has_elevator/parking |

### Key Columns Used by Search

**Universal columns:**

| Column | Type | Indexed | Used In |
|--------|------|---------|---------|
| `id` | uuid | PK | Property lookup |
| `portal` | text | Yes | Filter, aggregation |
| `portal_id` | text | Yes (composite) | Portal lookup |
| `property_category` | text | Partition key | Partition pruning |
| `property_type` | text | Yes | Filter, aggregation |
| `transaction_type` | text | Yes | Filter, aggregation |
| `status` | text | Partial index (`= 'active'`) | All queries |
| `price` | numeric | Yes | Filter, sort, aggregation |
| `city` | text | Yes | Filter, aggregation |
| `region` | text | Yes | Filter |
| `country` | text | Yes | Filter |
| `latitude` / `longitude` | numeric | Yes | Geo queries |
| `geom_point` | geometry(Point,4326) | GiST | KNN geo search |
| `canonical_property_id` | uuid | Yes | Duplicate exclusion |
| `created_at` | timestamptz | Yes | Sort, default order |
| `last_seen_at` | timestamptz | Yes | Market trends |
| `images` | jsonb | No | Property detail |
| `description` | text | No | Full-text search |
| `portal_features` | text[] | GIN | Feature filter |
| `portal_metadata` | jsonb | No | Property detail |
| `condition` | text | No | Filter |
| `heating_type` | text | No | Filter |
| `furnished` | text | No | Filter |
| `construction_type` | text | No | Filter |

**Category-specific columns (apartment):**

| Column | Type | Used In |
|--------|------|---------|
| `apt_bedrooms` | integer | Bedroom filter |
| `apt_bathrooms` | integer | Bathroom filter |
| `apt_sqm` | numeric | Sqm filter |
| `apt_floor` | integer | Property detail |
| `apt_total_floors` | integer | Property detail |
| `apt_has_elevator` | boolean | Amenity filter |
| `apt_has_balcony` | boolean | Amenity filter |
| `apt_has_parking` | boolean | Amenity filter |
| `apt_has_basement` | boolean | Amenity filter |
| `apt_has_terrace` | boolean | Amenity filter |

**Category-specific columns (house):**

| Column | Type | Used In |
|--------|------|---------|
| `house_bedrooms` | integer | Bedroom filter |
| `house_bathrooms` | integer | Bathroom filter |
| `house_sqm_living` | numeric | Sqm filter |
| `house_sqm_plot` | numeric | Property detail |
| `house_sqm_total` | numeric | Sqm filter |
| `house_has_garden` | boolean | Amenity filter |
| `house_has_garage` | boolean | Amenity filter |
| `house_has_parking` | boolean | Amenity filter |
| `house_has_basement` | boolean | Amenity filter |
| `house_has_terrace` | boolean | Amenity filter |

**Category-specific columns (land):**

| Column | Type | Used In |
|--------|------|---------|
| `land_area_plot_sqm` | numeric | Sqm filter |

**Category-specific columns (commercial):**

| Column | Type | Used In |
|--------|------|---------|
| `comm_floor_area` | numeric | Sqm filter |
| `comm_has_elevator` | boolean | Amenity filter |
| `comm_has_parking` | boolean | Amenity filter |
| `comm_property_subtype` | text | Property detail |

**Country-specific columns:**

| Column | Type | Country |
|--------|------|---------|
| `czech_disposition` | text | Czech |
| `czech_ownership` | text | Czech |
| `uk_tenure` | text | UK |
| `uk_council_tax_band` | text | UK |
| `uk_epc_rating` | text | UK |
| `uk_leasehold_years_remaining` | integer | UK |
| `usa_mls_number` | text | USA |
| `australia_land_size_sqm` | numeric | Australia |

## Table: price_history

Used by the price trends endpoints.

| Column | Type | Description |
|--------|------|-------------|
| `property_id` | uuid | FK to properties |
| `price` | numeric | Recorded price |
| `currency` | text | Currency code |
| `recorded_at` | timestamptz | When price was recorded |

## Table: property_boundary_cache

Used by the boundary properties endpoint.

| Column | Type | Description |
|--------|------|-------------|
| `property_id` | uuid | FK to properties |
| `boundary_id` | text | Boundary identifier |
| `boundary_type` | text | Boundary type |
| `confidence` | numeric | Match confidence |

## Table: search_filter_options (precomputed)

Used by the background filter options refresher for fast filter endpoint responses.

| Column | Type | Description |
|--------|------|-------------|
| `property_category` | text | Category scope |
| `transaction_type` | text | Transaction scope |
| `options` | jsonb | Precomputed filter options |
| `updated_at` | timestamptz | Last refresh time |

## Query Patterns

### Partition Pruning

Always include `property_category` in WHERE clauses for partition pruning:

```sql
-- Fast: scans only apartment partition
SELECT * FROM properties
WHERE property_category = 'apartment' AND price < 5000000 AND status = 'active';

-- Slow: scans all 4 partitions
SELECT * FROM properties
WHERE price < 5000000 AND status = 'active';
```

### Active-Only Partial Index

The `status = 'active'` condition uses a partial index, making it essentially free:

```sql
CREATE INDEX idx_properties_active ON properties (id) WHERE status = 'active';
```

### Duplicate Exclusion

All search queries include:

```sql
AND (canonical_property_id IS NULL OR id = canonical_property_id)
```

This filters out properties that have been identified as duplicates and linked to a canonical record.

### GiST KNN Search

Geo queries use the `<->` operator for ordered GiST traversal:

```sql
ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($lon, $lat), 4326)
LIMIT $N
```

This visits only the minimum number of index pages to return N nearest results.

### Bounding Box Search

Map tile queries use the `&&` operator for GiST envelope intersection:

```sql
WHERE geom_point && ST_MakeEnvelope($west, $south, $east, $north, 4326)
```

### Single-Pass Aggregation

Aggregation queries use CTEs to compute all facets in one round-trip:

```sql
WITH base AS (SELECT ... FROM properties WHERE ...),
  type_agg AS (SELECT property_type, COUNT(*) FROM base GROUP BY ...),
  price_agg AS (SELECT CASE ... END, COUNT(*) FROM base GROUP BY ...),
  ...
SELECT 'type', val, cnt FROM type_agg
UNION ALL SELECT 'price', ... FROM price_agg
...
```

### Market Trends

Joins `price_history` with `properties` for monthly averages, with fallback to `properties.last_seen_at` if price history is sparse:

```sql
WITH monthly_data AS (
  SELECT date_trunc('month', ph.recorded_at) AS month,
         AVG(ph.price / p.sqm) AS avg_price_per_sqm
  FROM price_history ph JOIN properties p ON p.id = ph.property_id
  WHERE ... AND ph.recorded_at >= NOW() - INTERVAL '12 months'
  GROUP BY 1
),
current_data AS (
  SELECT date_trunc('month', p.last_seen_at) AS month, ...
  FROM properties p WHERE ...
)
SELECT * FROM monthly_data
UNION ALL
SELECT * FROM current_data WHERE NOT EXISTS (SELECT 1 FROM monthly_data)
```

## Performance Considerations

1. **Connection pooling**: max 10 connections per country (configurable), idle timeout 30s
2. **Parallel queries**: all country databases are queried simultaneously
3. **Capped counts**: `LIMIT 10000` subquery avoids full-table count scans
4. **Read-only user**: prevents accidental writes, allows read replica routing
5. **Partial indexes**: `WHERE status = 'active'` indexes cover the common case
6. **GiST indexes**: `geom_point` column for spatial queries (KNN + bounding box)
7. **GIN indexes**: `portal_features` array for containment queries
8. **Category columns**: OR across `apt_*`/`house_*`/`comm_*` avoids JSONB extraction
