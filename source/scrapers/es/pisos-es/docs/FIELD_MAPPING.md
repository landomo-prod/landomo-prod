# Pisos.com Field Mapping

## Apartment (property_category: 'apartment')

| Portal Field | HTML/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Extracted from URL | Unique property identifier |
| detailUrl | Search result | source_url | Direct URL | Portal listing URL |
| title | Detail page | title | Text | Property title |
| price | Search/Detail page | price | Integer | EUR currency (monthly for rent) |
| transaction_type | URL path | transaction_type | 'sale' or 'rent' | Detected from URL |
| propertyTypeSlug | URL path | property_subtype | detectSubtypeFromSlug() | e.g., 'piso', 'apartamento' |
| bedrooms | Search result | bedrooms | Integer | Number of bedrooms |
| bathrooms | Search/Detail page | bathrooms | Integer | Optional |
| sqm | Search/Detail page | sqm | Integer | Living space in m² |
| floor | Search result | floor | parseFloor() | Converts text to number |
| features | Detail page | has_elevator | Boolean | Feature keyword match |
| features | Detail page | has_balcony | Boolean | Feature keyword match |
| features | Detail page | has_parking | Boolean | Parking + garage features |
| features | Detail page | has_basement | Boolean | Storage/basement feature |
| features | Detail page | has_terrace | Boolean | Terrace feature |
| features | Detail page | has_garage | Boolean | Garage feature |
| featuresSummary | Detail page | condition | normalizeCondition() | Building condition |
| featuresSummary | Detail page | heating_type | normalizeHeatingType() | Heating system |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating A-G |
| features | Detail page | furnished | normalizeFurnished() | Furnished status |
| location.city | Detail page | location.city | String | City name |
| location.neighborhood | Detail page | location.district | String | District/neighborhood |
| location.address | Detail page | location.address | String | Street address |
| location.latitude | Detail page | location.latitude | Float | Geographic latitude |
| location.longitude | Detail page | location.longitude | Float | Geographic longitude |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Feature/amenity list |
| agentName | Detail page | agent.name | String | Agent/agency name |
| agentPhone | Detail page | agent.phone | String | Agent contact phone |
| lastUpdated | Detail page | published_date | ISO string | Last update date |
| country_specific.ibi | Detail page | country_specific.ibi | Float | Property tax (if available) |
| country_specific.community_fees | Detail page | country_specific.community_fees | Float | Monthly community fees |
| country_specific.energy_certificate_status | Detail page | country_specific.energy_certificate_status | String | Certificate status |
| country_specific.is_new_development | Detail page | country_specific.is_new_development | Boolean | New development flag |

## House (property_category: 'house')

| Portal Field | HTML/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Extracted from URL | Unique identifier |
| detailUrl | Search result | source_url | Direct URL | Portal listing URL |
| title | Detail page | title | Text | Property title |
| price | Search/Detail page | price | Integer | EUR currency |
| transaction_type | URL path | transaction_type | 'sale' or 'rent' | Detected from URL |
| propertyTypeSlug | URL path | property_subtype | detectSubtypeFromSlug() | e.g., 'chalet', 'casa' |
| bedrooms | Search result | bedrooms | Integer | Number of bedrooms |
| bathrooms | Search/Detail page | bathrooms | Integer | Optional |
| sqm_living | Search/Detail page | sqm_living | Integer | Living space in m² |
| sqm_plot | Detail page | sqm_plot | Integer | Plot area (extracted from features) |
| features | Detail page | has_garden | Boolean | Garden feature |
| features | Detail page | has_garage | Boolean | Garage feature |
| features | Detail page | has_parking | Boolean | Parking feature |
| features | Detail page | has_basement | Boolean | Storage/basement |
| features | Detail page | has_pool | Boolean | Swimming pool |
| features | Detail page | has_terrace | Boolean | Terrace feature |
| features | Detail page | has_fireplace | Boolean | Fireplace feature |
| featuresSummary | Detail page | condition | normalizeCondition() | Building condition |
| featuresSummary | Detail page | heating_type | normalizeHeatingType() | Heating system |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating |
| features | Detail page | furnished | normalizeFurnished() | Furnished status |
| location.city | Detail page | location.city | String | City |
| location.neighborhood | Detail page | location.district | String | District |
| location.address | Detail page | location.address | String | Street address |
| location.latitude | Detail page | location.latitude | Float | Latitude |
| location.longitude | Detail page | location.longitude | Float | Longitude |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Feature list |
| agentName | Detail page | agent.name | String | Agent name |
| agentPhone | Detail page | agent.phone | String | Agent phone |
| lastUpdated | Detail page | published_date | ISO string | Last update |
| country_specific.energy_certificate_status | Detail page | country_specific.energy_certificate_status | String | Certificate status |
| country_specific.is_new_development | Detail page | country_specific.is_new_development | Boolean | New development |

## Land (property_category: 'land')

| Portal Field | HTML/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Extracted from URL | Unique identifier |
| detailUrl | Search result | source_url | Direct URL | Portal listing URL |
| title | Detail page | title | Text | Property title |
| price | Search/Detail page | price | Integer | EUR currency |
| sqm | Detail page | area_plot_sqm | Integer | Total plot area (required) |
| transaction_type | URL path | transaction_type | 'sale' or 'rent' | Detected from URL |
| location.city | Detail page | location.city | String | City |
| location.address | Detail page | location.address | String | Street address |
| location.latitude | Detail page | location.latitude | Float | Latitude |
| location.longitude | Detail page | location.longitude | Float | Longitude |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Feature list |
| agentName | Detail page | agent.name | String | Agent name |
| agentPhone | Detail page | agent.phone | String | Agent phone |

## Commercial (property_category: 'commercial')

| Portal Field | HTML/Detail Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| id | Search result | portal_id | Extracted from URL | Unique identifier |
| detailUrl | Search result | source_url | Direct URL | Portal listing URL |
| title | Detail page | title | Text | Property title |
| price | Search/Detail page | price | Integer | EUR currency |
| transaction_type | URL path | transaction_type | 'sale' or 'rent' | Detected from URL |
| propertyTypeSlug | URL path | property_subtype | Mapped (local→retail, etc.) | Commercial subtype |
| sqm | Detail page | sqm_total | Integer | Total area (required) |
| bathrooms | Detail page | bathroom_count | Integer | Number of bathrooms |
| has_bathrooms | Detail page | has_bathrooms | Boolean | Bathrooms present |
| features | Detail page | has_elevator | Boolean | Elevator feature |
| features | Detail page | has_parking | Boolean | Parking feature |
| featuresSummary | Detail page | condition | normalizeCondition() | Condition status |
| featuresSummary | Detail page | heating_type | normalizeHeatingType() | Heating system |
| energyCertificate | Detail page | energy_class | normalizeEnergyRating() | Energy rating |
| location.city | Detail page | location.city | String | City |
| location.neighborhood | Detail page | location.district | String | District |
| location.address | Detail page | location.address | String | Street address |
| location.latitude | Detail page | location.latitude | Float | Latitude |
| location.longitude | Detail page | location.longitude | Float | Longitude |
| description | Detail page | description | Text | Property description |
| images | Detail page | images | Array of URLs | Property photos |
| features | Detail page | features | Array of strings | Feature list |
| agentName | Detail page | agent.name | String | Agent name |
| agentPhone | Detail page | agent.phone | String | Agent phone |
| lastUpdated | Detail page | published_date | ISO string | Last update |

## Special Transformations

### parseSpanishPrice()
Handles formats: "1.500€", "1.500,00€", "€1.500", "1500"
Returns integer (EUR for sale, monthly for rent)

### parseFloor()
Converts floor text to numbers:
- "1", "Planta 1", "1º" → 1
- "Sótano", "S" → -1
- "Ático", "Átic" → 99
- "Entresuelo", "Bajo" → 0
- Returns undefined if unable to parse

### normalizeCondition()
Maps condition strings:
- "Nuevo" → "new"
- "Reformado", "Completamente reformado" → "renovated"
- "Buen estado" → "good"
- "Para reformar", "Necesita obra" → "needs_renovation"

### normalizeEnergyRating()
Maps A-G energy certificates:
- "A", "A+" → "A"
- "G" → "G"
- Returns string or undefined

### normalizeHeatingType()
Maps heating systems:
- "Calefacción" → "central"
- "Radiadores" → "radiators"
- "Suelo radiante" → "floor_heating"

### normalizeFurnished()
Maps furnished status:
- "Amueblado" → true
- "Sin amueblar" → false

### detectSubtypeFromSlug()
Maps URL slugs to property subtypes:
- "piso" → "standard"
- "apartamento" → "standard"
- "ático" → "penthouse"
- "loft" → "loft"
- "estudio" → "studio"
- "chalet" → "detached"
- "casa" → "detached"
- etc.

## Checksum Strategy
Portal ID extracted from URL → md5 hash for change detection
Unchanged listings skipped in detail phase
80% reduction in API calls on stable periods

## Province Filtering
- Optional parameter: `?provinces=madrid,barcelona,valencia`
- Filters SPANISH_PROVINCES list before scraping
- Enables targeted province-specific scrapes
- All property categories still processed
