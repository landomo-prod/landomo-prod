# OSM Boundary Sync

The polygon service syncs administrative boundaries from OpenStreetMap via the Overpass API.

## How It Works

The sync process runs in two phases:

### Phase 1: Data Collection

For each requested admin level, the service queries the Overpass API:

```
[out:json][timeout:6000];
area["ISO3166-1"="CZ"][admin_level=2]->.country;
relation(area.country)[admin_level={level}];
out body;
>;
out skel qt;
```

This returns all relations (boundaries), ways (line segments), and nodes (points) for that admin level within the country. The service collects:

- **Relations**: Administrative boundary definitions with tags and member references
- **Ways**: Line segments that form boundary edges
- **Nodes**: Geographic coordinates (lat/lon) of way vertices

### Phase 2: Geometry Processing

For each relation:

1. **Extract outer/inner ways** from relation members by role
2. **Assemble rings** by connecting ways end-to-end (handles reversed ways)
3. **Clean rings**: remove duplicate points, ensure closure, fix winding order (outer=CCW, inner=CW per GeoJSON spec)
4. **Assign inner rings** to outer rings using `@turf/boolean-within`
5. **Build geometry**: Single outer ring = Polygon, multiple = MultiPolygon
6. **UPSERT to PostGIS** using `ST_GeomFromGeoJSON()` with `ON CONFLICT (osm_relation_id)`

### Hierarchy Detection

Parent-child relationships are determined by:
1. Checking relation members for `subarea`/`inner`/`admin_centre` roles
2. Falling back to admin level hierarchy (parent = admin_level - 1)

## Admin Levels

Default sync levels and their typical meanings:

| Level | Typical Meaning | Example |
|-------|----------------|---------|
| 2 | Country | Czech Republic |
| 4 | Region/State | Jihomoravsky kraj |
| 6 | District | Brno-mesto |
| 8 | Municipality | Brno |
| 9 | Borough/City part | Brno-stred |
| 10 | Neighborhood | Veveri |

The full default range in `OverpassSyncService.sync()` is `[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]`. When triggered via API, the route defaults to `[2, 4, 6, 8, 9, 10]`.

## Skip Recently Updated

When `skipRecentlyUpdated` is true (default), areas with `updated_at` within the last month are skipped. This avoids redundant Overpass queries for data that hasn't changed.

## Running a Sync

### Via API

```bash
curl -X POST http://localhost:3100/api/v1/sync/overpass \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"countryCode": "CZ", "adminLevels": [2, 4, 6, 8]}'
```

### Via CLI Script

```bash
# Default: Czech Republic, all levels
npm run sync:overpass

# Custom country and levels
SYNC_COUNTRY=SK SYNC_ADMIN_LEVELS=2,4,6,8 npm run sync:overpass

# Force re-sync (don't skip recent)
SYNC_SKIP_RECENT=false npm run sync:overpass
```

The CLI script is at `src/scripts/sync-overpass.ts`.

## Overpass API Configuration

| Config | Default | Description |
|--------|---------|-------------|
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` | Overpass API endpoint |
| `OVERPASS_TIMEOUT` | `6000` | Query timeout in seconds |
| `OVERPASS_RETRY_DELAY` | `5000` | Delay between retries (ms) |
| `OVERPASS_MAX_RETRIES` | `3` | Max retry attempts |

## Considerations

- The Overpass API has rate limits. A full country sync can take several minutes.
- The service rotates user agents across requests.
- Geometry processing is CPU-intensive for large countries with many boundaries.
- Failed relations are logged and counted but don't abort the entire sync.
