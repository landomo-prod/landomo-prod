# Donpiso Field Mapping

## Apartment (property_category: 'apartment')

| Portal Field | JSON-LD Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| name | RealEstateListing.name | title | Title or listing title fallback | Max 200 chars from detail |
| url | RealEstateListing.url | source_url | Direct URL | Portal listing URL |
| url (extracted ID) | RealEstateListing.url | portal_id | Regex extraction | Unique property identifier |
| price | RealEstateListing.offers.price | price | parseSpanishPrice() | EUR currency |
| description | RealEstateListing.description | description | Direct text | May be null |
| image | RealEstateListing.image | images | Array of URLs | First image for media |
| propertyTypeSlug | Detected from title | property_subtype | Title keywords | e.g., 'piso', 'apartamento' |
| transactionType | URL/page context | transaction_type | 'sale' or 'rent' | From province URL segment |
| Detail: habitaciones | Detail page parse | bedrooms | Integer | Rooms minus 1 if needed |
| Detail: baños | Detail page parse | bathrooms | Integer | Optional, may be null |
| Detail: m² | Detail page parse | sqm | Integer | Living space |
| Detail: planta | Detail page parse | floor | parseFloor() | Converts text to number |
| Detail: ascensor | Detail page parse | has_elevator | Boolean | Feature keyword match |
| Detail: balcón | Detail page parse | has_balcony | Boolean | Feature keyword match |
| Detail: garaje/parking | Detail page parse | has_parking | Boolean | Combines garage + parking |
| Detail: trastero/sótano | Detail page parse | has_basement | Boolean | Storage/basement feature |
| Detail: terraza | Detail page parse | has_terrace | Boolean | Optional feature |
| Detail: estado (nuevo, reformado, a reformar) | Detail page parse | condition | normalizeCondition() | Maps to standard enum |
| Detail: certificado energético | Detail page parse | energy_class | normalizeEnergyRating() | A-G scale |
| Detail: calefacción | Detail page parse | heating_type | normalizeHeatingType() | e.g., central, individual |
| Detail: amueblado | Detail page parse | furnished | normalizeFurnished() | Boolean or null |
| Detail: fotos | Detail page parse | media.images | Array of URLs | Ordered by position |
| Detail: agente | Detail page parse | agent | Object {name, phone, email} | Optional |
| Detail: ubicación | Detail page parse | location | Object {city, province, neighborhood, address, lat/lon} | Geographic data |
| Detail: nuevadevelopment | Detail page parse | country_specific.is_new_development | Boolean | Promotional flag |
| Detail: construcción | Detail page parse | country_specific.construction_year | Integer | Year built |
| Detail: certificado | Detail page parse | country_specific.energy_certificate_status | String | Certificate status |

## House (property_category: 'house')

| Portal Field | JSON-LD Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| name | RealEstateListing.name | title | Detail title or listing title | Max 200 chars |
| url | RealEstateListing.url | source_url | Direct URL | Portal listing URL |
| url (extracted) | RealEstateListing.url | portal_id | Regex extraction | Unique identifier |
| price | RealEstateListing.offers.price | price | parseSpanishPrice() | EUR currency |
| description | RealEstateListing.description | description | Direct text | May be null |
| Detail: habitaciones | Detail page parse | bedrooms | Integer | Number of bedrooms |
| Detail: baños | Detail page parse | bathrooms | Integer | Optional |
| Detail: m² construida | Detail page parse | sqm_living | Integer | Living space |
| Detail: m² parcela/terreno | Detail page parse | sqm_plot | Integer | Plot area (extracted from features) |
| Detail: jardín | Detail page parse | has_garden | Boolean | Garden feature |
| Detail: garaje | Detail page parse | has_garage | Boolean | Garage feature |
| Detail: parking | Detail page parse | has_parking | Boolean | Parking space |
| Detail: sótano | Detail page parse | has_basement | Boolean | Storage/basement |
| Detail: piscina | Detail page parse | has_pool | Boolean | Optional pool |
| Detail: terraza | Detail page parse | has_terrace | Boolean | Terrace feature |
| Detail: chimenea | Detail page parse | has_fireplace | Boolean | Fireplace feature |
| Detail: estado | Detail page parse | condition | normalizeCondition() | Building condition |
| Detail: calefacción | Detail page parse | heating_type | normalizeHeatingType() | Heating system |
| Detail: certificado | Detail page parse | energy_class | normalizeEnergyRating() | Energy rating |
| Detail: amueblado | Detail page parse | furnished | normalizeFurnished() | Furnished flag |
| Detail: fotos | Detail page parse | images | Array of URLs | Property images |
| Detail: agente | Detail page parse | agent | Object {name, phone, email} | Contact info |
| Detail: ubicación | Detail page parse | location | Object {city, address, lat/lon} | Geographic data |

## Land (property_category: 'land')

| Portal Field | JSON-LD Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| name | RealEstateListing.name | title | Listing title | Property title |
| url | RealEstateListing.url | source_url | Direct URL | Portal listing URL |
| url (extracted) | RealEstateListing.url | portal_id | Regex extraction | Unique identifier |
| price | RealEstateListing.offers.price | price | parseSpanishPrice() | EUR currency |
| Detail: m² parcela | Detail page parse | area_plot_sqm | Integer | Total plot area (required) |
| Detail: ubicación | Detail page parse | location | Object {city, address, lat/lon} | Geographic data |
| Detail: fotos | Detail page parse | images | Array of URLs | Property images |
| Detail: agente | Detail page parse | agent | Object {name, phone, email} | Contact info |

## Commercial (property_category: 'commercial')

| Portal Field | JSON-LD Source | TierI Field | Transformation | Notes |
|---|---|---|---|---|
| name | RealEstateListing.name | title | Detail title or listing title | Property title |
| url | RealEstateListing.url | source_url | Direct URL | Portal listing URL |
| url (extracted) | RealEstateListing.url | portal_id | Regex extraction | Unique identifier |
| price | RealEstateListing.offers.price | price | parseSpanishPrice() | EUR currency |
| propertyTypeSlug | Detected from title | property_subtype | Title keywords mapped | local→retail, nave→warehouse, oficina→office |
| Detail: m² | Detail page parse | sqm_total | Integer | Total commercial area |
| Detail: ascensor | Detail page parse | has_elevator | Boolean | Elevator feature |
| Detail: parking | Detail page parse | has_parking | Boolean | Parking available |
| Detail: baños | Detail page parse | has_bathrooms | Boolean | Has bathrooms |
| Detail: número baños | Detail page parse | bathroom_count | Integer | Quantity of bathrooms |
| Detail: estado | Detail page parse | condition | normalizeCondition() | Condition status |
| Detail: calefacción | Detail page parse | heating_type | normalizeHeatingType() | Heating system |
| Detail: certificado | Detail page parse | energy_class | normalizeEnergyRating() | Energy rating |
| Detail: fotos | Detail page parse | images | Array of URLs | Property images |
| Detail: agente | Detail page parse | agent | Object {name, phone, email} | Contact info |
| Detail: ubicación | Detail page parse | location | Object {city, address, lat/lon} | Geographic data |

## Special Transformations

### parseSpanishPrice()
Handles formats: "1.500€", "1.500,00€", "€1.500", etc.
Returns integer (cents for rent, euros for sale)

### normalizeCondition()
Maps: "nueva" → "new", "reformada" → "renovated", "para reformar" → "needs_renovation", etc.

### normalizeEnergyRating()
Maps: "A", "B", "C", "D", "E", "F", "G" to standard energy class

### normalizeHeatingType()
Maps: "calefacción" → "central", "radiador" → "radiators", etc.

### normalizeFurnished()
Maps: "amueblado" → true, "sin amueblar" → false

### parseFloor()
Converts: "Planta 1" → 1, "Sótano" → -1, "Ático" → 99, etc.

## Checksum Strategy
Portal ID extracted from URL → md5 hash for change detection
Unchanged listings skipped in detail phase
