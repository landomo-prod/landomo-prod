# Otthon Centrum (oc.hu) Field Mapping

## Portal Fields → TierI Fields

| Portal Field | TierI Field | Type | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | string | Direct mapping | Unique listing ID from ecommerce.items |
| `name` | `title` | string | Direct mapping | Property title from ecommerce item |
| `price` | `price` | number | `parseFloat()` | Numeric HUF value |
| `currency` | `currency` | string | Default "HUF" | Property currency (hardcoded) |
| `location` | `location` | string | Direct mapping | City/region from ecommerce data |
| `propertyType` | `property_type` | string | Normalized to standard type | Mapped via `PROPERTY_TYPE_MAP` |
| `area` | `sqm` | number | `parseFloat()` | Square meters from ecommerce |
| `url` | `source_url` | string | Direct mapping | Listing URL from ecommerce |
| `ownId` | Portal metadata | string | Stored in metadata | OC.hu's own identifier |
| (Transaction Type) | `transaction_type` | string | Hardcoded "sale" | Currently sale only from ecommerce |

## StandardProperty Mapping

| StandardProperty Field | Source | Transformation |
|---|---|---|
| `title` | `name` | Direct mapping from ecommerce item |
| `price` | `price` | Direct mapping |
| `currency` | Constant | "HUF" |
| `property_category` | `propertyType` | Normalized to apartment/house/land/commercial |
| `transaction_type` | Constant | "sale" (only transaction type available) |
| `source_url` | `url` | Direct mapping |
| `source_platform` | Constant | "oc.hu" |
| `agent` | Not provided | undefined |
| `location.address` | `location` | Parsed from location string |
| `location.city` | `location` | Extracted from location if parsing possible |
| `location.region` | Not provided | undefined |
| `location.country` | Constant | "Hungary" |
| `location.postal_code` | Not provided | undefined |
| `location.coordinates` | Not provided | undefined |
| `details.bedrooms` | Not provided | undefined |
| `details.bathrooms` | Not provided | undefined |
| `details.sqm` | `area` | Direct mapping |
| `details.floor` | Not provided | undefined |
| `details.total_floors` | Not provided | undefined |
| `details.rooms` | Not provided | undefined |
| `details.year_built` | Not provided | undefined |
| `details.renovation_year` | Not provided | undefined |
| `details.parking_spaces` | Not provided | undefined |
| `price_per_sqm` | `price / area` | Calculated if both available |
| `condition` | Not provided | undefined |
| `heating_type` | Not provided | undefined |
| `furnished` | Not provided | undefined |
| `construction_type` | Not provided | undefined |
| `available_from` | Not provided | undefined |
| `published_date` | Not provided | undefined |
| `deposit` | Not provided | undefined |
| `images` | Not provided | undefined (DataLayer limitation) |
| `description` | Not provided | undefined |
| `description_language` | Not set | undefined |
| `status` | Constant | "active" |

## Country-Specific Fields (Hungary)

| Field | Source | Notes |
|---|---|---|
| `room_count` | Not provided | undefined |
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

All portal-specific fields are stored in `portal_metadata['oc.hu']`:
- `original_id`: Listing ID from ecommerce
- `own_id`: OC.hu's own identifier
- `source_url`: Full listing URL
- `published_date`: Not provided
- `modified_date`: Not provided
- `view_count`: Not provided
- `otthon_start_eligible`: Flag if available in ecommerce

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

## DataLayer Structure

OC.hu ecommerce.items contain:
```javascript
{
  id: "listing_id",
  name: "Property Title",
  price: 25000000,  // HUF
  quantity: 1,
  coupon: "property_type",
  custom1: "area_sqm",
  custom2: "location"
}
```

## Data Availability
- **High**: price, location, property type, area (sqm)
- **Medium**: listing URL, title
- **Low**: None
- **Missing**: bedrooms, bathrooms, rooms, condition, heating, construction, furnished, agent, images, description, coordinates, year built, deposit, utilities
- **Note**: Current DataLayer extraction provides minimal property information; detail page scraping required for comprehensive data

## Limitations
- DataLayer is analytics-focused, not designed for data extraction
- Only 4-5 properties per listing page accessible via ecommerce
- No nested amenities, features, or detailed specifications
- Region filtering not possible with CycleTLS (technical limitation)
- Ideal for market volume tracking; insufficient for detailed property analysis without enhancement
