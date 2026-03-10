# iDNES Reality - Field Mapping Reference

## Universal Mappings (All Categories)

| Portal Field | TierI Field | Transformation | Required |
|--------------|-------------|----------------|----------|
| `listing.title` | `title` | Direct, default "Untitled" | Yes |
| `listing.price` | `price` | Direct, default 0 | Yes |
| *(hardcoded)* | `currency` | Always `CZK` | Yes |
| `listing.transactionType` | `transaction_type` | "rent"/"pronajem" -> `rent`, else `sale` | Yes |
| `listing.location.city` | `location.city` | Falls back to `district`, then "Unknown" | Yes |
| `listing.location.district` | `location.region` | Direct | No |
| `listing.location.address` | `location.address` | Direct | No |
| `listing.coordinates.lat/lng` | `location.coordinates.lat/lon` | `lng` renamed to `lon` | No |
| *(hardcoded)* | `location.country` | Always "Czech Republic" | Yes |
| `listing.url` | `source_url` | Direct | Yes |
| *(hardcoded)* | `source_platform` | Always `idnes-reality` | Yes |
| `idnes-{listing.id}` | `portal_id` | Prefixed with `idnes-` | Yes |
| *(hardcoded)* | `status` | Always `active` | Yes |
| `listing.description` | `description` | Falls back to `title`, then empty string | No |
| `listing.features` | `features` | Direct array, default `[]` | No |
| `listing.images` | `media.images` | Direct array, default `[]` | No |
| `listing.images[0]` | `media.main_image` | First image | No |
| `listing.metadata.published` | `published_date` | Direct | No |

## Category: Apartment

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|--------------|-------------|----------------|---------|
| `listing.rooms` | `bedrooms` | First number from regex, default 1 | "3" -> 3 |
| `listing.area` | `sqm` | Direct, default 0 | 65 |
| `listing.features[]` | `has_elevator` | `parseCzechFeatures()`, default false | |
| `listing.features[]` | `has_balcony` | `parseCzechFeatures()`, default false | |
| `listing.features[]` | `has_parking` | `parseCzechFeatures()`, default false | |
| `listing.features[]` | `has_basement` | `parseCzechFeatures()`, default false | |

### Optional Fields
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `listing.rooms` | `rooms` | First number from regex |
| `listing.floor` | `floor` | From detail page attributes |
| `listing.floor` | `floor_location` | 0=ground_floor, >=1=middle_floor |
| `listing.condition` | `condition` | `normalizeCondition()` + remapping |
| `listing.heatingType` | `heating_type` | `normalizeHeatingType()` |
| `listing.constructionType` | `construction_type` | `normalizeConstructionType()` |
| `listing.energyRating` | `energy_class` | `normalizeEnergyRating()` |
| `listing.furnished` | `furnished` | `normalizeFurnished()` |
| `listing._attributes[Kauce]` | `deposit` | Strip currency symbols, parse number |
| `listing._attributes[Rok rekonstrukce]` | `renovation_year` | Extract 4-digit year (1800-2100) |
| `listing._attributes[K nastehování]` | `available_from` | Czech date DD.MM.YYYY -> YYYY-MM-DD |
| `listing.features[]` | `has_loggia` | `parseCzechFeatures()` |
| `listing.features[]` | `has_terrace` | `parseCzechFeatures()` |
| `listing.features[]` | `has_garage` | `parseCzechFeatures()` |

### Hardcoded
| TierI Field | Value |
|-------------|-------|
| `property_category` | `apartment` |
| `bathrooms` | `1` |

## Category: House

### Required Fields
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `listing.rooms` | `bedrooms` | First number from regex, default 1 |
| `listing.area` | `sqm_living` | Direct, default 0 |
| *(not available)* | `sqm_plot` | Hardcoded 0 |
| `listing.features[]` | `has_garden` | `parseCzechFeatures()`, default false |
| `listing.features[]` | `has_garage` | `parseCzechFeatures()`, default false |
| `listing.features[]` | `has_parking` | `parseCzechFeatures()`, default false |
| `listing.features[]` | `has_basement` | `parseCzechFeatures()`, default false |

### Optional Fields
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `has_garage` | `garage_count` | 1 if true, else undefined |
| `has_parking` | `parking_spaces` | 1 if true, else undefined |
| Same condition/heating/construction/energy/furnished as apartment | | |
| Same deposit/renovation_year/available_from extraction as apartment | | |

### Hardcoded
| TierI Field | Value |
|-------------|-------|
| `property_category` | `house` |
| `bathrooms` | `1` |
| `has_pool` | `false` |
| `has_fireplace` | `false` |

## Category: Land

### Required Fields
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `listing.area` | `area_plot_sqm` | Direct, default 0 |

### Optional Fields
| Portal Field | TierI Field | Transformation |
|--------------|-------------|----------------|
| `listing.ownership` | `ownership_type` | Direct cast to enum |
| `listing._attributes[K nastehování]` | `available_from` | Czech date parsing |

### Not Available
All utility fields (`water_supply`, `sewage`, `electricity`, `gas`), `zoning`, `land_type`, `building_permit`, `terrain`, `soil_quality`, `cadastral_number` are set to `undefined`.

## Special Handling

### Deposit Extraction
Searches `_attributes` for Czech keys in order: `Kauce`, `Vratna kauce`, `Jistina`, `Deposit`. Strips currency symbols (Kc, EUR), spaces, commas, and periods before parsing the number.

### Renovation Year Extraction
Searches `_attributes` for: `Rok rekonstrukce`, `Rekonstrukce rok`, `Rok renovace`. Validates year is between 1800-2100.

### Available From Date
Searches `_attributes` for: `K nastehování`, `Dostupne od`, `Volne od`, `Nastehování`. Parses Czech date format `DD.MM.YYYY` to ISO `YYYY-MM-DD`.

### Floor Parsing
Handles Czech floor formats:
- "prizemni" -> 0 (ground floor)
- "3. podlazi" or "3. patro" -> 3
- Leading number -> parsed directly

### Default Values
| TierI Field | Default When Missing | Strategy |
|-------------|---------------------|----------|
| `bedrooms` | `1` | Fallback for apartments/houses |
| `sqm` / `sqm_living` | `0` | Required field, zero if missing |
| `sqm_plot` | `0` | Not available from iDNES list pages |
| `area_plot_sqm` | `0` | Required for land, zero if missing |
| `bathrooms` | `1` | Always assumed |
| `has_*` booleans | `false` | Default when not in features |
| `transaction_type` | `sale` | Default when type unclear |
| `title` | `Untitled` | Fallback |
| `city` | `Unknown` | Last resort fallback |
