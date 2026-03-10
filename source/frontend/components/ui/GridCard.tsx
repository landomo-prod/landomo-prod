"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Heart, Layout, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Property, getPropertyAddress, getDisposition, formatPrice as formatPriceHelper } from "@/types/property";

const MAX_IMAGES = 7;

interface GridCardProps {
  property: Property;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isHovered?: boolean;
  /** Card index in the grid — cards in the first viewport row get priority image loading */
  index?: number;
}

export function GridCard({
  property,
  isLiked,
  onToggleLike,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isHovered,
  index = 0,
}: GridCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

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
      // Retry after a short delay by bumping retry count (forces re-render with new key)
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

  return (
    <a
      href={`/property/${property.id}`}
      className="cursor-pointer transition-opacity hover:opacity-95 block"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Image Carousel */}
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gray-100">
          {images.length > 0 ? (
            images.map((src, idx) =>
              visibleIndices.has(idx) ? (
                <Image
                  key={idx === currentImageIndex ? `${src}-${retryCount}` : src}
                  src={src}
                  alt={idx === currentImageIndex ? `${getPropertyAddress(property)}, ${property.city}` : ""}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={`object-cover transition-opacity duration-150 ${idx === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                  priority={idx === 0 && index < 6}
                  loading={idx === 0 && index < 6 ? undefined : "lazy"}
                  onError={idx === currentImageIndex ? handleImageError : undefined}
                />
              ) : null
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}

          {/* Tap zones */}
          <div className="absolute inset-0 flex">
            {images.length > 1 && (
              <div
                className="w-1/3 cursor-pointer"
                onClick={handlePreviousImage}
              />
            )}
            <div className="flex-1" />
            {images.length > 1 && (
              <div
                className="w-1/3 cursor-pointer"
                onClick={handleNextImage}
              />
            )}
          </div>

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
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

        {/* Heart button */}
        <button
          className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition-colors ${
            isLiked
              ? "border-white/40 bg-white/30 text-red-500"
              : "border-white/20 bg-black/20 text-white"
          } hover:bg-white/30`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(property.id);
          }}
        >
          <Heart className="h-5 w-5" fill={isLiked ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Details */}
      <div className="flex items-start justify-between px-1 pt-3 pb-1">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black text-gray-900 tracking-tight">
            {formatPriceHelper(property.price, property.currency)}
            {property.transaction_type === "rent" ? "/mo" : ""}
          </div>
          <div className="mt-0.5 text-sm font-medium text-gray-500 truncate">
            {getPropertyAddress(property)}, {property.city}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {property.transaction_type && (
              <Badge
                variant="secondary"
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  property.transaction_type === "rent"
                    ? "bg-teal-50 text-teal-700 hover:bg-teal-50"
                    : property.transaction_type === "auction"
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                    : "bg-gray-900 text-white hover:bg-gray-900"
                }`}
              >
                {property.transaction_type === "rent" ? "RENT" : property.transaction_type === "auction" ? "AUCTION" : "SALE"}
              </Badge>
            )}
            {getDisposition(property) && (
              <Badge
                variant="secondary"
                className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-bold hover:bg-gray-50"
              >
                <Layout className="mr-1 h-3 w-3" />
                {getDisposition(property)}
              </Badge>
            )}
            {property.sqm && (
              <Badge
                variant="secondary"
                className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-bold hover:bg-gray-50"
              >
                <Maximize className="mr-1 h-3 w-3" />
                {property.sqm} m²
              </Badge>
            )}
          </div>
        </div>
        {property.pricePerSqm && (
          <div className="ml-2 shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
            {formatPriceHelper(property.pricePerSqm, property.currency)}/m²
          </div>
        )}
      </div>
    </a>
  );
}
