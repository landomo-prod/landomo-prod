# Query Builder

The search service uses a multi-layer query building system to construct SQL queries from user-provided filters. This document describes how filter parameters map to SQL and the optimization strategies employed.

## Architecture

```
SearchRequest
    │
    ▼
buildSearchQuery()          ← query-builder.ts (base filters)
    │
    ▼
CountryModule.enhanceQuery()  ← country/*/index.ts (country-specific filters)
    │
    ▼
QueryBuilder.build()         ← generates SELECT + WHERE + ORDER BY + LIMIT
QueryBuilder.buildCount()    ← generates capped COUNT subquery (parallel)
    │
    ▼
queryCountries()             ← multi-db-manager.ts (parallel across DBs)
    │
    ▼
mergeAndRankResults()        ← result-aggregator.ts (global sort + paginate)
```

## QueryBuilder Class

**File:** `src/database/query-builder.ts`

The `QueryBuilder` class maintains:

- `selectFields: string[]` - columns to SELECT (initialized with ~40 default fields)
- `whereClauses: string[]` - WHERE conditions (always starts with `status = 'active'` and duplicate exclusion)
- `params: any[]` - parameterized query values
- `paramIndex: number` - next `$N` placeholder index

### Default WHERE Clauses

Every query automatically includes:

```sql
WHERE status = 'active'
  AND (canonical_property_id IS NULL OR id = canonical_property_id)
```

- `status = 'active'` - only show active listings (uses partial index for performance)
- Duplicate exclusion - filters out properties linked as duplicates of a canonical property

### build(sort, limit, offset)

Generates the data query. Note: does **not** use `COUNT(*) OVER()` to avoid full-table scans. Count is fetched separately.

```sql
SELECT id, portal, title, price, ...
FROM properties
WHERE status = 'active'
  AND (canonical_property_id IS NULL OR id = canonical_property_id)
  AND property_category = $1
  AND price >= $2
  AND price <= $3
ORDER BY price ASC
LIMIT 20
OFFSET 0
```

### buildCount(cap = 10000)

Generates a capped count query to avoid expensive full-table counts:

```sql
SELECT COUNT(*) AS _total_count
FROM (SELECT 1 FROM properties WHERE ... LIMIT 10000) AS _subq
```

Returns exact count for result sets under 10,000; capped at 10,000 for larger sets. This makes broad queries fast while still providing accurate counts for typical paginated views.

### clone()

Creates a deep copy for per-country query enhancement without modifying the base query.

## Filter Mapping

### Global Filters (query-builder.ts)

| Filter Parameter | SQL WHERE Clause | Index Used |
|-----------------|-----------------|------------|
| `property_category` | `property_category = $N` | Partition key (pruning) |
| `property_type` | `property_type = $N` | Yes |
| `transaction_type` | `transaction_type = $N` | Yes |
| `city` | `city = $N` | Yes |
| `region` | `region = $N` | Yes |
| `country` | `country = $N` | Yes |
| `price_min` | `price >= $N` | Yes (range) |
| `price_max` | `price <= $N` | Yes (range) |
| `portal` | `portal = $N` | Yes |
| `portal_features` | `portal_features @> $N` | GIN index |
| `search_query` | `title ILIKE $N OR description ILIKE $N` | Sequential scan |

### Category-Prefixed Filters

Data lives in category-specific columns (`apt_bedrooms`, `house_bedrooms`, etc.), not in the generic `bedrooms` column. The query builder uses OR across category columns:

| Filter | SQL WHERE Clause |
|--------|-----------------|
| `bedrooms` | `(apt_bedrooms = $N OR house_bedrooms = $N)` |
| `bedrooms_min` | `(apt_bedrooms >= $N OR house_bedrooms >= $N)` |
| `bedrooms_max` | `(apt_bedrooms <= $N OR house_bedrooms <= $N)` |
| `bathrooms_min` | `(apt_bathrooms >= $N OR house_bathrooms >= $N)` |
| `sqm_min` | `(apt_sqm >= $N OR house_sqm_living >= $N OR house_sqm_total >= $N)` |
| `sqm_max` | `(apt_sqm <= $N OR house_sqm_living <= $N OR house_sqm_total <= $N)` |
| `has_parking` | `(apt_has_parking = $N OR house_has_parking = $N)` |
| `has_garden` | `(apt_has_balcony = $N OR house_has_garden = $N)` |
| `has_balcony` | `(apt_has_balcony = $N OR house_has_terrace = $N)` |
| `has_terrace` | `(apt_has_terrace = $N OR house_has_terrace = $N)` |
| `has_elevator` | `(apt_has_elevator = $N OR comm_has_elevator = $N)` |
| `has_garage` | `(apt_has_basement = $N OR house_has_garage = $N)` |
| `has_pool` | `has_pool = $N` |

### Country-Specific Filters (Czech Example)

Applied in `CzechModule.enhanceQuery()`:

| Filter | SQL WHERE Clause | Validation |
|--------|-----------------|------------|
| `disposition` | `czech_disposition = $N` | Must be valid layout (1+kk, 2+1, etc.) |
| `ownership` | `czech_ownership = $N` | Must be Osobni, Druzstevni, or Statni |
| `building_type` | `czech_building_type = $N` | Non-empty string |
| `condition` | `czech_condition = $N` | Non-empty string |

### UK-Specific Filters

| Filter | SQL WHERE Clause |
|--------|-----------------|
| `tenure` | `uk_tenure = $N` |
| `council_tax_band` | `uk_council_tax_band = $N` |
| `epc_rating` | `uk_epc_rating = ANY($N)` (array) |
| `epc_min_rating` | `uk_epc_rating >= $N` |
| `leasehold_min_years` | `uk_leasehold_years_remaining >= $N` |
| `postcode_district` | `uk_postcode_district = $N` |

## Sort Field Whitelist

The `sanitizeSortField()` method validates sort fields against a whitelist:

```
price, created_at, updated_at, sqm, bedrooms, bathrooms, city,
uk_council_tax_band, uk_epc_rating, uk_leasehold_years_remaining,
usa_hoa_fees_monthly, australia_land_size_sqm
```

Invalid sort fields fall back to `created_at DESC`.

### Sort Presets

| Preset | Maps To |
|--------|---------|
| `price_asc` | `ORDER BY price ASC` |
| `price_desc` | `ORDER BY price DESC` |
| `date_newest` | `ORDER BY created_at DESC` |
| `date_oldest` | `ORDER BY created_at ASC` |

## Shared Filter Builder (filter-builder.ts)

Used by `cluster-queries.ts` and `advanced-queries.ts` (GraphQL). Provides `buildFilterClauses()` which generates SQL fragments for:

- `propertyCategory` - `property_category = ANY($N)` (array, partition pruning)
- `priceMin` / `priceMax` - range filters
- `transactionType` - equality filter
- `bedroomsMin` / `bedroomsMax` - OR across `apt_bedrooms` / `house_bedrooms` with category guard
- `sqmMin` / `sqmMax` - OR across `apt_sqm` / `house_sqm_living` / `land_area_plot_sqm` / `comm_floor_area`
- `hasParking` / `hasElevator` / `hasGarden` - OR across category-specific boolean columns

Key difference from `query-builder.ts`: the shared filter builder adds category guards (`property_category = 'apartment' AND apt_bedrooms >= $N`), making filters more precise when property_category is known.

## Geo Search Queries

**File:** `src/database/geo-search.ts`

### KNN Radius Search

Uses PostGIS GiST index on `geom_point` for ordered nearest-neighbor traversal:

```sql
SELECT ...,
  ST_Distance(geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0 AS distance_km
FROM properties
WHERE
  geom_point IS NOT NULL
  AND status = 'active'
  AND (canonical_property_id IS NULL OR id = canonical_property_id)
ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
LIMIT $3
```

The `<->` operator triggers GiST ordered traversal - visits only rows needed for LIMIT, starting from nearest. Results are post-filtered in JavaScript to enforce the actual circle radius (KNN returns a bounding square).

### Bounding Box Search

For map views, uses `&&` envelope operator with GiST index:

```sql
WHERE geom_point && ST_MakeEnvelope($west, $south, $east, $north, 4326)
```

## Map Clustering Queries

**File:** `src/database/cluster-queries.ts`

Three strategies based on zoom level:

### Geohash Clustering (Zoom 1-14)

```sql
SELECT
  LEFT(ST_GeoHash(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), $precision), $precision) AS cluster_id,
  COUNT(*), AVG(latitude), AVG(longitude), AVG(price), MIN(price), MAX(price)
FROM properties
WHERE latitude BETWEEN $south AND $north AND longitude BETWEEN $west AND $east
GROUP BY cluster_id
LIMIT 500
```

Precision scales with zoom:

| Zoom | Precision | Cell Size |
|------|-----------|-----------|
| 1-4 | 2 | ~1250 km |
| 5-7 | 3 | ~156 km |
| 8-10 | 4 | ~39 km |
| 11-12 | 5 | ~5 km |
| 13-14 | 6 | ~1.2 km |

### Grid Clustering (Zoom 15-16)

```sql
SELECT
  ST_SnapToGrid(ST_MakePoint(longitude, latitude), $gridSize) AS grid_cell,
  COUNT(*), ST_Centroid(ST_Collect(geom)), AVG(price)
FROM properties
WHERE ...
GROUP BY grid_cell
LIMIT 500
```

| Zoom | Grid Size | Cell Size |
|------|-----------|-----------|
| 15 | 0.001 | ~110 m |
| 16 | 0.0005 | ~55 m |

### Individual Properties (Zoom 17+)

Direct query with CASE expressions to resolve category-specific fields:

```sql
CASE property_category
  WHEN 'apartment' THEN apt_bedrooms
  WHEN 'house' THEN house_bedrooms
END as bedrooms
```

Limited to 1000 properties per tile.

## Aggregation Queries

**File:** `src/routes/aggregations.ts`

Uses a single-pass CTE approach to compute all facets in one database round-trip:

```sql
WITH base AS (SELECT ... FROM properties WHERE ...),
  type_agg AS (SELECT property_type, COUNT(*) FROM base GROUP BY property_type),
  price_agg AS (SELECT CASE ... END AS bucket, COUNT(*) FROM base GROUP BY bucket),
  bed_agg AS (...),
  city_agg AS (...),
  portal_agg AS (...)
SELECT 'type' AS facet, val, cnt FROM type_agg
UNION ALL SELECT 'price', ... FROM price_agg
UNION ALL ...
```

Results from multiple countries are merged in-memory with accumulator maps.

## Performance Optimizations

1. **Partition pruning**: including `property_category` in WHERE lets PostgreSQL skip irrelevant partitions
2. **Capped COUNT**: avoids full-table scans for total count
3. **Count caching**: page 2+ reuses cached count from page 1
4. **Single-flight coalescing**: deduplicates concurrent identical requests
5. **Parallel per-country queries**: data and count queries run simultaneously across all countries
6. **Over-fetching**: fetches `(limit + offset) * 2` rows per country for accurate global sorting
7. **KNN GiST traversal**: geo queries visit only the minimum rows needed
8. **Tile-based map cache**: deterministic tile coordinates give near-100% cache hit rate
