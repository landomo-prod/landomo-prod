# Realingo - Portal Data Format

## Data Source

**Type**: GraphQL API

### Endpoint
```
POST https://www.realingo.cz/graphql
Content-Type: application/json
```

### GraphQL Query
```graphql
query SearchOffer(
  $purpose: OfferPurpose,
  $property: PropertyType,
  $saved: Boolean,
  $categories: [OfferCategory!],
  $area: RangeInput,
  $plotArea: RangeInput,
  $price: RangeInput,
  $first: Int,
  $skip: Int
) {
  searchOffer(
    filter: {
      purpose: $purpose
      property: $property
      saved: $saved
      categories: $categories
      area: $area
      plotArea: $plotArea
      price: $price
    }
    first: $first
    skip: $skip
  ) {
    total
    items { ... }
  }
}
```

### Variables
| Variable | Type | Values | Description |
|----------|------|--------|-------------|
| `purpose` | OfferPurpose | `SELL`, `RENT` | Transaction type |
| `property` | PropertyType | `FLAT`, `HOUSE`, `LAND`, `COMMERCIAL`, `OTHERS` | Property type filter |
| `categories` | [OfferCategory!] | Category-specific values | Sub-category filter |
| `area` | RangeInput | `{ min, max }` | Floor area range |
| `plotArea` | RangeInput | `{ min, max }` | Plot area range |
| `price` | RangeInput | `{ min, max }` | Price range |
| `first` | Int | e.g. `100` | Page size |
| `skip` | Int | e.g. `0` | Offset for pagination |

## Response Structure

```json
{
  "data": {
    "searchOffer": {
      "total": 12345,
      "items": [
        {
          "id": "abc123",
          "adId": "def456",
          "category": "FLAT3_KK",
          "url": "/prodej/byt/3-kk/praha",
          "property": "FLAT",
          "purpose": "SELL",
          "location": {
            "address": "Praha 5, Praha",
            "latitude": 50.0755,
            "longitude": 14.4378
          },
          "price": {
            "total": 5900000,
            "currency": "CZK",
            "vat": null
          },
          "area": {
            "floor": 75,
            "plot": null,
            "garden": null,
            "built": null,
            "cellar": 5,
            "balcony": 8,
            "terrace": null,
            "loggia": null
          },
          "photos": {
            "main": "photo-id-abc",
            "list": ["photo-id-1", "photo-id-2"]
          },
          "updatedAt": "2026-02-15T10:30:00.000Z",
          "createdAt": "2026-01-20T08:00:00.000Z"
        }
      ]
    }
  }
}
```

## Available Fields

### Core Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|--------------|------|----------------|---------------|-------|
| `id` | string | Yes | `"abc123"` | Unique offer ID |
| `adId` | string | No | `"def456"` | Ad identifier |
| `category` | string | No | `"FLAT3_KK"` | Encodes disposition/subtype |
| `url` | string | No | `"/prodej/byt/3-kk/praha"` | Relative URL path |
| `property` | enum | No | `"FLAT"` | FLAT, HOUSE, LAND, COMMERCIAL, OTHERS |
| `purpose` | enum | No | `"SELL"` | SELL or RENT |
| `updatedAt` | string | No | `"2026-02-15T..."` | ISO 8601 timestamp |
| `createdAt` | string | No | `"2026-01-20T..."` | ISO 8601 timestamp |

### Location Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|--------------|------|----------------|---------------|-------|
| `location.address` | string | No | `"Praha 5, Praha"` | Comma-separated address |
| `location.latitude` | number | No | `50.0755` | GPS latitude |
| `location.longitude` | number | No | `14.4378` | GPS longitude |

### Price Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|--------------|------|----------------|---------------|-------|
| `price.total` | number/null | No | `5900000` | Total price |
| `price.currency` | string | No | `"CZK"` | Currency code |
| `price.vat` | number/null | No | `null` | VAT amount |

### Area Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|--------------|------|----------------|---------------|-------|
| `area.floor` | number/null | No | `75` | Floor/usable area in sqm |
| `area.plot` | number/null | No | `500` | Plot area in sqm |
| `area.garden` | number/null | No | `200` | Garden area in sqm |
| `area.built` | number/null | No | `120` | Built-up area in sqm |
| `area.cellar` | number/null | No | `5` | Cellar area in sqm |
| `area.balcony` | number/null | No | `8` | Balcony area in sqm |
| `area.terrace` | number/null | No | `null` | Terrace area in sqm |
| `area.loggia` | number/null | No | `null` | Loggia area in sqm |

### Media Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|--------------|------|----------------|---------------|-------|
| `photos.main` | string | No | `"photo-id-abc"` | Main photo ID |
| `photos.list` | string[] | No | `["id-1", "id-2"]` | Gallery photo IDs |

Image URLs are constructed as: `https://www.realingo.cz/image/{photoId}`

## Category Field Encoding

The `category` field encodes property subtype information:

| Category Pattern | Property Type | Meaning |
|------------------|--------------|---------|
| `FLAT2_KK` | FLAT | 2+kk apartment |
| `FLAT3_1` | FLAT | 3+1 apartment |
| `FLAT4_KK` | FLAT | 4+kk apartment |
| `HOUSE_FAMILY` | HOUSE | Family house |
| `HOUSE_VILLA` | HOUSE | Villa |
| `LAND_BUILDING` | LAND | Building land |
| `LAND_AGRICULTURAL` | LAND | Agricultural land |

## Data Peculiarities

### Missing Data Patterns
- No detail-level fields: description, features, condition, heating, construction type, energy class, ownership are all absent from the API
- `area.floor` represents usable sqm, not floor number
- `bathrooms` and `floor` (story level) are not available
- `photos.list` may be empty or absent

### Format Notes
- All URLs in `url` field are relative paths, need `https://www.realingo.cz` prefix
- Address is a comma-separated string with no structured city/district fields
- `price.total` can be `null` for "price on request" listings
- `purpose` may be absent from API response; the scraper sets it based on query context (SELL/RENT)
