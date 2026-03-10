"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Property, getPropertyAddress, getDisposition, formatPrice } from "@/types/property";
import { useSearchContext } from "@/contexts/SearchContext";
import { useLeafletMap } from "@/hooks/useLeafletMap";

interface MapScreenProps {
  onNavigate?: (screen: string) => void;
  onPropertyClick?: (property: Property) => void;
}

export function MapScreen({ onNavigate, onPropertyClick }: MapScreenProps) {
  const { results, isLoading, filterState, searchQuery } = useSearchContext();

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

  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(
    undefined
  );
  const [isCardsExpanded, setIsCardsExpanded] = useState(true);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentDragY, setCurrentDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { mapContainerRef } = useLeafletMap({
    filterState,
    searchQuery,
    onPropertySelect: (property) => {
      setSelectedProperty(property);
      setIsCardsExpanded(true);
    },
    center: [50.0755, 14.4378],
    zoom: 13,
    zoomControl: false,
    attributionControl: false,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - dragStartY;
    setCurrentDragY(deltaY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // If dragged down more than 50px, minimize
    if (currentDragY > 50) {
      setIsCardsExpanded(false);
    }
    // If dragged up more than 50px while minimized, expand
    else if (currentDragY < -50 && !isCardsExpanded) {
      setIsCardsExpanded(true);
    }
    setCurrentDragY(0);
  };

  // Mouse event handlers (same logic as touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartY(e.clientY);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY;
    setCurrentDragY(deltaY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // If dragged down more than 50px, minimize
    if (currentDragY > 50) {
      setIsCardsExpanded(false);
    }
    // If dragged up more than 50px while minimized, expand
    else if (currentDragY < -50 && !isCardsExpanded) {
      setIsCardsExpanded(true);
    }
    setCurrentDragY(0);
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Search Bar and Filter Button */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4">
        <div className="flex gap-2">
          {/* Search Bar */}
          <div
            className="flex flex-1 cursor-pointer items-center gap-2 rounded-full border border-gray-50 bg-white px-5 py-3 shadow-xl transition-transform"
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
            className="relative h-12 w-12 rounded-full border-gray-50 bg-white shadow-xl transition-transform hover:bg-gray-50"
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

      {/* Map Container */}
      <div ref={mapContainerRef} className="z-5 h-full w-full flex-1" />

      {/* Property Cards - Draggable to hide */}
      {isCardsExpanded && (
        <div
          className="absolute bottom-[120px] left-0 right-0 z-20 transition-transform duration-300"
          style={{ transform: `translateY(${isDragging ? Math.max(0, currentDragY) : 0}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="flex gap-3 overflow-x-auto px-4 pt-1 pb-2 no-scrollbar snap-x snap-mandatory">
            {results.map((property) => (
              <div
                key={property.id}
                className="flex min-w-[340px] cursor-pointer gap-4 rounded-[32px] bg-white p-3.5 shadow-lg snap-center"
                onClick={() => {
                  setSelectedProperty(property);
                  if (onPropertyClick) {
                    onPropertyClick(property);
                  } else {
                    onNavigate?.("detail");
                  }
                }}
              >
                <div className="relative h-32 w-32 flex-shrink-0">
                  {property.images?.[0] ? (
                    <img
                      src={property.images[0]}
                      alt={getPropertyAddress(property)}
                      className="h-full w-full rounded-[24px] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-[24px] bg-gray-100 text-gray-300">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="text-[22px] font-extrabold leading-tight text-gray-900">
                    {formatPrice(property.price, property.currency)}{property.transaction_type === 'rent' ? '/mo' : ''}
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-gray-500">
                    {getPropertyAddress(property)}, {property.city}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {property.transaction_type && (
                      <Badge
                        variant="secondary"
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                          property.transaction_type === 'rent'
                            ? 'bg-teal-50 text-teal-700 hover:bg-teal-50'
                            : property.transaction_type === 'auction'
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-50'
                            : 'bg-gray-900 text-white hover:bg-gray-900'
                        }`}
                      >
                        {property.transaction_type === 'rent' ? 'RENT' : property.transaction_type === 'auction' ? 'AUCTION' : 'SALE'}
                      </Badge>
                    )}
                    {getDisposition(property) && (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-100"
                      >
                        {getDisposition(property)}
                      </Badge>
                    )}
                    {property.sqm && (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-100"
                      >
                        {property.sqm} m²
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
