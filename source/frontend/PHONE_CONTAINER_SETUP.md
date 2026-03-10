# Phone Container Setup Documentation

## Overview
This document describes the phone container layout structure created to mimic an iPhone device mockup for the Landomo mobile real estate application.

## Components Created

### 1. PhoneContainer (`/components/PhoneContainer.tsx`)
Main container component that wraps all screen content.

**Specifications:**
- Dimensions: 393x852px (max-width) - iPhone 14 Pro size
- Border radius: 32px (rounded-[32px])
- Background: var(--bg-card) - white
- Shadow: 0 30px 80px rgba(15,23,42,0.35)
- Overflow: hidden

**Features:**
- Screen state management (map, list, saved)
- Integrates StatusBar, DynamicIsland, and NavigationBar
- Centered on page with responsive padding
- Client component for interactivity

**Props:**
```typescript
interface PhoneContainerProps {
  children?: ReactNode;
  initialScreen?: Screen;  // Default: "map"
  onScreenChange?: (screen: Screen) => void;
}
```

**Usage:**
```tsx
<PhoneContainer initialScreen="map">
  {/* Your screen content here */}
</PhoneContainer>
```

### 2. StatusBar (`/components/StatusBar.tsx`)
iOS-style status bar at the top of the device.

**Specifications:**
- Height: 59px
- Displays: Time (9:41), Signal, WiFi, Battery icons
- Background: white
- Padding: 0 24px (px-6)
- Font: 15px, semibold

**Icons:**
- Uses Lucide React icons
- Size: 16px (Signal, WiFi), 20px (Battery)
- Stroke width: 2.5

### 3. DynamicIsland (`/components/DynamicIsland.tsx`)
Black pill-shaped element mimicking iPhone's Dynamic Island.

**Specifications:**
- Width: 120px
- Height: 34px
- Border radius: 17px (rounded-[17px])
- Background: black
- Position: Absolute, centered at top
- Top offset: 12px (top-3)

### 4. NavigationBar (`/components/NavigationBar.tsx`)
Bottom navigation bar with three tabs (Map, List, Saved).

**Specifications:**
- Width: 178px (per design audit)
- Height: 64px (h-16)
- Border radius: 100px (rounded-full)
- Background: white
- Shadow: 0 4px 30px rgba(0,0,0,0.09)
- Padding: 0 12px (px-3)
- Gap: space-between

**Tab Specifications:**
- Individual tab size: 44x44px (h-11 w-11)
- Icon size: 22px
- Icon stroke width: 2
- Label font: 11px
- Active state: font-semibold (600), blue color
- Inactive state: font-medium (500), secondary color

**Tabs:**
1. Map - Map icon
2. List - List icon
3. Saved - Heart icon

**Props:**
```typescript
interface NavigationBarProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

type Screen = "map" | "list" | "saved";
```

### 5. PlaceholderScreen (`/components/PlaceholderScreen.tsx`)
Simple placeholder component for screen content during development.

**Props:**
```typescript
interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
}
```

## Design System

### CSS Variables (from globals.css)
```css
/* Color Tokens */
--accent-blue: #007AFF;
--accent-green: #34C759;
--accent-red: #FF3B30;
--bg-primary: #FFFFFF;
--bg-secondary: #F5F5F7;
--bg-card: #FFFFFF;
--bg-map: #E8E4DF;
--text-primary: #1D1D1F;
--text-secondary: #86868B;
--text-tertiary: #AEAEB2;
--pill-bg: #1D1D1F;
--pill-selected-bg: #007AFF;
--pill-text: #FFFFFF;
--border-light: #E5E5EA;
--border-separator: #C6C6C8;
```

### Typography
- Font family: Inter (weights: 400, 500, 600, 700)
- Loaded via Next.js font optimization
- Variable: --font-inter

### Background Gradient
```css
background: linear-gradient(135deg, #e5f1ff 0%, #f5f5f7 50%, #f9fafb 100%);
```

## Layout Structure

```
PhoneContainer (393x852px, rounded-[32px])
├── StatusBar (59px height)
│   ├── Time (9:41)
│   └── Icons (Signal, WiFi, Battery)
├── DynamicIsland (120x34px, centered)
├── Main Content Area (flex-1)
│   └── {children} - Screen components go here
└── NavigationBar (178x64px, floating at bottom)
    ├── Map tab
    ├── List tab
    └── Saved tab
```

## Screen Management

The PhoneContainer manages screen state internally:
- Uses React useState hook
- Default screen: "map"
- Screens: "map" | "list" | "saved"
- Calls optional onScreenChange callback when screen changes
- NavigationBar reflects and controls active screen

## Integration Example

```tsx
// app/page.tsx
import { PhoneContainer } from "@/components/PhoneContainer";
import { MapScreen } from "@/components/MapScreen";

export default function Home() {
  return (
    <PhoneContainer initialScreen="map">
      <MapScreen />
    </PhoneContainer>
  );
}
```

## Next Steps

1. **Create Screen Components:**
   - MapScreen (Task #4)
   - ListScreen (Task #5)
   - DetailScreen (Task #6)
   - SearchScreen (Task #7)
   - FiltersScreen (Task #7)

2. **Implement Screen Routing:**
   - Connect NavigationBar to actual screen components
   - Add transition animations between screens
   - Handle deep linking and URL state

3. **Add Interactivity:**
   - Screen transitions
   - Gesture support (swipe, etc.)
   - State persistence

## Design Audit Compliance

Based on DESIGN_AUDIT_REPORT.md, this implementation addresses:
- ✅ Correct NavigationBar width (178px vs previous 220px)
- ✅ Tab labels included (Map, List, Saved)
- ✅ Correct icon sizing (22px)
- ✅ Proper font weights (semibold for active, medium for inactive)
- ✅ StatusBar with proper height and icons
- ✅ DynamicIsland with correct dimensions
- ✅ Phone container with rounded corners and shadow

## File Locations

All components are in `/components/`:
- `/components/PhoneContainer.tsx` - Main container
- `/components/StatusBar.tsx` - Top status bar
- `/components/DynamicIsland.tsx` - Dynamic Island
- `/components/NavigationBar.tsx` - Bottom navigation
- `/components/PlaceholderScreen.tsx` - Temporary placeholder

Layout files:
- `/app/layout.tsx` - Root layout with Inter font
- `/app/page.tsx` - Home page using PhoneContainer
- `/app/globals.css` - Global styles and design tokens
