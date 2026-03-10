# Property Data & Icons Documentation

This directory contains the core data structures and icon references for the Prague Real Estate mobile application.

## Files Overview

### `properties.ts`
Sample property data with 5 properties extracted from the original design. Includes helper functions for filtering and querying properties.

**Usage:**
```tsx
import { sampleProperties, getPropertyById, getFeaturedProperty } from '@/lib/properties';

// Get all properties
const properties = sampleProperties;

// Get a specific property
const property = getPropertyById('1');

// Get the featured property (for map preview)
const featured = getFeaturedProperty();
```

### `icons.ts`
Documentation and constants for all Lucide React icons used in the application. Organized by context (navigation, search, property details, etc.).

**Usage:**
```tsx
import { Search, Heart, Map, SlidersHorizontal } from 'lucide-react';
import { ICON_SIZES } from '@/lib/icons';

// In your component
<Search className={ICON_SIZES.md} />
<Heart className="w-5 h-5 text-red-500" />
```

### `utils.ts`
Utility functions from Shadcn UI, including the `cn()` function for merging Tailwind classes.

**Usage:**
```tsx
import { cn } from '@/lib/utils';

<div className={cn("base-class", isActive && "active-class")} />
```

## Property Data Structure

See `/types/property.ts` for complete TypeScript interfaces.

### Property Interface
```typescript
interface Property {
  id: string;
  price: number;
  pricePerSqm: number;
  address: string;
  city: string;
  disposition: string; // e.g., "3+kk", "2+1"
  area: number; // square meters
  floor: string;
  images: string[];
  description: string;
  features: PropertyFeature[];
  coordinates: PropertyCoordinates;
  featured?: boolean;
}
```

### Sample Properties

1. **Vinohradská 12, Praha 2** - €285,000 (Featured)
   - 3+kk, 78 m², 3rd floor
   - Parking, Balcony
   - Coordinates: 50.0755, 14.4378

2. **Korunní 48, Praha 3** - €195,000
   - 2+kk, 67 m², 2nd floor
   - Parking
   - Coordinates: 50.088, 14.42

3. **Manesova 85, Praha 2** - €420,000
   - 4+kk, 100 m², 5th floor
   - Parking, Balcony, Elevator
   - Coordinates: 50.065, 14.46

4. **Belgická 22, Praha 2** - €310,000
   - 3+1, 80 m², 4th floor
   - Balcony, Elevator
   - Coordinates: 50.1, 14.4

5. **Nitranská 9, Praha 3** - €245,000
   - 2+1, 75 m², Ground floor
   - Parking, Garden
   - Coordinates: 50.082, 14.45

## Lucide Icons Reference

All icons are imported from `lucide-react`. The application uses the following icon categories:

### Navigation (Bottom Bar)
- `map` - Map view
- `list` - List view
- `heart` - Favorites

### Search & Filters
- `search` - Search input
- `sliders-horizontal` - Filters button
- `x-circle` - Clear search
- `arrow-up-down` - Sort
- `map-pin` - Location suggestions

### Property Details
- `layout` - Disposition/rooms
- `maximize` - Area/size
- `parking-circle` - Parking feature
- `snowflake` - Balcony/outdoor
- `tree-deciduous` - Garden
- `move-vertical` - Elevator

### Actions
- `heart` - Favorite/like
- `share` - Share property
- `message-circle` - Contact
- `chevron-left` - Back navigation

### Status Bar
- `signal` - Network signal
- `wifi` - WiFi status
- `battery` - Battery level

## Next Steps for Developers

1. **Map Screen**: Use `sampleProperties` coordinates to render map markers
2. **List Screen**: Display all properties from `sampleProperties` array
3. **Detail Screen**: Use `getPropertyById()` to fetch property details
4. **Filters**: Use property features and dispositions for filter options
5. **Icons**: Import needed icons from `lucide-react` following the patterns in `icons.ts`
