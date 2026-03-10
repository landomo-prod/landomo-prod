"use client";

import React from "react";
import { Heart, ArrowRight } from "lucide-react";
import { CardGrid } from "@/components/ui/CardGrid";
import { Property } from "@/types/property";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";
import { useSearchContext } from "@/contexts/SearchContext";

type SortOption = "newest" | "price-low" | "price-high" | "area-large" | "area-small";

interface DesktopSavedViewProps {
  onFilterClick: () => void;
  onNavigateToList: () => void;
  onPropertyClick: (property: Property) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  detailPanel?: React.ReactNode;
}

export function DesktopSavedView({
  onFilterClick,
  onNavigateToList,
  onPropertyClick,
  sortBy,
  onSortChange,
  detailPanel,
}: DesktopSavedViewProps) {
  const { toggleLike, isLiked, likedProperties } = usePropertyLikes();
  const { results } = useSearchContext();

  const savedProperties = results.filter(p => likedProperties.has(p.id));

  const sortedProperties = [...savedProperties].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "area-large":
        return (b.sqm ?? 0) - (a.sqm ?? 0);
      case "area-small":
        return (a.sqm ?? 0) - (b.sqm ?? 0);
      case "newest":
      default:
        return 0;
    }
  });

  // Empty State
  if (savedProperties.length === 0) {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white z-10">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 mb-8">
            <Heart className="h-20 w-20 text-gray-300" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-3">
            No saved properties yet
          </h2>
          <p className="text-center text-base text-gray-500 font-bold mb-10 max-w-md">
            Start saving properties you love by clicking the heart icon. They'll appear here for easy access.
          </p>
          <button
            onClick={onNavigateToList}
            className="flex items-center gap-2 px-8 py-4 text-base font-bold text-[#171717] bg-[#84CC16] rounded-full transition-all hover:bg-[#6aaa10]"
          >
            Browse Properties
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // List State
  return (
    <div className="flex-1 flex flex-col">
      {/* Content Area — flex row so grid shrinks as detail panel slides in */}
      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-auto bg-white transition-all duration-300 @container">
          <div className="w-full p-8">
            <CardGrid
              properties={sortedProperties}
              isLiked={isLiked}
              onToggleLike={toggleLike}
              onPropertyClick={onPropertyClick}
            />
          </div>
        </div>
        {detailPanel}
      </div>
    </div>
  );
}
