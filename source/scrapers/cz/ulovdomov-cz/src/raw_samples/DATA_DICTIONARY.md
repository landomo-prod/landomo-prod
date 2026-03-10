# UlovDomov — Raw Data Dictionary

## API Overview

UlovDomov uses a REST API at `https://ud.api.ulovdomov.cz/v1`. The listing page response contains **full listing data** — there is no separate detail endpoint. All fields are available in the `/offer/find` response.

## Listing Page Response

### Endpoint: `POST https://ud.api.ulovdomov.cz/v1/offer/find?page={page}&perPage={perPage}&sorting={sorting}`

### Request Body
```json
{
  "offerType": "sale",
  "bounds": {
    "northEast": { "lat": 51.06, "lng": 18.87 },
    "southWest": { "lat": 48.55, "lng": 12.09 }
  }
}
```

- `offerType` — `"rent"` | `"sale"` | `"coliving"` (lowercase required)
- `bounds` — geographic bounding box (Czech Republic)
- Query params: `page` (1-based), `perPage` (up to 100), `sorting` (`"latest"`, `"cheapest"`, `"most_expensive"`, `"biggest"`)

### Count Endpoint: `POST https://ud.api.ulovdomov.cz/v1/offer/count`
Same body as above, returns `{ success: true, data: { count: 2893 } }`.

---

## Response Envelope

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `success` | boolean | API success flag | `true` |
| `extraData.total` | number | Total matching offers | `2893` |
| `extraData.totalPages` | number | Total pages at current perPage | `579` |
| `extraData.perPage` | number | Items per page | `5` |
| `extraData.currentPage` | number | Current page number (1-based) | `1` |
| `data.offers` | array | Array of offer objects | `[...]` |
| `error` | string? | Error message if `success` is false | `undefined` |

---

## Offer Object Fields

### Identity & Metadata

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | number | Unique offer ID | `5650286` |
| `title` | string | Listing title (Czech) | `"Prodej domu 421 m2"` |
| `seo` | string | SEO-friendly URL slug | `"prodej-pribram-pribram-ii-fantova-louka-rodinny-dum"` |
| `absoluteUrl` | string | Full listing URL on portal | `"https://www.ulovdomov.cz/inzerat/prodej-pribram.../5650286"` |
| `adminUrl` | string | Admin panel URL (internal) | `"https://www.ulovdomov.cz/xadmin/offer/detail/5650286"` |
| `published` | string | ISO datetime of listing publication | `"2026-02-26T18:38:05"` |
| `isTop` | boolean | Whether listing is promoted/featured | `false` |
| `showScamWarn` | boolean | Portal scam warning flag | `false` |
| `isContacted` | boolean | Whether user has contacted (session-specific) | `false` |

### Classification

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `offerType` | string | Transaction type | `"sale"`, `"rent"`, `"coliving"` |
| `propertyType` | string | Property category | `"flat"`, `"house"`, `"room"`, `"land"`, `"commercial"` |
| `disposition` | string \| null | Room layout in camelCase | `"twoPlusKk"`, `"threePlusOne"`, `null` |
| `houseType` | string \| null | House subtype (houses only) | `"familyHouse"`, `"villa"`, `null` |

#### Known `disposition` values
| API Value | Czech Equivalent |
|-----------|-----------------|
| `"onePlusKk"` | 1+kk |
| `"onePlusOne"` | 1+1 |
| `"twoPlusKk"` | 2+kk |
| `"twoPlusOne"` | 2+1 |
| `"threePlusKk"` | 3+kk |
| `"threePlusOne"` | 3+1 |
| `"fourPlusKk"` | 4+kk |
| `"fourPlusOne"` | 4+1 |
| `"fivePlusKk"` | 5+kk |
| `"fivePlusOne"` | 5+1 |
| `"sixPlusKk"` | 6+kk |
| `"sixPlusOne"` | 6+1 |
| `"atelier"` | atelier |
| `"studio"` | studio (mapped to 1+kk) |
| `null` | not specified (houses, land, commercial) |

#### Known `houseType` values
- `"familyHouse"` — rodinny dum
- `"villa"` — vila
- `null` — not a house

#### Known `propertyType` values
- `"flat"` — byt (apartment)
- `"house"` — dum (house)
- `"room"` — pokoj (room, treated as apartment)
- `"land"` — pozemek (land)
- `"commercial"` — komercni (commercial)

### Pricing

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `rentalPrice` | object \| null | Price object (used for BOTH sale and rent) | `{ "value": 12500000, "currency": "CZK" }` |
| `rentalPrice.value` | number | Price amount in minor units (CZK) | `12500000` (= 12.5M CZK for sale) |
| `rentalPrice.currency` | string | Currency code | `"CZK"` |
| `depositPrice` | object \| null | Security deposit (rentals) | `{ "value": 25000, "currency": "CZK" }` |
| `depositPrice.value` | number | Deposit amount | `25000` |
| `depositPrice.currency` | string | Currency code | `"CZK"` |
| `monthlyFeesPrice` | object \| null | Monthly service charges (rentals) | `{ "value": 3500, "currency": "CZK" }` |
| `monthlyFeesPrice.value` | number | Monthly fees amount | `3500` |
| `monthlyFeesPrice.currency` | string | Currency code | `"CZK"` |
| `priceUnit` | string | Price interpretation | `"perRealEstate"` (sale), `"perMonth"` (rent) |
| `priceNote` | string \| null | Free-text note about price | `"vc. advokatniho servisu a uschovy, vc. provize RK"` |
| `isNoCommission` | boolean | Whether listing has no agent commission | `false` |

### Property Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `area` | number | Property area in m2 | `421`, `46` |
| `floorLevel` | number \| null | Floor number (0 = ground floor) | `0`, `null` |
| `description` | string | Full listing description (Czech) | `"Nabizime Vam velice prostorny byt..."` |

### Location

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `geoCoordinates` | object \| null | GPS coordinates | `{ "lat": 49.68957, "lng": 14.02562 }` |
| `geoCoordinates.lat` | number | Latitude | `49.68957` |
| `geoCoordinates.lng` | number | Longitude | `14.02562` |
| `village` | object \| null | City/town | `{ "id": 4124, "title": "Pribram" }` |
| `village.id` | number | Village ID | `4124` |
| `village.title` | string | Village name | `"Pribram"` |
| `villagePart` | object \| null | City district/part | `{ "id": 10118, "title": "Pribram II" }` |
| `villagePart.id` | number | Village part ID | `10118` |
| `villagePart.title` | string | Village part name | `"Pribram II"` |
| `street` | object \| null | Street | `{ "id": 67938, "title": "Fantova louka" }` |
| `street.id` | number | Street ID | `67938` |
| `street.title` | string | Street name | `"Fantova louka"` |

### Amenities

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `convenience` | string[] | Flat/apartment amenities | `["balcony", "garden"]` |
| `houseConvenience` | string[] | House-specific amenities | `["cellar", "garage", "parking"]` |

#### Known `convenience` values
- `"balcony"` — balkon
- `"terrace"` — terasa
- `"cellar"` — sklep
- `"elevator"` — vytah
- `"garden"` — zahrada
- `"garage"` — garaz
- `"parking"` — parkovani
- `"furnished"` — zarizeny
- `"partiallyFurnished"` — castecne zarizeny
- `"unfurnished"` — nezarizeny

#### Known `houseConvenience` values
- `"cellar"` — sklep
- `"garage"` — garaz
- `"parking"` — parkovani
- `"garden"` — zahrada

### Availability

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `availableFrom` | string \| null | ISO date when available | `"2025-04-15"`, `"2026-01-16"` |

### Media

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `photos` | array | Array of photo objects | `[{ "id": 22809882, "path": "https://...", "alt": "..." }]` |
| `photos[].id` | number | Photo ID | `22809882` |
| `photos[].path` | string | Full image URL | `"https://photo.ulovdomov.cz/2f/FXOCkjIs8s22809882"` |
| `photos[].alt` | string | Alt text (usually same as title) | `"Prodej domu 421 m2"` |

---

## Mapping Status

| Raw Field | StandardProperty Target | Notes |
|-----------|------------------------|-------|
| `id` | `portal_metadata.ulovdomov.id` | Used as `portal_id` (stringified) |
| `title` | `title` | Direct mapping |
| `area` | `details.sqm`, `country_specific.area_living` | Also used for category-specific fields (sqm, sqm_living, area_plot_sqm, sqm_total) |
| `description` | `description` | Direct mapping, `description_language` set to `"cs"` |
| `disposition` | `czech_disposition`, `details.bedrooms`, `details.rooms` | camelCase converted to Czech format (e.g. `"twoPlusKk"` -> `"2+kk"`), bedrooms/rooms extracted from numeric prefix |
| `houseType` | `portal_metadata.ulovdomov.house_type` | Stored in portal metadata only |
| `geoCoordinates.lat` | `location.coordinates.lat` | Direct mapping |
| `geoCoordinates.lng` | `location.coordinates.lon` | Note: API uses `lng`, StandardProperty uses `lon` |
| `photos[].path` | `media.images`, `images`, `country_specific.image_urls` | Photo paths extracted to URL arrays |
| `photos[].id` | — | NOT MAPPED (photo ID not preserved) |
| `photos[].alt` | — | NOT MAPPED (alt text not preserved) |
| `rentalPrice.value` | `price` | Used for both sale and rent prices |
| `rentalPrice.currency` | `currency` | Hardcoded to `"CZK"` in transformer |
| `depositPrice.value` | `deposit`, `portal_metadata.ulovdomov.deposit` | Mapped to both Tier 1 and portal metadata |
| `monthlyFeesPrice.value` | `portal_metadata.ulovdomov.monthly_fees` | Portal metadata only |
| `monthlyFeesPrice.currency` | — | NOT MAPPED |
| `priceUnit` | `portal_metadata.ulovdomov.price_unit` | Portal metadata only |
| `priceNote` | `portal_metadata.ulovdomov.price_note` | Portal metadata only |
| `isNoCommission` | `portal_metadata.ulovdomov.is_no_commission` | Portal metadata only |
| `offerType` | `transaction_type` | `"sale"` -> `"sale"`, everything else -> `"rent"` |
| `propertyType` | `property_type`, `property_category` | Mapped: flat->apartment, house->house, room->apartment, land->land, commercial->commercial |
| `published` | `published_date`, `country_specific.published_date` | Direct mapping |
| `seo` | — | Used to construct `source_url` fallback |
| `absoluteUrl` | `source_url`, `portal_metadata.ulovdomov.url` | Direct mapping |
| `adminUrl` | — | NOT MAPPED (internal portal URL) |
| `isTop` | `portal_metadata.ulovdomov.is_top` | Portal metadata only |
| `showScamWarn` | — | NOT MAPPED |
| `isContacted` | — | NOT MAPPED (session-specific) |
| `village.title` | `location.city`, `country_specific.city` | Direct mapping |
| `village.id` | — | NOT MAPPED |
| `villagePart.title` | `location.region`, `country_specific.district` | Direct mapping |
| `villagePart.id` | — | NOT MAPPED |
| `street.title` | Part of `location.address`, `country_specific.street` | Concatenated into address string |
| `street.id` | — | NOT MAPPED |
| `floorLevel` | `details.floor`, `country_specific.floor_number`, `portal_metadata.ulovdomov.floor_level` | Direct mapping |
| `availableFrom` | `available_from`, `country_specific.available_from` | Direct mapping |
| `convenience` | `amenities.*`, `furnished` | Individual items mapped to boolean amenities; furnished/partiallyFurnished/unfurnished mapped to `furnished` field |
| `houseConvenience` | `amenities.*` | Merged with `convenience` for amenity extraction |

### Convenience -> Amenity Mapping

| Convenience Value | Amenity Target |
|-------------------|---------------|
| `"balcony"` | `amenities.has_balcony` |
| `"terrace"` | `amenities.has_terrace` |
| `"cellar"` | `amenities.has_basement` |
| `"elevator"` | `amenities.has_elevator` |
| `"garden"` | `amenities.has_garden` |
| `"garage"` | `amenities.has_garage` |
| `"parking"` | `amenities.has_parking`, `details.parking_spaces` (set to 1) |
| `"furnished"` | `furnished` -> `"furnished"` |
| `"partiallyFurnished"` | `furnished` -> `"partially_furnished"` |
| `"unfurnished"` | `furnished` -> `"unfurnished"` |

### Derived/Computed Fields

| Derived Field | Source | Computation |
|---------------|--------|-------------|
| `price_per_sqm` | `rentalPrice.value`, `area` | `Math.round(price / area)` |
| `details.bedrooms` | `disposition` | Numeric prefix extracted (e.g. `"twoPlusKk"` -> `2`) |
| `details.rooms` | `disposition` | bedrooms + 1 if `+1` layout, bedrooms if `+kk` |
| `source_url` (fallback) | `seo`, `id` | `https://www.ulovdomov.cz/inzerat/{seo}/{id}` |
| `location.address` | `street`, `villagePart`, `village` | Concatenated with `, ` separator |
| `media.total_images` | `photos` | `photos.length` |
| `country_specific.image_count` | `photos` | `photos.length` |

### Unmapped Fields (data loss)

| Raw Field | Reason Not Mapped | Recommendation |
|-----------|-------------------|----------------|
| `photos[].id` | No target in PropertyImage | Could map to `PropertyImage.image_id` |
| `photos[].alt` | Not extracted | Could map to `PropertyImage.alt` |
| `village.id` | No target | Could store in `portal_metadata` for dedup |
| `villagePart.id` | No target | Could store in `portal_metadata` for dedup |
| `street.id` | No target | Could store in `portal_metadata` for dedup |
| `adminUrl` | Internal portal URL | Not needed |
| `showScamWarn` | Portal-internal flag | Not needed |
| `isContacted` | Session-specific | Not needed |
| `monthlyFeesPrice.currency` | Always CZK | Low priority |
| `depositPrice.currency` | Always CZK | Low priority |
| `rentalPrice.currency` | Hardcoded to CZK | Low priority (API always returns CZK) |

### Fields with No Portal Data (always null/undefined in StandardProperty)

| StandardProperty Field | Notes |
|------------------------|-------|
| `condition` | Not provided by UlovDomov API — set to `undefined` |
| `construction_type` | Not provided — normalized from `undefined` |
| `heating_type` | Not provided |
| `energy_rating` | Not provided |
| `details.bathrooms` | Not provided |
| `details.total_floors` | Not provided |
| `details.year_built` | Not provided |
| `details.renovation_year` | Not provided |
| `agent` | Not provided (no agent data in API response) |
| `features` | Not used |
| `hoa_fees` | Not mapped (monthlyFeesPrice only in portal_metadata) |

---

## Notes

1. **No detail page needed**: The UlovDomov API returns complete listing data in the `/offer/find` response. There is no separate detail endpoint to fetch.
2. **Price field naming**: Despite the field name `rentalPrice`, it contains the sale price for sale listings. The `priceUnit` field disambiguates (`"perRealEstate"` for sale, `"perMonth"` for rent).
3. **Coliving**: UlovDomov has a third offer type `"coliving"` in addition to rent and sale.
4. **Disposition encoding**: UlovDomov uses camelCase English-derived names (`"twoPlusKk"`) instead of the standard Czech format (`"2+kk"`). The transformer converts these.
5. **Convenience arrays**: Amenities are split into two arrays — `convenience` (general/flat amenities) and `houseConvenience` (house-specific). Both are merged in the transformer.
6. **Floor numbering**: `floorLevel: 0` means ground floor. `null` means not applicable (houses, land).
7. **Location hierarchy**: village (city) > villagePart (district) > street. Each has an `id` and `title`.
8. **Image CDN**: All photos served from `https://photo.ulovdomov.cz/` with pattern `{hash}{photoId}`.
