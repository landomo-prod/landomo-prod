# Subito.it Field Mapping

This document maps all raw Subito.it (Hades API) fields to the Landomo normalized schema.

## Data Flow

```
Hades API SubitoItem
  → SubitoMinimalListing (Phase 1 extraction)
    → Checksum comparison (Phase 2)
      → BullMQ job payload (Phase 3)
        → Category transformer
          → ApartmentPropertyTierI / HousePropertyTierI
            → bulk-ingest API
              → PostgreSQL partition
```

---

## Apartment Field Mapping (ApartmentPropertyTierI)

### Universal / Core Fields

| Hades API Source | Hades Path | Target Field | DB Column | Transformation |
|-----------------|-----------|-------------|-----------|----------------|
| Listing title | `item.subject` | `title` | `title` | Direct |
| Price feature | `features[uri=/price].values[0].value` | `price` | `price` | `parseNumeric("28000 €" -> 28000)` |
| Contract key | `config.contract` | `transaction_type` | `transaction_type` | `'s'` -> `'sale'`, `'k'` -> `'rent'` |
| City name | `item.geo.city.value` | `location.city` | `city` | Direct |
| Region name | `item.geo.region.value` | `location.region` | `region` | Direct |
| Latitude | `item.geo.coordinates.latitude` | `location.coordinates.lat` | `latitude` | Direct |
| Longitude | `item.geo.coordinates.longitude` | `location.coordinates.lon` | `longitude` | Direct |
| Listing URL | `item.urls.default` | `source_url` | `source_url` | Direct |
| URN | `item.urn` | `portal_id` | `portal_id` | `'subito-it-' + lastUrnSegment` |
| — | — | `status` | `status` | Hardcoded `'active'` |
| — | — | `property_category` | `property_category` | Hardcoded `'apartment'` |
| — | — | `source_platform` | `source_platform` | Hardcoded `'subito-it'` |

### Apartment-Specific Fields (apt_* columns)

| Hades API Source | Hades Path | Target Field | DB Column | Transformation |
|-----------------|-----------|-------------|-----------|----------------|
| Rooms feature | `features[uri=/rooms].values[0].value` | `rooms` | `apt_rooms` | `parseInt("3 locali" -> 3)` |
| Derived | `rooms - 1` | `bedrooms` | `apt_bedrooms` | `Math.max(0, rooms - 1)` |
| Bathrooms feature | `features[uri=/bathrooms].values[0].value` | `bathrooms` | `apt_bathrooms` | `parseNumeric("1 bagno" -> 1)` |
| Size feature | `features[uri=/size].values[0].value` | `sqm` | `apt_sqm` | `parseNumeric("74 mq" -> 74)` |
| Floor feature | `features[uri=/floor].values[0].value` | `floor` | `apt_floor` | `parseFloor("3° piano" -> 3)` |
| Elevator feature | `features[label=Ascensore].values[0].value` | `has_elevator` | `apt_has_elevator` | `=== 'Sì'` |
| Balcony feature | `features[label=Balcone].values[0].value` | `has_balcony` | `apt_has_balcony` | `=== 'Sì'` |
| Parking feature | `features[label=Box/Posto auto].values[0].value` | `has_parking` | `apt_has_parking` | `=== 'Sì'` |
| Basement feature | `features[label=Cantina].values[0].value` | `has_basement` | `apt_has_basement` | `=== 'Sì'` |

### Tier I Universal Fields (promoted columns)

| Hades API Source | Hades Path | Target Field | DB Column | Transformation |
|-----------------|-----------|-------------|-----------|----------------|
| Condition feature | `features[uri=/condition].values[0].value` | `condition` | `condition` | `mapCondition` (see table below) |
| Heating feature | `features[uri=/heating].values[0].value` | `heating_type` | `heating_type` | Direct Italian string |
| Images array | `item.images[].scale[].uri + cdn_base_url` | `images` | `images` | Largest scale per image |

### Country-Specific Fields (Tier II — JSONB)

| Hades API Source | Hades Path | Target Field | JSONB Key |
|-----------------|-----------|-------------|-----------|
| Province/town | `item.geo.town.value` | `country_specific.italy.province` | `country_specific->'italy'->>'province'` |

### Portal Metadata (Tier III — JSONB)

| Hades API Source | Hades Path | Target Field | JSONB Key |
|-----------------|-----------|-------------|-----------|
| Full URN | `item.urn` | `portal_metadata.subito.urn` | `portal_metadata->'subito'->>'urn'` |
| ISO date | `item.dates.display_iso8601` | `portal_metadata.subito.date_display` | `portal_metadata->'subito'->>'date_display'` |
| Display date | `item.dates.display` (fallback) | `portal_metadata.subito.date_display` | (same key, fallback only) |
| Advertiser | `item.advertiser.name` | `portal_metadata.subito.advertiser_name` | `portal_metadata->'subito'->>'advertiser_name'` |

### Additional Apartment Features (JSONB / extended)

| Hades Feature Label | Target Field | Notes |
|--------------------|-------------|-------|
| `Loggia` | `has_loggia` | `'Sì'` -> `true` |
| `Terrazzo` | `has_terrace` | `'Sì'` -> `true` |
| `Box auto` | `has_garage` | `'Sì'` -> `true` |

---

## House Field Mapping (HousePropertyTierI)

All core/universal fields are identical to the apartment mapping above, except `property_category` is hardcoded to `'house'` and DB columns use the `house_*` prefix.

### House-Specific Fields (house_* columns)

| Hades API Source | Hades Path | Target Field | DB Column | Transformation |
|-----------------|-----------|-------------|-----------|----------------|
| Size feature | `features[uri=/size].values[0].value` | `sqm_living` | `house_sqm_living` | `parseNumeric("120 mq" -> 120)` |
| Plot feature | `features[label=Superficie terreno].values[0].value` | `sqm_plot` | `house_sqm_plot` | `parseNumeric` |
| Garden feature | `features[label=Giardino].values[0].value` | `has_garden` | `house_has_garden` | `=== 'Sì'` |
| Garage feature | `features[label=Garage/Box].values[0].value` | `has_garage` | `house_has_garage` | `=== 'Sì'` |
| Parking feature | `features[label=Posto auto].values[0].value` | `has_parking` | `house_has_parking` | `=== 'Sì'` |
| Basement feature | `features[label=Cantina].values[0].value` | `has_basement` | `house_has_basement` | `=== 'Sì'` |
| Pool feature | `features[label=Piscina].values[0].value` | `has_pool` | `house_has_pool` | `=== 'Sì'` |
| Terrace feature | `features[label=Terrazzo].values[0].value` | `has_terrace` | `house_has_terrace` | `=== 'Sì'` |
| Balcony feature | `features[label=Balcone].values[0].value` | `has_balcony` | `house_has_balcony` | `=== 'Sì'` |

---

## Condition Value Mapping

Function: `mapCondition(str)` in `src/utils/subitoHelpers.ts`

| Italian Raw Value | Normalized Enum | Notes |
|------------------|-----------------|-------|
| `Nuovo` | `new` | New construction |
| `Nuova costruzione` | `new` | New construction (alternate) |
| `Ristrutturato` | `after_renovation` | Recently renovated |
| `Buone condizioni` | `good` | Good condition |
| `Buono` | `good` | Good (short form) |
| `Da ristrutturare` | `requires_renovation` | Needs renovation |
| (unmatched) | `undefined` | No condition set |

---

## Transaction Type Mapping

Function: `mapTransactionType(contract)` in `src/utils/subitoHelpers.ts`

| `config.contract` | `t` Param | `transaction_type` |
|-------------------|-----------|-------------------|
| `vendita` | `s` | `sale` |
| `affitto` | `k` | `rent` |

---

## Floor Value Mapping

Function: `parseFloor(str)` in `src/utils/subitoHelpers.ts`

| Italian Raw Value | Parsed Integer | Semantic Meaning |
|------------------|---------------|-----------------|
| `Piano terra` / `Pianoterra` | `0` | Ground floor |
| `Seminterrato` | `-1` | Basement level |
| `Attico` | `99` | Penthouse (sentinel) |
| `1° piano` | `1` | 1st floor |
| `2° piano` | `2` | 2nd floor |
| `Primo piano` | `1` | 1st floor (word form) |
| `Secondo piano` | `2` | 2nd floor (word form) |
| N° piano (general) | N | Ordinal digit extracted |
| (unparseable) | `undefined` | Not set |

---

## Property Subtype Mapping

### Apartment Subtypes

Keyword matched against `item.category.name` (case-insensitive):

| Keyword | `property_subtype` |
|---------|-------------------|
| `attico` | `penthouse` |
| `loft` | `loft` |
| `mansarda` | `atelier` |
| `monolocale` | `studio` |
| `maisonette` | `maisonette` |
| `duplex` | `duplex` |
| (no match) | `undefined` |

### House Subtypes

Keyword matched against `item.category.name` or `item.subject`:

| Keyword | `property_subtype` |
|---------|-------------------|
| `villa singola` | `villa` |
| `schiera` / `villetta a schiera` | `terraced` |
| `bifamiliare` | `semi_detached` |
| `rustico` / `casale` | `farmhouse` |
| (no match) | `undefined` |

---

## Checksum Fields

Fields used to compute the listing checksum for change detection:

| Field | Source Path | Notes |
|-------|-------------|-------|
| `portalId` | `extractIdFromUrn(item.urn)` | Unique listing ID |
| `price` | `listing.price` | Numeric value, nullable |
| `title` | `listing.subject` | Listing title, nullable |
| `sqm` | `listing.sqm` | Area in sqm, nullable |
| `date` | `listing.date` | ISO8601 preferred, display fallback |

A change in any of these fields causes the listing to be classified as `changed` and re-ingested.

---

## Portal ID Construction

```
URN:       "id:ad:608241847:list:636897239"
                                 ^^^^^^^^^
                            Last colon segment

portal_id: "subito-it-636897239"
```

The listing ID is the final colon-delimited segment of the URN. This is stable across scrape runs and used as the unique key for UPSERT operations in the database.

---

## Image URL Construction

```
cdn_base_url:  "https://imgs.subito.it/images/"
scale[].uri:   "abc123/filename-800x600.jpg"

Full URL:      "https://imgs.subito.it/images/abc123/filename-800x600.jpg"
```

The transformer selects the **largest available scale** from each image's `scale[]` array by comparing the `size` string (e.g. `"800x600"` > `"400x300"`).
