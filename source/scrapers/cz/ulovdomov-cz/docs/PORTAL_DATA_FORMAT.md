# UlovDomov - Portal Data Format

## Data Source

**Type**: REST API (primary), HTML `__NEXT_DATA__` (fallback)

### Count Endpoint
```
POST https://ud.api.ulovdomov.cz/v1/offer/count
Body: { "filters": { "offerType": "SALE" } }
```

### Discovery/Listing Endpoint
```
POST https://ud.api.ulovdomov.cz/v1/offer/find?page=1&perPage=100&sorting=latest
Body: { "filters": { "offerType": "SALE" } }
```

### HTML Fallback (Detail Pages)
```
GET https://www.ulovdomov.cz/inzerat/{id}
Data extracted from: window.__NEXT_DATA__.props.pageProps.offer.data
```

## Response Structure

### Count Response
```json
{
  "success": true,
  "data": { "count": 12345 },
  "error": null
}
```

### Listing Response
```json
{
  "success": true,
  "data": {
    "items": [ /* UlovDomovOffer[] */ ],
    "pagination": {
      "total": 12345,
      "page": 1,
      "perPage": 100,
      "pages": 124
    }
  }
}
```

## Available Fields

### Core Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| id | string | Yes | "abc123" | Unique identifier |
| title | string | Yes | "Prodej bytu 2+kk" | Listing title |
| offerType | enum | Yes | "SALE" / "RENT" | Transaction type |
| propertyType | enum | Yes | "FLAT" / "HOUSE" / "LAND" / "COMMERCIAL" / "ROOM" | Property classification |
| price | number | Yes | 4500000 | Price in CZK |
| priceNote | string | No | "Cena k jednani" | Additional price info |
| url | string | No | "https://..." | Detail page URL |

### Property Detail Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| area | number | No | 65 | Area in sqm |
| dispozice | string | No | "2+kk" | Czech disposition format |
| floor | number | No | 3 | Floor number |
| totalFloors | number | No | 8 | Total building floors |
| ownership | string | No | "Osobni" | Ownership type |
| construction | string | No | "Cihla" | Construction material |
| condition | string | No | "Dobry" | Property condition |
| furnished | string | No | "YES" / "NO" / "PARTIAL" | Furnished status |
| energyEfficiency | string | No | "C" | Energy rating |

### Location Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| location.city | string | No | "Praha" | City name |
| location.district | string | No | "Praha 3" | District |
| location.street | string | No | "Vinohradska" | Street name |
| location.coordinates.lat | number | No | 50.075 | Latitude |
| location.coordinates.lng | number | No | 14.437 | Longitude |

### Amenity Fields (Booleans)
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| parking | boolean | No | true | Has parking |
| balcony | boolean | No | true | Has balcony |
| terrace | boolean | No | false | Has terrace |
| cellar | boolean | No | true | Has cellar/basement |
| elevator | boolean | No | true | Has elevator |
| barrier_free | boolean | No | false | Wheelchair accessible |

### Media & Description Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| images | string[] | No | ["https://..."] | Image URLs |
| description | string | No | "Nabizime..." | Full description in Czech |
| features | string[] | No | ["Balkon", "Vytah"] | Feature list |

### Agent/Contact Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| contactPhone | string | No | "+420..." | Phone number |
| contactEmail | string | No | "agent@..." | Email |
| agent.name | string | No | "Jan Novak" | Agent name |
| agent.company | string | No | "RE/MAX" | Agency name |

### Temporal Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| published | string | No | "2026-01-15" | First published date |
| updated | string | No | "2026-02-01" | Last updated date |

## Search Filters

The API accepts these filter parameters in the POST body:

| Filter | Type | Example |
|---|---|---|
| offerType | "RENT" / "SALE" | "SALE" |
| propertyType | "FLAT" / "HOUSE" / "ROOM" / "LAND" / "COMMERCIAL" | "FLAT" |
| city | string | "Praha" |
| district | string | "Praha 3" |
| priceMin / priceMax | number | 1000000 |
| areaMin / areaMax | number | 50 |
| dispozice | string | "2+kk" |
| parking | boolean | true |
| balcony | boolean | true |
| furnished | string | "YES" |

## HTML __NEXT_DATA__ Differences

When using the HTML fallback scraper, the data structure differs from the REST API:

| REST API Field | HTML __NEXT_DATA__ Field | Notes |
|---|---|---|
| location.city | village.name | Different nesting |
| location.district | villagePart.name | Different nesting |
| location.street | street.name | Different nesting |
| location.coordinates | geoCoordinates | Different key |
| price | rentalPrice.value / salePrice.value | Nested by offer type |
| priceNote | rentalPrice.note / salePrice.note | Nested by offer type |
| dispozice | disposition | Different key name |
| floor | floorLevel | Different key name |
| totalFloors | houseType.totalFloors | Nested in houseType |
| ownership | houseType.ownership | Nested in houseType |
| construction | houseType.construction | Nested in houseType |
| condition | houseType.condition | Nested in houseType |
| energyEfficiency | houseType.energyEfficiency | Nested in houseType |
| features | convenience[] + houseConvenience[] | Two separate arrays |
| images | photos[].url | Array of objects |

## Data Peculiarities

- `bathrooms` is never provided by the API; the transformer defaults to 1
- `ROOM` is a valid propertyType but maps to `other` category (not apartment)
- `furnished` comes as string enum ("YES"/"NO"/"PARTIAL") from REST API, but must be extracted from feature arrays in HTML data
- Boolean amenity fields may be absent rather than false; transformer uses `!== false` checks
- Price is always in CZK; no multi-currency support
- `features` array contains mixed Czech/English strings
