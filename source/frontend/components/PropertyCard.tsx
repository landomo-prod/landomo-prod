"use client";

import { useState, useCallback } from "react";
import { Heart, Layout, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Property, getPropertyAddress, getDisposition, formatPrice as formatPriceHelper } from "@/types/property";

const MAX_IMAGES = 7;

interface PropertyCardProps {
  property: Property;
  isLiked: boolean;
  onToggleLike: (propertyId: string) => void;
  onNavigate?: (screen: string) => void;
  variant?: "mobile" | "desktop-list";
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isHovered?: boolean;
  index?: number;
}

export function PropertyCard({
  property,
  isLiked,
  onToggleLike,
  onNavigate,
  variant = "mobile",
  onClick,
  onMouseEnter,
  onMouseLeave,
  isHovered,
  index = 0,
}: PropertyCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isDesktopList = variant === "desktop-list";

  const images = (property.images ?? []).slice(0, MAX_IMAGES);

  // Initial load: only first image. After interaction: current + neighbors for instant switching.
  const visibleIndices = new Set<number>();
  if (images.length > 0) {
    visibleIndices.add(currentImageIndex);
    if (interacted && images.length > 1) {
      visibleIndices.add((currentImageIndex + 1) % images.length);
      visibleIndices.add((currentImageIndex - 1 + images.length) % images.length);
    }
  }

  const handleImageError = useCallback(() => {
    if (retryCount < 2) {
      setTimeout(() => setRetryCount((c) => c + 1), 1000 * (retryCount + 1));
    } else {
      setImgError(true);
    }
  }, [retryCount]);

  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interacted) setInteracted(true);
    setImgError(false);
    setRetryCount(0);
    setCurrentImageIndex((prev) =>
      prev > 0 ? prev - 1 : images.length - 1
    );
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interacted) setInteracted(true);
    setImgError(false);
    setRetryCount(0);
    setCurrentImageIndex((prev) =>
      prev < images.length - 1 ? prev + 1 : 0
    );
  };

  const handleOpenDetail = () => {
    onClick?.();
    onNavigate?.("detail");
  };

  return (
    <a
      href={`/property/${property.id}`}
      className={`${isDesktopList ? "" : "mb-8"} cursor-pointer hover:opacity-95 transition-opacity block`}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          handleOpenDetail();
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Property Image Carousel */}
      <div className={isDesktopList ? "relative mb-3" : "relative mb-4"}>
        {/* Current Image */}
        <div className={`relative overflow-hidden ${isDesktopList ? "rounded-2xl" : "rounded-3xl"}`}>
          {images.length > 0 ? (
            <div className="relative w-full aspect-[4/3]">
              {images.map((src, idx) =>
                visibleIndices.has(idx) ? (
                  <img
                    key={idx === currentImageIndex ? `${src}-${retryCount}` : src}
                    src={src}
                    alt={idx === currentImageIndex ? `${getPropertyAddress(property)}, ${property.city}` : ""}
                    className={`absolute inset-0 soft-shadow w-full h-full object-cover transition-opacity duration-150 ${idx === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                    loading={idx === 0 && index < 4 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 && index < 4 ? "high" : "auto"}
                    onError={idx === currentImageIndex ? handleImageError : undefined}
                  />
                ) : null
              )}
            </div>
          ) : (
            <div className={`flex w-full items-center justify-center bg-gray-100 aspect-[4/3] text-gray-300`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}

          {/* Tap zones for navigation */}
          <div className="absolute inset-0 flex">
            {/* Left tap zone - Previous image */}
            {images.length > 1 && (
              <div
                className="w-1/3 cursor-pointer"
                onClick={handlePreviousImage}
              />
            )}

            {/* Center tap zone - Open detail */}
            <div className="flex-1 cursor-pointer" onClick={handleOpenDetail} />

            {/* Right tap zone - Next image */}
            {images.length > 1 && (
              <div className="w-1/3 cursor-pointer" onClick={handleNextImage} />
            )}
          </div>

          {/* Image Counter */}
          {images.length > 1 && (
            <div className={`absolute rounded-full bg-black/50 px-3 py-1 text-xs font-black text-white backdrop-blur-md pointer-events-none ${isDesktopList ? "bottom-3 right-3" : "bottom-4 right-4"}`}>
              {currentImageIndex + 1}/{images.length}
            </div>
          )}

          {/* Dot Indicators */}
          {images.length > 1 && (
            <div className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none ${isDesktopList ? "bottom-3" : "bottom-4"}`}>
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentImageIndex
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Heart Button */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute ${isDesktopList ? "right-3 top-3 h-10 w-10" : "right-5 top-5 h-12 w-12"} rounded-full border backdrop-blur-xl ${
            isLiked
              ? "border-white/40 bg-white/30 text-red-500"
              : "border-white/20 bg-white/20 text-white"
          } hover:bg-white/30`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(property.id);
          }}
        >
          <Heart className={isDesktopList ? "h-5 w-5" : "h-7 w-7"} fill={isLiked ? "currentColor" : "none"} />
        </Button>
      </div>

      {/* Property Details */}
      <div className={`flex items-start justify-between ${isDesktopList ? "px-2" : "px-1"}`}>
        <div>
          <div className={isDesktopList ? "text-2xl font-black text-gray-900 tracking-tight" : "text-3xl font-black text-gray-900 tracking-tight"}>
            {formatPriceHelper(property.price, property.currency)}{property.transaction_type === 'rent' ? '/mo' : ''}
          </div>
          <div className={`mt-1 ${isDesktopList ? "text-xs" : "text-sm"} font-medium text-gray-500`}>
            {getPropertyAddress(property)}, {property.city}
          </div>
          <div className={`${isDesktopList ? "mt-2" : "mt-3"} flex items-center gap-2 text-gray-500`}>
            {property.transaction_type && (
              <Badge
                variant="secondary"
                className={`flex items-center gap-1.5 rounded-full ${isDesktopList ? "px-2.5 py-1" : "px-3 py-1.5"} text-xs font-bold ${
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
                className={`flex items-center gap-1.5 rounded-full bg-gray-50 ${isDesktopList ? "px-2.5 py-1" : "px-3 py-1.5"} text-xs font-bold hover:bg-gray-50`}
              >
                <Layout className={`mr-1 ${isDesktopList ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
                {getDisposition(property)}
              </Badge>
            )}
            {property.sqm && (
              <Badge
                variant="secondary"
                className={`flex items-center gap-1.5 rounded-full bg-gray-50 ${isDesktopList ? "px-2.5 py-1" : "px-3 py-1.5"} text-xs font-bold hover:bg-gray-50`}
              >
                <Maximize className={`mr-1 ${isDesktopList ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
                {property.sqm} m²
              </Badge>
            )}
          </div>
        </div>
        {/* Price per sqm */}
        {property.pricePerSqm && (
          <div className={`rounded-full border border-gray-200 bg-gray-50 ${isDesktopList ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-[11px]"} font-bold uppercase tracking-wider text-gray-600`}>
            {formatPriceHelper(property.pricePerSqm, property.currency)}/m²
          </div>
        )}
      </div>
    </a>
  );
}
