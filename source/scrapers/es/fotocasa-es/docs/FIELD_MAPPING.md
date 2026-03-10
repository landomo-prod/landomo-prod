# Fotocasa Field Mapping

## Apartment (property_category: 'apartment')

| Portal Field | API/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search API | portal_id | String | Unique property ID |
| description | Search API | title | Substring [0:200] | Property title |
| price | Search API | price | Integer | EUR currency |
| features (rooms) | Feature array | bedrooms | estimateBedrooms() | Converted from room count |
| features (bathrooms) | Feature array | bathrooms | Integer | Optional |
| features (surface) | Feature array | sqm | Integer | Living space in m² |
| address.zipCode | Detail page | location.postal_code | String | Postal code |
| address.ubication | Detail page | location.address | String | Street address |
| address.coordinates | Detail page | location.coordinates | {lat: number, lon: number} | Geographic coordinates |
| address.location.level0 | Detail page | location.country | 'Spain' | Country code |
| address.location.level1 | Detail page | location.region | String | Autonomous community |
| address.location.level2 | Detail page | location.city | String | City name |
| date | Detail page | published_date | ISO string | Publication date |
| features (elevator) | Feature array | has_elevator | Boolean | hasFeature() check |
| features (balcony) | Feature array | has_balcony | Boolean | hasFeature() check |
| features (parking) | Feature array | has_parking | Boolean | Combines garage + parking |
| features (storage_room) | Feature array | has_basement | Boolean | hasFeature() check |
| features (terrace) | Feature array | has_terrace | Boolean | hasFeature() check |
| features (garage) | Feature array | has_garage | Boolean | hasFeature() check |
| features (condition) | Feature array | condition | normalizeCondition() | Condition status |
| features (heater) | Feature array | heating_type | normalizeHeatingType() | Heating system |
| energyCertificate | Detail page | energy_class | String | Not available in search |
| images | Search API | media.images | Array {url, order} | Image URLs with position |
| images | Search API | images | Array of URLs | Direct image array |
| videoUrl | Detail page | videos | Array of URLs | Video/virtual tour URLs |
| subtypeId | Detail page | property_subtype | getApartmentSubtype() | Apartment subtype |
| transactionType | Search API | transaction_type | 'sale' or 'rent' | Transaction type |
| feature array | Detail page | features | Array of strings | Feature descriptions |

## House (property_category: 'house')

| Portal Field | API/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search API | portal_id | String | Unique property ID |
| description | Search API | title | Substring [0:200] | Property title |
| price | Search API | price | Integer | EUR currency |
| features (rooms) | Feature array | bedrooms | Integer | Number of bedrooms |
| features (bathrooms) | Feature array | bathrooms | Integer | Optional |
| features (surface) | Feature array | sqm_living | Integer | Living space |
| features (plot) | Feature array | sqm_plot | Integer | Plot area |
| address.zipCode | Detail page | location.postal_code | String | Postal code |
| address.ubication | Detail page | location.address | String | Street address |
| address.coordinates | Detail page | location.coordinates | {lat, lon} | Geographic coordinates |
| address.location.level1 | Detail page | location.region | String | Region/community |
| address.location.level2 | Detail page | location.city | String | City |
| date | Detail page | published_date | ISO string | Publication date |
| features (garden) | Feature array | has_garden | Boolean | hasFeature() check |
| features (garage) | Feature array | has_garage | Boolean | hasFeature() check |
| features (parking) | Feature array | has_parking | Boolean | hasFeature() check |
| features (storage) | Feature array | has_basement | Boolean | hasFeature() check |
| features (pool) | Feature array | has_pool | Boolean | hasFeature() check |
| features (terrace) | Feature array | has_terrace | Boolean | hasFeature() check |
| features (condition) | Feature array | condition | normalizeCondition() | Condition status |
| features (heating) | Feature array | heating_type | normalizeHeatingType() | Heating system |
| images | Search API | images | Array of URLs | Property photos |
| videoUrl | Detail page | videos | Array of URLs | Video/virtual tour URLs |
| transactionType | Search API | transaction_type | 'sale' or 'rent' | Transaction type |
| feature array | Detail page | features | Array of strings | Feature list |
| agent | Detail page | agent | {name, phone, email} | Agency contact info |

## Land (property_category: 'land')

| Portal Field | API/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search API | portal_id | String | Unique property ID |
| description | Search API | title | Text | Property title |
| price | Search API | price | Integer | EUR currency |
| features (plot) | Feature array | area_plot_sqm | Integer | Total plot area (required) |
| address.coordinates | Detail page | location.coordinates | {lat, lon} | Geographic coordinates |
| address.ubication | Detail page | location.address | String | Street address |
| address.location.level2 | Detail page | location.city | String | City |
| date | Detail page | published_date | ISO string | Publication date |
| images | Search API | images | Array of URLs | Property photos |
| transactionType | Search API | transaction_type | 'sale' or 'rent' | Transaction type |
| feature array | Detail page | features | Array of strings | Feature list |

## Commercial (property_category: 'commercial')

### Office (OFICINA)
| Portal Field | API/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search API | portal_id | String | Unique ID |
| description | Search API | title | Text | Property title |
| price | Search API | price | Integer | EUR currency |
| features (surface) | Feature array | sqm_total | Integer | Total commercial area |
| features (bathrooms) | Feature array | bathroom_count | Integer | Number of bathrooms |
| address.coordinates | Detail page | location.coordinates | {lat, lon} | Geographic coordinates |
| address.ubication | Detail page | location.address | String | Street address |
| address.location.level2 | Detail page | location.city | String | City |
| features (elevator) | Feature array | has_elevator | Boolean | hasFeature() check |
| features (parking) | Feature array | has_parking | Boolean | hasFeature() check |
| images | Search API | images | Array of URLs | Property photos |
| transactionType | Search API | transaction_type | 'sale' or 'rent' | Transaction type |

### Retail (LOCAL) / Warehouse (NAVE)
Similar structure to Office, with sqm_total as required field.

## Special Transformations

### estimateBedrooms()
Estimates bedroom count from room features:
- Examines feature array for room descriptors
- Falls back to numeric room count if present
- Returns 0 if unable to determine

### hasFeature()
Checks if feature exists in array:
- Case-insensitive keyword matching
- Returns boolean

### getApartmentSubtype()
Maps subtypeId to standard apartment types:
- 1 → standard
- 3 → penthouse
- 4 → loft
- 2 → studio
- etc.

### extractTransactionType()
Determines if sale or rent from search context:
- Returns 'sale' or 'rent'

### extractCondition()
Maps condition indicators:
- Age + state features
- Returns normalized condition enum

### normalizeCondition()
Maps Spanish conditions:
- "Nuevo" → "new"
- "Reformado" → "renovated"
- "Buen estado" → "good"
- etc.

## Checksum Strategy
Property ID → md5 hash for change detection
New/changed listings queued for detail fetch
75% reduction in API calls on stable periods
