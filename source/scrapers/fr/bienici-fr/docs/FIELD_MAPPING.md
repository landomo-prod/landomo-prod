# Bienici Field Mapping

## Universal (All Categories)

| Bienici Field | TierI Field | Type | Notes |
|---|---|---|---|
| `id` | `portal_id` | string | Prefixed with "bienici-" |
| `id` | `source_url` | string | Reconstructed as `https://www.bienici.com/annonce/{id}` |
| `title` | `title` | string | Fallback: "Apartment {city}" |
| `price` | `price` | number | 0 if missing |
| (implicit) | `currency` | string | Always "EUR" |
| `adType` | `transaction_type` | enum | "rent" → "rent", else "sale" |
| `city` | `location.city` | string | Required, empty string fallback |
| `postalCode` | `location.postal_code` | string | Optional |
| `district` | `location.region` | string | Converted to string |
| `latitude` | `location.coordinates.lat` | number | Included only if both lat/lon present |
| `longitude` | `location.coordinates.lon` | number | Included only if both lat/lon present |
| `description` | `description` | string | Converted to string |
| `photos[]` | `images[]` | array | URLs from `photos[].url` or `photos[].url_photo`, deduplicated |
| `photos[]` | `media.images[]` | array | Same images with order index |
| `agency.name` | `agent.name` | string | Optional, portal agency contact |
| `agency.phone` | `agent.phone` | string | Optional |
| (implicit) | `source_platform` | string | Always "bienici" |
| (implicit) | `status` | string | Always "active" |

## Apartment

| Bienici Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `bedroomsQuantity` | `bedrooms` | number | Direct, fallback to `max(roomsQuantity - 1, 0)` |
| `roomsQuantity` | `rooms` | number | Direct |
| `bathroomsQuantity` | `bathrooms` | number | Optional |
| `surfaceArea` | `sqm` | number | Required, 0 if missing |
| `floor` | `floor` | number | Optional |
| `floorQuantity` | `total_floors` | number | Optional |
| `hasElevator` | `has_elevator` | boolean | Default false |
| `hasBalcony` | `has_balcony` | boolean | Default false |
| `hasParking` | `has_parking` | boolean | Default false |
| `hasCellar` | `has_basement` | boolean | Default false |
| `hasTerrace` | `has_terrace` | boolean | Optional |
| `hasGarage` | `has_garage` | boolean | Extracted from `amenities` |
| `parkingQuantity` | `parking_spaces` | number | Optional |
| `newProperty` | `condition` | enum | true → "new", undefined otherwise |
| `heatingType` | `heating_type` | string | Optional |
| `energyClassification` | `energy_class` | string | Optional |
| `isFurnished` | `furnished` | enum | true → "furnished", undefined otherwise |
| `yearOfConstruction` | `year_built` | number | Optional |
| `publicationDate` | `published_date` | string | ISO format |
| Feature flags | `features[]` | array | Assembled from boolean flags (ascenseur, balcon, parking, terrasse, cave, cheminée, interphone, digicode, gardien) |
| `energyClassification` | `country_specific.dpe_rating` | string | French energy cert rating |
| `energyValue` | `country_specific.dpe_value` | number | Energy consumption value |
| `greenhouseGasClassification` | `country_specific.ges_rating` | string | Greenhouse gas rating |
| `greenhouseGasValue` | `country_specific.ges_value` | number | GES value |
| `accountType` | `country_specific.account_type` | string | Account type (pro/individual) |
| `newProperty` | `country_specific.is_new_property` | boolean | Direct |

## House

| Bienici Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `bedroomsQuantity` | `bedrooms` | number | Direct |
| `surfaceArea` | `sqm_living` | number | Living area |
| `plotArea` | `sqm_plot` | number | Land plot area |
| `floor` | `floor` | number | Optional (multi-story houses) |
| `hasGarden` | `has_garden` | boolean | Default false |
| `hasGarage` | `has_garage` | boolean | Default false |
| `hasParking` | `has_parking` | boolean | Default false |
| `hasBasement` | `has_basement` | boolean | Default false |
| `yearOfConstruction` | `renovation_year` | number | Optional |
| `condition` | `condition` | enum | new/excellent/good/after_renovation/requires_renovation |

## Land

| Bienici Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `plotArea` | `area_plot_sqm` | number | Land area in square meters |
| (inherited) | All universal fields | - | Same as apartment |

## Commercial

| Bienici Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `surfaceArea` | `sqm_total` | number | Total commercial space |
| `hasElevator` | `has_elevator` | boolean | Default false |
| `hasParking` | `has_parking` | boolean | Default false |
| `bathroomsQuantity` | `has_bathrooms` | boolean | true if count > 0 |
| `heatingType` | `heating_type` | string | Optional |

## Price Band Filtering

The scraper splits enumeration by price bands to avoid API limits:

**Buy Bands (EUR)**:
- 0-50k, 50-100k, 100-150k, 150-200k, 200-250k, 250-300k, 300-400k, 400-500k, 500-700k, 700-1M, 1M-2M, 2M+

**Rent Bands (EUR/month)**:
- 0-500, 500-800, 800-1200, 1200-1800, 1800-2500, 2500-4000, 4000+

Each band generates separate API calls; results deduplicated by portal_id.

## Data Quality Notes
- **Price**: Required for all listings; 0 used as fallback (likely rental without explicit price)
- **Area**: Required for apartments/houses; 0 fallback acceptable for commercial/land with price context
- **Rooms**: Estimated from bedrooms if bedroomsQuantity not available
- **Features**: Assembled from boolean flags; multiple "features" strings combined into single array
- **Images**: Only URLs are stored; Bienici returns full photo objects with metadata
- **Location**: City is required; district/postal code optional but recommended for geocoding
