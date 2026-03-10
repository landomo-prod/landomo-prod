# LuxuryEstate Field Mapping Reference

Complete source-to-target field mapping for both transformer outputs. All fields come from either Phase 1 minimal listing data (`LuxuryEstateMinimalListing`) or Phase 3 JSON-LD detail data (`LuxuryEstateJsonLd`).

---

## Common Fields (Both Categories)

These fields are mapped identically in both the apartment and house transformers.

### Identity & Routing

| Source | JSON-LD Path | Target Field | Type | Notes |
|--------|-------------|--------------|------|-------|
| Phase 1 `listing.id` | — | `portal_id` | `string` | Format: `'luxuryestate-it-{id}'` |
| Hardcoded | — | `source_platform` | `string` | `'luxuryestate.com'` |
| Phase 1 `listing.url` | — | `source_url` | `string` | `'https://www.luxuryestate.com' + url` |
| Hardcoded | — | `status` | `string` | `'active'` |
| Hardcoded | — | `country` | `string` | `'Italy'` |
| Hardcoded | — | `country_code` | `string` | `'IT'` |
| Hardcoded | — | `property_category` | `string` | `'apartment'` or `'house'` |

### Core Property Data

| Source | JSON-LD Path | Target Field | Type | Notes |
|--------|-------------|--------------|------|-------|
| JSON-LD | `mainEntity.name` | `title` | `string` | Listing headline |
| JSON-LD | `offers.price` | `price` | `number` | Numeric; Phase 1 price used only for checksum |
| Detected | — | `transaction_type` | `string` | `'sale'` or `'rent'` (from URL pattern) |
| JSON-LD | `mainEntity.description` | `description` | `string` | Full listing description |
| JSON-LD | `mainEntity.image` | `images` | `string[]` | Array of CDN image URLs |
| JSON-LD | `mainEntity.yearBuilt` | `year_built` | `number` | Construction year |
| JSON-LD | `mainEntity.numberOfRooms` | `rooms` | `number` | Total room count |
| JSON-LD | `mainEntity.numberOfBedrooms` | `bedrooms` | `number` | Falls back to `amenityFeature[Bedrooms]` |
| JSON-LD | `mainEntity.numberOfBathroomsTotal` | `bathrooms` | `number` | Falls back to `amenityFeature[Bathrooms]` |

### Location

| Source | JSON-LD Path | Target Field | Type | Notes |
|--------|-------------|--------------|------|-------|
| JSON-LD | `mainEntity.address.addressLocality` | `location.city` | `string` | City name |
| JSON-LD | `mainEntity.address.addressRegion` | `location.region` | `string` | Italian region (e.g., `Lazio`) |
| JSON-LD | `mainEntity.geo.latitude` | `location.coordinates.lat` | `number` | Decimal degrees |
| JSON-LD | `mainEntity.geo.longitude` | `location.coordinates.lon` | `number` | Decimal degrees |

### Boolean Amenities

| Source | `amenityFeature[name]` | Target Field | Type | True Condition |
|--------|------------------------|--------------|------|----------------|
| JSON-LD | `Elevator` | `has_elevator` | `boolean` | `value === true` or `=== 'Yes'` |
| JSON-LD | `Balcony` | `has_balcony` | `boolean` | `value === true` or `=== 'Yes'` |
| JSON-LD | `Parking` | `has_parking` | `boolean` | `value === true` or `=== 'Yes'` |
| JSON-LD | `Basement` or `Cellar` | `has_basement` | `boolean` | Either name matches |
| JSON-LD | `Terrace` | `has_terrace` | `boolean` | `value === true` or `=== 'Yes'` |
| JSON-LD | `Garage` | `has_garage` | `boolean` | `value === true` or `=== 'Yes'` |

### Tier II — Country-Specific (`country_specific.italy`)

| Source | JSON-LD Path | Stored Key | Type |
|--------|-------------|-----------|------|
| JSON-LD | `mainEntity.address.addressRegion` | `italy.region` | `string` |
| JSON-LD | `mainEntity.address.addressLocality` | `italy.city` | `string` |
| JSON-LD | `mainEntity.address.postalCode` | `italy.postal_code` | `string` |

### Tier III — Portal Metadata (`portal_metadata.luxuryestate`)

| Source | Path | Stored Key | Type |
|--------|------|-----------|------|
| JSON-LD | `mainEntity.identifier` | `identifier` | `string` |
| JSON-LD | `mainEntity.keywords` | `keywords` | `string` |
| Phase 1 | `listing.categoryHint` | `category_hint` | `string` |

---

## Apartment-Specific Fields

| Source | JSON-LD Path | Target Field | Type | Notes |
|--------|-------------|--------------|------|-------|
| Hardcoded | — | `property_category` | `string` | `'apartment'` |
| JSON-LD | `mainEntity.floorSize.value` | `sqm` | `number` | `unitCode: MTK` = sqm |
| Detected | `mainEntity.@type` | `property_subtype` | `string` | See subtype table below |

### Apartment Property Subtype Mapping

| `mainEntity.@type` | `property_subtype` |
|--------------------|---------------------|
| `Penthouse` | `penthouse` |
| `Loft` | `loft` |
| `Apartment` (or any other) | `standard` |

---

## House-Specific Fields

| Source | JSON-LD Path | Target Field | Type | Notes |
|--------|-------------|--------------|------|-------|
| Hardcoded | — | `property_category` | `string` | `'house'` |
| JSON-LD | `mainEntity.floorSize.value` | `sqm_living` | `number` | Living area in sqm |
| JSON-LD | `mainEntity.lotSize.value` | `sqm_plot` | `number` | Plot/land area; defaults to `0` if absent |
| JSON-LD | `amenityFeature[Garden]` | `has_garden` | `boolean` | `value === true` or `=== 'Yes'` |
| JSON-LD | `amenityFeature[Pool/Swimming pool]` | `has_pool` | `boolean` | Either name matches |
| Detected | `mainEntity.@type` + keywords | `property_subtype` | `string` | See subtype table below |

### House Property Subtype Mapping

| `mainEntity.@type` / Keyword | `property_subtype` |
|------------------------------|---------------------|
| `Villa` | `villa` |
| `SingleFamilyResidence` | `detached` |
| `terraced` (keyword in name/description) | `terraced` |
| `House` or (default) | `detached` |

---

## Checksum Fields

Phase 2 checksum comparison uses the following fields from Phase 1 minimal listing data. A change in any of these fields triggers a full detail re-fetch.

| Checksum Field | Source | Purpose |
|----------------|--------|---------|
| `price` | `tracking-hydration properties[].price.raw` | Detects price changes |
| `title` | `tracking-hydration properties[].title` | Detects title/name edits |
| `city` | `tracking-hydration properties[].geoInfo.city` | Detects location reassignments |
| `categoryHint` | `tracking-hydration properties[].type` | Detects category reclassification |

---

## Category Detection Logic

### From JSON-LD `@type` (Primary)

| `mainEntity.@type` | Resolved Category |
|--------------------|-------------------|
| `Apartment` | `apartment` |
| `SingleFamilyResidence` | `house` |
| `House` | `house` |
| `Villa` | `house` |
| `Residence` | `house` |

### Keyword Fallback (on `name`, `description`, URL path)

| Keywords | Resolved Category |
|----------|-------------------|
| `villa`, `casa`, `chalet`, `farmhouse`, `casale`, `rustico`, `masseria` | `house` |
| (no match) | `apartment` |

### Transaction Type Detection (from URL path)

| URL Pattern | Transaction |
|-------------|-------------|
| `/for-rent/` | `rent` |
| `/affitto/` | `rent` |
| `-for-rent-` | `rent` |
| `/rent/` | `rent` |
| (no match) | `sale` |

---

## Fields NOT Collected

The following fields are absent from LuxuryEstate listings or not exposed in the JSON-LD schema and are therefore not mapped:

| Field | Reason |
|-------|--------|
| `floor` / `total_floors` | Not present in schema.org JSON-LD |
| `energy_class` | Not available in LuxuryEstate structured data |
| `heating_type` | Not available in LuxuryEstate structured data |
| `construction_type` | Not available in LuxuryEstate structured data |
| `condition` | Not available in LuxuryEstate structured data |
| `furnished` | Not available in LuxuryEstate structured data |
| `deposit` | Not available in LuxuryEstate structured data |
| `monthly_rent` | Price field used for both sale price and rental price |
| `virtual_tour_url` | Not available |
| `video_url` | Not available |
| `sqm_total` (apartments) | Only `floorSize` (living area) is provided |
| `sqm_plot` (apartments) | Apartments do not have plot area |
