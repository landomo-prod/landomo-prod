"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Property, adaptProperties } from "@/types/property";
import { LocationSuggestion } from "@/lib/api/types";
import { useSearchContext, type MapBounds, filterStateToParams } from "@/contexts/SearchContext";
import { getPropertyById } from "@/lib/api/client";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";
import { CardGrid } from "@/components/ui/CardGrid";
import { DetailView } from "@/components/ui/DetailView";
import { DesktopFilterSheet } from "@/components/desktop/DesktopFilterSheet";
import { DesktopExplorerHeader } from "@/components/desktop/DesktopExplorerHeader";
import { DesktopNotificationsView } from "@/components/desktop/DesktopNotificationsView";
import { AlertConfigScreen } from "@/components/screens/AlertConfigScreen";
import { PortalNavigation } from "@/components/PortalNavigation";

type RightPanel = 'cards' | 'detail' | 'notifications' | 'alert-config';

interface DesktopExplorerProps {
  onNavigateToLanding: () => void;
  initialPropertyId?: string | null;
}

export function DesktopExplorer({ onNavigateToLanding, initialPropertyId }: DesktopExplorerProps) {
  const {
    allResults,
    total,
    isLoading,
    hasNextPage,
    page,
    setPage,
    filterState,
    setFilterState,
    sortBy,
    setSortBy,
    setMapBounds,
  } = useSearchContext();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanel>('cards');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  const { toggleLike, isLiked } = usePropertyLikes();

  const syncPropertyToUrl = useCallback((propertyId: string | null) => {
    const params = filterStateToParams(filterState, sortBy, propertyId);
    const qs = new URLSearchParams(params).toString();
    const newPath = qs ? `/search?${qs}` : '/search';
    window.history.pushState(null, '', newPath);
  }, [filterState, sortBy]);

  const detailPanelOpen = activeRightPanel === 'detail';

  const openDetail = useCallback((property: Property) => {
    setSelectedProperty(property);
    setActiveRightPanel('detail');
    syncPropertyToUrl(property.id);
  }, [syncPropertyToUrl]);

  const closeDetail = useCallback(() => {
    setActiveRightPanel('cards');
    syncPropertyToUrl(null);
  }, [syncPropertyToUrl]);

  // Auto-open property from URL param on mount
  useEffect(() => {
    if (!initialPropertyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPropertyById(initialPropertyId);
        if (cancelled) return;
        const adapted = adaptProperties([res.property]);
        if (adapted.length > 0) {
          setSelectedProperty(adapted[0]);
          setActiveRightPanel('detail');
        }
      } catch (err) {
        console.error('Failed to load property from URL:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [initialPropertyId]);

  // Handle browser back/forward button
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.get('property')) {
        setActiveRightPanel('cards');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    if (suggestion.bounds) {
      // Administrative area → zoom to boundary
      const { north, south, east, west } = suggestion.bounds;
      mapRef.current?.fitBounds([[south, west], [north, east]], { padding: [20, 20] });
    } else {
      // Exact address → center + zoom in
      mapRef.current?.setView([suggestion.coordinates.lat, suggestion.coordinates.lon], 17);
    }
  };

  const { mapRef, mapContainerRef, invalidateSize } = useLeafletMap({
    filterState,
    onPropertySelect: openDetail,
    onPropertyHover: setHoveredPropertyId,
    onBoundsChange: useCallback((bounds: MapBounds) => setMapBounds(bounds), [setMapBounds]),
    hoveredPropertyId,
    center: [50.0755, 14.4378],
    zoom: 13,
    zoomControl: true,
    attributionControl: false,
  });

  useEffect(() => {
    invalidateSize();
  }, [detailPanelOpen, invalidateSize]);

  const sidebarProperties = allResults;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: load next page when sentinel is visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isLoading && hasNextPage) {
        setPage(page + 1);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading, hasNextPage, page, setPage]);

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">

      {/* ── FULL-WIDTH NAVBAR ── */}
      <PortalNavigation
        onLogoClick={onNavigateToLanding}
        onNotificationsClick={() => setActiveRightPanel(prev => prev === 'notifications' ? 'cards' : 'notifications')}
        hideMapExplorer={true}
        fixed={false}
      />

      {/* ── FILTER BAR ── */}
      <DesktopExplorerHeader
        showPortalNav={false}
        onFilterClick={() => setFilterSheetOpen(true)}
        showPriorityFilters={true}
        filterState={filterState}
        onFilterChange={setFilterState}
        propertyCount={total}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showSortButton={true}
        placeholder="Search by district, street, or ZIP code..."
        onLocationSelect={handleLocationSelect}
      />

      {/* ── MAP + SIDEBAR + DETAIL ── */}
      <div className="flex-1 overflow-hidden flex flex-row min-h-0">

        {/* Map canvas */}
        <section className="flex-1 relative min-h-0 z-10">
          <div ref={mapContainerRef} className="absolute inset-0" />
        </section>

        {/* Right panel — card grid, detail view, or notifications */}
        <section className="w-[520px] lg:w-[600px] xl:w-[680px] 2xl:w-[800px] border-l border-gray-100 flex flex-col bg-white z-10">
          {activeRightPanel === 'alert-config' ? (
            <AlertConfigScreen
              onNavigate={(screen) => {
                if (screen === 'notifications') setActiveRightPanel('notifications');
                else setActiveRightPanel('cards');
              }}
            />
          ) : activeRightPanel === 'notifications' ? (
            <DesktopNotificationsView
              onClose={() => setActiveRightPanel('cards')}
              onPropertySelect={openDetail}
              onNavigate={(screen) => {
                if (screen === 'alert-config') setActiveRightPanel('alert-config');
                else setActiveRightPanel('cards');
              }}
            />
          ) : activeRightPanel === 'detail' && selectedProperty ? (
            <DetailView
              property={selectedProperty}
              isOpen={true}
              onClose={closeDetail}
              isLiked={isLiked(selectedProperty.id)}
              onToggleLike={toggleLike}
              inline={true}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading && sidebarProperties.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-[#84CC16] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sidebarProperties.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-sm font-semibold text-gray-500">No properties found</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-gray-500 mb-4 px-1">
                    {total.toLocaleString()} properties in view
                    {isLoading && <span className="ml-2 text-gray-400">Updating...</span>}
                  </p>
                  <CardGrid
                    properties={sidebarProperties}
                    isLiked={isLiked}
                    onToggleLike={toggleLike}
                    onPropertyClick={openDetail}
                    onMouseEnter={(id) => setHoveredPropertyId(id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                    hoveredPropertyId={hoveredPropertyId}
                    minCardWidth={280}
                  />
                  {hasNextPage && (
                    <div ref={sentinelRef} className="flex items-center justify-center py-8 gap-3">
                      <div className="w-5 h-5 border-2 border-[#84CC16] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold text-gray-400">Loading more...</span>
                    </div>
                  )}
                  {!hasNextPage && sidebarProperties.length > 0 && (
                    <p className="text-center text-xs font-bold text-gray-400 py-6">All properties loaded</p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Filter sheet */}
      <DesktopFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filterState={filterState}
        onFilterChange={setFilterState}
        onApply={() => setFilterSheetOpen(false)}
      />
    </div>
  );
}
