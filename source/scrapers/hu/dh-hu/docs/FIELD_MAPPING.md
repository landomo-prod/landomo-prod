# DH.hu Field Mapping

## Portal Fields → TierI Fields

| Portal Field | TierI Field | Type | Transformation | Notes |
|---|---|---|---|---|
| `referenceNumber` | `portal_id` | string | Direct mapping | Unique listing ID from portal |
| `alias` | `source_url` | string | `https://dh.hu{alias}` | Preferred; falls back to ID-based URL |
| `combined_targetPrice` | `price` | number | `parseFloat()` | Numeric HUF value |
| `combined_targetPriceCurrency_text` | `currency` | string | Direct mapping | Usually "HUF" |
| `address` | `address` | string | Direct mapping | Full address string |
| `cityName` | `city` | string | Direct mapping | Primary city name |
| `districtName` | `district` | string | Direct mapping | Budapest district if applicable |
| `propertyTypeName` | `property_type` | string | Normalized to standard type | Mapped via `PROPERTY_TYPE_MAP` |
| `area` | `sqm` | number | `parseInt()` | Square meters living area |
| `rooms` | `rooms` | number | `parseInt()` | Total room count |
| `lat`, `lng` | `coordinates.lat/lon` | number | `parseFloat()` | GPS coordinates if available |
| `coverImage` | `images[0]` | string | Array push | Primary image URL |
| `images[]` | `images` | string[] | Deduped array | Additional images |
| Transaction Type | `transaction_type` | string | `elado` → `sale`, `kiado` → `rent` | Standardized to sale/rent |
| `description` | `description` | string | Direct mapping | Portal-provided description |
| `agentName` | `agent.name` | string | Direct mapping | Agent/broker name |
| `isNew` | `is_new` | boolean | Direct mapping | New listing flag |
| `isComingSoon` | `is_coming_soon` | boolean | Direct mapping | Coming soon indicator |
| `isExclusive` | `is_exclusive` | boolean | Direct mapping | Exclusive listing flag |
| `enabledOtthonStart` | `enabled_otthon_start` | boolean | Direct mapping | Otthon Start program eligibility |

## StandardProperty Mapping

| StandardProperty Field | Source | Transformation |
|---|---|---|
| `title` | `propertyTypeName + transactionType + cityName` | Constructed template string |
| `price` | `combined_targetPrice` | Direct mapping |
| `currency` | `combined_targetPriceCurrency_text` | Default "HUF" |
| `property_category` | `propertyTypeName` | Normalized to apartment/house/land/commercial |
| `transaction_type` | Transaction type | elado → sale, kiado → rent |
| `source_url` | `alias` or computed | Via url property |
| `source_platform` | Constant | "dh.hu" |
| `agent` | `agentName` | Mapped to agent object with company "Duna House" |
| `location.address` | `address` | Direct mapping |
| `location.city` | `cityName` | Direct mapping |
| `location.region` | `districtName` | Direct mapping |
| `location.coordinates` | `lat`, `lng` | Object mapping |
| `details.bedrooms` | `rooms` | Direct mapping |
| `details.bathrooms` | `rooms` | Calculated as max(1, floor(rooms/2)) |
| `details.sqm` | `area` | Direct mapping |
| `details.year_built` | Not provided | undefined |
| `details.parking_spaces` | `parking` flag | 1 if present, undefined otherwise |
| `price_per_sqm` | `price / area` | Calculated |
| `condition` | Not provided | undefined (Tier 1 universal field) |
| `heating_type` | Not provided | undefined (Tier 1 universal field) |
| `furnished` | Not provided | undefined (Tier 1 universal field) |
| `construction_type` | Not provided | undefined (Tier 1 universal field) |
| `images` | `coverImage + images[]` | Array of URLs |
| `description` | `description` | Direct mapping |
| `description_language` | Constant | "hu" |
| `status` | Constant | "active" |

## Country-Specific Fields (Hungary)

| Field | Source | Notes |
|---|---|---|
| `room_count` | `rooms` | Integer room count |
| `half_rooms` | Not provided | undefined |
| `ownership` | Not provided | undefined |
| `condition` | Not provided | undefined |
| `furnished` | Not provided | undefined |
| `energy_rating` | Not provided | undefined |
| `heating_type` | Not provided | undefined |
| `construction_type` | Not provided | undefined |
| `utility_costs` | Not provided | undefined |
| `deposit` | Not provided | undefined |

## Portal Metadata

All portal-specific fields are stored in `portal_metadata['dh.hu']`:
- `original_id`: Listing ID
- `reference_number`: DH reference number
- `source_url`: Portal URL
- `published_date`: Initial listing date
- `modified_date`: Last modification date
- `view_count`: Portal view counter
- `is_new`: New listing indicator
- `is_exclusive`: Exclusive listing flag
- `enabled_otthon_start`: Otthon Start program eligibility

## Property Type Mapping

| Portal Type | Normalized | Category |
|---|---|---|
| lakás, lakas | apartment | apartment |
| ház, haz | house | house |
| telek | land | land |
| garázs, garazs | garage | commercial |
| iroda | office | commercial |
| üzlet, uzlet | shop | commercial |
| (other) | other | apartment (default) |

## Data Availability
- **High**: price, location (city), property type, transaction type
- **Medium**: area (sqm), rooms, images
- **Low**: agent info, condition, heating, construction type, parking
- **Missing**: renovation year, deposit, utility costs, furnished status
