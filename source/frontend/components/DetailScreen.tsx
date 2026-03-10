"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Share,
  Heart,
  MessageCircle,
  ParkingCircle,
  Snowflake,
  TreeDeciduous,
  MoveVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@/types/property";
import { getPropertyAddress, getDisposition, formatPrice, adaptProperty } from "@/types/property";
import { useProperty } from "@/lib/api/hooks";
import { useSearchContext } from "@/contexts/SearchContext";

interface DetailScreenProps {
  propertyId?: string;
  onNavigate?: (screen: string) => void;
}

/**
 * DetailScreen Component
 *
 * Full-screen property detail view with:
 * - Hero image with navigation controls
 * - Property information (price, address, stats)
 * - Description and features
 * - Action buttons (Book view, Message)
 *
 * Based on ORIGINAL_DESIGN.html detail screen
 */
export function DetailScreen({ propertyId, onNavigate }: DetailScreenProps) {
  const { selectedPropertyId, results } = useSearchContext();
  const idToFetch = propertyId || selectedPropertyId;

  // Try to find property in existing search results first (avoids extra API call)
  const cachedProperty = results.find(p => p.id === idToFetch);
  const { property: detailResult, isLoading, error } = useProperty(
    cachedProperty ? null : idToFetch || null,
    'czech'
  );
  const property = cachedProperty || (detailResult ? adaptProperty(detailResult) : null);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="w-8 h-8 border-2 border-[#84CC16] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white gap-3">
        <p className="text-sm font-semibold text-gray-500">
          {error ? 'Failed to load property' : 'Property not found'}
        </p>
        <button onClick={() => onNavigate?.("map")} className="text-sm font-bold text-[#84CC16]">Go back</button>
      </div>
    );
  }

  const formattedPrice = formatPrice(property.price, property.currency);

  const formattedPricePerSqm = property.pricePerSqm
    ? formatPrice(property.pricePerSqm, property.currency)
    : '';

  // Icon mapping for features
  const featureIcons: Record<string, any> = {
    "parking-circle": ParkingCircle,
    snowflake: Snowflake,
    "tree-deciduous": TreeDeciduous,
    "move-vertical": MoveVertical,
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Hero Image Section - 48% height */}
      <div className="relative h-[48%] flex-shrink-0">
        <img
          src={property.images?.[currentImageIndex] ?? ''}
          alt={getPropertyAddress(property)}
          className="h-full w-full object-cover"
        />

        {/* Top Navigation Controls */}
        <div className="absolute left-5 right-5 top-14 z-20 flex justify-between">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl transition-transform hover:bg-black/30"
            onClick={() => onNavigate?.("map")}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl hover:bg-black/30"
            >
              <Share className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl hover:bg-black/30"
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? "fill-white" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Photo Counter Badge */}
        <div className="absolute bottom-14 right-6 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] font-black text-white backdrop-blur-md">
          {currentImageIndex + 1}/{property.images?.length ?? 0}
        </div>
      </div>

      {/* Content Card with overlap */}
      <div className="relative z-10 -mt-12 flex flex-1 flex-col overflow-hidden rounded-t-[48px] bg-white pb-32 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
        {/* Scrollable Content */}
        <div className="no-scrollbar scroll-container flex-1 overflow-y-auto p-8">
          {/* Price and Address */}
          <div className="mb-2 flex items-end justify-between">
            <h1 className="text-[34px] font-black tracking-tight text-gray-900">
              {formattedPrice}
            </h1>
            <span className="mb-3 text-[11px] font-black uppercase tracking-widest text-gray-400">
              {formattedPricePerSqm}/m²
            </span>
          </div>
          <p className="mb-8 font-bold text-gray-500">
            {getPropertyAddress(property)}, {property.city}
          </p>

          {/* Stats Grid - 3 columns */}
          <div className="mb-10 grid grid-cols-3 gap-3">
            {/* Disposition */}
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-5">
              <span className="text-lg font-black text-gray-900">
                {getDisposition(property)}
              </span>
              <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
                Disposition
              </span>
            </div>

            {/* Area */}
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-5">
              <span className="text-lg font-black text-gray-900">
                {property.sqm} m²
              </span>
              <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
                Area
              </span>
            </div>

            {/* Floor */}
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-5">
              <span className="text-lg font-black text-gray-900">
                {property.floor}
              </span>
              <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
                Floor
              </span>
            </div>
          </div>

          {/* Description */}
          <h3 className="mb-4 text-xl font-black">Description</h3>
          <p className="mb-8 text-[15px] font-medium leading-relaxed text-gray-600">
            {property.description}
          </p>

          {/* Features */}
          <h3 className="mb-5 text-xl font-black">Features</h3>
          <div className="mb-24 flex flex-wrap gap-2.5">
            {(property.features ?? []).map((feature) => {
              const IconComponent = featureIcons[feature.icon] || ParkingCircle;
              return (
                <div
                  key={feature.id}
                  className="flex items-center gap-2.5 border border-gray-100 bg-gray-50 px-5 py-3 text-xs font-black"
                >
                  <IconComponent className="h-4.5 w-4.5 text-[#84CC16]" />
                  {feature.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Bottom Actions with Gradient Background */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex gap-4 bg-gradient-to-t from-white via-white/95 to-transparent p-6 pt-16">
          <Button
            className="pointer-events-auto flex-1 rounded-full bg-[#84CC16] py-5 text-lg font-black text-white shadow-xl shadow-lime-100 transition-transform hover:bg-[#6aaa10]"
            onClick={() => {
              // Handle booking view
              console.log("Book view clicked for property:", property.id);
            }}
          >
            Book view
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-gray-100 bg-gray-50 hover:bg-gray-100 active:bg-gray-100"
            onClick={() => {
              // Handle message
              console.log("Message clicked for property:", property.id);
            }}
          >
            <MessageCircle className="h-7 w-7 text-[#84CC16]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
