# Realingo - Field Mapping Reference

## Mapping Overview

| Portal Field | TierI Field | Category | Transformation | Required | Notes |
|--------------|-------------|----------|----------------|----------|-------|
| `id` | `portal_id` | all | `"realingo-" + id` | Yes | Unique ID |
| `category` | `title` | all | disposition string or raw value | Yes | Encoded type info |
| `url` | `source_url` | all | prepend `https://www.realingo.cz` | Yes | Relative path |
| `purpose` | `transaction_type` | all | `RENT` -> `"rent"`, else `"sale"` | Yes | |
| `price.total` | `price` | all | direct, default `0` | Yes | |
| `price.currency` | `currency` | all | direct, default `"CZK"` | Yes | |
| `location.address` | `location.address` | all | direct, default `"Unknown"` | Yes | |
| `location.address` | `location.city` | all | last comma-separated part | Yes | Parsed |
| `location.address` | `location.region` | all | first comma-separated part | No | Parsed |
| `location.latitude` | `location.coordinates.lat` | all | direct | No | |
| `location.longitude` | `location.coordinates.lon` | all | direct | No | |
| `photos.main` | `media.main_image` | all | `https://www.realingo.cz/image/{id}` | No | |
| `photos.list` | `media.images` | all | map to full URLs | No | |
| `updatedAt` | -- | -- | stored in portal_metadata | No | |
| `createdAt` | -- | -- | stored in portal_metadata | No | |

## Category: Apartment

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `category` | `bedrooms` | parse `FLAT{N}_{type}`, N = bedrooms | `"FLAT3_KK"` -> `3` |
| `category` | `rooms` | N + 1 | `"FLAT3_KK"` -> `4` |
| `area.floor` | `sqm` | direct, default `0` | `75` -> `75` |
| -- | `has_elevator` | hardcoded `false` | Not in API |
| -- | `has_balcony` | hardcoded `false` | Not in API |
| -- | `has_parking` | hardcoded `false` | Not in API |
| -- | `has_basement` | hardcoded `false` | Not in API |
| -- | `bathrooms` | hardcoded `1` | Not in API |

### Optional Fields
| Portal Field | TierI Field | Transformation | Notes |
|--------------|-------------|----------------|-------|
| -- | `floor` | `undefined` | Not in API |
| -- | `total_floors` | `undefined` | Not in API |
| -- | `condition` | `undefined` | Not in API |
| -- | `heating_type` | `undefined` | Not in API |
| -- | `energy_class` | `undefined` | Not in API |
| -- | `year_built` | `undefined` | Not in API |
| -- | `furnished` | `undefined` | Not in API |
| -- | `description` | `""` | Not in API |
| -- | `features` | `[]` | Not in API |

## Category: House

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `area.floor` | `sqm_living` | direct, default `0` | `120` -> `120` |
| `area.plot` | `sqm_plot` | direct, default `0` | `500` -> `500` |
| -- | `bedrooms` | hardcoded `1` | Not in API |
| -- | `stories` | hardcoded `1` | Not in API |
| -- | `has_garden` | hardcoded `false` | Not in API |
| -- | `has_garage` | hardcoded `false` | Not in API |
| -- | `has_parking` | hardcoded `false` | Not in API |
| -- | `has_basement` | hardcoded `false` | Not in API |

### Title
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `category` | `title` | `HOUSE_FAMILY` -> `"family"` via `parseDisposition()` |

## Category: Land

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `area.plot` / `area.floor` | `area_plot_sqm` | prefer `plot`, fallback `floor`, default `0` | `1200` -> `1200` |
| -- | `zoning` | `undefined` | Not in API |
| -- | `water_supply` | `undefined` | Not in API |
| -- | `sewage` | `undefined` | Not in API |
| -- | `electricity` | `undefined` | Not in API |
| -- | `gas` | `undefined` | Not in API |

## Category: Commercial

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `area.floor` | `sqm_total` | direct, default `0` | `200` -> `200` |
| -- | `has_elevator` | hardcoded `false` | Not in API |
| -- | `has_parking` | hardcoded `false` | Not in API |
| -- | `has_bathrooms` | hardcoded `false` | Not in API |

## Category: Other

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `area.floor` | `sqm_total` | direct, default `0` | `50` -> `50` |
| -- | `property_subtype` | hardcoded `"other"` | |
| -- | `has_parking` | hardcoded `false` | Not in API |
| -- | `has_electricity` | hardcoded `false` | Not in API |

## Special Handling

### Calculated Fields
- **bedrooms** (apartment): Derived from `category` field. `"FLAT3_KK"` = 3 bedrooms. Default: 1
- **rooms** (apartment): bedrooms + 1 (accounts for living room)
- **title**: Disposition string for apartments (`"3+kk"`), subtype for houses/land (`"family"`), raw category for commercial/other

### Default Values
| Field | Default | Reason |
|-------|---------|--------|
| `status` | `"active"` | All discovered listings are active |
| `country` | `"Czech Republic"` | Hardcoded |
| `currency` | `"CZK"` | Fallback |
| `source_platform` | `"realingo"` | Hardcoded |
| `description` | `""` | Not available in API |
| `features` | `[]` | Not available in API |
| `bathrooms` | `1` | Not available in API |

### Missing Field Strategy
| TierI Field | If Missing | Strategy |
|-------------|-----------|----------|
| `bedrooms` | No disposition in category | Default to `1` |
| `sqm` / `sqm_living` | `area.floor` missing | Default to `0` |
| `sqm_plot` | `area.plot` missing | Default to `0` |
| `area_plot_sqm` (land) | `area.plot` missing | Fallback to `area.floor`, then `0` |
| `price` | `price.total` null | Default to `0` |
| `location.city` | address missing | Default to `"Unknown"` |
| `has_*` fields | Not in API | Default to `false` |
| `coordinates` | lat/lon missing | `undefined` (omitted) |

## Tier II: Country Specific

Fields stored in `country_specific.czech` JSONB:

| Field | Category | Source | Notes |
|-------|----------|--------|-------|
| `disposition` | apartment | `parseDisposition(category)` | e.g. `"3+kk"` |
| `ownership` | apartment, house, commercial | -- | Always `undefined` |
| `condition` | apartment, commercial | -- | Always `undefined` |
| `heating_type` | apartment, commercial | -- | Always `undefined` |
| `construction_type` | apartment | -- | Always `undefined` |
| `energy_rating` | apartment, house, commercial | -- | Always `undefined` |
| `furnished` | apartment, house, commercial | -- | Always `undefined` |
| `zoning` | land | -- | Always `undefined` |
| `water_supply` | land | -- | Always `undefined` |
| `sewage` | land | -- | Always `undefined` |
| `electricity` | land | -- | Always `undefined` |
| `gas` | land | -- | Always `undefined` |
| `road_access` | land | -- | Always `undefined` |

## Tier III: Portal Metadata

Fields stored in `portal_metadata.realingo` JSONB:

| Field | Source | Example |
|-------|--------|---------|
| `id` | `offer.id` | `"abc123"` |
| `ad_id` | `offer.adId` | `"def456"` |
| `category` | `offer.category` | `"FLAT3_KK"` |
| `property_type` | `offer.property` | `"FLAT"` |
| `purpose` | `offer.purpose` | `"SELL"` |
| `url` | `offer.url` | `"/prodej/byt/3-kk/praha"` |
| `vat` | `offer.price.vat` | `null` |
| `area` | `offer.area` (full object, apartment only) | `{floor: 75, cellar: 5, ...}` |
| `floor_area_sqm` | `offer.area.floor` (house/land/commercial/other) | `120` |
| `photo_main` | `offer.photos.main` | `"photo-id-abc"` |
| `photo_gallery` | `offer.photos.list` (apartment only) | `["id-1", "id-2"]` |
| `raw_address` | `offer.location.address` | `"Praha 5, Praha"` |
| `coordinates` | lat/lon (apartment only) | `{lat: 50.07, lon: 14.43}` |
| `updated_at` | `offer.updatedAt` (apartment only) | `"2026-02-15T..."` |
| `created_at` | `offer.createdAt` (apartment only) | `"2026-01-20T..."` |
