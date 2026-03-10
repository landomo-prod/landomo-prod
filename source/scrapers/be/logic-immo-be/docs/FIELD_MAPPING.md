# Logic-Immo.be Field Mapping

## Apartment Transformation

| Logic-Immo Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"logic-immo-be-" + raw.id` | Unique per property |
| `title` | `title` | string | Direct or fallback | Fallback: `"Apartment - {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR, no conversion |
| `currency` | `currency` | string | Direct (default "EUR") | Static EUR for Belgium |
| `transaction_type` | `transaction_type` | string | `raw.transaction_type === 'rent' ? 'rent' : 'sale'` | Rent or sale |
| - | `property_category` | string | `"apartment"` | Static |
| `address.street` | `location.address` | string | Direct, empty string default | Street name |
| `address.city` | `location.city` | string | Direct, empty string default | City name |
| `address.postal_code` | `location.postal_code` | string | Direct (snake_case) | Belgian postal code |
| `address.province` | `location.region` | string | Direct, empty string default | Province/region |
| - | `location.country` | string | `"BE"` | Static |
| `address.lat` + `address.lng` | `location.coordinates` | object | Included if both present | `{ lat, lng }` structure |
| `bedrooms` | `bedrooms` | number | `raw.bedrooms ?? (raw.rooms ? Math.max(raw.rooms - 1, 0) : 0)` | Derived from rooms if needed |
| `bathrooms` | `bathrooms` | number | Direct | May be undefined |
| `surface` | `sqm` | number | `raw.surface \|\| raw.living_surface \|\| 0` | Total living surface |
| `living_surface` | `sqm` | number | Fallback if surface missing | Alternative field name |
| `floor` | `floor` | number | Direct | Current floor number |
| `total_floors` | `total_floors` | number | Direct | Total floors in building |
| `rooms` | `rooms` | number | Direct | Total room count |
| `has_elevator` | `has_elevator` | boolean | Direct (default false) | Elevator/lift present |
| `has_balcony` | `has_balcony` | boolean | Direct (default false) | Balcony |
| `has_parking` | `has_parking` | boolean | Direct (default false) | Parking available |
| `has_basement` | `has_basement` | boolean | Direct (default false) | Basement |
| `has_terrace` | `has_terrace` | boolean | Direct | Terrace |
| `has_garage` | `has_garage` | boolean | Direct | Garage |
| `year_built` | `year_built` | number | Direct | Build year |
| `construction_type` | `construction_type` | string | `mapConstructionType(raw.construction_type)` | See mapping function |
| `condition` | `condition` | string | `mapCondition(raw.condition)` | See mapping function |
| `heating_type` | `heating_type` | string | Direct | e.g., "gaz", "électrique" |
| `energy_class` | `energy_class` | string | Direct | A-G energy label |
| `furnished` | `furnished` | string | `raw.furnished ? 'furnished' : undefined` | Furnished/unfurnished |
| `published_at` | `published_date` | ISO8601 | Direct | Publication timestamp |
| `description` | `description` | string | Direct | HTML or plain text |
| `features` | `features` | object | Direct | Additional features object |
| `images` | `images` | string[] | Direct | Image URLs array |
| `url` | `source_url` | string | Direct or template | Fallback: `https://www.logic-immo.be/fr/detail/{id}` |
| - | `source_platform` | string | `"logic-immo-be"` | Static |
| - | `status` | string | `"active"` | Static for new listings |
| `agent.name` | `agent.name` | string | Direct | Agent name |
| `agent.phone` | `agent.phone` | string | Direct | Agent phone |
| `agent.email` | `agent.email` | string | Direct | Agent email |
| `agent.agency` | `agent.agency_name` | string | Direct | Agency name |

## House Transformation

| Logic-Immo Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"logic-immo-be-" + raw.id` | Unique identifier |
| `title` | `title` | string | Direct or fallback | Fallback: `"House - {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR |
| `currency` | `currency` | string | Direct (default "EUR") | Static EUR |
| `transaction_type` | `transaction_type` | string | Rent or sale | Derived |
| - | `property_category` | string | `"house"` | Static |
| `address.*` | `location.*` | object | Same as apartment | Full location mapping |
| `bedrooms` | `bedrooms` | number | Derived from rooms if needed | See apartment logic |
| `bathrooms` | `bathrooms` | number | Direct | May be undefined |
| `living_surface` | `sqm_living` | number | `raw.living_surface \|\| raw.surface \|\| 0` | Living area |
| `plot_surface` | `sqm_plot` | number | Direct (default 0) | Land/plot area |
| `rooms` | `rooms` | number | Direct | Total rooms |
| `has_garden` | `has_garden` | boolean | Direct (default false) | Garden |
| `garden_surface` | `garden_area` | number | Direct | Garden area sqm |
| `has_garage` | `has_garage` | boolean | Direct (default false) | Garage |
| `has_parking` | `has_parking` | boolean | Direct (default false) | Parking |
| `has_basement` | `has_basement` | boolean | Direct (default false) | Basement |
| `has_terrace` | `has_terrace` | boolean | Direct | Terrace |
| `has_balcony` | `has_balcony` | boolean | Direct | Balcony |
| `year_built` | `year_built` | number | Direct | Build year |
| `construction_type` | `construction_type` | string | `mapHouseConstructionType()` | Specialized mapping |
| `condition` | `condition` | string | `mapCondition()` | Property condition |
| `heating_type` | `heating_type` | string | Direct | Heating system |
| `energy_class` | `energy_class` | string | Direct | Energy label |
| `furnished` | `furnished` | string | `raw.furnished ? 'furnished' : undefined` | Furnished |
| `published_at` | `published_date` | ISO8601 | Direct | Publication date |
| `description` | `description` | string | Direct | Description |
| `features` | `features` | object | Direct | Features object |
| `images` | `images` | string[] | Direct | Image URLs |
| `url` | `source_url` | string | Direct or template | Canonical URL |
| - | `source_platform` | string | `"logic-immo-be"` | Static |
| - | `status` | string | `"active"` | Static |
| `agent.*` | `agent.*` | object | Direct mapping | See apartment agent fields |

## Land Transformation

| Logic-Immo Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"logic-immo-be-" + raw.id` | Unique identifier |
| `title` | `title` | string | Direct or fallback | Fallback: `"Land - {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR |
| `currency` | `currency` | string | Direct (default "EUR") | Static EUR |
| `transaction_type` | `transaction_type` | string | Rent or sale | Derived |
| - | `property_category` | string | `"land"` | Static |
| `address.*` | `location.*` | object | Same mapping | Full location |
| `plot_surface` | `area_plot_sqm` | number | Direct (default 0) | Land area |
| `year_built` | `year_built` | number | Direct | Year (if applicable) |
| `published_at` | `published_date` | ISO8601 | Direct | Publication date |
| `description` | `description` | string | Direct | Description |
| `features` | `features` | object | Direct | Features |
| `images` | `images` | string[] | Direct | Images |
| `url` | `source_url` | string | Direct or template | Canonical URL |
| - | `source_platform` | string | `"logic-immo-be"` | Static |
| - | `status` | string | `"active"` | Static |

## Commercial Transformation

| Logic-Immo Field (Raw) | TierI Field | Data Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | `"logic-immo-be-" + raw.id` | Unique identifier |
| `title` | `title` | string | Direct or fallback | Fallback: `"Commercial - {city}"` |
| `price` | `price` | number | Direct (default 0) | EUR |
| `currency` | `currency` | string | Direct (default "EUR") | Static EUR |
| `transaction_type` | `transaction_type` | string | Rent or sale | Derived |
| - | `property_category` | string | `"commercial"` | Static |
| `address.*` | `location.*` | object | Same mapping | Full location |
| `surface` | `sqm_total` | number | `raw.surface \|\| raw.living_surface \|\| 0` | Total area |
| `plot_surface` | `sqm_plot` | number | Direct | Plot area |
| `floor` | `floor` | number | Direct | Floor number |
| `total_floors` | `total_floors` | number | Direct | Total floors |
| `has_elevator` | `has_elevator` | boolean | Direct (default false) | Elevator |
| `has_parking` | `has_parking` | boolean | Direct (default false) | Parking |
| `bathrooms` | `bathroom_count` | number | Direct | Bathroom count |
| - | `has_bathrooms` | boolean | `raw.bathrooms != null ? raw.bathrooms > 0 : false` | Derived |
| `year_built` | `year_built` | number | Direct | Build year |
| `condition` | `condition` | string | `mapCondition()` | Condition mapping |
| `heating_type` | `heating_type` | string | Direct | Heating |
| `energy_class` | `energy_class` | string | Direct | Energy label |
| `published_at` | `published_date` | ISO8601 | Direct | Publication date |
| `description` | `description` | string | Direct | Description |
| `features` | `features` | object | Direct | Features |
| `images` | `images` | string[] | Direct | Images |
| `url` | `source_url` | string | Direct or template | Canonical URL |
| - | `source_platform` | string | `"logic-immo-be"` | Static |
| - | `status` | string | `"active"` | Static |
| `agent.*` | `agent.*` | object | Direct mapping | Agent info |

## Mapping Functions

### mapConstructionType (Apartment)
```
"brique"/"brick"     → "brick"
"béton"/"concrete"   → "concrete"
"mixte"/"mixed"      → "mixed"
default              → undefined
```

### mapHouseConstructionType
```
"brique"/"brick"     → "brick"
"bois"/"wood"        → "wood"
"pierre"/"stone"     → "stone"
"béton"/"concrete"   → "concrete"
"mixte"/"mixed"      → "mixed"
default              → undefined
```

### mapCondition (Apartment/House/Commercial)
```
"neuf"/"new"         → "new"
"excellent"/"parfait"→ "excellent"
"bon"/"good"         → "good"
"rénov..."/"renovat" → "after_renovation"
"rénover"/"to renovate" → "requires_renovation"
default              → undefined
```

## Common Transformation Rules

### Default Values
- `price`: 0 if missing
- `sqm_total`, `sqm_living`, `sqm_plot`, `area_plot_sqm`: 0 if missing
- `bedrooms`: Derived from `rooms - 1` if not provided (minimum 0)
- Boolean features: `false` if missing
- `status`: Always `"active"` on initial ingest

### Location Handling
- All address fields default to empty string `""`
- Coordinates included only if both `lat` and `lng` are present
- Structure: `{ lat: number, lng: number }`

### Surface Priority
- `sqm` (apartment): `raw.surface || raw.living_surface || 0`
- `sqm_living` (house): `raw.living_surface || raw.surface || 0`
- Fallback to 0 if neither present

### Furnished Field
- Only included if truthy: `raw.furnished ? 'furnished' : undefined`
- Omitted if falsy or undefined

### Agent Information
- Included only if agent object exists
- Maps: `name`, `phone`, `email`, `agency` → `agency_name`
