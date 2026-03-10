"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Share2,
  MessageSquare,
  MessageCircle,
  CheckCircle2,
  ExternalLink,
  Phone,
  Mail,
} from "lucide-react";
import { Property, getPropertyAddress, getDisposition, formatPrice, isPriceOnRequest, getCategoryDisplayName, getTransactionDisplayName, adaptProperty } from "@/types/property";
import { useProperty } from "@/lib/api/hooks";
import { Lightbox } from "@/components/Lightbox";
import { PropertyCardCompact } from "@/components/desktop/PropertyCardCompact";
import { PortalSpecificSection } from "@/components/detail/PortalSpecificSection";
import { CategoryDetail } from "@/components/detail/CategoryDetail";
import { PriceHistoryChart } from "@/components/detail/PriceHistoryChart";

interface DesktopPropertyDetailPanelProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  isLiked?: boolean;
  onToggleLike?: (propertyId: string) => void;
  showSimilarListings?: boolean;
  allProperties?: Property[];
  onPropertyChange?: (property: Property, imageIndex: number) => void;
  overlay?: boolean;
}

/**
 * DesktopPropertyDetailPanel - Shared sliding detail panel for all desktop views
 *
 * Features:
 * - Slides in from right side
 * - Responsive width matching content area
 * - Image carousel with navigation
 * - Property details and action buttons
 * - Reused across Map, List, Saved, and Notifications views
 */
export function DesktopPropertyDetailPanel({
  property: propertyProp,
  isOpen,
  onClose,
  isLiked = false,
  onToggleLike,
  showSimilarListings = false,
  allProperties = [],
  onPropertyChange,
  overlay = false,
}: DesktopPropertyDetailPanelProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [carouselScrollPosition, setCarouselScrollPosition] = useState(0);
  const [scrolledPastImage, setScrolledPastImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const detailMapRef = useRef<any>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Fetch full property detail (includes category-specific Tier I fields)
  const { property: detailResult, isLoading: isLoadingDetail } = useProperty(
    isOpen && propertyProp ? propertyProp.id : null
  );
  // Merge: use full detail data when available, fall back to search result
  const property: Property | null = propertyProp
    ? detailResult
      ? { ...adaptProperty(detailResult), coordinates: propertyProp.coordinates ?? adaptProperty(detailResult).coordinates }
      : propertyProp
    : null;

  // Mortgage calculator state
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [interestRate, setInterestRate] = useState(3.5);

  // Track scroll to switch button style when image scrolls out of view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolledPastImage(el.scrollTop > 260);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Reset scroll-past state when panel opens a new property
  useEffect(() => {
    setScrolledPastImage(false);
    scrollRef.current?.scrollTo(0, 0);
  }, [property?.id, isOpen]);

  // Reset image index when property changes
  if (property && currentImageIndex >= (property.images?.length ?? 0)) {
    setCurrentImageIndex(0);
  }

  // Initialize detail map
  useEffect(() => {
    if (!property || !isOpen) return;

    if (!property.coordinates) return;
    const { lat, lng } = property.coordinates;

    const initMap = async () => {
      // Use global L from CDN (loaded in layout.tsx)
      await new Promise<void>((r) => { const iv = setInterval(() => { if ((window as any).L) { clearInterval(iv); r(); } }, 50); });
      const L = (window as any).L;
      const container = miniMapContainerRef.current;

      if (!container) return;

      // Remove existing map if any
      if (detailMapRef.current) {
        detailMapRef.current.remove();
        detailMapRef.current = null;
      }

      // Create new map
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      }).setView([lat, lng], 15);

      // Add tile layer - Colorful OSM Voyager style
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "",
        maxZoom: 19,
      }).addTo(map);

      // Add marker
      const icon = L.divIcon({
        className: "custom-marker-icon",
        html: `
          <div class="price-marker" style="background: #84CC16; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 4px 12px rgba(132,204,22,0.4); border: 1.5px solid white; white-space: nowrap;">
            ${property.price <= 1 ? 'na dotaz' : property.price >= 1000000 ? (property.price / 1000000).toFixed(1) + 'M' : Math.round(property.price / 1000) + 'k' + ' Kč'}
          </div>
        `,
        iconSize: [60, 30] as [number, number],
        iconAnchor: [30, 15] as [number, number],
      });

      L.marker([lat, lng], {
        icon,
        zIndexOffset: 1000 // Keep property marker on top of POIs
      }).addTo(map);

      // Fetch and display POIs
      const fetchPOIs = async () => {
        const radius = 500; // 500 meters radius

        // Overpass API query for nearby amenities
        const query = `
          [out:json][timeout:25];
          (
            node["railway"="subway_entrance"](around:${radius},${lat},${lng});
            node["railway"="tram_stop"](around:${radius},${lat},${lng});
            node["highway"="bus_stop"](around:${radius},${lat},${lng});
            node["amenity"="hospital"](around:${radius},${lat},${lng});
            node["amenity"="school"](around:${radius},${lat},${lng});
            node["shop"="supermarket"](around:${radius},${lat},${lng});
            node["shop"="convenience"](around:${radius},${lat},${lng});
          );
          out body;
        `;

        try {
          const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });

          const data = await response.json();

          // Group POIs by type and limit each category
          const poiByType: { [key: string]: any[] } = {
            subway: [],
            tram: [],
            bus: [],
            hospital: [],
            school: [],
            grocery: [],
          };

          // Categorize POIs
          data.elements.forEach((element: any) => {
            if (element.tags.railway === 'subway_entrance') {
              poiByType.subway.push(element);
            } else if (element.tags.railway === 'tram_stop') {
              poiByType.tram.push(element);
            } else if (element.tags.highway === 'bus_stop') {
              poiByType.bus.push(element);
            } else if (element.tags.amenity === 'hospital') {
              poiByType.hospital.push(element);
            } else if (element.tags.amenity === 'school') {
              poiByType.school.push(element);
            } else if (element.tags.shop === 'supermarket' || element.tags.shop === 'convenience') {
              poiByType.grocery.push(element);
            }
          });

          // Calculate distance and sort by proximity
          const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371e3; // Earth's radius in meters
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };

          // Sort each category by distance and limit to 3 closest
          Object.keys(poiByType).forEach(type => {
            poiByType[type].sort((a, b) => {
              const distA = calculateDistance(lat, lng, a.lat, a.lon);
              const distB = calculateDistance(lat, lng, b.lat, b.lon);
              return distA - distB;
            });
            poiByType[type] = poiByType[type].slice(0, 3); // Keep only 3 closest
          });

          // Flatten the limited POIs
          const limitedPOIs = Object.values(poiByType).flat();

          // Create markers for each POI
          limitedPOIs.forEach((element: any) => {
            let color = '#666';
            let label = '';
            let iconSymbol = '●';

            if (element.tags.railway === 'subway_entrance') {
              color = '#E74C3C';
              label = element.tags.name || 'Metro';
              iconSymbol = '🚇';
            } else if (element.tags.railway === 'tram_stop') {
              color = '#3498DB';
              label = element.tags.name || 'Tram';
              iconSymbol = '🚊';
            } else if (element.tags.highway === 'bus_stop') {
              color = '#F39C12';
              label = element.tags.name || 'Bus';
              iconSymbol = '🚌';
            } else if (element.tags.amenity === 'hospital') {
              color = '#E74C3C';
              label = element.tags.name || 'Hospital';
              iconSymbol = '🏥';
            } else if (element.tags.amenity === 'school') {
              color = '#9B59B6';
              label = element.tags.name || 'School';
              iconSymbol = '🏫';
            } else if (element.tags.shop === 'supermarket' || element.tags.shop === 'convenience') {
              color = '#27AE60';
              label = element.tags.name || 'Shop';
              iconSymbol = '🛒';
            }

            const poiIcon = L.divIcon({
              className: 'poi-marker',
              html: `
                <div style="
                  background: ${color};
                  color: white;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 700;
                  border: 2px solid white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">${iconSymbol}</div>
              `,
              iconSize: [24, 24] as [number, number],
              iconAnchor: [12, 12] as [number, number],
            });

            const poiMarker = L.marker([element.lat, element.lon], { icon: poiIcon });

            if (label) {
              poiMarker.bindTooltip(label, {
                permanent: false,
                direction: 'top',
                className: 'poi-tooltip',
              });
            }

            poiMarker.addTo(map);
          });
        } catch (error) {
          console.error('Error fetching POIs:', error);
        }
      };

      fetchPOIs();

      detailMapRef.current = map;

      // Force resize after a short delay
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    initMap();

    return () => {
      if (detailMapRef.current) {
        detailMapRef.current.remove();
        detailMapRef.current = null;
      }
    };
  }, [property?.id, isOpen]);

  if (!property) return null;

  // Calculate mortgage payment
  const calculateMortgage = () => {
    if (!property) return { monthlyPayment: 0, principalAndInterest: 0 };

    const loanAmount = property.price * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const months = loanTermYears * 12;

    const monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);

    return {
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      principalAndInterest: isNaN(monthlyPayment) ? 0 : monthlyPayment
    };
  };

  const mortgage = calculateMortgage();
  const propertyTaxEstimate = 125;
  const insuranceEstimate = 42;
  const totalMonthlyPayment = mortgage.principalAndInterest + propertyTaxEstimate + insuranceEstimate;

  // Filter similar properties: same disposition, ±20% price, same city
  const similarProperties = property && showSimilarListings && allProperties.length > 0
    ? allProperties.filter((p) => {
        if (p.id === property.id) return false;
        if (getDisposition(p) !== getDisposition(property)) return false;
        if (p.city !== property.city) return false;

        const priceLower = property.price * 0.8;
        const priceUpper = property.price * 1.2;
        if (p.price < priceLower || p.price > priceUpper) return false;

        return true;
      })
    : [];

  // Carousel scroll handlers
  const handleCarouselScroll = (direction: "left" | "right") => {
    const container = document.getElementById("similar-listings-carousel");
    if (!container) return;

    const scrollAmount = 296; // card width (280px) + gap (16px)
    const newPosition = direction === "left"
      ? Math.max(0, carouselScrollPosition - scrollAmount)
      : Math.min(
          container.scrollWidth - container.clientWidth,
          carouselScrollPosition + scrollAmount
        );

    container.scrollTo({ left: newPosition, behavior: "smooth" });
    setCarouselScrollPosition(newPosition);
  };

  // Calculate visible thumbnails - show all images except current main image
  const images = property.images ?? [];
  const otherImages = images
    .map((img, idx) => ({ img, idx }))
    .filter((item) => item.idx !== currentImageIndex);
  const maxVisibleThumbnails = 5; // Maximum 5 thumbnails visible (6th slot for overflow)
  const visibleThumbnailImages = otherImages.slice(0, maxVisibleThumbnails);
  const overflowCount = Math.max(0, otherImages.length - maxVisibleThumbnails);

  return (
    <div
      className={`${
        overlay
          ? "absolute right-0 top-0 bottom-0 z-50"
          : "flex-shrink-0"
      } bg-white flex flex-col h-full border-l border-gray-100 transition-all duration-300 ease-out shadow-2xl ${
        isOpen ? "w-[520px] lg:w-[600px] xl:w-[680px] 2xl:w-[800px]" : "w-0 border-l-0"
      } overflow-hidden`}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll relative">

        {/* Floating sticky buttons — h-0 so they don't affect layout */}
        <div className="sticky top-0 z-20 h-0 overflow-visible pointer-events-none">
          <div className="flex items-center justify-between px-4 pt-3 pointer-events-none">
            <button
              onClick={onClose}
              className={`pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                scrolledPastImage
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "bg-black/20 text-white backdrop-blur-xl border border-white/10 hover:bg-black/30"
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={() => onToggleLike?.(property.id)}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  scrolledPastImage
                    ? "bg-gray-100 hover:bg-gray-200"
                    : "bg-black/20 text-white backdrop-blur-xl border border-white/10 hover:bg-black/30"
                }`}
              >
                <Heart className={`h-5 w-5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : scrolledPastImage ? "text-gray-700" : "text-white"}`} />
              </button>
              <button
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  scrolledPastImage
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-black/20 text-white backdrop-blur-xl border border-white/10 hover:bg-black/30"
                }`}
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

      {/* Image Gallery — 16:9 aspect ratio */}
      <div className="relative p-4">
        <div className="flex gap-3" style={{ aspectRatio: '16/9', maxHeight: '360px' }}>
          {/* Main image */}
          <div
            className="flex-[3] relative bg-gray-100 rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() => setLightboxOpen(true)}
          >
            <Image
              src={images[currentImageIndex] ?? ''}
              alt={`${getPropertyAddress(property)} - Main view`}
              fill
              className="object-cover transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 60vw"
              priority
            />
            {/* Image counter */}
            <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-md pointer-events-none">
              {currentImageIndex + 1}/{images.length}
            </div>
          </div>

          {/* Thumbnail grid */}
          {images.length > 1 && (
            <div className="flex-[2] grid grid-cols-2 grid-rows-3 gap-3 h-full">
              {visibleThumbnailImages.map((item) => (
                <div
                  key={item.idx}
                  className="relative bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => { setCurrentImageIndex(item.idx); setLightboxOpen(true); }}
                >
                  <Image
                    src={item.img}
                    alt={`${getPropertyAddress(property)} - View ${item.idx + 1}`}
                    fill
                    className="object-cover transition-transform duration-300"
                    sizes="20vw"
                  />
                </div>
              ))}
              {overflowCount > 0 && otherImages[maxVisibleThumbnails] && (
                <div
                  className="relative bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => { setCurrentImageIndex(otherImages[maxVisibleThumbnails].idx); setLightboxOpen(true); }}
                >
                  <Image
                    src={otherImages[maxVisibleThumbnails].img}
                    alt={`${getPropertyAddress(property)} - More`}
                    fill
                    className="object-cover"
                    sizes="20vw"
                  />
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center group-hover:bg-black/60 transition-colors">
                    <span className="text-white font-black text-lg">+{overflowCount} more</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-32">
        {/* Price — own prominent zone */}
        <div className="pt-6 pb-2">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            {formatPrice(property.price, property.currency)}
            {property.transaction_type === 'rent' && !isPriceOnRequest(property.price) && (
              <span className="text-lg font-bold text-gray-400">/mo</span>
            )}
          </h1>
          {property.pricePerSqm && !isPriceOnRequest(property.price) && (
            <p className="text-sm font-semibold text-gray-400 mt-1">
              {property.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²
            </p>
          )}
        </div>

        {/* Address & status */}
        <div className="pb-4">
          <p className="text-sm font-medium text-gray-500">
            {getPropertyAddress(property)}{property.neighbourhood ? `, ${property.neighbourhood}` : ''}{property.district ? `, ${property.district}` : ''}, {property.city}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Status badge */}
            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              property.status === 'removed' ? 'bg-red-50 border border-red-200 text-red-700'
                : property.status === 'sold' ? 'bg-purple-50 border border-purple-200 text-purple-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {property.status === 'removed' ? 'Removed' : property.status === 'sold' ? 'Sold' : 'Active'}
            </span>
            {/* Transaction type */}
            <span className="inline-block rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 uppercase tracking-wide">
              {getTransactionDisplayName(property.transaction_type)}
            </span>
            {/* Category */}
            <span className="inline-block rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
              {getCategoryDisplayName(property.property_category)}
            </span>
            {/* Portal */}
            {property.portal && (
              <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700 tracking-wide">
                {property.portal}
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {getDisposition(property) && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{getDisposition(property)}</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Disposition</span>
            </div>
          )}
          {property.sqm != null && property.sqm > 0 && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{property.sqm} m²</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Area</span>
            </div>
          )}
          {property.floor != null && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{property.floor === 0 ? "GF" : `${property.floor}F`}</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Floor</span>
            </div>
          )}
          {property.rooms != null && property.rooms > 0 && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{property.rooms}</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Rooms</span>
            </div>
          )}
          {property.bedrooms != null && property.bedrooms > 0 && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{property.bedrooms}</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Bedrooms</span>
            </div>
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
              <span className="text-base font-black text-gray-900">{property.bathrooms}</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Bathrooms</span>
            </div>
          )}
        </div>

        {/* Description — progressive disclosure */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-gray-900 mb-2.5">Description</h3>
          <p className={`text-sm text-gray-600 leading-relaxed font-medium ${!descriptionExpanded ? "line-clamp-3" : ""}`}>
            {property.description}
          </p>
          {property.description && property.description.length > 150 && (
            <button
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              className="text-sm font-bold text-[#84CC16] mt-2 hover:underline"
            >
              {descriptionExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Category-Specific Details */}
        <CategoryDetail property={property} />

        {/* Property Features as Pills */}
        {property.features && property.features.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-900 mb-3">Property Features</h3>
            <div className="flex flex-wrap gap-2">
              {property.features.map((feature) => (
                <div key={feature.id} className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-700">{feature.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portal-Specific Section */}
        <PortalSpecificSection
          portal={property.portal}
          portalMetadata={property.portal_metadata}
          sourceUrl={property.source_url}
        />

        {/* Agent, Mortgage & Map Row */}
        <div className="flex gap-4 mb-8">
          {/* Left Column: Agent & Mortgage stacked */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Agent Contact */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              {property.agent && (property.agent.name || property.agent.phone || property.agent.email) ? (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {property.agent.name
                        ? property.agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                        : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      {property.agent.name && (
                        <h4 className="text-sm font-black text-gray-900">{property.agent.name}</h4>
                      )}
                      <p className="text-xs font-bold text-gray-500 mt-0.5">Real Estate Agent</p>
                    </div>
                  </div>
                  {/* Contact details */}
                  <div className="space-y-2 mb-4">
                    {property.agent.phone && (
                      <a href={`tel:${property.agent.phone}`} className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-bold text-gray-900">{property.agent.phone}</span>
                      </a>
                    )}
                    {property.agent.email && (
                      <a href={`mailto:${property.agent.email}`} className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-bold text-gray-900 truncate">{property.agent.email}</span>
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-500">Contact info not available</p>
                  <p className="text-xs font-medium text-gray-400 mt-1">View the original listing for contact details</p>
                </div>
              )}

              {/* Commission note */}
              {property.commission_note && (
                <p className="text-xs font-medium text-gray-500 mb-3">{property.commission_note}</p>
              )}

              {/* View on Portal Button */}
              {property.source_url && (
                <button
                  onClick={() => window.open(property.source_url!, '_blank')}
                  className="w-full bg-white text-gray-900 font-bold py-2.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on {property.portal || 'Source Portal'}
                </button>
              )}
            </div>

            {/* Mortgage Summary — only for sale properties with known price */}
            {property.transaction_type === 'sale' && !isPriceOnRequest(property.price) && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  With downpayment{" "}
                  <span className="font-black text-gray-900">
                    {Math.round(property.price * (downPaymentPercent / 100)).toLocaleString("cs-CZ")} Kč
                  </span>
                  , your monthly payment could start from{" "}
                  <span className="font-black text-gray-900">
                    {Math.round(totalMonthlyPayment).toLocaleString("cs-CZ")} Kč
                  </span>
                </p>
                <button className="w-full bg-white text-[#84CC16] font-bold py-2.5 px-4 rounded-full border border-gray-200 hover:bg-lime-50 hover:border-purple-200 transition-all text-sm">
                  Find out more
                </button>
              </div>
            )}

            {/* Rent deposit info — only for rent properties with deposit */}
            {property.transaction_type === 'rent' && property.deposit != null && property.deposit > 0 && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Deposit: <span className="font-black text-gray-900">{formatPrice(property.deposit, property.currency)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Map */}
          <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
            <div ref={miniMapContainerRef} className="w-full h-full min-h-[300px]" />
          </div>
        </div>

        {/* Price History Chart (real data from API) */}
        <PriceHistoryChart propertyId={property.id} country="czech" />

        {/* Similar Listings Carousel - Only in Map View */}
        {showSimilarListings && similarProperties.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-900 mb-3">Similar Listings</h3>
            <div className="relative">
              {/* Navigation Arrows */}
              {carouselScrollPosition > 0 && (
                <button
                  onClick={() => handleCarouselScroll("left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gray-100 hover:bg-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-800" />
                </button>
              )}
              {carouselScrollPosition < (similarProperties.length - 3) * 296 && (
                <button
                  onClick={() => handleCarouselScroll("right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gray-100 hover:bg-white transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800" />
                </button>
              )}

              {/* Carousel Container */}
              <div
                id="similar-listings-carousel"
                className="flex gap-4 overflow-x-auto scroll-smooth snap-x hide-scrollbar"
                onScroll={(e) => setCarouselScrollPosition(e.currentTarget.scrollLeft)}
              >
                {similarProperties.map((similarProperty) => (
                  <div
                    key={similarProperty.id}
                    className="w-[280px] snap-start flex-shrink-0"
                    onClick={() => {
                      if (onPropertyChange) {
                        onPropertyChange(similarProperty, 0);
                        setCurrentImageIndex(0);
                      }
                    }}
                  >
                    <PropertyCardCompact
                      property={similarProperty}
                      isLiked={false}
                      onToggleLike={(id) => onToggleLike?.(id)}
                      onClick={() => {
                        if (onPropertyChange) {
                          onPropertyChange(similarProperty, 0);
                          setCurrentImageIndex(0);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      </div>{/* end scroll wrapper */}

      {/* Pinned bottom action bar */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 px-4 py-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <button className="rounded-full bg-[#84CC16] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-lime-100 hover:bg-[#6aaa10] transition-all">
            Book viewing
          </button>
          <button className="h-12 w-12 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-all">
            <MessageSquare className="h-5 w-5 text-[#84CC16]" />
          </button>
        </div>
        <p className="text-[11px] font-medium text-gray-400">Usually responds within 2 hours</p>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }

        .poi-tooltip {
          background: rgba(0, 0, 0, 0.8) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 4px 8px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: white !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }

        .poi-tooltip::before {
          border-top-color: rgba(0, 0, 0, 0.8) !important;
        }

        /* Range slider styling */
        input[type="range"].slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        input[type="range"].slider::-webkit-slider-thumb:hover {
          background: #1d4ed8;
        }

        input[type="range"].slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        input[type="range"].slider::-moz-range-thumb:hover {
          background: #1d4ed8;
        }
      `}</style>

      {/* Lightbox Gallery */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}
    </div>
  );
}
