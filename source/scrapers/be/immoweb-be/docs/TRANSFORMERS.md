# Immoweb Transformers

## Architecture

Category detection is based on the search URL category parameter passed through to the detail queue job. The `transformListing` function in `detailQueue.ts` routes to the correct transformer.

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Core Field Mapping

| Source (Immoweb) | Target (TierI) | Conversion |
|-------------------|-----------------|------------|
| `property.title` | `title` | Direct, fallback to generated title |
| `transaction.sale.price` / `transaction.rental.monthlyRentalPrice` | `price` | Sale vs rent price chain |
| `property.location.locality` | `location.city` | Direct |
| `property.location.latitude/longitude` | `location.coordinates` | Direct lat/lon |
| `property.location.postalCode` | `location.postal_code` | Direct |
| `property.location.province` | `location.region` | Fallback to `region` |

### Apartment-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `property.bedroomCount` | `bedrooms` | Direct, default 0 |
| `property.bathroomCount` | `bathrooms` | Direct |
| `property.netHabitableSurface` | `sqm` | Fallback to `surface` |
| `property.floor` | `floor` | parseInt |
| `property.building.floorCount` | `total_floors` | Direct |
| `property.roomCount` | `rooms` | Direct |
| `property.hasLift` | `has_elevator` | Boolean, default false |
| `property.hasBalcony` | `has_balcony` | Boolean, default false |
| `property.hasParkingSpace` | `has_parking` | Boolean, default false |
| `property.parkingCountIndoor + parkingCountOutdoor` | `parking_spaces` | Sum |
| `property.hasBasement` | `has_basement` | Boolean, default false |
| `property.hasTerrace` / `hasTermassure` | `has_terrace` | OR chain |
| `property.terraceSurface` | `terrace_area` | Direct |
| `property.garageCount > 0` | `has_garage` | Count check |
| `property.building.constructionYear` | `year_built` | Direct |
| `property.building.condition` | `condition` | `mapCondition()` |
| `property.energy.heatingType` | `heating_type` | Direct |
| `property.certificates.epcScore` | `energy_class` | Direct |

### Condition Mapping

| Immoweb Value | TierI Value |
|---------------|-------------|
| `new`, `as_new` | `new` |
| `good` | `good` |
| `to_renovate`, `to_be_done_up` | `requires_renovation` |
| `just_renovated`, `excellent` | `after_renovation` |

### Features Extraction

| Immoweb Field | Feature Tag |
|---------------|-------------|
| `property.hasAirConditioning` | `air_conditioning` |
| `property.hasSwimmingPool` | `swimming_pool` |
| `property.fireplaceExists` | `fireplace` |
| `property.hasDressingRoom` | `dressing_room` |
| `property.kitchen.type` = `INSTALLED`/`HYPER_EQUIPPED` | `equipped_kitchen` |

### Belgium-Specific Fields (country_specific)

| Source | Target | Notes |
|--------|--------|-------|
| `property.certificates.epcScore` | `epc_score` | Energy Performance Certificate (Belgium-specific) |
| `property.certificates.primaryEnergyConsumptionPerSqm` | `primary_energy_consumption` | kWh/m2/year |
| `property.building.facadeCount` | `facade_count` | Number of facades (important in Belgian market) |
| `flags.isNewlyBuilt` | `is_newly_built` | New construction flag |

---

## House Transformer

File: `src/transformers/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `property.netHabitableSurface` | `sqm_living` | Fallback to `surface` |
| `property.landSurface` | `sqm_plot` | Direct, default 0 |
| `property.surface` | `sqm_total` | Direct |
| `property.building.floorCount` | `stories` | Direct |
| `property.hasGarden` | `has_garden` | Boolean |
| `property.gardenSurface` | `garden_area` | Direct |
| `property.hasSwimmingPool` | `has_pool` | Direct |
| `property.fireplaceExists` | `has_fireplace` | Direct |
| `property.hasBalcony` | `has_balcony` | Direct |
| `property.hasSolarPanels` | features: `solar_panels` | Feature extraction |

---

## Land Transformer

File: `src/transformers/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `property.landSurface` | `area_plot_sqm` | Fallback to `netHabitableSurface` |
| `property.landType` | `zoning` | `mapZoning()` |
| `property.hasBuildingPermit` | `building_permit` | Direct boolean |

### Zoning Mapping

| Immoweb Land Type | TierI Zoning |
|--------------------|-------------|
| `building`, `residential` | `residential` |
| `commercial` | `commercial` |
| `agricultural`, `farm` | `agricultural` |
| `industrial` | `industrial` |
| `recreational` | `recreational` |
| (default) | `mixed` |

---

## Commercial Transformer

File: `src/transformers/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `property.netHabitableSurface` | `sqm_total` | Fallback to `surface` |
| `property.landSurface` | `sqm_plot` | Direct |
| `property.subtype` / `property.type` | `property_subtype` | `mapSubtype()` |
| `transaction.rental.monthlyRentalPrice` | `monthly_rent` | Direct |
| `property.bathroomCount > 0` | `has_bathrooms` | Count check |

### Commercial Subtype Mapping

| Immoweb Subtype | TierI Subtype |
|-----------------|---------------|
| `office` | `office` |
| `retail`, `shop`, `commerce` | `retail` |
| `warehouse`, `storage` | `warehouse` |
| `industrial` | `industrial` |
| `hotel` | `hotel` |
| `restaurant`, `horeca` | `restaurant` |
| (default) | `mixed_use` |
