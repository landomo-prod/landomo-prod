# Immovlan Transformers

## Architecture

Category detection is based on the category string from the search URL combination. Transformers follow the same pattern as Zimmo with flat raw object structure.

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source (Immovlan) | Target (TierI) | Conversion |
|--------------------|-----------------|------------|
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
| `raw.building.constructionYear` | `year_built` | Direct |
| `raw.energy.heatingType` | `heating_type` | Direct |
| `raw.energy.epcScore` | `energy_class` | Direct |
| `raw.images` | `images` | Maps string or `{url}` objects |

---

## House Transformer

Same flat structure as Zimmo house transformer. Maps `raw.surface` to `sqm_living`, `raw.landSurface` to `sqm_plot`, and garden/garage/pool features from `raw.features.*`.

---

## Land Transformer

Maps `raw.landSurface` (fallback `raw.surface`) to `area_plot_sqm`. Minimal field mapping.

---

## Commercial Transformer

Maps `raw.surface` to `sqm_total`, `raw.landSurface` to `sqm_plot`. Includes elevator, parking, and bathroom detection.
