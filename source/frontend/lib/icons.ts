/**
 * Lucide Icon Integration
 *
 * This file documents and exports all Lucide React icons used in the application.
 * Icons are organized by their usage context for easy reference.
 *
 * Import icons from 'lucide-react' as needed:
 * ```tsx
 * import { Search, Heart, Map } from 'lucide-react';
 * ```
 */

/**
 * NAVIGATION ICONS
 * Used in the bottom navigation bar and screen transitions
 */
export const NAVIGATION_ICONS = {
  map: "map",
  list: "list",
  heart: "heart",
  chevronLeft: "chevron-left",
} as const;

/**
 * STATUS BAR ICONS
 * Used in the iOS-style status bar at the top
 */
export const STATUS_BAR_ICONS = {
  signal: "signal",
  wifi: "wifi",
  battery: "battery",
} as const;

/**
 * SEARCH & FILTER ICONS
 * Used in search inputs and filter controls
 */
export const SEARCH_FILTER_ICONS = {
  search: "search",
  slidersHorizontal: "sliders-horizontal",
  xCircle: "x-circle",
  x: "x",
  arrowUpDown: "arrow-up-down",
  mapPin: "map-pin",
} as const;

/**
 * PROPERTY DETAIL ICONS
 * Used to display property information and features
 */
export const PROPERTY_DETAIL_ICONS = {
  layout: "layout", // Disposition/rooms
  maximize: "maximize", // Area/size
  parkingCircle: "parking-circle",
  snowflake: "snowflake", // Balcony/outdoor space
  treeDeciduous: "tree-deciduous", // Garden
  moveVertical: "move-vertical", // Elevator
} as const;

/**
 * ACTION ICONS
 * Used for interactive buttons and actions
 */
export const ACTION_ICONS = {
  heart: "heart", // Favorite/like
  share: "share",
  messageCircle: "message-circle",
} as const;

/**
 * ALL ICONS
 * Complete list of all Lucide icons used in the application
 */
export const ALL_APP_ICONS = {
  // Navigation
  map: "map",
  list: "list",
  heart: "heart",
  chevronLeft: "chevron-left",

  // Status Bar
  signal: "signal",
  wifi: "wifi",
  battery: "battery",

  // Search & Filters
  search: "search",
  slidersHorizontal: "sliders-horizontal",
  xCircle: "x-circle",
  x: "x",
  arrowUpDown: "arrow-up-down",
  mapPin: "map-pin",

  // Property Details
  layout: "layout",
  maximize: "maximize",
  parkingCircle: "parking-circle",
  snowflake: "snowflake",
  treeDeciduous: "tree-deciduous",
  moveVertical: "move-vertical",

  // Actions
  share: "share",
  messageCircle: "message-circle",
} as const;

/**
 * Icon size presets matching the original design
 */
export const ICON_SIZES = {
  xs: "w-3.5 h-3.5", // 14px
  sm: "w-4 h-4", // 16px
  md: "w-5 h-5", // 20px
  lg: "w-6 h-6", // 24px
  xl: "w-7 h-7", // 28px
  "2xl": "w-8 h-8", // 32px
} as const;

/**
 * Helper type for icon names
 */
export type AppIconName = keyof typeof ALL_APP_ICONS;

/**
 * Usage Examples:
 *
 * ```tsx
 * import { Search, Heart, Map } from 'lucide-react';
 * import { ICON_SIZES } from '@/lib/icons';
 *
 * // In a component:
 * <Search className={ICON_SIZES.md} />
 * <Heart className="w-5 h-5 text-red-500" />
 * <Map className="w-8 h-8" />
 * ```
 */
