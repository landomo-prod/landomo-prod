# Immovlan.be Field Mapping

## Apartment Transformation

| Immovlan Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"immovlan-" + raw.id` | Unique per property |
| `title` | `title` | string | Direct mapping or fallback | Fallback: `"Apartment in {city}"` |
| `price` | `price` | number | Direct mapping (default 0) | EUR, no conversion |
| - | `currency` | string | `"EUR"` | Static |
| - | `transaction_type` | string | `"sale" \| "rent"` | From scraper phase, not raw data |
| - | `property_category` | string | `"apartment"` | Static, category from phase 1 |
| `address.street` | `location.address` | string | `[street, number].join(' ')` | Filter falsy values |
| `address.city` | `location.city` | string | Direct mapping | Fallback city name |
| `address.postalCode` | `location.zip_code` | string | Direct mapping | Belgian postcode |
| `address.province` | `location.region` | string | Direct mapping | Flanders/Wallonia/Brussels |
| - | `location.country` | string | `"BE"` | Static |
| `address.latitude` | `location.latitude` | number | Direct mapping | WGS84 |
| `address.longitude` | `location.longitude` | number | Direct mapping | WGS84 |
| `bedrooms` | `bedrooms` | number | Direct mapping (default 0) | Integer count |
| `bathrooms` | `bathrooms` | number | Direct mapping | May be undefined |
| `surface` | `sqm` | number | Direct mapping (default 0) | Living area |
| `building.floor` | `floor` | number | Direct mapping | Current floor |
| `building.floors` | `total_floors` | number | Direct mapping | Total floors in building |
| `features.hasLift` | `has_elevator` | boolean | Direct mapping (default false) | Lift/elevator |
| `features.hasBalcony` | `has_balcony` | boolean | Direct mapping (default false) | Balcony |
| `features.hasParking` | `has_parking` | boolean | Direct mapping (default false) | Parking spot |
| `features.parkingSpaces` | `parking_spaces` | number | Direct mapping | Count of spaces |
| `features.hasBasement` | `has_basement` | boolean | Direct mapping (default false) | Basement |
| `features.hasTerrace` | `has_terrace` | boolean | Direct mapping (default false) | Terrace |
| `features.terraceSurface` | `terrace_area` | number | Direct mapping | Area in sqm |
| `features.hasGarage` | `has_garage` | boolean | Direct mapping (default false) | Garage |
| `building.constructionYear` | `year_built` | number | Direct mapping | Build year |
| `energy.heatingType` | `heating_type` | string | Direct mapping | e.g., "gas", "electric" |
| `energy.epcScore` | `energy_class` | string | Direct mapping | A-G scale |
| `description` | `description` | string | Direct mapping | HTML or plain text |
| `images` | `images` | string[] | Map URLs; handle objects | `images?.map(i => typeof i === 'string' ? i : i.url)` |
| `publicationDate` | `published_date` | ISO8601 | Direct mapping | Publication timestamp |
| - | `source_url` | string | Template: `https://www.immovlan.be/en/property/{id}` | Canonical URL |
| - | `source_platform` | string | `"immovlan"` | Static |
| - | `status` | string | `"active"` | Static for new listings |

## House Transformation

| Immovlan Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"immovlan-" + raw.id` | Unique per property |
| `title` | `title` | string | Direct mapping or fallback | Fallback: `"House in {city}"` |
| `price` | `price` | number | Direct mapping (default 0) | EUR, no conversion |
| - | `currency` | string | `"EUR"` | Static |
| - | `transaction_type` | string | `"sale" \| "rent"` | From scraper phase |
| - | `property_category` | string | `"house"` | Static |
| `address.*` | `location.*` | string | Same as apartment | See location fields above |
| `bedrooms` | `bedrooms` | number | Direct mapping (default 0) | Integer count |
| `bathrooms` | `bathrooms` | number | Direct mapping | May be undefined |
| `surface` | `sqm_living` | number | Direct mapping (default 0) | Living/habitable area |
| `landSurface` | `sqm_plot` | number | Direct mapping | Land/plot area |
| `building.floors` | `stories` | number | Direct mapping | Number of stories |
| `features.hasGarden` | `has_garden` | boolean | Direct mapping (default false) | Garden |
| `features.gardenSurface` | `garden_area` | number | Direct mapping | Garden area sqm |
| `features.hasGarage` | `has_garage` | boolean | Direct mapping (default false) | Garage |
| `features.hasParking` | `has_parking` | boolean | Direct mapping (default false) | Parking |
| `features.hasBasement` | `has_basement` | boolean | Direct mapping (default false) | Basement |
| `features.hasPool` | `has_pool` | boolean | Direct mapping | Swimming pool |
| `features.hasTerrace` | `has_terrace` | boolean | Direct mapping | Terrace |
| `features.terraceSurface` | `terrace_area` | number | Direct mapping | Terrace area sqm |
| `building.constructionYear` | `year_built` | number | Direct mapping | Build year |
| `energy.heatingType` | `heating_type` | string | Direct mapping | Heating system |
| `energy.epcScore` | `energy_class` | string | Direct mapping | A-G energy label |
| `description` | `description` | string | Direct mapping | Property description |
| `images` | `images` | string[] | Map URLs | Same as apartment |
| `publicationDate` | `published_date` | ISO8601 | Direct mapping | Publication date |
| - | `source_url` | string | Template URL | Direct mapping |
| - | `source_platform` | string | `"immovlan"` | Static |
| - | `status` | string | `"active"` | Static |

## Land Transformation

| Immovlan Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"immovlan-" + raw.id` | Unique identifier |
| `title` | `title` | string | Direct or fallback | Fallback: `"Land in {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR |
| - | `currency` | string | `"EUR"` | Static |
| - | `transaction_type` | string | `"sale" \| "rent"` | From phase 1 |
| - | `property_category` | string | `"land"` | Static |
| `address.*` | `location.*` | string | Same mapping as above | Full location object |
| `surface` | `area_plot_sqm` | number | Direct (default 0) | Total land area |
| `building.constructionYear` | `year_built` | number | Direct | Year built (if applicable) |
| `description` | `description` | string | Direct | Property description |
| `images` | `images` | string[] | Map URLs | Image array |
| `publicationDate` | `published_date` | ISO8601 | Direct | Listing date |
| - | `source_url` | string | Template URL | Canonical link |
| - | `source_platform` | string | `"immovlan"` | Static |
| - | `status` | string | `"active"` | Static |

## Commercial Transformation

| Immovlan Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"immovlan-" + raw.id` | Unique identifier |
| `title` | `title` | string | Direct or fallback | Fallback: `"Commercial in {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR |
| - | `currency` | string | `"EUR"` | Static |
| - | `transaction_type` | string | `"sale" \| "rent"` | From phase 1 |
| - | `property_category` | string | `"commercial"` | Static |
| `address.*` | `location.*` | string | Same mapping | Full location object |
| `surface` | `sqm_total` | number | Direct (default 0) | Total commercial area |
| `landSurface` | `sqm_plot` | number | Direct | Plot/land area |
| `features.hasLift` | `has_elevator` | boolean | Direct (default false) | Lift |
| `features.hasParking` | `has_parking` | boolean | Direct (default false) | Parking |
| `bathrooms` | `bathroom_count` | number | Direct | Number of bathrooms |
| - | `has_bathrooms` | boolean | `bathrooms > 0 ? true : false` | Derived |
| `energy.epcScore` | `energy_class` | string | Direct | Energy label |
| `description` | `description` | string | Direct | Property description |
| `images` | `images` | string[] | Map URLs | Image array |
| `publicationDate` | `published_date` | ISO8601 | Direct | Listing date |
| - | `source_url` | string | Template URL | Canonical link |
| - | `source_platform` | string | `"immovlan"` | Static |
| - | `status` | string | `"active"` | Static |

## Common Transformation Rules

### Default Values
- `price`: 0 if missing
- `sqm` / `sqm_living` / `sqm_plot` / `area_plot_sqm`: 0 if missing
- `bedrooms`: 0 if missing
- Boolean features: `false` if missing
- `status`: Always `"active"` on initial ingest

### URL Construction
- All properties link to: `https://www.immovlan.be/en/property/{raw.id}`
- Portal ID: `"immovlan-" + raw.id`

### Coordinate System
- Latitude/Longitude in WGS84 (standard web mapping)
- If missing, location.latitude and location.longitude are `undefined`

### Image Handling
- Immovlan can return images as strings (direct URLs) or objects `{ url: string }`
- Transformer normalizes to string array: `images?.map(i => typeof i === 'string' ? i : i.url)`

### Transaction Type
- Not stored in raw listing data
- Derived from discovery phase: `transactionType === 'sale' ? 'sale' : 'rent'`
- Passed from orchestrator to transformer
