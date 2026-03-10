# Zenga.hu Field Mapping

## Portal Fields → TierI Fields

| Portal Field | TierI Field | Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | Direct mapping | Unique listing ID from API |
| `title` | `title` | string | Direct mapping | Listing title |
| `url` | `source_url` | string | Direct mapping | Full listing URL |
| `price` | `price` | number | Direct mapping | Numeric HUF value |
| `currency` | `currency` | string | Default "HUF" | Property currency |
| `location` | `location` | string | Direct mapping | City/address location |
| `address` | `address` | string | Direct mapping | Full address string |
| `city` | `city` | string | Direct mapping | City name extracted from location |
| `district` | `district` | string | Direct mapping | District/region if applicable |
| `zipCode` | `postal_code` | string | Direct mapping | Postal code |
| `propertyType` | `property_type` | string | Normalized to standard type | Mapped via `PROPERTY_TYPE_MAP` |
| `area` | `sqm` | number | Direct mapping | Square meters living area |
| `rooms` | `rooms` | number | Direct mapping | Total room count |
| `halfRooms` | `half_rooms` | number | Direct mapping | Count of half-rooms |
| `floor` | `floor` | number | Direct mapping | Floor level |
| `totalFloors` | `total_floors` | number | Direct mapping | Total building floors |
| `buildYear` | `year_built` | number | Direct mapping | Construction year |
| `pricePerSqm` | `price_per_sqm` | number | Direct mapping | Price per square meter |
| `coordinates` | `coordinates` | object | Lat/lon object | GPS coordinates if available |
| `lat` | `coordinates.lat` | number | Direct mapping | Latitude |
| `lon` | `coordinates.lon` | number | Direct mapping | Longitude |
| `images[]` | `images` | string[] | Direct array mapping | Image URLs from listing |
| `parking` | Amenity | boolean | Feature flag | Has parking |
| `elevator` | Amenity | boolean | Feature flag | Has elevator |
| `balcony` | Amenity | boolean | Feature flag | Has balcony |
| `terrace` | Amenity | boolean | Feature flag | Has terrace |
| `garden` | Amenity | boolean | Feature flag | Has garden |
| `airConditioning` | Amenity | boolean | Feature flag | Has AC |
| Transaction Type | `transaction_type` | string | Mapped from context | Sale/rent designation |
| `agent.name` | `agent.name` | string | Direct mapping | Agent/broker name |
| `agent.company` | `agent.company` | string | Direct mapping | Real estate company |
| `agent.phone` | `agent.phone` | string | Direct mapping | Contact phone |
| `agent.email` | `agent.email` | string | Direct mapping | Contact email |
| `description` | `description` | string | Direct mapping | Listing description |
| `publishedDate` | `published_date` | date | Direct mapping | Listing publication date |
| `modifiedDate` | `modified_date` | date | Direct mapping | Last modification date |
| `viewCount` | `view_count` | number | Direct mapping | Portal view count |
| `isPremier` | Portal metadata | boolean | Stored in metadata | Premier listing status |

## StandardProperty Mapping

| StandardProperty Field | Source | Transformation |
|---|---|---|
| `title` | `title` | Direct mapping from API |
| `price` | `price` | Direct mapping |
| `currency` | `currency` | Default "HUF" |
| `property_category` | `propertyType` | Normalized to apartment/house/land/commercial |
| `transaction_type` | Transaction type | Inferred from search context |
| `source_url` | `url` | Direct mapping |
| `source_platform` | Constant | "zenga.hu" |
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
| `price_per_sqm` | `pricePerSqm` | Direct mapping from API |
| `condition` | Not provided | undefined (Tier 1 universal field) |
| `heating_type` | Not provided | undefined (Tier 1 universal field) |
| `furnished` | Not provided | undefined (Tier 1 universal field) |
| `construction_type` | Not provided | undefined (Tier 1 universal field) |
| `available_from` | Not provided | undefined |
| `published_date` | `publishedDate` | Direct mapping |
| `deposit` | Not provided | undefined |
| `parking_spaces` | `parking` flag | 1 if present, undefined otherwise |
| `images` | `images[]` | Array of image URLs |
| `description` | `description` | Direct mapping |
| `description_language` | Constant | "hu" |
| `status` | Constant | "active" |

## Country-Specific Fields (Hungary)

| Field | Source | Notes |
|---|---|---|
| `room_count` | `rooms` | Integer room count |
| `half_rooms` | `halfRooms` | Half-room count if available |
| `ownership` | Not provided | undefined |
| `condition` | Not provided | undefined |
| `furnished` | Not provided | undefined |
| `energy_rating` | Not provided | undefined |
| `heating_type` | Not provided | undefined |
| `construction_type` | Not provided | undefined |
| `utility_costs` | Not provided | undefined |
| `deposit` | Not provided | undefined |

## Portal Metadata

All portal-specific fields are stored in `portal_metadata['zenga.hu']`:
- `original_id`: Listing ID from API
- `source_url`: Full listing URL
- `published_date`: Publication date
- `modified_date`: Last modification date
- `view_count`: Portal view counter
- `is_premier`: Premier listing status (higher visibility)

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

## Amenities Mapping

| Portal Flag | TierI Field | Transformation |
|---|---|---|
| `parking` | `amenities.has_parking` | Boolean mapping |
| `elevator` | `amenities.has_elevator` | Boolean mapping |
| `balcony` | `amenities.has_balcony` | Boolean mapping |
| `terrace` | `amenities.has_terrace` | Boolean mapping |
| `garden` | `amenities.has_garden` | Boolean mapping |
| `airConditioning` | `amenities.has_ac` | Boolean mapping |

## Data Availability
- **High**: price, location (city), property type, area (sqm), rooms, images
- **Medium**: address, floor, year built, coordinates, agent info, publication date
- **Low**: half-rooms, total floors, condition, heating
- **Missing**: furnished, construction type, deposit, utilities, energy rating, renovation year
