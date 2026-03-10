# Logic-Immo BE Transformers

## Architecture

Logic-Immo uses typed raw listings (`RawLogicImmoListing`) with rich field extraction from Next.js data, JSON-LD, and HTML parsing. The `mapNextDataListing` function in `fetchData.ts` normalizes various source formats into the raw type.

## Raw Type: `RawLogicImmoListing`

The raw type includes all fields that may be extracted from any of the three parsing strategies:

| Field | Type | Source |
|-------|------|--------|
| `id` | `string` | All strategies |
| `title` | `string?` | Next.js `item.title`, LD+JSON `obj.name`, HTML `h2/h3` |
| `price` | `number?` | Next.js `item.price.value`, LD+JSON `obj.offers.price` |
| `surface` | `number?` | Next.js `item.surface`, LD+JSON `obj.floorSize.value` |
| `bedrooms` | `number?` | Next.js `item.bedrooms`, LD+JSON `obj.numberOfBedrooms` |
| `bathrooms` | `number?` | Next.js `item.bathrooms`, LD+JSON `obj.numberOfBathroomsTotal` |
| `address` | `object` | Next.js `item.address`, LD+JSON `obj.address` |
| `features` | `string[]?` | Next.js `item.features` |
| `has_elevator` | `boolean?` | Next.js `item.hasElevator` |
| `has_balcony` | `boolean?` | Next.js `item.hasBalcony` |
| `has_terrace` | `boolean?` | Next.js `item.hasTerrace` |
| `has_garden` | `boolean?` | Next.js `item.hasGarden` |
| `has_garage` | `boolean?` | Next.js `item.hasGarage` |
| `has_parking` | `boolean?` | Next.js `item.hasParking` |
| `has_basement` | `boolean?` | Next.js `item.hasBasement` |
| `garden_surface` | `number?` | Next.js `item.gardenSurface` |
| `plot_surface` | `number?` | Next.js `item.plotSurface` |
| `living_surface` | `number?` | Next.js `item.livingSurface` |
| `condition` | `string?` | Next.js `item.condition` |
| `heating_type` | `string?` | Next.js `item.heatingType` |
| `construction_type` | `string?` | Next.js `item.constructionType` |
| `energy_class` | `string?` | Next.js `item.energyClass` |
| `agent` | `object?` | Next.js `item.agent` |

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source | Target | Conversion |
|--------|--------|------------|
| `raw.title` | `title` | Direct, fallback generated |
| `raw.price` | `price` | Direct, default 0 |
| `raw.address.city` | `location.city` | Direct |
| `raw.address.lat/lng` | `location.coordinates` | Direct |
| `raw.bedrooms` | `bedrooms` | Fallback: `rooms - 1` |
| `raw.surface` / `raw.living_surface` | `sqm` | First available, default 0 |
| `raw.has_elevator` | `has_elevator` | Boolean, default false |
| `raw.has_balcony` | `has_balcony` | Boolean, default false |
| `raw.has_parking` | `has_parking` | Boolean, default false |
| `raw.has_basement` | `has_basement` | Boolean, default false |
| `raw.construction_type` | `construction_type` | `mapConstructionType()` |
| `raw.condition` | `condition` | `mapCondition()` |
| `raw.furnished` | `furnished` | Boolean to `'furnished'` string |
| `raw.agent` | `agent` | Direct mapping to TierI agent object |

### Construction Type Mapping

| Logic-Immo Value | TierI Value |
|------------------|-------------|
| `brique`, `brick` | `brick` |
| `beton`, `concrete` | `concrete` |
| `mixte`, `mixed` | `mixed` |

### Condition Mapping (French + English)

| Logic-Immo Value | TierI Value |
|------------------|-------------|
| `neuf`, `new` | `new` |
| `excellent`, `parfait` | `excellent` |
| `bon`, `good` | `good` |
| `renov` (prefix) | `after_renovation` |
| `renover`, `to renovate` | `requires_renovation` |

---

## House, Land, Commercial Transformers

Follow same pattern as apartment transformer with category-specific fields (sqm_living, sqm_plot, area_plot_sqm, etc.).
