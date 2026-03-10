import { PropertyAlert, NotificationHistoryItem } from "@/types/property";

/**
 * Sample Alert Data
 *
 * Mock data for testing the notification/alert system.
 */

export const sampleAlerts: PropertyAlert[] = [
  {
    id: "1",
    type: "price_drop",
    propertyId: "1",
    priceThreshold: 270000,
    frequency: "instant",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-15T10:00:00Z",
    triggerCount: 2,
  },
  {
    id: "2",
    type: "price_drop",
    propertyId: "2",
    priceThreshold: 320000,
    frequency: "instant",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-14T08:00:00Z",
    triggerCount: 1,
  },
  {
    id: "3",
    type: "property_update",
    propertyId: "3",
    frequency: "daily",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-13T16:30:00Z",
    triggerCount: 0,
  },
  {
    id: "4",
    type: "price_drop",
    propertyId: "4",
    priceThreshold: 400000,
    frequency: "instant",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-12T11:45:00Z",
    triggerCount: 3,
  },
  {
    id: "5",
    type: "new_listing",
    searchCriteria: {
      price_min: 200000,
      price_max: 300000,
      property_type: "3+kk",
      city: "Praha 2",
    },
    frequency: "daily",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-10T14:30:00Z",
    triggerCount: 5,
  },
  {
    id: "6",
    type: "location_based",
    locationRadius: 500,
    centerCoordinates: {
      lat: 50.0755,
      lng: 14.4378,
    },
    searchCriteria: {
      price_min: 250000,
      price_max: 350000,
      property_type: "2+kk",
    },
    frequency: "weekly",
    channels: ["in_app"],
    active: true,
    muted: false,
    createdAt: "2024-01-05T09:15:00Z",
    triggerCount: 1,
  },
];

export const sampleNotificationHistory: NotificationHistoryItem[] = [
  {
    id: "1",
    alertId: "1",
    type: "price_change",
    title: "Price reduced",
    message: "Apartment at Vinohradská dropped by 250k Kč",
    timestamp: "2024-01-20T14:30:00Z",
    unread: true,
    propertyId: "1",
    metadata: {
      oldPrice: 285000,
      newPrice: 275000,
      changeAmount: -10000,
      changePercent: -3.5,
    },
  },
  {
    id: "2",
    alertId: "2",
    type: "new_property",
    title: "New property in Praha 2",
    message: "3+kk apartment matching your criteria",
    timestamp: "2024-01-19T10:15:00Z",
    unread: true,
    propertyId: "2",
  },
  {
    id: "3",
    alertId: "2",
    type: "saved_search",
    title: "Saved search alert",
    message: "5 new properties in Praha 2 - Žižkov",
    timestamp: "2024-01-18T08:00:00Z",
    unread: false,
  },
  {
    id: "4",
    alertId: "3",
    type: "new_property",
    title: "New property nearby",
    message: "2+kk within 500m of your saved location",
    timestamp: "2024-01-17T16:45:00Z",
    unread: false,
    propertyId: "3",
  },
];

/**
 * Get alert by ID
 */
export function getAlertById(id: string): PropertyAlert | undefined {
  return sampleAlerts.find((alert) => alert.id === id);
}

/**
 * Get property name/address for alert display
 */
export function getAlertDisplayName(alert: PropertyAlert): string {
  if (alert.type === "price_drop" && alert.propertyId) {
    // In real app, would fetch property data
    return "Vinohradská 12, Praha 2";
  }

  if (alert.type === "new_listing" && alert.searchCriteria) {
    const { city, property_type, price_min, price_max } = alert.searchCriteria;
    const dispText = property_type || "Any";
    const fmt = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M Kč` : `${Math.round(v / 1000)}k Kč`;
    const priceText =
      price_min && price_max
        ? `${fmt(price_min)}-${fmt(price_max)}`
        : price_min
        ? `from ${fmt(price_min)}`
        : price_max
        ? `up to ${fmt(price_max)}`
        : "Any price";

    return `${dispText} in ${city || "Any area"}, ${priceText}`;
  }

  if (alert.type === "location_based") {
    return `Within ${alert.locationRadius}m radius`;
  }

  return "Alert";
}

/**
 * Get alert type display name
 */
export function getAlertTypeName(type: PropertyAlert["type"]): string {
  const typeNames: Record<PropertyAlert["type"], string> = {
    price_drop: "Price Alert",
    new_listing: "New Listing Alert",
    property_update: "Property Updates",
    location_based: "Location Alert",
  };

  return typeNames[type];
}

/**
 * Format alert frequency for display
 */
export function formatFrequency(frequency: PropertyAlert["frequency"]): string {
  const frequencyMap: Record<PropertyAlert["frequency"], string> = {
    instant: "Instant",
    daily: "Daily Digest",
    weekly: "Weekly Digest",
  };

  return frequencyMap[frequency];
}
