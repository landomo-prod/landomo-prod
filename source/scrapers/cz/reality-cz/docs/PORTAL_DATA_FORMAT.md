# Reality.cz - Portal Data Format

## Data Source

**Type**: Reverse-engineered mobile API (JSON)
**Base URL**: `https://api.reality.cz`
**Auth**: Token header + session cookie from guest login

### Authentication
```
POST /moje-reality/prihlasit2/
Headers:
  Authorization: Token 5c858f9578fc6f0a12ec9f367b1807b3
  User-Agent: Android Mobile Client 3.1.4b47
  Content-Type: application/x-www-form-urlencoded
Body: mrregemail=&mrregh=&fcm_id=&os=6
Response: Set-Cookie: sid={session_id}
```

Guest login (empty credentials) returns a session cookie valid for ~2 years.

### Search Endpoint
```
GET /{offer_type}/{property_type}/{region}/?skip={n}&take={n}
Cookie: sid={session_id}
```

**Path Parameters**:
- `offer_type`: `prodej` (sale) or `pronajem` (rent)
- `property_type`: `byty` | `domy` | `pozemky` | `komercni`
- `region`: e.g., `Ceska-republika` (default)

**Query Parameters**:
- `skip`: Offset for pagination (default 0)
- `take`: Items per page (default 100)

### Detail Endpoint
```
GET /{advertisement_id}/
Cookie: sid={session_id}
```

## Response Structure

### Search Response (`RealityApiSearchResponse`)
```typescript
{
  count: number;              // Total matching listings
  location?: string;
  location_gps?: { lat, lng };
  skip?: number;
  take?: number;
  viewport?: {
    southwest: { lat, lng },
    northeast: { lat, lng },
    zoom: number
  };
  advertisements: [           // List items (summary only)
    {
      id: string;             // Listing ID
      type: string;           // Descriptive: "byt 2+1, 62 m2, panel, osobni"
      place: string;          // Location text
      gps: { lat, lng };      // GPS coordinates
      price: {
        sale?: { price, unit },
        rent?: { price, unit },
        advance?: { price, unit },
        commission?: boolean,
        note?: string,
        previous_price?: string,
        previous?: number,
        discount?: number
      },
      photos?: string[];
      photo_id?: string;
      offer_type?: number;    // 1 = sale, 2 = rent
      badge?: { text, color }
    }
  ];
  ok?: string;
  err?: string;
}
```

### Detail Response (`RealityApiDetailResponse`)
```typescript
{
  id: string;
  custom_id?: string;
  type: string;               // "byt 2+1, 62 m2, panel, osobni"
  title: string;              // Often empty
  place: string;
  description?: string;
  offer_type?: number;        // 1 = sale, 2 = rent
  price: {
    sale?: { price: number, unit: string },
    rent?: { price: number, unit: string },
    advance?: { price: number, unit: string },
    commission?: boolean,
    note?: string,
    previous_price?: string | null,
    previous?: number | null,
    discount?: number | null
  },
  location?: {
    gps: { lat, lng },
    show_location: boolean,
    street?: Array<Array<{ lat, lng }>>
  },
  information?: [             // Key-value structured data
    { key: string, value: string }
  ],
  photos?: [
    { name: string, title: string }  // name is URL path
  ],
  badges?: [{ text, color }],
  contact?: {
    advertiser?: { name, company, email, title, phones[], has_name },
    broker?: { name, email, phones[], photo, title, url?, gender },
    real_estate?: { name, address, email, phones[], logo, title }
  },
  created_at?: string,
  modified_at?: string
}
```

## Available Fields

### Core Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| id | string | Yes | "123456" | Unique listing ID |
| type | string | Yes | "byt 2+1, 62 m2, panel, osobni" | Descriptive type string |
| title | string | Yes | "" | Often empty |
| place | string | Yes | "Praha 1 - Stare Mesto" | Location text |
| offer_type | number | No | 1 | 1=sale, 2=rent |
| description | string | No | "Prodej bytu..." | HTML or plain text |

### Price Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| price.sale.price | number | For sales | 5500000 | Sale price |
| price.sale.unit | string | For sales | "Kc" or "Kc" | Currency |
| price.rent.price | number | For rentals | 15000 | Monthly rent |
| price.commission | boolean | No | true | Agent commission |
| price.note | string | No | "Cena vcetne DPH" | Price note |
| price.previous_price | string | No | "5 800 000" | Previous price |

### Location Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| location.gps.lat | number | Usually | 50.0755 | Latitude |
| location.gps.lng | number | Usually | 14.4378 | Longitude |
| location.show_location | boolean | No | true | Whether GPS is exact |
| place | string | Yes | "Praha 1 - Stare Mesto" | Parsed for city/region |

### Information Array (Key-Value Pairs)
The `information[]` array contains structured property details. Common keys:

| Key (Czech) | Type | Category | Example Value |
|---|---|---|---|
| Dispozice | string | apt/house | "2+kk", "3+1" |
| Plocha | string | all | "75 m2" |
| Uzitna plocha | string | all | "62 m2" |
| Podlahova plocha | string | apt | "60 m2" |
| Plocha pozemku | string | house/land | "850 m2" |
| Podlazi / Patro | string | apt/comm | "3. podlazi" |
| Pocet podlazi | string | all | "5" |
| Vytah | string | apt/comm | "Ano" / "Ne" |
| Balkon | string | apt/house | "Ano" |
| Sklep | string | apt/house | "Ano" |
| Parkovani | string | all | "Ano" |
| Terasa | string | apt/house | "Ano" |
| Lodzie | string | apt | "Ano" |
| Garaz | string | apt/house | "Ano" |
| Stav / Stav objektu | string | all | "Velmi dobry" |
| Topeni / Vytapeni | string | apt/house/comm | "Ustredni" |
| Stavba / Konstrukce | string | apt/house/comm | "Panel" |
| Energeticka trida | string | all | "B" |
| Vlastnictvi | string | apt/house | "Osobni" |
| Vybaveni | string | apt/house/comm | "Castecne" |
| Rok vystavby | string | all | "1985" |
| Rok rekonstrukce | string | all | "2020" |
| Kauce | string | rental | "30 000 Kc" |
| K nastehavani | string | rental | "01.03.2026" |
| Koupelna | string | apt/house | "1" |
| Voda | string | land | "Ano" |
| Kanalizace | string | land | "Ano" |
| Elektrina | string | land | "Ano" |
| Plyn | string | land | "Ano" |
| Klimatizace | string | apt/comm | "Ano" |
| Bezbarierovy | string | apt/comm | "Ano" |
| Zahrada | string | house | "Ano" |
| Bazen | string | house | "Ano" |
| Krb | string | house | "Ano" |

### Media Fields
| Portal Field | Type | Always Present | Example Value | Notes |
|---|---|---|---|---|
| photos[].name | string | Usually | "/photos/123/abc.jpg" | URL path (prefix with base URL) |
| photos[].title | string | Usually | "Obyvaci pokoj" | Photo caption |

### Contact Fields
| Portal Field | Type | Always Present | Notes |
|---|---|---|---|
| contact.advertiser.name | string | No | Owner/seller name |
| contact.advertiser.company | string | No | Company name |
| contact.broker.name | string | No | Agent name |
| contact.broker.email | string | No | Agent email |
| contact.broker.phones | string[] | No | Agent phone numbers |
| contact.real_estate.name | string | No | Agency name |

## Data Peculiarities

### Missing Data Patterns
- `title` is empty for most listings; the `type` field serves as the effective title
- `description` may be absent for some listings
- GPS coordinates are occasionally missing (`location` absent or `show_location: false`)
- `information[]` array varies significantly between listings; not all keys are present

### Format Inconsistencies
- Price `unit` can be "Kc" or "Kc" (with or without hacek)
- Area values include unit suffix: "75 m2" (must be parsed)
- Floor values may be "3. podlazi" or just "3"
- Boolean values are Czech: "Ano"/"Ne" (not true/false)
- Dates use Czech format: DD.MM.YYYY (e.g., "01.03.2026")

### Edge Cases
- Commercial properties may have different information keys (e.g., "Kancelarska plocha", "Skladova plocha")
- Land listings have utility-related keys (Voda, Kanalizace, Elektrina, Plyn) instead of building amenities
- Photo URLs are relative paths that must be prefixed with `https://api.reality.cz`
- Search results contain only summary data; full detail requires a separate API call per listing
- The `err` field on responses indicates API errors; `ok` field indicates success
