"use client";

import { Heart, Search, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/PropertyCard";
import { Property } from "@/types/property";
import { useSearchContext } from "@/contexts/SearchContext";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";

interface SavedScreenProps {
  onNavigate?: (screen: string) => void;
  onPropertyClick?: (property: Property) => void;
}

export function SavedScreen({ onNavigate, onPropertyClick }: SavedScreenProps) {
  const { results } = useSearchContext();
  const { toggleLike, isLiked, likedProperties } = usePropertyLikes();

  const savedProperties = results.filter(p => likedProperties.has(p.id));

  // Empty State
  if (savedProperties.length === 0) {
    return (
      <div className="relative flex h-full flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-100 bg-white px-5 pb-6 pt-20">
          <h1 className="text-2xl font-black">Saved Properties</h1>
        </div>

        {/* Empty State */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-32">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gray-50 mb-6">
            <Heart className="h-20 w-20 text-gray-300" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">
            No saved properties yet
          </h2>
          <p className="text-center text-sm text-gray-500 mb-8 max-w-sm">
            Start saving properties you love by tapping the heart icon. They'll appear here for easy access.
          </p>
          <button
            onClick={() => onNavigate?.("list")}
            className="flex items-center gap-2 text-base font-bold text-gray-900 transition-colors hover:text-gray-600"
          >
            Browse Properties
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // Listings State (has saved properties)
  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      {/* Top background cover */}
      <div className="absolute left-0 right-0 top-0 h-28 z-20"></div>

      {/* Search Bar and Filter Button */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4 pb-2 bg-white/90 backdrop-blur-md backdrop-saturate-200">
        <div className="flex gap-2">
          {/* Search Bar */}
          <div
            className="flex flex-1 cursor-pointer items-center gap-2 rounded-full border border-gray-50 bg-white px-5 py-3 shadow-sm transition-transform"
            onClick={() => onNavigate?.("search")}
          >
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search saved properties..."
              className="pointer-events-none h-auto border-0 bg-transparent p-0 text-[15px] font-medium text-gray-400 placeholder:text-gray-400 focus-visible:ring-0"
              readOnly
            />
          </div>

          {/* Filter Button */}
          <Button
            variant="outline"
            size="icon"
            className="relative h-12 w-12 rounded-full border-gray-50 bg-white shadow-sm transition-transform hover:bg-gray-50"
            onClick={() => onNavigate?.("filters")}
          >
            <SlidersHorizontal className="h-5 w-5 text-gray-800" />
          </Button>
        </div>
      </div>

      {/* Property Count Row */}
      <div className="relative z-10 px-5 pt-32 bg-white/90 backdrop-blur-md backdrop-saturate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {savedProperties.length} {savedProperties.length === 1 ? "property" : "properties"}
          </h2>
        </div>

        {/* Easing Gradient Overlay - positioned at bottom of this row */}
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{
            height: '40px',
            transform: 'translateY(calc(100% - 1px))',
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.987) 8.1%, rgba(255, 255, 255, 0.951) 15.5%, rgba(255, 255, 255, 0.896) 22.5%, rgba(255, 255, 255, 0.825) 29%, rgba(255, 255, 255, 0.741) 35.3%, rgba(255, 255, 255, 0.648) 41.2%, rgba(255, 255, 255, 0.550) 47.1%, rgba(255, 255, 255, 0.450) 52.9%, rgba(255, 255, 255, 0.352) 58.8%, rgba(255, 255, 255, 0.259) 64.7%, rgba(255, 255, 255, 0.175) 71%, rgba(255, 255, 255, 0.104) 77.5%, rgba(255, 255, 255, 0.049) 84.5%, rgba(255, 255, 255, 0.013) 91.9%, rgba(255, 255, 255, 0) 100%)'
          }}
        />
      </div>

      {/* Scrollable Property List */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {savedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isLiked={isLiked(property.id)}
              onToggleLike={toggleLike}
              onNavigate={onNavigate}
              onClick={() => onPropertyClick?.(property)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
