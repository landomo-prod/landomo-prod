"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  Share,
  Heart,
  MessageCircle,
  ParkingCircle,
  Snowflake,
  MoveVertical,
  TreeDeciduous,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Home,
  Zap,
  Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Property, getPropertyAddress, getDisposition, getFloorDisplay, formatPrice, formatArea, adaptProperty } from "@/types/property";
import { useProperty } from "@/lib/api/hooks";
import { useSearchContext } from "@/contexts/SearchContext";
import { PortalSpecificSection } from "@/components/detail/PortalSpecificSection";
import { CategoryDetail } from "@/components/detail/CategoryDetail";
import { PriceHistoryChart } from "@/components/detail/PriceHistoryChart";

// Icon mapping for features
const iconMap: Record<string, any> = {
  "parking-circle": ParkingCircle,
  snowflake: Snowflake,
  "move-vertical": MoveVertical,
  "tree-deciduous": TreeDeciduous,
  warehouse: ParkingCircle, // fallback
  waves: Snowflake, // fallback
  sun: Snowflake, // fallback
  box: ParkingCircle, // fallback
};

interface DetailScreenProps {
  onNavigate?: (screen: string) => void;
  propertyId?: string;
}

export function DetailScreen({ onNavigate, propertyId }: DetailScreenProps) {
  const { selectedPropertyId, results } = useSearchContext();
  const idToFetch = propertyId || selectedPropertyId;

  // Try to find property in existing search results first (for instant display)
  const cachedProperty = results.find(p => p.id === idToFetch);
  // Always fetch full detail (includes agent, category-specific fields not in search results)
  const { property: detailResult, isLoading: detailLoading } = useProperty(
    idToFetch || null,
    'czech'
  );
  // Merge: use full detail when available, fall back to cached search result
  const property = detailResult
    ? adaptProperty(detailResult)
    : cachedProperty || null;
  const [isLiked, setIsLiked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="w-8 h-8 border-2 border-[#84CC16] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white gap-3">
        <p className="text-sm font-semibold text-gray-500">Property not found</p>
        <button onClick={() => onNavigate?.("map")} className="text-sm font-bold text-[#84CC16]">Go back</button>
      </div>
    );
  }

  const images = property.images ?? [];
  const totalImages = images.length;

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined") return;
      if (!mapContainerRef.current) return;
      if (mapRef.current) return; // Already initialized

      // Use global L from CDN (loaded in layout.tsx)
      await new Promise<void>((r) => { const iv = setInterval(() => { if ((window as any).L) { clearInterval(iv); r(); } }, 50); });
      const L = (window as any).L;

      // Check again after async import
      if (mapRef.current) return;

      // Initialize map centered on property
      if (!property.coordinates) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView([property.coordinates.lat, property.coordinates.lng], 15);

      // Add same tile layer as MapScreen
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "",
        }
      ).addTo(map);

      // Add a single marker for this property
      const icon = L.divIcon({
        className: "custom-marker-icon",
        html: `
          <div class="detail-marker">
            <div class="marker-pin"></div>
          </div>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });

      L.marker([property.coordinates.lat, property.coordinates.lng], { icon }).addTo(map);

      mapRef.current = map;

      // Add custom styles for marker
      const style = document.createElement("style");
      style.textContent = `
        .detail-marker {
          position: relative;
          width: 30px;
          height: 40px;
        }
        .marker-pin {
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          background: #84CC16;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -20px 0 0 -15px;
          box-shadow: 0 4px 12px rgba(107, 70, 193, 0.4);
        }
        .marker-pin::after {
          content: '';
          width: 16px;
          height: 16px;
          margin: 7px 0 0 7px;
          background: #fff;
          position: absolute;
          border-radius: 50%;
        }
      `;
      document.head.appendChild(style);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [property.coordinates?.lat, property.coordinates?.lng]);

  return (
    <div className="relative h-full w-full bg-white">
      {/* Fixed Top Navigation Buttons - Always Visible */}
      <div className="fixed left-0 right-0 top-14 z-50 flex justify-between px-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl transition-transform hover:bg-black/30"
          onClick={() => onNavigate?.("map")}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

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
            onClick={() => setIsLiked(!isLiked)}
          >
            <Heart
              className="h-6 w-6"
              fill={isLiked ? "currentColor" : "none"}
            />
          </Button>
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="no-scrollbar h-full overflow-y-auto bg-white">
        {/* Hero Image Section - 4:3 Aspect Ratio with Carousel */}
        <div className="relative w-full aspect-[4/3]">
          <img
            src={property.images?.[currentImageIndex]}
            alt={`${getPropertyAddress(property)}, ${property.city}`}
            className="h-full w-full object-cover"
          />

          {/* Tap zones for navigation */}
          {totalImages > 1 && (
            <div className="absolute inset-0 flex">
              {/* Left tap zone - Previous image */}
              <div
                className="w-1/3 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev > 0 ? prev - 1 : totalImages - 1
                  );
                }}
              />

              {/* Center tap zone - No action (allow scrolling) */}
              <div className="flex-1" />

              {/* Right tap zone - Next image */}
              <div
                className="w-1/3 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev < totalImages - 1 ? prev + 1 : 0
                  );
                }}
              />
            </div>
          )}

          {/* Image Counter */}
          {totalImages > 1 && (
            <div className="absolute bottom-6 right-6 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] font-black text-white backdrop-blur-md pointer-events-none">
              {currentImageIndex + 1}/{totalImages}
            </div>
          )}

          {/* Dot Indicators */}
          {totalImages > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
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

        {/* Content Section */}
        <div className="relative z-10 bg-white px-5 pb-16">
          {/* Price and Address */}
          <div className="pt-6 pb-8">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl font-black text-gray-900">
                {formatPrice(property.price, property.currency)}
              </h1>
              {property.pricePerSqm && (
                <div className="rounded-full border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {formatPrice(property.pricePerSqm, property.currency)}/m²
                </div>
              )}
            </div>
            <p className="text-[15px] font-semibold text-gray-500">
              {getPropertyAddress(property)}{property.neighbourhood ? `, ${property.neighbourhood}` : ''}{property.district ? `, ${property.district}` : ''}, {property.city}
            </p>
          </div>

          {/* Stats Grid - 3 columns */}
          <div className="mb-8 grid grid-cols-3 gap-3">
            {getDisposition(property) && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">
                  {getDisposition(property)}
                </span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Disposition
                </span>
              </div>
            )}
            {property.sqm && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">
                  {property.sqm} m²
                </span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Area
                </span>
              </div>
            )}
            {property.floor !== undefined && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">
                  {getFloorDisplay(property.floor)}
                </span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Floor
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <h3 className="mb-4 text-base font-black">Description</h3>
          <p className="mb-8 text-sm font-medium leading-relaxed text-gray-600">
            {property.description}
          </p>

          {/* Category-Specific Details */}
          <CategoryDetail property={property} />

          {/* Price History Chart */}
          <PriceHistoryChart propertyId={property.id} country="czech" />

          {/* Features */}
          {property.features && property.features.length > 0 && (
            <>
              <h3 className="mb-4 text-base font-black">Features</h3>
              <div className="mb-8 flex flex-wrap gap-2.5">
                {property.features.map((feature) => {
                  const IconComponent = iconMap[feature.icon] || ParkingCircle;
                  return (
                    <div
                      key={feature.id}
                      className="flex items-center gap-2 border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-bold rounded-2xl"
                    >
                      <IconComponent className="h-4 w-4 text-[#84CC16]" />
                      {feature.name}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Location & Map */}
          {property.coordinates && (
            <>
              <h3 className="mb-4 text-base font-black">Location</h3>
              <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100">
                {/* Map using Leaflet with CartoCD tiles (same as MapScreen) */}
                <div ref={mapContainerRef} className="h-64 w-full bg-gray-100" />
              </div>
              <div className="mb-10 flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <MapPin className="h-5 w-5 text-[#84CC16] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{getPropertyAddress(property)}</p>
                  <p className="text-sm font-medium text-gray-500">{property.city}</p>
                </div>
              </div>
            </>
          )}


          {/* Portal-Specific Section */}
          <PortalSpecificSection
            portal={property.portal}
            portalMetadata={property.portal_metadata}
            sourceUrl={property.source_url}
          />

          {/* Costs */}
          {(property.deposit || property.commission_note || property.uk_epc_rating) && (
            <>
              <h3 className="mb-4 text-base font-black">Costs</h3>
            <div className="mb-8 space-y-3">
              {property.deposit != null && property.deposit > 0 && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Euro className="h-5 w-5 text-[#84CC16]" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400">Deposit</p>
                      <p className="text-sm font-bold text-gray-900">{formatPrice(property.deposit, property.currency)}</p>
                    </div>
                  </div>
                </div>
              )}
              {property.commission_note && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">Commission</p>
                  <p className="text-sm font-bold text-gray-900">{property.commission_note}</p>
                </div>
              )}
              {property.uk_epc_rating && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <Zap className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400">EPC Rating</p>
                      <p className="text-sm font-bold text-gray-900">{property.uk_epc_rating}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

          {/* Agent Contact & Source */}
          {(property.agent || property.source_url) && (
            <>
              <h3 className="mb-4 text-base font-black">Contact & Source</h3>
              <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
              {property.agent && (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {property.agent.name
                        ? property.agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                        : '?'}
                    </div>
                    <div>
                      {property.agent.name && (
                        <h4 className="text-base font-black text-gray-900">{property.agent.name}</h4>
                      )}
                      <p className="text-xs font-bold text-gray-500">Real Estate Agent</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {property.agent.phone && (
                      <a
                        href={`tel:${property.agent.phone}`}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <Phone className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-bold text-gray-900">{property.agent.phone}</span>
                      </a>
                    )}
                    {property.agent.email && (
                      <a
                        href={`mailto:${property.agent.email}`}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <Mail className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-bold text-gray-900 truncate">{property.agent.email}</span>
                      </a>
                    )}
                  </div>
                </>
              )}
              {property.source_url && (
                <a
                  href={property.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-bold text-gray-900"
                >
                  View on {property.portal || 'source portal'}
                </a>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Fixed Bottom Action Buttons - Always Visible */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex gap-4 bg-gradient-to-t from-white via-white/95 to-transparent p-6 pt-16">
        <Button
          className="pointer-events-auto flex-1 rounded-full bg-[#84CC16] py-6 text-xl font-black text-white shadow-xl shadow-lime-100 transition-transform hover:bg-[#6aaa10]"
        >
          Book view
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="pointer-events-auto h-14 w-14 rounded-full border-gray-100 bg-gray-50 hover:bg-gray-100 active:bg-gray-100"
        >
          <MessageCircle className="h-7 w-7 text-[#84CC16]" />
        </Button>
      </div>
    </div>
  );
}
