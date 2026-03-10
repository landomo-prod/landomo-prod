# Bezrealitky — Raw Data Dictionary

## Listing Page Response (GraphQL)

### Endpoint
- **URL:** `https://api.bezrealitky.cz/graphql/`
- **Method:** POST
- **Operation:** `ListAdverts`
- **Note:** GraphQL returns full listing data in listing page response — no separate detail endpoint needed.

### Query Variables
| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `offerType` | `[OfferType]` | `["PRODEJ"]` | `PRODEJ` (sale), `PRONAJEM` (rent) |
| `estateType` | `[EstateType]` | `["BYT"]` | `BYT`, `DUM`, `POZEMEK`, `KOMERCNI`, `GARAZ`, etc. |
| `order` | `ResultOrder` | `"TIMEORDER_DESC"` | Sort order |
| `limit` | `Int` | `5` | Page size |
| `offset` | `Int` | `0` | Pagination offset |
| `locale` | `Locale!` | `"CS"` | `CS` (Czech), `EN` (English) |

### Response Wrapper
```json
{
  "data": {
    "listAdverts": {
      "totalCount": 694,
      "list": [ ...listings... ]
    }
  }
}
```

---

## Field Dictionary — `listAdverts.list[]`

### Identification & Status

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `id` | string | `"985017"` | Internal listing ID |
| `externalId` | string\|null | `null` | External reference ID (rarely populated) |
| `hash` | string | `"ZYKTQYECLGYJXMMRBGVXWLCSU"` | Unique hash identifier |
| `uri` | string | `"985017-nabidka-prodej-bytu-nepilova-praha"` | URL slug (relative path) |
| `code` | string\|null | `null` | Listing code (rarely populated) |
| `active` | boolean | `true` | Whether listing is currently active |
| `isPausedBySystem` | boolean | `false` | System-paused flag |
| `isPausedByUser` | boolean | `false` | User-paused flag |
| `activationPending` | boolean\|null | `null` | Awaiting activation |
| `archived` | boolean | `false` | Archived flag |
| `reserved` | boolean | `false` | Property is reserved (under contract) |
| `highlighted` | boolean | `false` / `true` | Promoted/featured listing |
| `isNew` | boolean | `false` / `true` | Recently published flag |
| `isEditable` | boolean | `false` / `true` | Whether current user can edit (always false for anonymous) |

### Timestamps

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `timeActivated` | number\|null | `null` | Unix epoch when listing was activated |
| `timeDeactivated` | number\|null | `null` | Unix epoch when listing was deactivated |
| `timeExpiration` | number\|null | `1774899489` | Unix epoch when listing expires |
| `timeOrder` | number\|null | `null` | Unix epoch for sort ordering |
| `daysActive` | string\|null | `"30 dni"` | Human-readable active duration (Czech locale) |

### Content

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `title` | string | `"Prodej bytu 2+kk 52 m2"` | Czech title |
| `titleEnglish` | string | `"1 bedroom with open-plan kitchen flat for sale, 52 m2"` | English title |
| `description` | string | (long Czech text) | Full Czech description |
| `descriptionEnglish` | string | (long English text or `""`) | English description (may be empty) |
| `descriptionSk` | string\|null | `null` | Slovak description |
| `imageAltText` | string | `"Prodej bytu 2+kk 52 m2, Nepilova, Praha"` | Alt text for main image (locale-dependent) |

### Property Classification

| Field | Type | Example Values | Description |
|-------|------|----------------|-------------|
| `estateType` | string | `"BYT"` | Estate type enum: `BYT` (apartment), `DUM` (house), `POZEMEK` (land), `KOMERCNI` (commercial), `GARAZ` (garage), `KANCELAR` (office), `NEBYTOVY_PROSTOR` (non-residential) |
| `offerType` | string | `"PRODEJ"` | Offer type enum: `PRODEJ` (sale), `PRONAJEM` (rent) |
| `disposition` | string | `"DISP_2_KK"`, `"DISP_3_1"` | Room layout enum: `DISP_{N}_{KK\|1}` format. `KK` = open kitchen, `1` = separate kitchen |
| `landType` | string | `"UNDEFINED"` | Land type classification (for POZEMEK listings) |
| `houseType` | string\|null | `null` | House subtype (for DUM listings) |

### Dimensions / Area

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `surface` | number\|null | `52` | Living area in m2 |
| `surfaceLand` | number\|null | `null` | Land/plot area in m2 (for houses/land) |
| `balconySurface` | number\|null | `7.2` | Balcony area in m2 |
| `loggiaSurface` | number\|null | `null` | Loggia area in m2 |
| `terraceSurface` | number\|null | `null` / `100` | Terrace area in m2 |
| `cellarSurface` | number\|null | `null` / `15` | Cellar area in m2 |

### Financial

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `price` | number\|null | `8990000` | Price in given currency (CZK) |
| `priceFormatted` | string | `"8.990.000 Kc"` | Locale-formatted price string |
| `deposit` | number\|null | `null` | Security deposit amount (rentals) |
| `charges` | number | `0` | Total charges |
| `serviceCharges` | number | `0` | Service/HOA charges |
| `utilityCharges` | number | `0` | Utility charges |
| `fee` | number | `0` | Agency fee |
| `currency` | string | `"CZK"` | Currency code |
| `originalPrice` | number | `9190000` | Original price before discount |
| `isDiscounted` | boolean | `true` / `false` | Whether price has been reduced |
| `serviceChargesNote` | string\|null | `null` | Note about service charges |
| `utilityChargesNote` | string\|null | `null` | Note about utility charges |

### Location

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `gps.lat` | number | `50.1108618` | Latitude |
| `gps.lng` | number | `14.4959955` | Longitude |
| `address` | string | `"Nepilova, Praha - Vysocany"` | Formatted address (locale-dependent) |
| `addressInput` | string | `"Nepilova 903/1, Vysocany, Praha, obvod Praha 9, Hlavni mesto Praha, Praha, 190 00, Cesko"` | Full structured address input |
| `street` | string | `"Nepilova"` | Street name |
| `houseNumber` | string | `"903/1"` | House/building number |
| `city` | string | `"Praha"` | City name (locale-dependent) |
| `cityDistrict` | string | `"Praha - Vysocany"` / `"Poruba"` | City district (locale-dependent) |
| `zip` | string | `"190 00"` | Postal code |
| `region.id` | string | `"15393"` | Region ID |
| `region.name` | string | `"Vysocany"` | Region name |
| `region.uri` | string | `"praha-vysocany"` | Region URL slug |
| `ruianId` | string\|null | `"25663321"` | Czech RUIAN address register ID |
| `addressPointId` | string\|null | `null` | Address point ID |

### Geographic Segmentation

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `isPrague` | boolean | `true` | Property is in Prague |
| `isBrno` | boolean | `false` | Property is in Brno |
| `isPragueWest` | boolean | `false` | Property is in Prague-West district |
| `isPragueEast` | boolean | `false` | Property is in Prague-East district |
| `isCityWithDistricts` | boolean | `false` / `true` | City has multiple districts |
| `isTSRegion` | boolean | `true` / `false` | Moravian-Silesian region flag |

### Building Characteristics

| Field | Type | Example Values | Description |
|-------|------|----------------|-------------|
| `condition` | string | `"VERY_GOOD"` | Property condition enum |
| `ownership` | string | `"OSOBNI"` | Ownership type: `OSOBNI` (personal), `DRUZSTEVNI` (cooperative), etc. |
| `equipped` | string | `"CASTECNE"` | Furnished status: `CASTECNE` (partially), `EQUIPPED` (furnished), `NOT_EQUIPPED` (unfurnished) |
| `construction` | string | `"BRICK"`, `"PANEL"` | Construction type: `BRICK`, `PANEL`, `WOOD`, `STONE`, etc. |
| `position` | string | `"UNDEFINED"` | Position in building |
| `situation` | string | `"UNDEFINED"` | Property situation/exposure |
| `floor` | string\|null | `null` | Floor (string, e.g. "3. patro", "prizemi") |
| `totalFloors` | number\|null | `null` | Total floors in building |
| `age` | number\|null | `null` | Building age in years |
| `execution` | string\|null | `null` | Execution quality |
| `reconstruction` | string\|null | `null` | Reconstruction/renovation info |

### Energy & Utilities

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `penb` | string\|null | `"B"`, `"E"` | PENB energy rating (A-G scale) |
| `lowEnergy` | boolean | `false` | Low energy building flag |
| `heating` | string\|null | `null` | Heating type |
| `water` | string\|null | `null` | Water supply type |
| `sewage` | string\|null | `null` | Sewage type |

### Amenities (Boolean Flags)

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `parking` | boolean | `true` | Has parking |
| `garage` | boolean | `false` | Has garage |
| `lift` | boolean | `true` | Has elevator |
| `balcony` | boolean | `false` | Has balcony (NOTE: can be `false` even when `balconySurface` > 0) |
| `terrace` | boolean | `false` | Has terrace |
| `cellar` | boolean | `false` | Has cellar/basement |
| `loggia` | boolean | `false` | Has loggia |
| `frontGarden` | boolean\|null | `null` | Has front garden |
| `newBuilding` | boolean\|null | `null` | New construction |
| `petFriendly` | boolean\|null | `null` | Allows pets |
| `barrierFree` | boolean | `false` / `true` | Wheelchair accessible |
| `roommate` | boolean | `false` | Roommate/shared living flag |

### Rental-Specific

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `shortTerm` | boolean | `false` | Short-term rental allowed |
| `minRentDays` | number\|null | `null` | Minimum rental period (days) |
| `maxRentDays` | number\|null | `null` | Maximum rental period (days) |
| `availableFrom` | number\|null | `1769382000` | Unix epoch timestamp when available |

### Media

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `publicImages` | array | (see below) | Array of image objects |
| `publicImages[].id` | string | `"26743912"` | Image ID |
| `publicImages[].url` | string | `"https://api.bezrealitky.cz/media/cache/record_main/data/images/advert/..."` | Image URL (filtered by `RECORD_MAIN`) |
| `publicImages[].order` | number | `1` | Display order |
| `publicImages[].main` | boolean | `true` / `false` | Main/featured image flag |
| `publicImages[].filename` | string | `"1769458028-wfyfgkgvcv-terasa-2.jpg"` | Original filename |
| `tour360` | string\|null | `null` | 360-degree virtual tour URL |

### Analytics & Portal Metadata

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `visitCount` | number | `690` | Number of page views |
| `conversationCount` | number | `12` | Number of inquiries/conversations |
| `locale` | string | `"CS"` | Listing locale |
| `charity` | boolean | `false` | Charity listing flag |
| `showOwnest` | boolean | `true` | Show Ownest integration |
| `showPriceSuggestionButton` | boolean | `false` | Show price suggestion feature |
| `threesome` | boolean | `true` | Package tier flag (3-listing plan) |
| `fivesome` | boolean | `true` | Package tier flag (5-listing plan) |
| `brizCount` | number | `9` | Number of "briz" (bumps/refreshes) |
| `realmanExportEnabled` | boolean | `true` | Realman export integration enabled |
| `hasContractRent` | boolean\|null | `null` | Has contract rent feature |
| `rentPlatformStatus` | string\|null | `null` | Rent platform status |
| `rentPlatformOrder` | number | `0` | Rent platform ordering |
| `tags` | string[] | `["Castecne vybaveno", "Vytah", "Parkovani", "Balkon 7,2 m2"]` | Human-readable tag labels (locale-dependent) |

---

## Known Enum Values

### `estateType`
| Value | Meaning |
|-------|---------|
| `BYT` | Apartment |
| `DUM` | House |
| `POZEMEK` | Land |
| `KOMERCNI` | Commercial |
| `GARAZ` | Garage |
| `KANCELAR` | Office |
| `NEBYTOVY_PROSTOR` | Non-residential space |

### `offerType`
| Value | Meaning |
|-------|---------|
| `PRODEJ` | Sale |
| `PRONAJEM` | Rent |

### `disposition`
| Value | Czech Equivalent |
|-------|-----------------|
| `DISP_1_KK` | 1+kk (studio with kitchenette) |
| `DISP_1_1` | 1+1 (1 room + separate kitchen) |
| `DISP_2_KK` | 2+kk |
| `DISP_2_1` | 2+1 |
| `DISP_3_KK` | 3+kk |
| `DISP_3_1` | 3+1 |
| `DISP_4_KK` | 4+kk |
| `DISP_4_1` | 4+1 |
| `DISP_5_KK` | 5+kk |
| `DISP_5_1` | 5+1 |
| `DISP_6_KK` | 6+kk |
| `UNDEFINED` | Undefined/atypical |
| `ROOM` | Single room |
| `OTHER` | Other |

### `ownership`
| Value | Meaning |
|-------|---------|
| `OSOBNI` | Personal ownership |
| `DRUZSTEVNI` | Cooperative |
| `STATNI` | State |

### `equipped`
| Value | Meaning |
|-------|---------|
| `CASTECNE` | Partially furnished |
| `EQUIPPED` | Fully furnished |
| `NOT_EQUIPPED` | Unfurnished |

### `construction`
| Value | Meaning |
|-------|---------|
| `BRICK` | Brick |
| `PANEL` | Panel (prefab) |
| `WOOD` | Wood |
| `STONE` | Stone |
| `UNDEFINED` | Unknown |

### `condition`
| Value | Meaning |
|-------|---------|
| `VERY_GOOD` | Very good condition |
| `GOOD` | Good condition |
| `NEW` | New |
| `AFTER_RECONSTRUCTION` | After renovation |
| `BEFORE_RECONSTRUCTION` | Needs renovation |
| `BAD` | Bad condition |
| `UNDEFINED` | Unknown |

### `penb` (Energy Rating)
| Value | Meaning |
|-------|---------|
| `A` | A (best) |
| `B` | B |
| `C` | C |
| `D` | D |
| `E` | E |
| `F` | F |
| `G` | G (worst) |

---

## Mapping Status

| Raw Field | StandardProperty / TierI Target | Notes |
|-----------|-------------------------------|-------|
| `id` | `portal_id` (as `bezrealitky-{id}`) | Prefixed with portal name |
| `externalId` | -- UNMAPPED | Rarely populated, low value |
| `hash` | -- UNMAPPED | Internal hash, could use as checksum |
| `uri` | `source_url` (as `https://www.bezrealitky.cz{uri}`) | Relative path, prefixed |
| `code` | -- UNMAPPED | Rarely populated |
| `active` | `status` | `true` -> `active`, `false` -> `removed` |
| `isPausedBySystem` | -- UNMAPPED | Portal-internal state |
| `isPausedByUser` | -- UNMAPPED | Portal-internal state |
| `activationPending` | -- UNMAPPED | Portal-internal state |
| `archived` | -- UNMAPPED | Could refine `status` detection |
| `reserved` | -- UNMAPPED | Could map to `status: 'reserved'` or feature flag |
| `highlighted` | -- UNMAPPED | Portal promotion flag |
| `isNew` | -- UNMAPPED | Could map to `portal_metadata` |
| `isEditable` | -- UNMAPPED | Auth-specific, no value |
| `timeActivated` | `published_date` | Unix epoch -> ISO 8601 |
| `timeDeactivated` | -- UNMAPPED | Could track deactivation timestamp |
| `timeExpiration` | -- UNMAPPED | Could map to `portal_metadata` |
| `timeOrder` | -- UNMAPPED | Sort-only field |
| `daysActive` | -- UNMAPPED | Human-readable string, derived from timestamps |
| `title` | `title` | Direct |
| `titleEnglish` | -- UNMAPPED | Could map to `portal_metadata.title_en` |
| `description` | `description` | Direct |
| `descriptionEnglish` | -- UNMAPPED | Could map to `portal_metadata.description_en` |
| `descriptionSk` | -- UNMAPPED | Slovak translation |
| `imageAltText` | -- UNMAPPED | Could use for image alt text in media |
| `estateType` | `property_category` (via `categoryDetector`) | `BYT`->apartment, `DUM`->house, etc. |
| `offerType` | `transaction_type` | `PRODEJ`->sale, `PRONAJEM`->rent |
| `disposition` | `country_specific.czech_disposition`, `bedrooms`, `rooms` | Mapped via helpers |
| `landType` | -- UNMAPPED (partially) | Used in land transformer |
| `houseType` | -- UNMAPPED (partially) | Used in house transformer |
| `surface` | `sqm` (apartment), `sqm_living` (house), `area_plot_sqm` (land) | Category-dependent |
| `surfaceLand` | `sqm_plot` (house), `area_plot_sqm` (land) | Category-dependent |
| `balconySurface` | `balcony_area` | Direct (apartment) |
| `loggiaSurface` | `loggia_area` | Direct (apartment) |
| `terraceSurface` | `terrace_area` | Direct (apartment) |
| `cellarSurface` | `cellar_area` | Direct (apartment) |
| `price` | `price` | Direct |
| `priceFormatted` | -- UNMAPPED | Display-only, derived from price+currency |
| `deposit` | `deposit` | Direct |
| `charges` | -- UNMAPPED | Generic charges, overlaps with serviceCharges/utilityCharges |
| `serviceCharges` | `hoa_fees`, `service_charges` | Mapped to both |
| `utilityCharges` | `utility_charges` | Direct |
| `fee` | -- UNMAPPED | Agency fee, could map to `portal_metadata` |
| `currency` | `currency` | Direct |
| `originalPrice` | -- UNMAPPED | Could map to `portal_metadata.original_price` for price history |
| `isDiscounted` | -- UNMAPPED | Could derive from price vs originalPrice |
| `serviceChargesNote` | -- UNMAPPED | Could map to `country_specific.service_charges_note` |
| `utilityChargesNote` | -- UNMAPPED | Could map to `country_specific.utility_charges_note` |
| `gps.lat` | `location.coordinates.lat` | Direct |
| `gps.lng` | `location.coordinates.lon` | Note: `lng` -> `lon` rename |
| `address` | `location.address` | Direct |
| `addressInput` | -- UNMAPPED | Full structured address, more detailed than `address` |
| `street` | -- UNMAPPED (used in address fallback) | Used to construct address if `address` is null |
| `houseNumber` | -- UNMAPPED (used in address fallback) | Used to construct address if `address` is null |
| `city` | `location.city` | Direct |
| `cityDistrict` | -- UNMAPPED | Could map to `location.district` or `country_specific` |
| `zip` | `location.postal_code` | Direct |
| `region.id` | -- UNMAPPED | Internal region ID |
| `region.name` | `location.region` | Direct |
| `region.uri` | -- UNMAPPED | URL slug for region |
| `ruianId` | -- UNMAPPED | Czech address register ID; could map to `country_specific.ruian_id` |
| `addressPointId` | -- UNMAPPED | Address point reference |
| `isPrague` | -- UNMAPPED | Could map to `country_specific.is_prague` |
| `isBrno` | -- UNMAPPED | Could map to `country_specific.is_brno` |
| `isPragueWest` | -- UNMAPPED | Could map to `country_specific.is_prague_west` |
| `isPragueEast` | -- UNMAPPED | Could map to `country_specific.is_prague_east` |
| `isCityWithDistricts` | -- UNMAPPED | Could map to `country_specific.is_city_with_districts` |
| `isTSRegion` | -- UNMAPPED | Could map to `country_specific.is_ts_region` |
| `condition` | `condition` | Via `normalizeCondition()` |
| `ownership` | `country_specific.czech_ownership` | Via `normalizeOwnership()` |
| `equipped` | `furnished` | Via `normalizeFurnished()` |
| `construction` | `construction_type` | Via `normalizeConstructionType()` |
| `position` | -- UNMAPPED | Usually `"UNDEFINED"`. Could map to `country_specific.position_in_building` |
| `situation` | -- UNMAPPED | Usually `"UNDEFINED"`. Could map to `country_specific.street_exposure` |
| `floor` | `floor` | Via `parseFloor()` (string -> number) |
| `totalFloors` | `total_floors` | Direct |
| `age` | `year_built` | Computed: `currentYear - age` |
| `execution` | -- UNMAPPED | Execution quality. Could map to `country_specific.execution_quality` |
| `reconstruction` | `renovation_year` | Via `parseRenovationYear()` |
| `penb` | `energy_class` | Via `normalizeEnergyRating()` |
| `lowEnergy` | feature: `low_energy` | Added to features array |
| `heating` | `heating_type` | Via `normalizeHeatingType()` |
| `water` | -- UNMAPPED | Could map to `country_specific.water_supply` |
| `sewage` | -- UNMAPPED | Could map to `country_specific.sewage_type` |
| `parking` | `has_parking` | Direct boolean |
| `garage` | `has_garage` | Direct boolean |
| `lift` | `has_elevator` | Direct boolean |
| `balcony` | `has_balcony` | Direct boolean (NOTE: can be false when balconySurface > 0) |
| `terrace` | `has_terrace` | Direct boolean |
| `cellar` | `has_basement` | Direct boolean |
| `loggia` | `has_loggia` | Direct boolean |
| `frontGarden` | -- UNMAPPED | Could map to `amenities.has_garden` |
| `newBuilding` | feature: `new_building` | Added to features array |
| `petFriendly` | feature: `pet_friendly` | Added to features array; could also map to `amenities.is_pet_friendly` |
| `barrierFree` | feature: `barrier_free` | Added to features array; could also map to `amenities.is_barrier_free` |
| `roommate` | -- UNMAPPED | Roommate/shared living flag |
| `shortTerm` | feature: `short_term_rental` | Added to features array; could also map to `country_specific.short_term_rental` |
| `minRentDays` | `min_rent_days` | Direct |
| `maxRentDays` | `max_rent_days` | Direct |
| `availableFrom` | `available_from` | Unix epoch -> ISO 8601 |
| `publicImages[].url` | `media.images[]`, `images[]` | Extracted as URL strings |
| `publicImages[].main` | `media.main_image` | First image where `main === true` |
| `publicImages[].id` | -- UNMAPPED | Could map to `media.images[].image_id` |
| `publicImages[].order` | -- UNMAPPED | Could map to `media.images[].order` |
| `publicImages[].filename` | -- UNMAPPED | Could map to `media.images[].filename` |
| `tour360` | `media.tour_360_url` | Direct |
| `visitCount` | -- UNMAPPED | Could map to `portal_metadata.visit_count` |
| `conversationCount` | -- UNMAPPED | Could map to `portal_metadata.conversation_count` |
| `locale` | -- UNMAPPED | Query-dependent, not a property attribute |
| `charity` | -- UNMAPPED | Charity listing flag |
| `showOwnest` | -- UNMAPPED | Portal UI flag |
| `showPriceSuggestionButton` | -- UNMAPPED | Portal UI flag |
| `threesome` | -- UNMAPPED | Seller package tier flag |
| `fivesome` | -- UNMAPPED | Seller package tier flag |
| `brizCount` | -- UNMAPPED | Listing bump/refresh count |
| `realmanExportEnabled` | -- UNMAPPED | Integration flag |
| `hasContractRent` | -- UNMAPPED | Rent contract feature |
| `rentPlatformStatus` | -- UNMAPPED | Rent platform integration |
| `rentPlatformOrder` | -- UNMAPPED | Rent platform ordering |
| `tags` | -- UNMAPPED | Human-readable tags (locale-dependent). Could map to `portal_features` |

---

## Unmapped Fields — Priority Assessment

### HIGH VALUE (should map)
| Raw Field | Suggested Target | Reason |
|-----------|-----------------|--------|
| `reserved` | `portal_metadata.reserved` or status refinement | Indicates property is under contract |
| `originalPrice` | `portal_metadata.original_price` | Price history tracking |
| `cityDistrict` | `country_specific` or `location` extension | Useful for Prague/Brno district filtering |
| `isPrague` | `country_specific.is_prague` | Already defined in CzechSpecificFields |
| `isBrno` | `country_specific.is_brno` | Already defined in CzechSpecificFields |
| `water` | `country_specific.water_supply` | Already defined in CzechSpecificFields |
| `sewage` | `country_specific.sewage_type` | Already defined in CzechSpecificFields |
| `frontGarden` | `amenities.has_garden` | Already defined in PropertyAmenities |
| `petFriendly` | `amenities.is_pet_friendly` | Already defined in PropertyAmenities |
| `barrierFree` | `amenities.is_barrier_free` | Already defined in PropertyAmenities |
| `tags` | `portal_features` | Human-readable feature tags |
| `ruianId` | `country_specific.ruian_id` | Czech address register reference |
| `imageAltText` | `media.images[0].alt` | PropertyImage supports alt text |

### MEDIUM VALUE (nice to have)
| Raw Field | Suggested Target | Reason |
|-----------|-----------------|--------|
| `titleEnglish` | `portal_metadata.title_en` | Multilingual support |
| `descriptionEnglish` | `portal_metadata.description_en` | Multilingual support |
| `fee` | `portal_metadata.agency_fee` | Agency fee transparency |
| `position` | `country_specific.position_in_building` | When not UNDEFINED |
| `situation` | `country_specific.street_exposure` | When not UNDEFINED |
| `execution` | `country_specific.execution_quality` | When populated |
| `visitCount` | `portal_metadata.visit_count` | Demand indicator |
| `conversationCount` | `portal_metadata.conversation_count` | Demand indicator |
| `serviceChargesNote` | `country_specific.service_charges_note` | Already defined |
| `utilityChargesNote` | `country_specific.utility_charges_note` | Already defined |
| `publicImages[].order` | `media.images[].order` | Already defined in PropertyImage |
| `publicImages[].filename` | `media.images[].filename` | Already defined in PropertyImage |

### LOW VALUE (skip)
| Raw Field | Reason |
|-----------|--------|
| `isPausedBySystem`, `isPausedByUser`, `activationPending` | Portal-internal moderation state |
| `isEditable` | Auth-specific, always false for scrapers |
| `timeOrder`, `daysActive` | Sort/display helpers |
| `priceFormatted` | Derived from price + currency |
| `showOwnest`, `showPriceSuggestionButton` | Portal UI config |
| `threesome`, `fivesome` | Seller package tiers |
| `brizCount` | Listing bump count |
| `realmanExportEnabled` | Integration flag |
| `rentPlatformStatus`, `rentPlatformOrder` | Rent platform integration |
| `locale` | Query parameter, not property data |
| `charity` | Niche flag |

---

## Data Quality Notes

1. **Boolean vs Surface inconsistency**: `balcony` can be `false` while `balconySurface` is `7.2`. The surface fields are more reliable than boolean flags for determining if the feature exists. The transformer currently uses only the boolean flags.

2. **Timestamps are Unix epoch**: `timeActivated`, `timeExpiration`, `availableFrom` are all Unix epoch seconds (not milliseconds). The transformer correctly multiplies by 1000 for JS Date.

3. **`daysActive` is a localized string**: e.g. `"30 dni"` — not a number. Cannot be parsed reliably across locales.

4. **`floor` is a string, not a number**: Contains Czech text like "3. patro", "prizemi", "podkrovi". The transformer has a `parseFloor()` helper for this.

5. **`age` is building age, not year built**: The transformer computes `year_built = currentYear - age`. This drifts by 1 year depending on when the listing was created vs when we scrape.

6. **Most fields frequently null**: `floor`, `totalFloors`, `age`, `heating`, `water`, `sewage`, `execution`, `reconstruction` are null in the majority of listings. The GraphQL API returns full data — there is no separate detail endpoint with more fields.

7. **`description` quality varies**: Some listings have detailed descriptions; others (especially `descriptionEnglish`) are empty strings. Slovak descriptions (`descriptionSk`) are almost always null.
