# Zimmo Transformers

## Architecture

Category detection is based on the category string passed through the three-phase orchestrator from the search URL combination. The `transformListing` function in `detailQueue.ts` routes to the appropriate transformer.

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source (Zimmo) | Target (TierI) | Conversion |
|----------------|-----------------|------------|
| `raw.title` | `title` | Direct, fallback generated |
| `raw.price` | `price` | Direct, default 0 |
| `raw.address.city` | `location.city` | Direct |
| `raw.address.latitude/longitude` | `location.coordinates` | Direct |
| `raw.address.postalCode` | `location.zip_code` | Direct |
| `raw.address.province` | `location.region` | Direct |
| `raw.bedrooms` | `bedrooms` | Direct, default 0 |
| `raw.bathrooms` | `bathrooms` | Direct |
| `raw.surface` | `sqm` | Direct, default 0 |
| `raw.building.floor` | `floor` | Direct |
| `raw.building.floors` | `total_floors` | Direct |
| `raw.features.hasLift` | `has_elevator` | Boolean, default false |
| `raw.features.hasBalcony` | `has_balcony` | Boolean, default false |
| `raw.features.hasParking` | `has_parking` | Boolean, default false |
| `raw.features.parkingSpaces` | `parking_spaces` | Direct |
| `raw.features.hasBasement` | `has_basement` | Boolean, default false |
| `raw.features.hasTerrace` | `has_terrace` | Boolean, default false |
| `raw.features.terraceSurface` | `terrace_area` | Direct |
| `raw.features.hasGarage` | `has_garage` | Boolean, default false |
| `raw.features.garageCount` | `garage_count` | Direct |
| `raw.building.constructionYear` | `year_built` | Direct |
| `raw.building.condition` | `condition` | `mapCondition()` |
| `raw.energy.heatingType` | `heating_type` | Direct |
| `raw.energy.epcScore` | `energy_class` | Direct |

### Condition Mapping

| Zimmo Value | TierI Value |
|-------------|-------------|
| Contains `new` | `new` |
| Contains `good` | `good` |
| Contains `renovate` | `requires_renovation` |
| Contains `renovated` | `after_renovation` |

---

## House Transformer

File: `src/transformers/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `raw.surface` | `sqm_living` | Direct, default 0 |
| `raw.landSurface` | `sqm_plot` | Direct, default 0 |
| `raw.building.floors` | `stories` | Direct |
| `raw.features.hasGarden` | `has_garden` | Boolean |
| `raw.features.gardenSurface` | `garden_area` | Direct |
| `raw.features.hasPool` | `has_pool` | Direct |
| `raw.features.hasFireplace` | `has_fireplace` | Direct |
| `raw.features.hasTerrace` | `has_terrace` | Direct |

---

## Land Transformer

File: `src/transformers/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `raw.landSurface` | `area_plot_sqm` | Fallback to `raw.surface`, default 0 |

Note: Zimmo land transformer is minimal -- only maps core fields. No zoning or utility detection.

---

## Commercial Transformer

File: `src/transformers/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `raw.surface` | `sqm_total` | Direct, default 0 |
| `raw.landSurface` | `sqm_plot` | Direct |
| `raw.features.hasLift` | `has_elevator` | Boolean |
| `raw.features.hasParking` | `has_parking` | Boolean |
| `raw.bathrooms > 0` | `has_bathrooms` | Count check |
| `raw.energy.epcScore` | `energy_class` | Direct |
