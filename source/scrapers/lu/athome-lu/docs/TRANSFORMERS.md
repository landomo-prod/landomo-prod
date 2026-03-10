# ATHome.lu Transformers

## Architecture

The detail queue's `transformByCategory()` function routes each listing to the appropriate transformer based on the ATHome `propertyType` parameter from the search API.

| ATHome `propertyType` | Transformer | Output Type |
|----------------------|-------------|-------------|
| `flat` | `transformApartment()` | `ApartmentPropertyTierI` |
| `house` | `transformHouse()` | `HousePropertyTierI` |
| `land` | `transformLand()` | `LandPropertyTierI` |
| `office` | `transformCommercial()` | `CommercialPropertyTierI` |

## ATHome API Response Structure

The API returns listings with these key structures:

```typescript
{
  id: number,
  externalReference: string,
  type: "apartment",           // Human-readable
  typeKey: "flat",             // API parameter value
  typeId: number,
  group: string,
  permalink: { fr, en, de },  // Multilingual URLs
  isNewBuild: boolean,
  status: "active",
  transaction: "for-sale",
  address: {
    street: string,
    zip: string,
    city: string,
    district: string,          // Commune in Luxembourg
    country: "LU",
    pin: { lat, lon },         // GPS coordinates
  },
  contact: {
    agency: { name, logo, phone, email },
  },
  media: {
    photos: string[],
    plan: string,
    video: string,
    virtualVisit: string,
  },
  prices: { min, max, currency: "EUR" },
  surfaces: { min, max, unit: "sqm" },
  rooms: number,
  bedrooms: number,
  children: [{ id, floor, bedrooms, surface, price, bathrooms }],  // New build units
}
```

---

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Core Field Mapping

| ATHome API Field | TierI Field | Conversion |
|-----------------|-------------|------------|
| `name` | `title` | Direct, fallback to "Apartment in {city}" |
| `prices.min \|\| prices.max` | `price` | First available price |
| `transaction` | `transaction_type` | `for-rent` -> `rent`, else `sale` |
| `address.city` | `location.city` | Direct |
| `address.zip` | `location.postal_code` | Direct |
| `address.district` | `location.region` | District or region |
| `address.pin.lat/lon` | `location.coordinates` | `{ lat, lon }` object |
| `bedrooms` | `bedrooms` | Direct number |
| `bathrooms` | `bathrooms` | Direct number |
| `surfaces.min \|\| surfaces.max` | `sqm` | First available surface |
| `floor` | `floor` | From detail endpoint |
| `total_floors` | `total_floors` | From detail endpoint |
| `has_elevator` | `has_elevator` | Boolean, default false |
| `has_balcony` | `has_balcony` | Boolean, default false |
| `has_parking` | `has_parking` | Boolean, default false |
| `has_basement` | `has_basement` | Boolean, default false |
| `has_terrace` | `has_terrace` | Boolean |
| `parking_spaces` | `parking_spaces` | Number |
| `year_built` | `year_built` | Number |
| `energy_class` | `energy_class` | String (A-G) |
| `condition` | `condition` | `mapCondition()` |
| `media.photos` | `images` | String array |

### Condition Mapping

| ATHome Value | TierI Value |
|-------------|-------------|
| `new`, `neuf` | `new` |
| `excellent` | `excellent` |
| `good`, `bon` | `good` |
| `renov*` | `after_renovation` |
| `rework`, `refurbish` | `requires_renovation` |

### Source URL

Constructed as: `https://www.athome.lu/en/buy/apartment/id-{id}`

### Portal Metadata (Tier III)

```typescript
portal_metadata: {
  athome_id: raw.id,
  external_reference: raw.externalReference,
  type_key: raw.typeKey,
  group: raw.group,
  is_new_build: raw.isNewBuild,
}
```

### Country-Specific (Tier II)

```typescript
country_specific: {
  commune: raw.address?.district,  // Luxembourg commune
}
```

---

## House Transformer

File: `src/transformers/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| ATHome API Field | TierI Field | Conversion |
|-----------------|-------------|------------|
| `surfaces.min \|\| surfaces.max` | `sqm_living` | First available surface |
| `sqm_plot` | `sqm_plot` | Direct, default 0 |
| `has_garden` | `has_garden` | Boolean, default false |
| `has_garage` | `has_garage` | Boolean, default false |
| `has_pool` | `has_pool` | Boolean |

All other fields follow the same pattern as the apartment transformer.

---

## Land Transformer

File: `src/transformers/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| ATHome API Field | TierI Field | Conversion |
|-----------------|-------------|------------|
| `surfaces.min \|\| surfaces.max \|\| sqm_plot` | `area_plot_sqm` | First available area value |

Minimal transformer -- land listings have fewer attributes. No boolean feature fields.

---

## Commercial Transformer

File: `src/transformers/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| ATHome API Field | TierI Field | Conversion |
|-----------------|-------------|------------|
| `surfaces.min \|\| surfaces.max` | `sqm_total` | First available surface |
| `has_elevator` | `has_elevator` | Boolean, default false |
| `has_parking` | `has_parking` | Boolean, default false |
| `bathrooms > 0` | `has_bathrooms` | Derived boolean |
| `bathrooms` | `bathroom_count` | Direct number |
| `parking_spaces` | `parking_spaces` | Number |

### Commercial Condition Mapping

Same as apartment, plus:

| ATHome Value | TierI Value |
|-------------|-------------|
| `fair` | `fair` |
| `renov*`, `rework` | `requires_renovation` |
