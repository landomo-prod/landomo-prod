# LuxuryEstate Transformers

## Architecture

After a detail page is fetched and the JSON-LD is parsed, the `detailQueue.ts` worker routes to one of two transformers based on the detected property category:

| Category | Transformer File | Output Type |
|----------|-----------------|-------------|
| `apartment` | `src/transformers/apartments/apartmentTransformer.ts` | `ApartmentPropertyTierI` |
| `house` | `src/transformers/houses/houseTransformer.ts` | `HousePropertyTierI` |

Both transformers receive a combined object containing:
- The minimal listing data from Phase 1 (`LuxuryEstateMinimalListing`)
- The flattened JSON-LD data from the detail page (`LuxuryEstateJsonLd`)
- The detected `transactionType` (`'sale'` | `'rent'`)

---

## Input Types

File: `src/types/luxuryEstateTypes.ts`

### LuxuryEstateMinimalListing

Produced by Phase 1 (listing page extraction):

| Field | Type | Source |
|-------|------|--------|
| `id` | `number` | `tracking-hydration properties[].id` |
| `url` | `string` | `tracking-hydration properties[].url` (relative path) |
| `title` | `string` | `tracking-hydration properties[].title` |
| `price` | `number` | `tracking-hydration properties[].price.raw` |
| `city` | `string` | `tracking-hydration properties[].geoInfo.city` |
| `categoryHint` | `string` | `tracking-hydration properties[].type` |

### LuxuryEstateJsonLd

Produced by Phase 3 detail extraction (flattened from `mainEntity` + `offers`):

| Field | Type | JSON-LD Source |
|-------|------|----------------|
| `@type` | `string` | `mainEntity.@type` |
| `name` | `string` | `mainEntity.name` |
| `description` | `string` | `mainEntity.description` |
| `floorSize.value` | `number` | `mainEntity.floorSize.value` (MTK = sqm) |
| `lotSize.value` | `number` | `mainEntity.lotSize.value` (houses only) |
| `numberOfRooms` | `number` | `mainEntity.numberOfRooms` |
| `numberOfBedrooms` | `number` | `mainEntity.numberOfBedrooms` |
| `numberOfBathroomsTotal` | `number` | `mainEntity.numberOfBathroomsTotal` |
| `address.addressLocality` | `string` | `mainEntity.address.addressLocality` |
| `address.addressRegion` | `string` | `mainEntity.address.addressRegion` |
| `address.postalCode` | `string` | `mainEntity.address.postalCode` |
| `geo.latitude` | `number` | `mainEntity.geo.latitude` |
| `geo.longitude` | `number` | `mainEntity.geo.longitude` |
| `amenityFeature` | `array` | `mainEntity.amenityFeature` |
| `yearBuilt` | `number` | `mainEntity.yearBuilt` |
| `image` | `string[]` | `mainEntity.image` |
| `identifier` | `string` | `mainEntity.identifier` |
| `keywords` | `string` | `mainEntity.keywords` |
| `offers.price` | `number` | `@graph RealEstateListing.offers.price` |
| `offers.priceCurrency` | `string` | `@graph RealEstateListing.offers.priceCurrency` |

---

## amenityFeature Lookup

The `amenityFeature` array is searched by `name` for both boolean flags and numeric values. The lookup is case-insensitive.

### Boolean Amenities (true if `value === true` or `value === 'Yes'`)

| `name` | Target Field |
|--------|-------------|
| `Elevator` | `has_elevator` |
| `Balcony` | `has_balcony` |
| `Parking` | `has_parking` |
| `Basement`, `Cellar` | `has_basement` |
| `Terrace` | `has_terrace` |
| `Garage` | `has_garage` |
| `Garden` | `has_garden` (houses only) |
| `Pool`, `Swimming pool` | `has_pool` (houses only) |

### Numeric Amenities (fallback when top-level field is absent)

| `name` | Target Field | Notes |
|--------|-------------|-------|
| `Bedrooms` | `bedrooms` | Fallback if `numberOfBedrooms` is absent |
| `Bathrooms` | `bathrooms` | Fallback if `numberOfBathroomsTotal` is absent |

---

## Apartment Transformer

File: `src/transformers/apartments/apartmentTransformer.ts`
Output type: `ApartmentPropertyTierI`

### Core Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `jsonLd.name` | `title` | Direct string |
| `jsonLd.offers.price` | `price` | Direct number |
| `listing.transactionType` | `transaction_type` | `'sale'` / `'rent'` |
| `jsonLd.address.addressLocality` | `location.city` | Direct string |
| `jsonLd.address.addressRegion` | `location.region` | Direct string |
| `jsonLd.geo.latitude` / `.longitude` | `location.coordinates` | `{ lat, lon }` object |
| `jsonLd.description` | `description` | Direct string |
| `jsonLd.image` | `images` | Array of image URLs |
| `listing.url` | `source_url` | `'https://www.luxuryestate.com' + url` |
| `listing.id` | `portal_id` | `'luxuryestate-it-' + id` |
| `'luxuryestate.com'` | `source_platform` | Hardcoded constant |
| `'active'` | `status` | Hardcoded constant |
| `'Italy'` | `country` | Hardcoded constant |
| `'IT'` | `country_code` | Hardcoded constant |

### Apartment-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `jsonLd.numberOfBedrooms` → fallback `amenityFeature[Bedrooms].value` | `bedrooms` | Number; amenityFeature used if top-level absent |
| `jsonLd.numberOfBathroomsTotal` → fallback `amenityFeature[Bathrooms].value` | `bathrooms` | Number; amenityFeature used if top-level absent |
| `jsonLd.floorSize.value` | `sqm` | Direct number (MTK = sqm) |
| `jsonLd.numberOfRooms` | `rooms` | Direct number |
| `jsonLd.yearBuilt` | `year_built` | Direct number |
| `amenityFeature[Elevator].value` | `has_elevator` | `true` if `=== true` or `=== 'Yes'` |
| `amenityFeature[Balcony].value` | `has_balcony` | Boolean |
| `amenityFeature[Parking].value` | `has_parking` | Boolean |
| `amenityFeature[Basement/Cellar].value` | `has_basement` | Boolean |
| `amenityFeature[Terrace].value` | `has_terrace` | Boolean |
| `amenityFeature[Garage].value` | `has_garage` | Boolean |

### Property Subtype Detection

Derived from `jsonLd['@type']`:

| `@type` value | `property_subtype` |
|--------------|---------------------|
| `Penthouse` | `penthouse` |
| `Loft` | `loft` |
| `Apartment` (default) | `standard` |

### Tier II — Italy-Specific Fields (`country_specific.italy`)

| Source | Target |
|--------|--------|
| `jsonLd.address.addressRegion` | `italy.region` |
| `jsonLd.address.addressLocality` | `italy.city` |
| `jsonLd.address.postalCode` | `italy.postal_code` |

### Tier III — Portal Metadata (`portal_metadata.luxuryestate`)

| Source | Stored Key |
|--------|-----------|
| `jsonLd.identifier` | `identifier` |
| `jsonLd.keywords` | `keywords` |
| `listing.categoryHint` | `category_hint` |

---

## House Transformer

File: `src/transformers/houses/houseTransformer.ts`
Output type: `HousePropertyTierI`

Inherits all core and shared fields from the apartment transformer. The following fields differ or are additional:

### House-Specific Area Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `jsonLd.floorSize.value` | `sqm_living` | Direct number (living area) |
| `jsonLd.lotSize.value` | `sqm_plot` | Direct number (land/plot area) |

Note: `sqm_plot` is a required field for `HousePropertyTierI`. It defaults to `0` when `lotSize` is absent.

### House-Specific Boolean Features

| Source | Target | Conversion |
|--------|--------|------------|
| `amenityFeature[Garden].value` | `has_garden` | Boolean |
| `amenityFeature[Pool/Swimming pool].value` | `has_pool` | Boolean |
| `amenityFeature[Garage].value` | `has_garage` | Boolean |
| `amenityFeature[Parking].value` | `has_parking` | Boolean |
| `amenityFeature[Basement/Cellar].value` | `has_basement` | Boolean |

### House Property Subtype Detection

Derived from `jsonLd['@type']` and keyword matching on `name`/description:

| `@type` / Keyword | `property_subtype` |
|-------------------|---------------------|
| `Villa` | `villa` |
| `SingleFamilyResidence` | `detached` |
| `terraced` (keyword) | `terraced` |
| (default) | `detached` |

### Tier II — Italy-Specific Fields (`country_specific.italy`)

Same as apartment: `italy.region`, `italy.city`, `italy.postal_code`.

### Tier III — Portal Metadata (`portal_metadata.luxuryestate`)

Same as apartment: `identifier`, `keywords`, `category_hint`.

---

## Required Field Compliance

### ApartmentPropertyTierI Required Fields

| Field | Supplied By |
|-------|-------------|
| `property_category` | Hardcoded `'apartment'` |
| `bedrooms` | `numberOfBedrooms` / `amenityFeature` |
| `sqm` | `floorSize.value` |
| `has_elevator` | `amenityFeature[Elevator]` |
| `has_balcony` | `amenityFeature[Balcony]` |
| `has_parking` | `amenityFeature[Parking]` |
| `has_basement` | `amenityFeature[Basement/Cellar]` |

### HousePropertyTierI Required Fields

| Field | Supplied By |
|-------|-------------|
| `property_category` | Hardcoded `'house'` |
| `bedrooms` | `numberOfBedrooms` / `amenityFeature` |
| `sqm_living` | `floorSize.value` |
| `sqm_plot` | `lotSize.value` (defaults to `0` if absent) |
| `has_garden` | `amenityFeature[Garden]` |
| `has_garage` | `amenityFeature[Garage]` |
| `has_parking` | `amenityFeature[Parking]` |
| `has_basement` | `amenityFeature[Basement/Cellar]` |

---

## Data Quality Notes

- **Price:** Sourced from `jsonLd.offers.price` (JSON-LD detail) rather than `listing.price` (Phase 1 minimal) for accuracy. The Phase 1 price is used only for checksum comparison.
- **Bedrooms/Bathrooms fallback:** The `amenityFeature` array approach is necessary because LuxuryEstate does not always populate top-level schema.org bedroom/bathroom fields consistently.
- **Plot size for villas:** Many Italian villa listings omit `lotSize` from the JSON-LD. The transformer defaults to `0` to satisfy the required field constraint rather than dropping the listing.
- **Images:** The `image` array from JSON-LD contains full CDN URLs. No additional size variants are constructed.
