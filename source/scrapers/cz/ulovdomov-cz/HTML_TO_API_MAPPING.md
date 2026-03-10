# UlovDomov HTML to REST API Schema Mapping

**Investigation Date**: February 14, 2026
**Investigator**: data-investigator agent

---

## Overview

This document maps the HTML data structure extracted from `window.__NEXT_DATA__.props.pageProps.offer.data` to the expected REST API schema (`UlovDomovOffer`).

---

## Data Source Location

### HTML Detail Pages
```javascript
window.__NEXT_DATA__.props.pageProps.offer.data
```

### Category Pages (Listings)
```javascript
window.__NEXT_DATA__.props.pageProps.listingsFlatRent[]     // Rental apartments
window.__NEXT_DATA__.props.pageProps.listingsFlatSale[]     // Sale apartments
window.__NEXT_DATA__.props.pageProps.listingsHouseRent[]    // Rental houses
window.__NEXT_DATA__.props.pageProps.listingsHouseSale[]    // Sale houses
// etc.
```

---

## Complete Field Mapping

### Basic Information

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `id` | `id` | Direct | String or number |
| `title` | `title` | Direct | "Pronájem bytu 3+1 60 m2" |
| `offerType` | `offerType` | Direct | "RENT" or "SALE" |
| `propertyType` | `propertyType` | Direct | "FLAT", "HOUSE", "ROOM", "LAND", "COMMERCIAL" |
| `url` | N/A | Construct from ID | `https://ulovdomov.cz/nemovitost/${id}` |
| `description` | `description` | Direct | Full text description |

### Pricing

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `price` | `rentalPrice.value` OR `salePrice.value` | Extract from object | Depends on offerType |
| `priceNote` | `rentalPrice.note` OR `salePrice.note` | Extract from object | Optional |
| N/A (new) | `depositPrice` | Additional field | { value, currency } |
| N/A (new) | `monthlyFeesPrice` | Additional field | { value, currency } |
| N/A (new) | `isNoCommission` | Additional field | Boolean |

### Property Details

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `area` | `area` | Direct | Square meters (number) |
| `dispozice` | `disposition` | Direct | "1+kk", "2+1", "3+kk", etc. |
| `floor` | `floorLevel` | Direct | Floor number (number) |
| `totalFloors` | `houseType.totalFloors` OR extract | From houseType object | May need extraction |
| `ownership` | `houseType.ownership` OR extract | From houseType object | May need extraction |
| `construction` | `houseType.construction` OR extract | From houseType object | May need extraction |
| `condition` | `houseType.condition` OR extract | From houseType object | May need extraction |

### Location

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `location.city` | `village.name` | Extract from object | City/village name |
| `location.district` | `villagePart.name` | Extract from object | District/part name |
| `location.street` | `street.name` | Extract from object | Street name |
| `location.coordinates.lat` | `geoCoordinates.lat` | Direct | Latitude |
| `location.coordinates.lng` | `geoCoordinates.lng` | Direct | Longitude |

### Media

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `images` | `photos` | Map photo objects | Array of image URLs |
| N/A | `photos[].url` | Extract URLs | Each photo has metadata |
| N/A | `photos[].description` | Extract descriptions | Optional captions |

### Features & Amenities

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `features` | `convenience[]` + `houseConvenience[]` | Merge arrays | Combined property + building features |
| `parking` | Extract from `houseConvenience` | Check for parking-related items | Boolean |
| `balcony` | Extract from `convenience` | Check for "balkón" or similar | Boolean |
| `terrace` | Extract from `convenience` | Check for "terasa" or similar | Boolean |
| `cellar` | Extract from `convenience` | Check for "sklep" or similar | Boolean |
| `elevator` | Extract from `houseConvenience` | Check for "výtah" or similar | Boolean |
| `barrier_free` | Extract from `convenience` | Check for "bezbariérový" | Boolean |
| `furnished` | Extract from `convenience` | Check for "vybavený", "částečně vybavený" | "YES", "NO", "PARTIAL" |
| `energyEfficiency` | `houseType.energyEfficiency` OR extract | From houseType object | Energy rating |

### Temporal

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `published` | `published` | Direct | ISO date string |
| `updated` | `updated` OR N/A | Direct if available | May not be present |

### Agent/Contact

| REST API Field | HTML Field | Transformation | Notes |
|----------------|------------|----------------|-------|
| `contactPhone` | `agent.phone` OR extract | From agent object | May need extraction |
| `contactEmail` | `agent.email` OR extract | From agent object | May need extraction |
| `agent.name` | `agent.name` OR extract | From agent object | Agent name |
| `agent.company` | `agent.company` OR extract | From agent object | Agency name |

---

## Sample HTML Data Structure

```javascript
{
  // BASIC INFO
  id: 5574930,
  title: "Pronájem bytu 3+1 60 m2",
  offerType: "RENT",                              // or "SALE"
  propertyType: "FLAT",                           // or "HOUSE", "LAND", etc.
  description: "Krásný byt v centru...",

  // PRICING
  rentalPrice: {
    value: 17000,
    currency: "CZK",
    note: "plus poplatky"
  },
  depositPrice: {
    value: 17000,
    currency: "CZK"
  },
  monthlyFeesPrice: {
    value: 3000,
    currency: "CZK"
  },
  isNoCommission: false,

  // PROPERTY DETAILS
  area: 60,
  disposition: "3+1",
  floorLevel: 7,
  houseType: {
    totalFloors: 10,
    ownership: "Osobní",
    construction: "Panelový",
    condition: "Velmi dobrý",
    energyEfficiency: "C"
  },

  // LOCATION
  village: {
    name: "Pardubice",
    id: 12345
  },
  villagePart: {
    name: "Polabiny",
    id: 67890
  },
  street: {
    name: "Bělehradská",
    id: 11111
  },
  geoCoordinates: {
    lat: 50.0358,
    lng: 15.7598
  },

  // MEDIA
  photos: [
    {
      url: "https://...",
      description: "Obývací pokoj",
      order: 1
    }
  ],

  // FEATURES
  convenience: [
    "Balkón",
    "Sklep",
    "Vybavená kuchyně",
    "Lodžie"
  ],
  houseConvenience: [
    "Výtah",
    "Parkovací místo",
    "Sklep"
  ],

  // TEMPORAL
  published: "2024-02-10",
  updated: "2024-02-12",

  // AGENT
  agent: {
    name: "Jan Novák",
    company: "Reality ABC",
    phone: "+420 123 456 789",
    email: "novak@reality.cz"
  }
}
```

---

## Mapping Strategy

### Option 1: HTML → REST API Mapper (Recommended)

Create a mapper function that converts the HTML structure to match the REST API schema:

```typescript
function mapHtmlToApiSchema(htmlData: UlovDomovHtmlOffer): UlovDomovOffer {
  return {
    id: htmlData.id.toString(),
    title: htmlData.title,
    offerType: htmlData.offerType,
    propertyType: htmlData.propertyType,

    // Price extraction based on type
    price: htmlData.offerType === 'RENT'
      ? htmlData.rentalPrice.value
      : htmlData.salePrice.value,
    priceNote: htmlData.offerType === 'RENT'
      ? htmlData.rentalPrice.note
      : htmlData.salePrice.note,

    // Location mapping
    location: {
      city: htmlData.village?.name,
      district: htmlData.villagePart?.name,
      street: htmlData.street?.name,
      coordinates: htmlData.geoCoordinates ? {
        lat: htmlData.geoCoordinates.lat,
        lng: htmlData.geoCoordinates.lng
      } : undefined
    },

    // Simple fields
    area: htmlData.area,
    dispozice: htmlData.disposition,
    floor: htmlData.floorLevel,
    description: htmlData.description,

    // Images
    images: htmlData.photos?.map(p => p.url),

    // Features (merge arrays)
    features: [
      ...(htmlData.convenience || []),
      ...(htmlData.houseConvenience || [])
    ],

    // Extract boolean amenities from features
    parking: extractBoolean(htmlData.houseConvenience, ['parking', 'garáž']),
    balcony: extractBoolean(htmlData.convenience, ['balkón', 'balkon']),
    terrace: extractBoolean(htmlData.convenience, ['terasa']),
    cellar: extractBoolean(htmlData.convenience, ['sklep']),
    elevator: extractBoolean(htmlData.houseConvenience, ['výtah', 'vytah']),
    barrier_free: extractBoolean(htmlData.convenience, ['bezbariérový', 'bezbarierovy']),

    // Furnished status
    furnished: extractFurnished(htmlData.convenience),

    // House type details
    totalFloors: htmlData.houseType?.totalFloors,
    ownership: htmlData.houseType?.ownership,
    construction: htmlData.houseType?.construction,
    condition: htmlData.houseType?.condition,
    energyEfficiency: htmlData.houseType?.energyEfficiency,

    // Temporal
    published: htmlData.published,
    updated: htmlData.updated,

    // Agent
    contactPhone: htmlData.agent?.phone,
    contactEmail: htmlData.agent?.email,
    agent: htmlData.agent ? {
      name: htmlData.agent.name,
      company: htmlData.agent.company
    } : undefined,

    // URL
    url: `https://www.ulovdomov.cz/nemovitost/${htmlData.id}`
  };
}
```

### Option 2: Direct Transformer Update

Update `ulovdomovTransformer.ts` to handle both HTML and REST API structures.

---

## Helper Functions Needed

```typescript
// Extract boolean from feature arrays
function extractBoolean(features: string[] | undefined, keywords: string[]): boolean {
  if (!features) return false;
  const lower = features.map(f => f.toLowerCase());
  return keywords.some(keyword =>
    lower.some(f => f.includes(keyword.toLowerCase()))
  );
}

// Extract furnished status
function extractFurnished(features: string[] | undefined): "YES" | "NO" | "PARTIAL" | undefined {
  if (!features) return undefined;
  const lower = features.map(f => f.toLowerCase());

  if (lower.some(f => f.includes('vybaven') || f.includes('furnished'))) {
    return lower.some(f => f.includes('částečně') || f.includes('partial'))
      ? 'PARTIAL'
      : 'YES';
  }

  if (lower.some(f => f.includes('nevybaven') || f.includes('unfurnished'))) {
    return 'NO';
  }

  return undefined;
}

// Extract energy efficiency
function extractEnergyEfficiency(houseType: any): string | undefined {
  return houseType?.energyEfficiency || houseType?.energyRating;
}
```

---

## Known Gaps

### Fields Present in HTML but Missing in REST API Schema

- `depositPrice` - Security deposit amount
- `monthlyFeesPrice` - Monthly utility fees
- `isNoCommission` - No commission flag
- `photos[].description` - Image captions
- `photos[].order` - Image ordering

### Fields Expected by REST API but Missing in HTML

- None identified - HTML data is more complete than API

---

## Recommendations

1. **Create UlovDomovHtmlOffer type** in `ulovdomovTypes.ts`
2. **Implement mapper** in new file `src/mappers/htmlToApiMapper.ts`
3. **Update htmlScraper.ts** to use correct types
4. **Keep transformer unchanged** to maintain compatibility
5. **Add unit tests** for the mapper function

---

## Next Steps

1. ✅ Investigation complete
2. ⏳ Create mapper function
3. ⏳ Update type definitions
4. ⏳ Test with real data
5. ⏳ Deploy and validate

---

## References

- API Investigation: `API_INVESTIGATION.md`
- Implementation Summary: `IMPLEMENTATION_SUMMARY.md`
- Type Definitions: `src/types/ulovdomovTypes.ts`
- HTML Scraper: `src/scrapers/htmlScraper.ts`
- Transformer: `src/transformers/ulovdomovTransformer.ts`
