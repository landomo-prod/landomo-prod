# Realingo - Transformer Field Mappings

## Category Routing

Category is determined by the `category` field in the GraphQL response:

| Realingo Category | Transformer |
|------------------|-------------|
| `FLAT` | `realingoApartmentTransformer` |
| `HOUSE` | `realingoHouseTransformer` |
| `LAND` | `realingoLandTransformer` |
| `COMMERCIAL` | `realingoCommercialTransformer` |
| `OTHERS` | `realingoOthersTransformer` |

## Common Fields (All Categories)

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `title` | `offer.title` or generated | Direct or `"{type} {disposition} {city}"` |
| `price` | `offer.price.total` | Direct |
| `currency` | Hardcoded | `'CZK'` |
| `transaction_type` | `offer.purpose` | `SELL` → `sale`, `RENT` → `rent` |
| `location.city` | `offer.locality.city` | Direct |
| `location.country` | Hardcoded | `'Czech Republic'` |
| `location.address` | `offer.locality.street` | Direct |
| `location.postal_code` | `offer.locality.zip` | Direct |
| `location.coordinates` | `offer.locality.gps` | `{ lat, lon }` |
| `description` | `detail.description` | From detail fetch |
| `images` | `offer.images` | Prefixed with `https://www.realingo.cz/image/` |
| `media.images` | Same as `images` | Structured format |
| `source_url` | Generated | `https://www.realingo.cz/offer/{id}` |
| `source_platform` | Hardcoded | `'realingo'` |
| `status` | Hardcoded | `'active'` |

## Shared Field Mappers (`shared/fieldMappers.ts`)

### Building Type / Construction
| Realingo Enum | Normalized |
|---------------|-----------|
| `BRICK` | `brick` |
| `PANEL` | `prefab` |
| `WOOD` | `wood` |
| `SKELETON` | `concrete` |
| `MIXED` | `mixed` |
| `OTHER` | `other` |

### Condition
| Realingo Enum | Normalized |
|---------------|-----------|
| `NEW` | `new` |
| `GOOD` | `good` |
| `EXCELLENT` | `excellent` |
| `RECONSTRUCTED` | `after_renovation` |
| `FOR_RECONSTRUCTION` | `requires_renovation` |
| `BEFORE_RECONSTRUCTION` | `requires_renovation` |

### Furnished
| Realingo Enum | Normalized |
|---------------|-----------|
| `FURNISHED` | `furnished` |
| `PARTIALLY` | `partially_furnished` |
| `UNFURNISHED` | `not_furnished` |

### Heating
| Realingo Enum | Normalized |
|---------------|-----------|
| `GAS` | `gas` |
| `ELECTRIC` | `electric` |
| `CENTRAL` | `central` |
| `LOCAL` | `local` |
| `SOLID_FUEL` | `solid_fuel` |

### Disposition Parsing (`categoryParser.ts`)
| Realingo Enum | Disposition | Bedrooms | Rooms |
|---------------|------------|----------|-------|
| `FLAT1_KK` | `1+kk` | 1 | 1 |
| `FLAT1_1` | `1+1` | 1 | 2 |
| `FLAT2_KK` | `2+kk` | 2 | 3 |
| `FLAT2_1` | `2+1` | 2 | 3 |
| `FLAT3_KK` | `3+kk` | 3 | 4 |
| `FLAT3_1` | `3+1` | 3 | 4 |
| `FLAT4_KK` | `4+kk` | 4 | 5 |
| `FLAT4_1` | `4+1` | 4 | 5 |
| `FLAT5_KK` | `5+kk` | 5 | 6 |
| `FLAT5_1` | `5+1` | 5 | 6 |

## Apartment-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | `parseDisposition()` | From category enum (see above) |
| `sqm` | `offer.area.floor` | Direct |
| `floor` | `detail.floor` | From detail fetch |
| `total_floors` | `detail.floorCount` | From detail fetch |
| `has_elevator` | `detail.elevator` | Boolean |
| `has_balcony` | `detail.balcony` | Boolean |
| `has_parking` | `detail.parking` | Boolean or string check |
| `has_basement` | `detail.cellar` | Boolean |
| `rooms` | `parseDisposition().rooms` | Calculated |
| `construction_type` | `detail.buildingType` | Mapped via `fieldMappers` |
| `condition` | `detail.condition` | Mapped via `fieldMappers` |
| `year_built` | `detail.yearBuild` | Direct |
| `energy_class` | `detail.energyClass` | Direct |
| `furnished` | `detail.furnished` | Mapped via `fieldMappers` |
| `heating_type` | `detail.heating` | Mapped via `fieldMappers` |

## House-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | `parseDisposition()` or detail | From category or room count |
| `sqm_living` | `offer.area.floor` | Direct |
| `sqm_plot` | `offer.area.plot` | Direct |
| `has_garden` | `detail.garden` | Boolean |
| `has_garage` | `detail.garage` | Boolean |
| `has_parking` | `detail.parking` | Boolean |
| `has_basement` | `detail.cellar` | Boolean |

## Land-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `area_plot_sqm` | `offer.area.plot` or `offer.area.floor` | Plot preferred, floor fallback |
| `portal_metadata.water` | `detail.water` | Utility info |
| `portal_metadata.sewage` | `detail.sewage` | Utility info |
| `portal_metadata.electricity` | `detail.electricity` | Utility info |
| `portal_metadata.gas` | `detail.gas` | Utility info |

## Commercial-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `sqm_total` | `offer.area.floor` | Direct |
| `has_elevator` | `detail.elevator` | Boolean |
| `has_parking` | `detail.parking` | Boolean |
| `has_bathrooms` | `detail.bathroom` | Boolean |

## Checksum Fields

Fields used for change detection (`checksumExtractor.ts`):

| Field | Source |
|-------|--------|
| `price.total` | `offer.price.total` |
| `category` | `offer.category` |
| `updatedAt` | `offer.updatedAt` |
| `area.floor` | `offer.area.floor` |
| `purpose` | `offer.purpose` |
