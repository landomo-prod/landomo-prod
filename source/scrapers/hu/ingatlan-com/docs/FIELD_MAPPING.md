# Ingatlan.com Field Mapping

## Portal Fields → TierI Fields

| Portal Field | TierI Field | Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | Direct mapping | Unique listing ID from portal |
| `ownId` | Portal metadata | string | Stored in metadata | Portal's own ID field |
| `url` | `source_url` | string | Direct mapping | Full listing URL |
| `price` | `price` | number | Direct mapping | Numeric HUF value |
| `currency` | `currency` | string | Default "HUF" | Property currency |
| `title` | `title` | string | Direct mapping | Portal listing title |
| `address` | `address` | string | Direct mapping | Full address string |
| `location` | Fallback location | string | Extracted/parsed | Used if address unavailable |
| `city` | `city` | string | Direct mapping | Primary city name |
| `district` | `district` | string | Direct mapping | Budapest district if applicable |
| `zipCode` | `postal_code` | string | Direct mapping | Postal code |
| `propertyType` | `property_type` | string | Normalized to standard type | Mapped via `PROPERTY_TYPE_MAP` |
| `area` | `sqm` | number | `parseInt()` | Square meters living area |
| `rooms` | `rooms` | number | `parseInt()` | Total room count |
| `floor` | `floor` | number | Direct mapping | Floor level |
| `totalFloors` | `total_floors` | number | Direct mapping | Total building floors |
| `buildYear` | `year_built` | number | Direct mapping | Construction year |
| `coordinates` | `coordinates` | object | Lat/lon object | GPS coordinates if available |
| `images[]` | `images` | string[] | Direct array mapping | Image URLs from listing |
| Transaction Type | `transaction_type` | string | Mapped from context | Sale/rent designation |
| `agent.name` | `agent.name` | string | Direct mapping | Agent/broker name |
| `agent.company` | `agent.company` | string | Direct mapping | Real estate company |
| `agent.phone` | `agent.phone` | string | Direct mapping | Contact phone |
| `agent.email` | `agent.email` | string | Direct mapping | Contact email |
| `description` | `description` | string | Direct mapping | Listing description |
| `publishedDate` | `published_date` | date | Direct mapping | Listing publication date |
| `modifiedDate` | `modified_date` | date | Direct mapping | Last modification date |
| `viewCount` | `view_count` | number | Direct mapping | Portal view count |

## StandardProperty Mapping

| StandardProperty Field | Source | Transformation |
|---|---|---|
| `title` | `title` | Direct mapping from portal |
| `price` | `price` | Direct mapping |
| `currency` | `currency` | Default "HUF" |
| `property_category` | `propertyType` | Normalized to apartment/house/land/commercial |
| `transaction_type` | Transaction type | Inferred from search context |
| `source_url` | `url` | Direct mapping |
| `source_platform` | Constant | "ingatlan.com" |
| `agent` | Agent object | Mapped with name, phone, email, agency |
| `location.address` | `address` or `location` | Direct mapping |
| `location.city` | `city` | Extracted from location if needed |
| `location.region` | `district` | Direct mapping |
| `location.country` | Constant | "Hungary" |
| `location.postal_code` | `zipCode` | Direct mapping |
| `location.coordinates` | `coordinates` | Lat/lon object if available |
| `details.bedrooms` | `rooms` | Direct mapping |
| `details.bathrooms` | `rooms` | Calculated as max(1, floor(rooms/2)) |
| `details.sqm` | `area` | Direct mapping |
| `details.floor` | `floor` | Direct mapping |
| `details.total_floors` | `totalFloors` | Direct mapping |
| `details.rooms` | `rooms` | Direct mapping |
| `details.year_built` | `buildYear` | Direct mapping |
| `details.renovation_year` | Not provided | undefined |
| `details.parking_spaces` | `parking` flag | 1 if present, undefined otherwise |
| `price_per_sqm` | `price / area` | Calculated |
| `condition` | Not provided | undefined (Tier 1 universal field) |
| `heating_type` | Not provided | undefined (Tier 1 universal field) |
| `furnished` | Not provided | undefined (Tier 1 universal field) |
| `construction_type` | Not provided | undefined (Tier 1 universal field) |
| `available_from` | Not provided | undefined |
| `published_date` | `publishedDate` | Direct mapping |
| `deposit` | Not provided | undefined |
| `images` | `images[]` | Array of image URLs |
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

All portal-specific fields are stored in `portal_metadata['ingatlan.com']`:
- `original_id`: Listing ID
- `own_id`: Portal's own identifier
- `source_url`: Full listing URL
- `published_date`: Publication date
- `modified_date`: Last modification date
- `view_count`: Portal view counter

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
- **High**: price, location (city), property type, area (sqm), rooms
- **Medium**: address, images, publication date
- **Low**: agent info, floor, year built, coordinates
- **Missing**: condition, heating, construction type, furnished, deposit, utilities
