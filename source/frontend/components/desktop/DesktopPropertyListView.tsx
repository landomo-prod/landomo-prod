"use client";

import React from "react";
import { CardGrid } from "@/components/ui/CardGrid";
import { Property } from "@/types/property";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";

type SortOption = "newest" | "price-low" | "price-high" | "area-large" | "area-small";

interface DesktopPropertyListViewProps {
  properties: Property[];
  onFilterClick: () => void;
  onPropertyClick: (property: Property) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  detailPanel?: React.ReactNode;
}

export function DesktopPropertyListView({
  properties,
  onFilterClick,
  onPropertyClick,
  sortBy,
  onSortChange,
  detailPanel,
}: DesktopPropertyListViewProps) {
  const { toggleLike, isLiked } = usePropertyLikes();

  const sortedProperties = [...properties].sort((a, b) => {
    switch (sortBy) {
      case "price-low":  return a.price - b.price;
      case "price-high": return b.price - a.price;
      case "area-large": return (b.sqm ?? 0) - (a.sqm ?? 0);
      case "area-small": return (a.sqm ?? 0) - (b.sqm ?? 0);
      default:           return 0;
    }
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Content area — flex row so grid shrinks as detail panel slides in */}
      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-y-auto bg-white p-6">
          <CardGrid
            properties={sortedProperties}
            isLiked={isLiked}
            onToggleLike={toggleLike}
            onPropertyClick={onPropertyClick}
          />
        </div>
        {detailPanel}
      </div>
    </div>
  );
}
