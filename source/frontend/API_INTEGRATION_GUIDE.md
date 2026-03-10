# API Integration Guide

This guide explains how to migrate from mock data to the real Landomo API.

## Overview

The frontend has been updated to match the backend schema from `search-service`. The API layer is now ready for integration.

## Files Changed

### ✅ New Files Created

1. **`lib/api/types.ts`** - Backend API types matching `search-service/src/types/search.ts`
2. **`lib/api/client.ts`** - HTTP client for making API requests
3. **`lib/api/hooks.ts`** - React hooks for data fetching
4. **`lib/api/index.ts`** - Central export point
5. **`lib/properties-mock.ts`** - Mock data in backend format
6. **`.env.local.example`** - Environment variable template

### 📝 Updated Files

1. **`types/property.ts`** - Now extends `PropertyResult` from backend
2. **`lib/properties.ts`** - Re-exports from `properties-mock.ts`

---

## Environment Setup

### 1. Create `.env.local` file

```bash
cp .env.local.example .env.local
```

### 2. Configure environment variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_KEY=your-api-key-here

# Feature Flags
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
```

---

## Migration Path

### Phase 1: Understanding the New Schema

**Old Property Type (Mock):**
```typescript
interface Property {
  id: string;
  price: number;
  address: string;       // Frontend field
  city: string;
  disposition: string;   // Czech-specific
  area: number;          // Alias for sqm
  floor: string;         // "3rd", "Ground"
}
```

**New Property Type (Backend-Compatible):**
```typescript
interface Property extends PropertyResult {
  // Backend fields
  id: string;
  portal: string;              // NEW: "sreality", "rightmove"
  portal_id: string;           // NEW: Portal's internal ID
  title: string;               // NEW: Property title
  price: number;
  currency: string;            // NEW: "EUR", "USD", "GBP"
  property_category: string;   // NEW: "apartment", "house", "land", "commercial"
  transaction_type: string;    // NEW: "sale", "rent"
  city: string;
  region: string;              // NEW: Region/state
  country: string;             // NEW: Country code
  bedrooms?: number;           // NEW: Number of bedrooms
  bathrooms?: number;          // NEW: Number of bathrooms
  sqm?: number;                // NEW: Area in square meters
  floor?: number;              // NEW: Floor number (numeric)
  latitude?: number;           // NEW: GPS coordinates
  longitude?: number;

  // Computed fields (added by adaptProperty)
  address?: string;            // Computed from title
  area?: number;               // Alias for sqm
  disposition?: string;        // Alias for czech_disposition
  coordinates?: { lat, lng };  // Computed from lat/lng
  features?: Feature[];        // Computed from has_* fields
  pricePerSqm?: number;        // Computed: price / sqm
}
```

### Phase 2: Using API Hooks

**Example: Map Screen with Geo Search**

```typescript
// Old (Mock Data)
import { sampleProperties } from '@/lib/properties';

export function MapScreen() {
  const properties = sampleProperties;
  // ...
}

// New (Real API)
import { useGeoSearch } from '@/lib/api';

export function MapScreen() {
  const { data, isLoading, error } = useGeoSearch({
    latitude: 50.0755,
    longitude: 14.4378,
    radius_km: 5,
    filters: {
      property_category: 'apartment',
      price_max: 500000,
    },
    limit: 20,
  });

  const properties = data?.results || [];
  // ...
}
```

**Example: List Screen with Search**

```typescript
// Old (Mock Data)
import { sampleProperties } from '@/lib/properties';

export function ListScreen() {
  const properties = sampleProperties;
  // ...
}

// New (Real API)
import { useSearch } from '@/lib/api';

export function ListScreen() {
  const { data, isLoading, error, refetch } = useSearch({
    filters: {
      city: 'Prague',
      property_category: 'apartment',
      price_min: 100000,
      price_max: 500000,
      bedrooms_min: 2,
    },
    page: 1,
    limit: 20,
    sort_by: 'price_asc',
  });

  const properties = data?.results || [];
  const pagination = data?.pagination;
  // ...
}
```

**Example: Detail Screen**

```typescript
// Old (Mock Data)
import { getPropertyById } from '@/lib/properties';

export function DetailScreen({ id }: { id: string }) {
  const property = getPropertyById(id);
  // ...
}

// New (Real API)
import { useProperty } from '@/lib/api';

export function DetailScreen({ id }: { id: string }) {
  const { property, similarProperties, priceHistory, isLoading, error } = useProperty(id);
  // ...
}
```

### Phase 3: Adapting Backend Data

The `adaptProperty()` function automatically converts backend `PropertyResult` to frontend `Property`:

```typescript
import { adaptProperty } from '@/types/property';
import { PropertyResult } from '@/lib/api/types';

// Backend data
const backendProperty: PropertyResult = {
  id: '1',
  portal: 'sreality',
  title: 'Vinohradská 12',
  price: 285000,
  currency: 'EUR',
  property_category: 'apartment',
  transaction_type: 'sale',
  sqm: 78,
  latitude: 50.0755,
  longitude: 14.4378,
  has_parking: true,
  has_balcony: true,
  // ...
};

// Adapt to frontend format
const property = adaptProperty(backendProperty);

// Now has computed fields:
console.log(property.pricePerSqm); // 3654
console.log(property.address);     // "Vinohradská 12"
console.log(property.coordinates); // { lat: 50.0755, lng: 14.4378 }
console.log(property.features);    // [{ id: 'parking', ... }, { id: 'balcony', ... }]
```

### Phase 4: Helper Functions

```typescript
import {
  getPropertyAddress,
  getPropertyFeatures,
  getPricePerSqm,
  formatPrice,
  formatArea,
} from '@/types/property';

const property = { /* ... */ };

// Get display address
const address = getPropertyAddress(property);
// "Vinohradská 12"

// Format price
const priceFormatted = formatPrice(property.price, property.currency);
// "€285,000"

// Format area
const areaFormatted = formatArea(property.sqm);
// "78 m²"

// Get price per sqm
const pricePerSqm = getPricePerSqm(property);
// 3654
```

---

## Testing

### 1. Start Backend Services

```bash
# Start infrastructure
docker compose -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis

# Start search service
docker compose up -d search-service
```

### 2. Verify API is Running

```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"2026-02-16T..."}
```

### 3. Test Search Endpoint

```bash
curl -X POST http://localhost:4000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "city": "Prague",
      "property_category": "apartment"
    },
    "limit": 5
  }'
```

### 4. Start Frontend

```bash
cd landomo-frontend
npm run dev
```

Visit http://localhost:3000 and check:
- Map loads with properties from API
- List view shows real data
- Filters work correctly
- Detail pages load

---

## API Reference

### Search Properties

```typescript
import { api } from '@/lib/api';

const response = await api.search({
  filters: {
    city: 'Prague',
    property_category: 'apartment',
    price_min: 100000,
    price_max: 500000,
    bedrooms_min: 2,
    has_parking: true,
  },
  page: 1,
  limit: 20,
  sort_by: 'price_asc',
  countries: ['czech'], // Optional
});

// Response:
// {
//   total: 42,
//   results: PropertyResult[],
//   pagination: { page, limit, total, totalPages, hasNext, hasPrev },
//   aggregations: { by_country, by_property_type, price_range },
//   query_time_ms: 45,
//   countries_queried: ['czech']
// }
```

### Geo Search

```typescript
import { api } from '@/lib/api';

const response = await api.geoSearch({
  latitude: 50.0755,
  longitude: 14.4378,
  radius_km: 5,
  filters: {
    property_category: 'apartment',
  },
  limit: 20,
});

// Response:
// {
//   center: { latitude, longitude },
//   radius_km: 5,
//   total: 18,
//   results: GeoSearchResult[], // Includes distance_km
//   pagination: { ... },
//   query_time_ms: 32
// }
```

### Get Property Details

```typescript
import { api } from '@/lib/api';

const response = await api.getProperty('property-id-123');

// Response:
// {
//   property: PropertyResult,
//   similar_properties: PropertyResult[],
//   price_history: [{ date, price }],
//   market_data: { avg_price_per_sqm, median_price_area, price_trend_3m }
// }
```

---

## Backward Compatibility

The old `Property` interface fields are maintained for backward compatibility:

- `address` → computed from `title`
- `area` → alias for `sqm`
- `disposition` → alias for `czech_disposition`
- `floor` → converted from number to string ("3rd", "Ground")
- `coordinates` → computed from `latitude`/`longitude`
- `features` → computed from `has_*` amenity fields
- `pricePerSqm` → computed from `price / sqm`

Components using these fields will continue to work without changes.

---

## Next Steps

1. ✅ **Schema Updated** - Types match backend
2. ✅ **API Client Created** - HTTP client ready
3. ✅ **React Hooks Ready** - `useSearch`, `useGeoSearch`, `useProperty`
4. ⏳ **Update Components** - Replace mock data with API hooks
5. ⏳ **Add Loading States** - Handle `isLoading` and `error`
6. ⏳ **Add Pagination** - Use `pagination` metadata
7. ⏳ **Add Filters UI** - Connect to `SearchFilters`
8. ⏳ **Add Error Handling** - User-friendly error messages

---

## Common Issues

### 1. CORS Errors

If you see CORS errors in the browser console:

```bash
# Add CORS_ORIGIN to search-service .env
CORS_ORIGIN=http://localhost:3000
```

### 2. API Key Required

If you get 401 Unauthorized:

```bash
# Set API key in frontend .env.local
NEXT_PUBLIC_API_KEY=your-api-key-here
```

### 3. Backend Not Running

If API requests fail:

```bash
# Check if search-service is running
docker ps | grep search-service

# Check logs
docker logs search-service
```

---

## Resources

- **Backend API Docs**: `search-service/README.md`
- **Backend Types**: `search-service/src/types/search.ts`
- **Frontend Types**: `landomo-frontend/lib/api/types.ts`
- **Mock Data**: `landomo-frontend/lib/properties-mock.ts`
