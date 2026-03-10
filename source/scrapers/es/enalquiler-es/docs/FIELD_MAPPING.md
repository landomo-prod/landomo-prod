# Enalquiler Field Mapping

## Apartment (property_category: 'apartment')

| Portal Field | Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Prefixed `enalquiler-{id}` | Unique property identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text extraction | Property title |
| price | Search result | price | Integer | EUR currency |
| propertyType | Search result | property_category | 'apartment' | Fixed for apartment type |
| rooms | Search result | bedrooms | Integer | Number of bedrooms |
| bathrooms | Search result | bathrooms | Integer | Optional |
| sqm | Search result | sqm | Integer | Living space in m² |
| hasElevator | Search/Detail | has_elevator | Boolean | Elevator feature |
| hasBalcony | Search/Detail | has_balcony | Boolean | Balcony feature |
| hasParking | Search/Detail | has_parking | Boolean | Parking space |
| hasBasement | Search/Detail | has_basement | Boolean | Storage/basement |
| hasTerrace | Search/Detail | has_terrace | Boolean | Terrace feature |
| hasGarage | Search/Detail | has_garage | Boolean | Garage feature |
| floor | Search result | floor | parseFloor() | Converts text to number |
| condition | Detail page | condition | mapCondition() | Property condition |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating A-G |
| yearBuilt | Detail page | year_built | Integer | Construction year |
| communityFees | Detail page | hoa_fees | Float | Monthly HOA/community fees |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Amenity list |
| agencyName | Detail page | agent.name | String | Real estate agency name |
| agencyPhone | Detail page | agent.phone | String | Agency contact number |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City name |
| location.province | Detail page | location.region | String | Province/region |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Geographic coordinates |
| transactionType | Portal context | transaction_type | 'rent' | Always rental |
| currency | Detail page | currency | 'EUR' | Euro currency |
| estateTypeId | Detail page | (internal) | (internal) | Used for category detection |

## House (property_category: 'house')

| Portal Field | Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Prefixed `enalquiler-{id}` | Unique identifier |
| url | Search result | source_url | Direct URL | Portal listing URL |
| title | Search/Detail page | title | Text extraction | Property title |
| price | Search result | price | Integer | EUR currency |
| propertyType | Search result | property_category | 'house' | Fixed for house type |
| rooms | Search result | bedrooms | Integer | Number of bedrooms |
| bathrooms | Search result | bathrooms | Integer | Optional |
| sqm | Search result | sqm_living | Integer | Living space |
| sqmPlot | Detail page | sqm_plot | Integer | Plot area |
| hasGarden | Search/Detail | has_garden | Boolean | Garden feature |
| hasGarage | Search/Detail | has_garage | Boolean | Garage feature |
| hasParking | Search/Detail | has_parking | Boolean | Parking space |
| hasBasement | Search/Detail | has_basement | Boolean | Storage/basement |
| hasPool | Search/Detail | has_pool | Boolean | Swimming pool |
| hasTerrace | Search/Detail | has_terrace | Boolean | Terrace feature |
| floor | Search result | floor | parseFloor() | Converts text to number |
| condition | Detail page | condition | mapCondition() | Property condition |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating |
| yearBuilt | Detail page | year_built | Integer | Construction year |
| communityFees | Detail page | hoa_fees | Float | Monthly fees |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Amenity list |
| agencyName | Detail page | agent.name | String | Agency name |
| agencyPhone | Detail page | agent.phone | String | Agency phone |
| location.address | Detail page | location.address | String | Street address |
| location.city | Detail page | location.city | String | City |
| location.province | Detail page | location.region | String | Province |
| location.lat/lng | Detail page | location.coordinates | {lat, lon} | Coordinates |
| transactionType | Portal context | transaction_type | 'rent' | Always rental |
| currency | Detail page | currency | 'EUR' | Euro currency |
| estateTypeId | Detail page | (internal) | (internal) | Used for category detection |

## Special Transformations

### parseFloor()
Converts text formats to floor numbers:
- "1", "Planta 1" → 1
- "Sótano", "Semisótano" → -1
- "Ático" → 99
- "Entresuelo" → 0

### mapCondition()
Maps condition strings to standard values:
- "Nuevo" → "new"
- "Reformado" → "renovated"
- "Buen estado" → "good"
- "Para reformar" → "needs_renovation"

### normalizeEnergyRating()
Maps A-G energy certificates:
- "A" → "A" (most efficient)
- "G" → "G" (least efficient)

### normalizePropertyType()
Detects property subtype from title:
- "Apartamento", "Piso", "Flat" → "standard"
- "Ático", "Penthouse" → "penthouse"
- "Loft" → "loft"
- "Dúplex" → "maisonette"
- "Estudio" → "studio"

## Search Configuration
Combinations are formed from:
- **propertyType**: apartment, house (mapped from estateTypeId)
- **province**: Spanish provinces with specific URL slugs
- Each combination creates independent search pages (pagination)

## Checksum Strategy
Listing ID → md5 hash for change detection
Only new/changed listings queued for detail fetch
Reduces API calls by 70-80% on stable periods
