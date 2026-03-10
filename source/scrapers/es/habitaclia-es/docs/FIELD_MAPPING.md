# Habitaclia Field Mapping

## Apartment (property_category: 'apartment')

| Portal Field | Search/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | `habitaclia-{id}` | Unique property identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text | Property title |
| price | Search result | price | Integer | EUR currency |
| transactionType | Search context | transaction_type | 'sale' or 'rent' | Transaction type |
| propertyType | Search config | property_category | 'apartment' | Fixed for apartment |
| rooms | Search result | bedrooms | rooms - 1 | Adjusted bedroom count |
| bathrooms | Search/Detail page | bathrooms | Integer | Optional |
| sqm | Search/Detail page | sqm | Integer | Living space in m² |
| floor | Search/Detail page | floor | parseFloor() | Converts text to number |
| hasElevator | Search/Detail page | has_elevator | Boolean | Direct field or feature match |
| hasBalcony | Search/Detail page | has_balcony | Boolean | Feature presence |
| hasParking | Search/Detail page | has_parking | Boolean | Parking feature |
| hasBasement | Search/Detail page | has_basement | Boolean | Storage/basement feature |
| hasTerrace | Search/Detail page | has_terrace | Boolean | Terrace feature |
| hasGarage | Search/Detail page | has_garage | Boolean | Garage feature |
| condition | Detail page | condition | mapCondition() | Building condition |
| yearBuilt | Detail page | year_built | Integer | Construction year |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating A-G |
| communityFees | Detail page | hoa_fees | Float | Monthly HOA fees |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City name |
| location.province | Detail page | location.region | String | Province |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Geographic coordinates |
| country | Portal context | location.country | 'ES' | Country code |
| currency | Search result | currency | 'EUR' | Euro currency |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Amenity/feature list |
| agencyName | Detail page | agent.name | String | Real estate agency |
| agencyPhone | Detail page | agent.phone | String | Agency contact |
| country_specific.portal_property_type | Search/Detail | country_specific.portal_property_type | String | Original portal type |
| country_specific.has_air_conditioning | Detail page | country_specific.has_air_conditioning | Boolean | AC feature |
| country_specific.has_pool | Detail page | country_specific.has_pool | Boolean | Pool feature |

## House (property_category: 'house')

| Portal Field | Search/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | `habitaclia-{id}` | Unique identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text | Property title |
| price | Search result | price | Integer | EUR currency |
| transactionType | Search context | transaction_type | 'sale' or 'rent' | Transaction type |
| propertyType | Search config | property_category | 'house' | Fixed for house |
| rooms | Search result | bedrooms | Integer | Number of bedrooms |
| bathrooms | Search/Detail page | bathrooms | Integer | Number of bathrooms |
| sqm | Search/Detail page | sqm_living | Integer | Living space |
| sqmPlot | Detail page | sqm_plot | Integer | Plot area |
| hasGarden | Search/Detail page | has_garden | Boolean | Garden feature |
| hasGarage | Search/Detail page | has_garage | Boolean | Garage feature |
| hasParking | Search/Detail page | has_parking | Boolean | Parking feature |
| hasBasement | Search/Detail page | has_basement | Boolean | Storage/basement |
| hasPool | Search/Detail page | has_pool | Boolean | Swimming pool |
| hasTerrace | Search/Detail page | has_terrace | Boolean | Terrace feature |
| hasFireplace | Search/Detail page | has_fireplace | Boolean | Fireplace feature |
| condition | Detail page | condition | mapCondition() | Building condition |
| yearBuilt | Detail page | year_built | Integer | Construction year |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating |
| communityFees | Detail page | hoa_fees | Float | Monthly fees |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City |
| location.province | Detail page | location.region | String | Province |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Coordinates |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Feature list |
| agencyName | Detail page | agent.name | String | Agency name |
| agencyPhone | Detail page | agent.phone | String | Agency phone |

## Land (property_category: 'land')

| Portal Field | Search/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | `habitaclia-{id}` | Unique identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text | Property title |
| price | Search result | price | Integer | EUR currency |
| sqm | Search/Detail page | area_plot_sqm | Integer | Total plot area (required) |
| transactionType | Search context | transaction_type | 'sale' or 'rent' | Transaction type |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Coordinates |
| images | Detail page | images | Array of URLs | Property photos |
| description | Detail page | description | Text | Property description |
| features | Detail page | features | Array of strings | Feature list |

## Commercial (property_category: 'commercial')

| Portal Field | Search/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | `habitaclia-{id}` | Unique identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text | Property title |
| price | Search result | price | Integer | EUR currency |
| sqm | Search/Detail page | sqm_total | Integer | Total commercial area (required) |
| bathrooms | Detail page | bathroom_count | Integer | Number of bathrooms |
| has_bathrooms | Detail page | has_bathrooms | Boolean | Bathrooms present |
| hasElevator | Search/Detail page | has_elevator | Boolean | Elevator feature |
| hasParking | Search/Detail page | has_parking | Boolean | Parking feature |
| transactionType | Search context | transaction_type | 'sale' or 'rent' | Transaction type |
| condition | Detail page | condition | mapCondition() | Building condition |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City |
| location.province | Detail page | location.region | String | Province |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Coordinates |
| images | Detail page | images | Array of URLs | Property photos |
| description | Detail page | description | Text | Property description |
| features | Detail page | features | Array of strings | Feature list |
| agencyName | Detail page | agent.name | String | Agency name |
| agencyPhone | Detail page | agent.phone | String | Agency phone |

## Special Transformations

### parseFloor()
Converts floor text to numbers:
- "1", "Planta 1" → 1
- "Sótano" → -1
- "Ático" → 99
- "Entresuelo" → 0
- Returns undefined if unable to parse

### mapCondition()
Maps condition strings:
- "Nuevo" → "new"
- "Buen estado" → "good"
- "Reformado" → "renovated"
- "Para reformar" → "needs_renovation"
- etc.

### normalizeEnergyRating()
Maps energy certificates A-G:
- "A" → "A" (most efficient)
- "G" → "G" (least efficient)
- Returns undefined if invalid

### normalizePropertyType()
Detects apartment subtypes:
- "Apartamento", "Piso" → "standard"
- "Ático" → "penthouse"
- "Loft" → "loft"
- "Estudio" → "studio"
- "Dúplex" → "maisonette"

### parseSpanishFeatures()
Extracts boolean amenities from feature text:
- Elevator, balcony, parking, garage, storage, terrace
- Pool, air conditioning
- Fireplace, garden, etc.

## Search Configuration
Combinations from:
- **propertyType**: apartment, house, land, commercial
- **province**: Spanish provinces with URL slugs
- **transactionType**: venta (sale) or alquiler (rent)
Each creates independent search (pagination, checksum tracking)

## Checksum Strategy
Listing ID → md5 hash for change detection
Only new/changed listings queued for detail
70-80% API reduction on stable periods
