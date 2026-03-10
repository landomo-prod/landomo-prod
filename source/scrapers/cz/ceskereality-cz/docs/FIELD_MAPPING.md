# CeskeReality - Field Mapping Reference

## Common Fields (All Categories)

| Source | Portal Field | TierI Field | Transformation | Required |
|--------|-------------|-------------|----------------|----------|
| JSON-LD | `name` | `title` | Direct, fallback `"Untitled"` | Yes |
| JSON-LD | `offers.price` | `price` | Direct, fallback `0` | Yes |
| JSON-LD | `offers.priceCurrency` | `currency` | Direct, fallback `"CZK"` | Yes |
| Constant | - | `transaction_type` | Always `"sale"` | Yes |
| Constant | - | `status` | Always `"active"` | Yes |
| Constant | - | `source_platform` | Always `"ceskereality-cz"` | Yes |
| Param | - | `source_url` | Detail page URL | Yes |
| Constant | - | `property_category` | From discovery URL | Yes |
| JSON-LD | `offers.areaServed.address.addressLocality` | `location.city` | Direct, fallback `"Unknown"` | Yes |
| Constant | - | `location.country` | Always `"Czech Republic"` | Yes |
| JSON-LD | `offers.areaServed.address.streetAddress` | `location.address` | Direct | No |
| JSON-LD | `offers.areaServed.address.postalCode` | `location.postal_code` | Direct | No |
| JSON-LD | `description` | `description` | Direct | No |
| HTML | Gallery images | `images` | Filter + dedup, fallback to JSON-LD single image | No |

## Category: Apartment

### Required Fields

| Source | Portal Field | TierI Field | Transformation | Example |
|--------|-------------|-------------|----------------|---------|
| JSON-LD | `name` regex | `bedrooms` | `(\d+)\+(?:kk\|\d)` -> int - 1, fallback 0 | `"2+kk"` -> 1 |
| HTML > JSON-LD | mapped `sqm` or `name` regex | `sqm` | HTML preferred, then `([\d\s]+)\s*m[²2]` | `"46 m2"` -> 46 |
| JSON-LD | `description` keywords | `has_elevator` | `/vytah\|elevator/i` | `true`/`false` |
| JSON-LD + HTML | description + mapped areas | `has_balcony` | keywords OR balcony/terrace/loggia area exists | `true`/`false` |
| JSON-LD + HTML | description + mapped parking | `has_parking` | keywords OR parking field exists | `true`/`false` |
| JSON-LD + HTML | description + mapped cellar | `has_basement` | keywords OR cellar area exists | `true`/`false` |

### Optional Fields

| Source | Portal Field | TierI Field | Transformation |
|--------|-------------|-------------|----------------|
| HTML | `Patro` / `Podlazi` | `floor` | `parseFloor()` |
| HTML | `Pocet podlazi` | `total_floors` | `parseFloor()` |
| HTML | `Pocet pokoju` | `rooms` | `parseNumber()` |
| HTML | `Koupelna` / `WC` | `bathrooms` | `parseNumber()` |
| HTML | `Balkon` | `balcony_area` | `parseArea()` |
| HTML | `Sklep` | `cellar_area` | `parseArea()` |
| HTML | `Terasa` | `terrace_area` | `parseArea()` |
| HTML | `Lodzie` | `loggia_area` | `parseArea()` |
| Derived | loggia_area exists | `has_loggia` | `!!loggiaArea` |
| Derived | terrace_area exists | `has_terrace` | `!!terraceArea` |
| Derived | garage count exists | `has_garage` | `!!garageCount` |
| HTML | `Garaz` | `garage_count` | `parseNumber()` |
| HTML | `Parkovacich stani` | `parking_spaces` | `parseNumber()` |
| HTML | `Konstrukce` | `construction_type` | `mapConstructionType()` |
| HTML | `Stav` | `condition` | `mapCondition()` |
| HTML | `Rok vystavby` | `year_built` | `parseYear()` |
| HTML | `Rok rekonstrukce` | `renovation_year` | `parseYear()` |
| HTML | `Topeni` | `heating_type` | Direct string |
| HTML + energy | `Energeticka trida` or `.s-estate-detail-intro__energy` | `energy_class` | Regex `[A-G]` |
| HTML | `Vybaveni` | `furnished` | `mapFurnished()` |
| HTML | `Datum vlozeni` | `published_date` | Direct string |
| HTML | `Poplatek` | `hoa_fees` | `parseArea()` (numeric) |
| HTML | `Dostupne od` | `available_from` | Direct string |
| HTML | `Kauce` | `deposit` | `parseArea()` (numeric) |

## Category: House

### Required Fields

| Source | Portal Field | TierI Field | Transformation | Example |
|--------|-------------|-------------|----------------|---------|
| JSON-LD | `name`/`description` regex | `bedrooms` | Disposition -> int - 1, or room/bedroom count from description | `"5+1"` -> 4 |
| HTML > JSON-LD | mapped `sqmLiving` or `name` regex | `sqm_living` | HTML preferred | `"120 m2"` -> 120 |
| HTML > JSON-LD | mapped `sqmPlot` or description regex | `sqm_plot` | HTML preferred, fallback multiple regex patterns | `"850 m2"` -> 850 |
| JSON-LD | `description` keywords | `has_garden` | `/zahrada\|garden/i` | `true`/`false` |
| JSON-LD + HTML | description + mapped garage | `has_garage` | keywords OR garage count exists | `true`/`false` |
| JSON-LD + HTML | description + mapped parking | `has_parking` | keywords OR parking exists | `true`/`false` |
| JSON-LD + HTML | description + mapped cellar | `has_basement` | keywords OR cellar area exists | `true`/`false` |

### Optional Fields (same as apartment plus)

| Source | Portal Field | TierI Field | Transformation |
|--------|-------------|-------------|----------------|
| HTML | `Pocet podlazi` | `stories` | `parseFloor()` |
| HTML | `Konstrukce` | `construction_type` | `mapConstructionType()`, `panel` -> `concrete` |

## Category: Land

### Required Fields

| Source | Portal Field | TierI Field | Transformation | Example |
|--------|-------------|-------------|----------------|---------|
| HTML > JSON-LD | mapped `sqmPlot` or `name`/`description` regex | `area_plot_sqm` | HTML preferred, then title, then description | `"2 510 m2"` -> 2510 |

### Optional Fields

| Source | Portal Field | TierI Field | Transformation |
|--------|-------------|-------------|----------------|
| HTML | `Datum vlozeni` | `published_date` | Direct string |
| HTML | `Dostupne od` | `available_from` | Direct string |

## Category: Commercial

### Required Fields

| Source | Portal Field | TierI Field | Transformation | Example |
|--------|-------------|-------------|----------------|---------|
| HTML > JSON-LD | mapped `sqm` or `name` regex | `sqm_total` | HTML preferred | `"200 m2"` -> 200 |
| JSON-LD | `description` keywords | `has_elevator` | `/vytah\|elevator/i` | `true`/`false` |
| JSON-LD + HTML | description + mapped parking | `has_parking` | keywords OR parking exists | `true`/`false` |
| JSON-LD + HTML | description + mapped bathrooms | `has_bathrooms` | keywords OR bathrooms count exists | `true`/`false` |

### Optional Fields

| Source | Portal Field | TierI Field | Transformation | Notes |
|--------|-------------|-------------|----------------|-------|
| HTML | `Koupelna` | `bathroom_count` | `parseNumber()` | |
| HTML | `Konstrukce` | `construction_type` | `mapConstructionType()`, `panel` -> `prefab` | Different from house |
| HTML | `Stav` | `condition` | `mapCondition()`, `after_renovation` -> `good` | Simplified for commercial |

## Default Values

| TierI Field | Default Value | When Applied |
|-------------|---------------|-------------|
| `title` | `"Untitled"` | JSON-LD `name` missing |
| `price` | `0` | `offers.price` missing |
| `currency` | `"CZK"` | `offers.priceCurrency` missing |
| `location.city` | `"Unknown"` | `addressLocality` missing |
| `bedrooms` | `0` | No disposition found |
| `sqm` / `sqm_living` / `sqm_total` | `0` | No area found |
| `area_plot_sqm` | `0` | No plot area found |
| All `has_*` booleans | `false` | No keywords or details found |

## Tier III: Portal Metadata

Fields stored in `portal_metadata` JSONB:

| Field | Source | Example |
|-------|--------|---------|
| `agent_name` | `offers.offeredby.name` | `"RE/MAX Reality"` |
| `agent_phone` | `offers.offeredby.telephone` | `"+420 123 456 789"` |
| `property_id` | HTML `ID nemovitosti` | `"CR-12345"` |
| `ownership` | HTML `Vlastnictvi` | `"osobni"` |
| `water` | HTML `Voda` | `"verejny vodovod"` |
| `sewage` | HTML `Kanalizace` | `"verejna kanalizace"` |
| `electricity` | HTML `Elektrina` | `"230V"` |
| `gas` | HTML `Plyn` | `"ano"` |
| `parking_info` | HTML `Parkovani` | `"vlastni parkovaci stani"` |
| `original_details` | All HTML details | Raw `Record<string, string>` |
