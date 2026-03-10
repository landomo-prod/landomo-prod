# CeskeReality - Transformation Logic

## Overview

Transforms raw JSON-LD + HTML data into category-specific TierI types:
- `ApartmentPropertyTierI`
- `HousePropertyTierI`
- `LandPropertyTierI`
- `CommercialPropertyTierI`

## Category Detection

Categories are **not detected** from the data. They are determined by the listing page URL that the listing was discovered on:

| Discovery URL | Category |
|---------------|----------|
| `/prodej/byty/` | `apartment` |
| `/prodej/rodinne-domy/` | `house` |
| `/prodej/pozemky/` | `land` |
| `/prodej/komercni/` | `commercial` |

The category is passed through from discovery to transformation via the `sendToIngest()` call.

## Transformation Flow

```
ScrapedListing { url, jsonLd, htmlData }
    |
    category (from discovery URL)
    |
    switch(category):
      apartment -> transformApartment()
      house     -> transformHouse()
      land      -> transformLand()
      commercial -> transformCommercial()
    |
    All transformers use:
      1. JSON-LD for: title, price, currency, location, description, image
      2. htmlData.propertyDetails -> mapPropertyDetails() for structured fields
      3. Regex on jsonLd.name for: bedrooms (disposition), sqm
      4. Regex on jsonLd.description for: boolean features (elevator, balcony, etc.)
      5. htmlData.images for: full gallery
      6. htmlData.energyRating for: energy class
```

## Property Details Mapper

`propertyDetailsMapper.ts` is the shared utility that converts Czech HTML labels to standardized fields.

### Input
`Record<string, string>` - raw Czech label-value pairs from the `.i-info` table.

### Output
`MappedPropertyDetails` interface with typed fields.

### Key Parsing Functions

**`parseArea(value)`** - Handles Czech number formats:
```typescript
// "43 m2" -> 43, "43,5 m2" -> 43.5, "2 510 m2" -> 2510
parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
```

**`parseFloor(value)`** - Handles Czech floor names:
```typescript
// "prizemni" / "parter" -> 0
// "suteren" / "podzemni" -> -1
// "2." -> 2
```

**`mapConstructionType(value)`** - Czech construction terms:
| Czech Term | Mapped Value |
|------------|-------------|
| `panel` | `panel` |
| `cihla`, `cihlova`, `zdena` | `brick` |
| `beton`, `zelezobeton` | `concrete` |
| `skelet`, `ocel` | `concrete` |
| `smisen`, `kombinovan`, `jina` | `mixed` |

**`mapCondition(value)`** - Czech condition terms:
| Czech Term | Mapped Value |
|------------|-------------|
| `novostavba`, `novy` | `new` |
| `vyborny`, `velmi dobry` | `excellent` |
| `dobry`, `udrzovany` | `good` |
| `po rekonstrukci` | `after_renovation` |
| `vyzaduje`, `k rekonstrukci` | `requires_renovation` |

**`mapFurnished(value)`** - Furnished status:
| Czech Term | Mapped Value |
|------------|-------------|
| `ano`, `vybaveny`, `zarizeny` | `furnished` |
| `castecne` | `partially_furnished` |
| `ne`, `nevybaveny` | `not_furnished` |

## Apartment Transformer

**File**: `src/transformers/ceskerealityApartmentTransformer.ts`

### Bedroom Extraction
Parsed from `jsonLd.name` using Czech disposition format:
```typescript
const nameMatch = jsonLd.name?.match(/(\d+)\+(?:kk|\d)/i);
bedrooms = parseInt(nameMatch[1]) - 1; // "2+kk" -> 1, "3+1" -> 2
```

### Area Extraction
Priority: HTML mapped `sqm` > title regex > 0
```typescript
sqm: mappedDetails.sqm || sqm || 0
```

### Boolean Features
Derived from description keywords AND mapped HTML details:
```typescript
hasElevator = /vytah|elevator/i.test(description);
hasBalcony = /balkon|terasa/i.test(description) || !!mappedDetails.balconyArea;
hasParking = /parkovani|garaz/i.test(description) || !!mappedDetails.parking;
hasBasement = /sklep|basement/i.test(description) || !!mappedDetails.cellarArea;
```

### Images
Prefers HTML gallery (multiple images) over JSON-LD (single image).

## House Transformer

**File**: `src/transformers/ceskerealityHouseTransformer.ts`

### Bedroom Extraction (extended)
Three-level fallback:
1. Title disposition: `"5+1"` -> 4
2. Description bedroom count: `"3 loznice"` -> 3
3. Description room count: `"4 pokoju"` -> 3 (rooms - 1)
4. Description disposition: `"3+kk"` -> 2

### Plot Size Extraction
Regex patterns on description text:
```typescript
/pozemek[^\d]*([\d\s]+)\s*m[²2]/i
/pozemku\s*o?\s*(?:vymere|rozloze)?\s*([\d\s]+)\s*m[²2]/i
/zahrada[^\d]*([\d\s]+)\s*m[²2]/i
/plocha\s*pozemku[^\d]*([\d\s]+)\s*m[²2]/i
```

### Construction Type Override
Panel construction mapped to `concrete` for houses:
```typescript
construction_type: mappedDetails.constructionType === 'panel' ? 'concrete' : mappedDetails.constructionType
```

## Land Transformer

**File**: `src/transformers/ceskerealityLandTransformer.ts`

### Plot Area
Priority: HTML mapped `sqmPlot` > title regex > description regex > 0

Simplest transformer - only required field is `area_plot_sqm`.

## Commercial Transformer

**File**: `src/transformers/ceskerealityCommercialTransformer.ts`

### Construction Type Override
Panel mapped to `prefab`:
```typescript
construction_type: mappedDetails.constructionType === 'panel' ? 'prefab' : mappedDetails.constructionType
```

### Condition Override
`after_renovation` mapped to `good`:
```typescript
condition: mappedDetails.condition === 'after_renovation' ? 'good' : mappedDetails.condition
```

### Boolean Features
```typescript
hasElevator = /vytah|elevator/i.test(description);
hasParking = /parkovani|garaz/i.test(description) || !!mappedDetails.parking;
hasBathrooms = /koupelna|wc/i.test(description) || !!mappedDetails.bathrooms;
```

## Common Patterns Across All Transformers

### Constant Fields
```typescript
source_platform: 'ceskereality-cz'
status: 'active'
transaction_type: 'sale'
location.country: 'Czech Republic'
currency: 'CZK' (fallback)
```

### Portal Metadata (Tier III)
All transformers store in `portal_metadata`:
- `agent_name` - from `offers.offeredby.name`
- `agent_phone` - from `offers.offeredby.telephone`
- `property_id` - from HTML details mapper
- `ownership` - from HTML details mapper
- `original_details` - raw HTML property details for reference

### Portal ID Generation
In `ingestAdapter.ts`:
```typescript
// URL: .../listing-name-3084877.html -> "cr-3084877"
const match = url.match(/-(\d{6,})\.html$/);
return match ? `cr-${match[1]}` : url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
```

In `detailQueue.ts` (alternative):
```typescript
// URL: .../listing-name.html -> "ceskereality-listing-name"
const urlMatch = url.match(/\/([^\/]+)\.html$/);
const portalId = urlMatch ? `ceskereality-${urlMatch[1]}` : `ceskereality-${Date.now()}`;
```

Note: The two adapters generate different portal ID formats.
