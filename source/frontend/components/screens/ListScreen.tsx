"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/PropertyCard";
import { Property } from "@/types/property";
import { useSearchContext } from "@/contexts/SearchContext";


interface ListScreenProps {
  onNavigate?: (screen: string) => void;
  onPropertyClick?: (property: Property) => void;
}

type SortOption = "newest" | "price-low" | "price-high" | "area-large" | "area-small";

export function ListScreen({ onNavigate, onPropertyClick }: ListScreenProps) {
  const { allResults: results, total, isLoading, hasNextPage, page, setPage, sortBy, setSortBy, filterState } = useSearchContext();

  const activeFilterCount = (() => {
    let count = 0;
    if (filterState.selectedType) count++;
    if (filterState.selectedCategory) count++;
    if (filterState.selectedSubCategory) count++;
    if (filterState.selectedDispositions.length > 0) count++;
    if (filterState.minPrice > 0 || filterState.maxPrice < 50000000) count++;
    if (filterState.selectedEnergyRatings.length > 0) count++;
    if (filterState.minArea > 0 || filterState.maxArea < 500) count++;
    if (filterState.selectedFloors.length > 0) count++;
    if (filterState.selectedConditions.length > 0) count++;
    if (filterState.selectedFeatures.length > 0) count++;
    if (filterState.selectedFurnished && filterState.selectedFurnished !== 'any') count++;
    if (filterState.selectedOwnership) count++;
    if (filterState.selectedConstructionTypes.length > 0) count++;
    if (filterState.selectedYearBuiltMin > 0 || filterState.selectedYearBuiltMax > 0) count++;
    if (filterState.selectedPlotAreaMin > 0 || filterState.selectedPlotAreaMax > 0) count++;
    return count;
  })();
  const [likedProperties, setLikedProperties] = useState<Set<string>>(
    new Set()
  );
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (!isLoading && hasNextPage) {
      setPage(page + 1);
    }
  }, [isLoading, hasNextPage, page, setPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

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

  const sortOptions = [
    { id: "newest" as SortOption, label: "Newest first" },
    { id: "price-low" as SortOption, label: "Lowest price first" },
    { id: "price-high" as SortOption, label: "Highest price first" },
    { id: "area-large" as SortOption, label: "Largest first" },
    { id: "area-small" as SortOption, label: "Smallest first" },
  ];

  const handleSortSelect = (option: SortOption) => {
    setSortBy(option);
    setShowSortMenu(false);
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-white">
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
              placeholder="Search address, city..."
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
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-black text-white ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Sort Button Row */}
      <div className="relative z-10 px-5 pt-32 bg-white/90 backdrop-blur-md backdrop-saturate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {total.toLocaleString()} properties
          </h2>
          <button
            onClick={() => setShowSortMenu(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-600 transition-colors hover:text-gray-900 cursor-pointer"
          >
            Sort <ArrowUpDown className="h-4 w-4" />
          </button>
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
      <div className="no-scrollbar scroll-container flex-1 overflow-y-auto px-5 pb-24 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {results.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              isLiked={likedProperties.has(property.id)}
              onToggleLike={toggleLike}
              onNavigate={onNavigate}
              onClick={() => onPropertyClick?.(property)}
              index={index}
            />
          ))}
        </div>

        {/* Infinite Scroll Loading Animation */}
        {hasNextPage && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-4"
            ref={sentinelRef}
          >
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[#84CC16] border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-bold text-gray-400">Loading more properties...</p>
          </div>
        )}
        {!hasNextPage && results.length > 0 && (
          <p className="text-center text-sm font-bold text-gray-400 py-8">All properties loaded</p>
        )}
      </div>

      {/* Sort Menu Modal */}
      {showSortMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
            onClick={() => setShowSortMenu(false)}
          />

          {/* Sort Options Dropdown */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white rounded-b-[32px] shadow-2xl">
            <div className="px-5 pt-20 pb-6">
              {/* Header with Title and Close Button */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black">Sort by</h3>
                <button
                  onClick={() => setShowSortMenu(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-800" />
                </button>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSortSelect(option.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                      sortBy === option.id
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
