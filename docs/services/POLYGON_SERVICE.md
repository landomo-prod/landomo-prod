# Polygon Service

OSM administrative boundary management and point-in-polygon queries.

## Overview

**Port**: 4300  
**Technology**: Node.js + PostGIS + Redis  
**Data Source**: OpenStreetMap Overpass API

## Features

- Boundary search by name
- Point-in-polygon queries  
- Admin levels: 2/4/6/8/9/10
- Monthly automated OSM sync
- Redis caching for performance

## API Endpoints

See `/docs/API_REFERENCE.md#polygon-service-api`

- `GET /boundaries/search` - Search by name
- `POST /boundaries/point-in-polygon` - Find containing boundaries
- `POST /sync/overpass` - Manual sync trigger

## Usage

```bash
# Find city
curl "http://localhost:4300/boundaries/search?q=Prague&level=8"

# Point-in-polygon
curl -X POST http://localhost:4300/boundaries/point-in-polygon \
  -H "Content-Type: application/json" \
  -d '{"lat": 50.0755, "lon": 14.4378, "country": "Czech Republic"}'
```

## Data Model

```sql
CREATE TABLE boundaries (
  id UUID PRIMARY KEY,
  osm_id VARCHAR(20) NOT NULL,
  name TEXT NOT NULL,
  admin_level INTEGER NOT NULL,
  country VARCHAR(100),
  geometry GEOMETRY(MultiPolygon, 4326),
  bbox JSONB
);

CREATE INDEX idx_boundaries_geom ON boundaries USING GIST(geometry);
```

---

**Last Updated**: 2026-02-16
