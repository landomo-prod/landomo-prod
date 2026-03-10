# UlovDomov Transformer

**File:** `transformers/ulovdomovTransformer.ts`

Unlike BezRealitky (which has separate transformer files per category), UlovDomov uses a single transformer function `transformUlovDomovToStandard()` that handles all property categories via the `buildCategoryFields()` helper.

## Property Type Mapping

| API `propertyType` | `property_category` |
|---|---|
| `flat` | `apartment` |
| `house` | `house` |
| `room` | `apartment` |
| `land` | `land` |
| `commercial` | `commercial` |
| Unknown | `other` |

## Core Field Mapping

| Output Field | Source | Transformation |
|---|---|---|
| `title` | `offer.title` | Default: `'Unknown'` |
| `price` | `offer.rentalPrice?.value` | Default: `0`. Used for both rent AND sale |
| `currency` | -- | `'CZK'` (constant) |
| `property_type` | `offer.propertyType` | `mapPropertyType()` |
| `property_category` | `offer.propertyType` | Same as `property_type` |
| `transaction_type` | `offer.offerType` | `'sale'` -> `'sale'`, else `'rent'` |
| `source_url` | `offer.absoluteUrl` | Fallback: `https://www.ulovdomov.cz/inzerat/${seo}/${id}` |
| `source_platform` | -- | `'ulovdomov'` (constant) |
| `status` | -- | `'active'` (constant) |
| `description` | `offer.description` | Direct |
| `description_language` | -- | `'cs'` (constant) |

## Location Fields

| Output Field | Source | Transformation |
|---|---|---|
| `location.address` | `street.title + villagePart.title + village.title` | `buildAddress()`: joined with `, ` |
| `location.city` | `offer.village?.title` | Default: `'Unknown'` |
| `location.region` | `offer.villagePart?.title` | Optional |
| `location.country` | -- | `'Czech Republic'` (constant) |
| `location.coordinates.lat` | `offer.geoCoordinates.lat` | Direct |
| `location.coordinates.lon` | `offer.geoCoordinates.lng` | Note: `lng` -> `lon` |

## Details Fields

| Output Field | Source | Transformation |
|---|---|---|
| `details.bedrooms` | `offer.disposition` | `extractBedrooms()` via `camelToDisposition()` |
| `details.sqm` | `offer.area` | Direct |
| `details.floor` | `offer.floorLevel` | Direct (nullable) |
| `details.rooms` | `offer.disposition` | `extractRooms()` via `camelToDisposition()` |
| `details.parking_spaces` | `convenience` array | `1` if `parking` present |

## Disposition Conversion

UlovDomov uses camelCase disposition format. The `camelToDisposition()` function converts to Czech format:

| API Value | Czech Format |
|---|---|
| `onePlusKk` | `1+kk` |
| `onePlusOne` | `1+1` |
| `twoPlusKk` | `2+kk` |
| `twoPlusOne` | `2+1` |
| `threePlusKk` | `3+kk` |
| `threePlusOne` | `3+1` |
| `fourPlusKk` | `4+kk` |
| `fourPlusOne` | `4+1` |
| `fivePlusKk` | `5+kk` |
| `fivePlusOne` | `5+1` |
| `sixPlusKk` | `6+kk` |
| `sixPlusOne` | `6+1` |
| `atelier` | `atelier` |
| `studio` | `1+kk` |

### Bedroom Extraction

From the converted Czech disposition: first digit is the bedroom count. `1+kk` = 1, `3+1` = 3.

### Room Extraction

`N+kk` = N rooms, `N+1` = N+1 rooms (kitchen counts as a room).

## Category-Specific Tier I Fields

### Apartment (`flat`, `room`)

| Field | Source |
|---|---|
| `sqm` | `offer.area` (default: 0) |
| `bedrooms` | `extractBedrooms(disposition)` |
| `has_elevator` | `convenience` includes `elevator` |
| `has_balcony` | `convenience` includes `balcony` |
| `has_parking` | `convenience` includes `parking` |
| `has_basement` | `convenience` includes `cellar` |

### House

| Field | Source |
|---|---|
| `sqm_living` | `offer.area` |
| `bedrooms` | `extractBedrooms(disposition)` |
| `has_garden` | `houseConvenience` includes `garden` |
| `has_garage` | `houseConvenience` includes `garage` |
| `has_parking` | `convenience` includes `parking` |
| `has_basement` | `convenience` includes `cellar` |

### Land

| Field | Source |
|---|---|
| `area_plot_sqm` | `offer.area` |

### Commercial

| Field | Source |
|---|---|
| `sqm_total` | `offer.area` |
| `has_elevator` | `convenience` includes `elevator` |
| `has_parking` | `convenience` includes `parking` |

## Convenience (Amenities) Mapping

UlovDomov provides two arrays: `convenience` (flat amenities) and `houseConvenience` (house amenities). They are merged for lookup.

| Convenience Value | Amenity Field |
|---|---|
| `parking` | `has_parking` |
| `balcony` | `has_balcony` |
| `terrace` | `has_terrace` |
| `cellar` | `has_basement` |
| `elevator` | `has_elevator` |
| `garden` | `has_garden` |
| `garage` | `has_garage` |
| `furnished` | `furnished` -> `'furnished'` |
| `partiallyFurnished` | `furnished` -> `'partially_furnished'` |
| `unfurnished` | `furnished` -> `'unfurnished'` |

Note: `hasConvenience()` returns `true` if present, `undefined` if not (not `false`).

## Universal Tier 1 Fields

| Field | Source | Transformation |
|---|---|---|
| `condition` | -- | `undefined` (not available in API) |
| `furnished` | `convenience` array | `extractFurnished()` -> `normalizeFurnished()` |
| `construction_type` | -- | `normalizeConstructionType(undefined)` |
| `available_from` | `offer.availableFrom` | Direct (string or null) |
| `published_date` | `offer.published` | Direct (ISO string) |
| `deposit` | `offer.depositPrice?.value` | Direct |
| `parking_spaces` | `convenience` array | `1` if parking present |
| `price_per_sqm` | `price / area` | Calculated, rounded |

## Country-Specific (Tier 2) Fields

| Field | Source |
|---|---|
| `czech_disposition` | `camelToDisposition(offer.disposition)` -> `normalizeDisposition()` |
| `area_living` | `offer.area` |
| `floor_number` | `offer.floorLevel` |
| `city` | `offer.village?.title` |
| `district` | `offer.villagePart?.title` |
| `street` | `offer.street?.title` |
| `coordinates` | `offer.geoCoordinates` (lat/lng) |
| `image_urls` | `offer.photos[].path` |
| `image_count` | `photos.length` |
| `published_date` | `offer.published` |
| `available_from` | `offer.availableFrom` |

## Portal Metadata

Stored in `portal_metadata.ulovdomov`:

| Field | Source |
|---|---|
| `id` | `offer.id` |
| `url` | `offer.absoluteUrl` |
| `offer_type` | `offer.offerType` |
| `property_type` | `offer.propertyType` |
| `disposition` | `offer.disposition` (camelCase) |
| `house_type` | `offer.houseType` |
| `floor_level` | `offer.floorLevel` |
| `price_unit` | `offer.priceUnit` |
| `price_note` | `offer.priceNote` |
| `is_no_commission` | `offer.isNoCommission` |
| `monthly_fees` | `offer.monthlyFeesPrice?.value` |
| `deposit` | `offer.depositPrice?.value` |
| `convenience` | `offer.convenience` |
| `house_convenience` | `offer.houseConvenience` |
| `village` | `offer.village?.title` |
| `village_part` | `offer.villagePart?.title` |
| `street` | `offer.street?.title` |
| `geo` | `offer.geoCoordinates` |
| `published` | `offer.published` |
| `available_from` | `offer.availableFrom` |
| `is_top` | `offer.isTop` |

## Media

| Field | Source |
|---|---|
| `media.images` | `offer.photos[].path` |
| `media.total_images` | `photos.length` |
| `images` | Same as `media.images` (legacy field) |
