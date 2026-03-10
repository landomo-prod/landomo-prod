"use client";

import { useState } from "react";
import { PropertyAlert } from "@/types/property";
import { PropertyCard } from "@/components/PropertyCard";
import { useSearchContext } from "@/contexts/SearchContext";

interface PropertyAlertsViewProps {
  alerts: PropertyAlert[];
  onNavigate?: (screen: string) => void;
  onEditAlert: (alertId: string) => void;
  onMuteAlert: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
  gridClassName?: string;
  onPropertyClick?: (propertyId: string) => void;
}

export function PropertyAlertsView({
  alerts,
  onNavigate,
  onEditAlert,
  onMuteAlert,
  onDeleteAlert,
  gridClassName = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8",
  onPropertyClick,
}: PropertyAlertsViewProps) {
  const { results } = useSearchContext();
  const [likedProperties, setLikedProperties] = useState<Set<string>>(new Set());

  const toggleLike = (propertyId: string) => {
    setLikedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  // Get properties that have alerts
  const propertiesWithAlerts = alerts
    .filter((alert) => alert.propertyId)
    .map((alert) => {
      const property = results.find((p) => p.id === alert.propertyId);
      return { alert, property };
    })
    .filter((item) => item.property);

  return (
    <div className={gridClassName}>
      {propertiesWithAlerts.map(({ alert, property }) => {
        if (!property) return null;

        return (
          <PropertyCard
            key={alert.id}
            property={property}
            isLiked={likedProperties.has(property.id)}
            onToggleLike={toggleLike}
            onNavigate={onNavigate}
            onClick={onPropertyClick ? () => onPropertyClick(property.id) : undefined}
          />
        );
      })}
    </div>
  );
}
