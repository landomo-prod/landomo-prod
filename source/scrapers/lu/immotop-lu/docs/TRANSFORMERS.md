# Immotop.lu Transformers

## Architecture

The detail queue's `transformByCategory()` routes listings based on the category string assigned during discovery.

| Category | Transformer | Output Type |
|----------|-------------|-------------|
| `apartment` | `transformApartment()` | `ApartmentPropertyTierI` |
| `house` | `transformHouse()` | `HousePropertyTierI` |
| `land` | `transformLand()` | `LandPropertyTierI` |
| `commercial` | `transformCommercial()` | `CommercialPropertyTierI` |

## Raw Data Structure

Data from `__NEXT_DATA__` or HTML parsing is normalized into `ImmotopListingRaw`:

```typescript
{
  id: string,
  title: string,
  price: number,
  currency: "EUR",
  propertyType: string,
  transactionType: string,
  url: string,
  address: { street?, zip?, city?, country?, region? },
  latitude: number,
  longitude: number,
  surface: number,
  bedrooms: number,
  bathrooms: number,
  rooms: number,
  floor: number,
  plotSize: number,
  yearBuilt: number,
  energyClass: string,
  description: string,
  features: string[],
  images: string[],
  // Boolean features (from detail page)
  hasElevator, hasBalcony, hasParking, hasBasement,
  hasGarden, hasGarage, hasTerrace, hasPool,
}
```

---

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Raw Field | TierI Field | Conversion |
|-----------|-------------|------------|
| `title` | `title` | Direct, fallback to "Apartment in {city}" |
| `price` | `price` | Direct number |
| `transactionType` | `transaction_type` | `rent` -> `rent`, else `sale` |
| `address.city` | `location.city` | Direct |
| `address.zip` | `location.zip_code` | Direct |
| `latitude/longitude` | `location.latitude/longitude` | Direct numbers |
| `bedrooms` | `bedrooms` | Direct, default 0 |
| `bathrooms` | `bathrooms` | Direct |
| `surface` | `sqm` | Direct, default 0 |
| `floor` | `floor` | Direct |
| `rooms` | `rooms` | Direct |
| `hasElevator` | `has_elevator` | Boolean, default false |
| `hasBalcony` | `has_balcony` | Boolean, default false |
| `hasParking` | `has_parking` | Boolean, default false |
| `hasBasement` | `has_basement` | Boolean, default false |
| `hasTerrace` | `has_terrace` | Boolean |
| `parkingSpaces` | `parking_spaces` | Number |
| `yearBuilt` | `year_built` | Number |
| `energyClass` | `energy_class` | String |
| `description` | `description` | Direct |
| `features` | `features` | String array |
| `images` | `images` | String array |

### Source URL

From raw `url` field or constructed as: `https://www.immotop.lu/en/property/{id}`

### Portal ID

Format: `immotop-{id}`

---

## House Transformer

File: `src/transformers/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Raw Field | TierI Field | Notes |
|-----------|-------------|-------|
| `surface` | `sqm_living` | Living area |
| `plotSize` | `sqm_plot` | Plot area, default 0 |
| `hasGarden` | `has_garden` | Boolean, default false |
| `hasGarage` | `has_garage` | Boolean, default false |
| `hasPool` | `has_pool` | Boolean |

---

## Land Transformer

File: `src/transformers/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Raw Field | TierI Field | Notes |
|-----------|-------------|-------|
| `plotSize \|\| surface` | `area_plot_sqm` | Prefers plotSize, falls back to surface |

Minimal transformer -- only location, price, and area.

---

## Commercial Transformer

File: `src/transformers/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Raw Field | TierI Field | Notes |
|-----------|-------------|-------|
| `surface` | `sqm_total` | Total commercial area |
| `hasElevator` | `has_elevator` | Boolean, default false |
| `hasParking` | `has_parking` | Boolean, default false |
| `bathrooms > 0` | `has_bathrooms` | Derived boolean |
| `bathrooms` | `bathroom_count` | Direct number |

---

## Differences from ATHome Transformers

| Aspect | ATHome | Immotop |
|--------|--------|---------|
| Data source | JSON API | `__NEXT_DATA__` / HTML |
| ID type | `number` | `string` |
| Price field | `prices.min/max` | `price` (single value) |
| Surface field | `surfaces.min/max` | `surface` (single value) |
| Coordinates | `address.pin.lat/lon` | Top-level `latitude/longitude` |
| Features | API boolean fields | Regex matching on features list |
| Portal metadata | Rich (typeKey, group, isNewBuild) | None (minimal data available) |
| Country-specific | `commune` from district | None |
