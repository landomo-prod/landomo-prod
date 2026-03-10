# BezRealitky - Portal Data Format

## Data Source

**Type**: GraphQL API

### GraphQL Endpoint
```
POST https://api.bezrealitky.cz/graphql/
Content-Type: application/json
```

## GraphQL Query Structure

### List Adverts Query
```graphql
query ListAdverts(
  $offerType: [OfferType],
  $estateType: [EstateType],
  $order: ResultOrder,
  $limit: Int,
  $offset: Int,
  $locale: Locale!
) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    order: $order
    limit: $limit
    offset: $offset
    locale: $locale
  ) {
    totalCount
    list {
      # See full field list below
    }
  }
}
```

### Variables
```json
{
  "offerType": ["PRODEJ", "PRONAJEM"],
  "estateType": null,
  "order": "timeOrder_desc",
  "limit": 100,
  "offset": 0,
  "locale": "cs"
}
```

## Response Structure

### Root Response
```json
{
  "data": {
    "listAdverts": {
      "totalCount": 15234,
      "list": [/* array of listings */]
    }
  }
}
```

### Single Listing Object
```json
{
  "id": "12345",
  "externalId": "BR12345",
  "hash": "abc123def456",
  "uri": "/nemovitost/prodej/byt/praha/12345",
  "code": "BR12345",
  "active": true,
  "isPausedBySystem": false,
  "isPausedByUser": false,
  "archived": false,
  "reserved": false,
  "highlighted": false,
  "isNew": true,
  "timeActivated": "1708012800",
  "timeDeactivated": null,
  "timeExpiration": "1710604800",
  "daysActive": 15,
  "title": "Prodej bytu 2+kk, 52 m², Praha 5",
  "description": "Krásný světlý byt...",
  "estateType": "BYT",
  "offerType": "PRODEJ",
  "disposition": "2+kk",
  "surface": 52,
  "balconySurface": 6,
  "loggiaSurface": null,
  "terraceSurface": null,
  "cellarSurface": 4,
  "price": 6500000,
  "priceFormatted": "6 500 000 Kč",
  "currency": "CZK",
  "originalPrice": null,
  "isDiscounted": false,
  "deposit": 19500,
  "charges": null,
  "serviceCharges": 2500,
  "utilityCharges": null,
  "gps": {
    "lat": 50.0755,
    "lng": 14.4378
  },
  "address": "Anděl, Praha 5",
  "street": "Nádražní",
  "houseNumber": "15",
  "city": "Praha",
  "cityDistrict": "Praha 5",
  "zip": "15000",
  "region": {
    "id": "19",
    "name": "Praha",
    "uri": "/reality/praha"
  },
  "condition": "VELMI_DOBRY",
  "ownership": "OSOBNI",
  "equipped": "ZARIZENY",
  "construction": "PANEL",
  "floor": "3",
  "totalFloors": 8,
  "age": 45,
  "reconstruction": "2020",
  "penb": "B",
  "heating": "USTREDNI_DOMOVNI",
  "water": "VODOVOD_OBECNI",
  "sewage": "KANALIZACE_OBECNI",
  "parking": true,
  "garage": false,
  "lift": true,
  "balcony": true,
  "terrace": false,
  "cellar": true,
  "loggia": false,
  "newBuilding": false,
  "petFriendly": true,
  "barrierFree": false,
  "publicImages": [
    {
      "id": "img1",
      "url": "https://cdn.bezrealitky.cz/...",
      "order": 1,
      "main": true,
      "filename": "image1.jpg"
    }
  ],
  "tour360": null,
  "visitCount": 234,
  "conversationCount": 5
}
```

## Available Fields

### Core Fields
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| id | string | ✅ | "12345" | Unique identifier |
| externalId | string | ✅ | "BR12345" | Portal's display ID |
| hash | string | ✅ | "abc123" | Hash for URL |
| uri | string | ✅ | "/nemovitost/prodej/byt/..." | Relative URL |
| code | string | ✅ | "BR12345" | Display code |
| active | boolean | ✅ | true | Is listing active |
| archived | boolean | ✅ | false | Is listing archived |
| reserved | boolean | ✅ | false | Is property reserved |

### Timestamps (Unix Epoch Seconds)
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| timeActivated | string | ⚠️ | "1708012800" | Activation timestamp |
| timeDeactivated | string | ❌ | "1710604800" | Deactivation timestamp |
| timeExpiration | string | ⚠️ | "1710604800" | Expiration timestamp |
| daysActive | number | ⚠️ | 15 | Days since activation |
| availableFrom | string | ❌ | "1709222400" | Available from (rentals) |

### Property Details
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| title | string | ✅ | "Prodej bytu 2+kk..." | Property title |
| description | string | ⚠️ | "Krásný světlý..." | Full description |
| estateType | enum | ✅ | "BYT" | BYT/DUM/POZEMEK/GARAZ/KANCELAR/NEBYTOVY_PROSTOR/REKREACNI_OBJEKT |
| offerType | enum | ✅ | "PRODEJ" | PRODEJ/PRONAJEM |
| disposition | string | ⚠️ | "2+kk" | Czech room layout |
| surface | number | ⚠️ | 52 | Living area (m²) |
| surfaceLand | number | ❌ | 500 | Land area (m²) for houses |

### Additional Areas
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| balconySurface | number | ❌ | 6 | Balcony area (m²) |
| loggiaSurface | number | ❌ | 4 | Loggia area (m²) |
| terraceSurface | number | ❌ | 12 | Terrace area (m²) |
| cellarSurface | number | ❌ | 4 | Cellar area (m²) |

### Financial
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| price | number | ⚠️ | 6500000 | Price in currency |
| priceFormatted | string | ⚠️ | "6 500 000 Kč" | Formatted display |
| currency | string | ✅ | "CZK" | Currency code |
| deposit | number | ❌ | 19500 | Security deposit |
| serviceCharges | number | ❌ | 2500 | Monthly fees |
| utilityCharges | number | ❌ | 3000 | Utility costs |

### Location
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| gps.lat | number | ⚠️ | 50.0755 | Latitude |
| gps.lng | number | ⚠️ | 14.4378 | Longitude |
| address | string | ⚠️ | "Anděl, Praha 5" | Full address |
| street | string | ❌ | "Nádražní" | Street name |
| houseNumber | string | ❌ | "15" | House number |
| city | string | ⚠️ | "Praha" | City name |
| cityDistrict | string | ❌ | "Praha 5" | District |
| zip | string | ❌ | "15000" | Postal code |
| region.id | string | ⚠️ | "19" | Region ID |
| region.name | string | ⚠️ | "Praha" | Region name |

### Building Details
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| condition | enum | ❌ | "VELMI_DOBRY" | Property condition |
| ownership | enum | ❌ | "OSOBNI" | Ownership type |
| equipped | enum | ❌ | "ZARIZENY" | Furnished status |
| construction | enum | ❌ | "PANEL" | Building material |
| floor | string | ❌ | "3" | Floor level |
| totalFloors | number | ❌ | 8 | Total floors |
| age | number | ❌ | 45 | Building age (years) |
| reconstruction | string | ❌ | "2020" | Renovation year |
| penb | string | ❌ | "B" | Energy rating |

### Utilities
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| heating | enum | ❌ | "USTREDNI_DOMOVNI" | Heating type |
| water | enum | ❌ | "VODOVOD_OBECNI" | Water source |
| sewage | enum | ❌ | "KANALIZACE_OBECNI" | Sewage type |

### Amenities (Boolean Flags)
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| parking | boolean | ⚠️ | true | Has parking |
| garage | boolean | ⚠️ | false | Has garage |
| lift | boolean | ⚠️ | true | Has elevator |
| balcony | boolean | ⚠️ | true | Has balcony |
| terrace | boolean | ⚠️ | false | Has terrace |
| cellar | boolean | ⚠️ | true | Has basement |
| loggia | boolean | ⚠️ | false | Has loggia |
| newBuilding | boolean | ⚠️ | false | Is new building |
| petFriendly | boolean | ❌ | true | Pets allowed |
| barrierFree | boolean | ❌ | false | Wheelchair accessible |

### Media
| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| publicImages | array | ⚠️ | [...] | Array of image objects |
| publicImages[].id | string | ✅ | "img1" | Image ID |
| publicImages[].url | string | ✅ | "https://..." | Image URL |
| publicImages[].order | number | ✅ | 1 | Display order |
| publicImages[].main | boolean | ✅ | true | Is main image |
| tour360 | string | ❌ | "https://..." | 360° tour URL |

## Data Peculiarities

### Missing Data Patterns
- `price` is null for "price on request" listings
- `description` sometimes empty for very new listings
- GPS coordinates missing for privacy-protected addresses
- Area fields (balcony, loggia, terrace, cellar) often null
- `reconstruction` only present if renovated
- Many enum fields null if not applicable

### Timestamp Format
- All timestamps in Unix epoch seconds (string format)
- Need conversion: `new Date(parseInt(timestamp) * 1000)`
- `timeActivated` and `timeExpiration` usually present
- `timeDeactivated` only for inactive listings

### Boolean Logic
- Some fields use `true/false/null` (3-state)
- `null` means "not applicable" or "unknown"
- `false` means explicitly "no"
- Must check for truthiness: `field === true`

### Enum Values

**estateType**:
- BYT (Apartments)
- DUM (Houses)
- POZEMEK (Land)
- GARAZ (Garages)
- KANCELAR (Offices)
- NEBYTOVY_PROSTOR (Non-residential)
- REKREACNI_OBJEKT (Recreational)

**offerType**:
- PRODEJ (Sale)
- PRONAJEM (Rent)

**condition**:
- NOVOSTAVBA (New construction)
- VELMI_DOBRY (Very good)
- DOBRY (Good)
- PO_REKONSTRUKCI (After renovation)
- PRED_REKONSTRUKCI (Before renovation)
- K_DEMOLICI (For demolition)

**ownership**:
- OSOBNI (Personal)
- DRUZSTEVNI (Cooperative)
- STATNI (State)

**equipped**:
- ZARIZENY (Furnished)
- CASTECNE_ZARIZENY (Partially furnished)
- NEZARIZENY (Unfurnished)

**construction**:
- PANEL (Panel)
- CIHLA (Brick)
- BETON (Concrete)
- DREVO (Wood)
- SMISENA (Mixed)

### Image URL Filters
- Images require filter parameter: `url(filter: RECORD_MAIN)`
- Available filters: `RECORD_MAIN`, `RECORD_THUMB`, etc.
- URLs are CDN-hosted (fast, reliable)

### Locale Handling
- Many fields accept `locale` parameter
- Supports: cs (Czech), en (English), sk (Slovak)
- Address fields localized
- Enum values NOT localized (always Czech)
