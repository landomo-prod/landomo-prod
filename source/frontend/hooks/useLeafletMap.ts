import { useEffect, useRef, useCallback } from "react";
import { Property } from "@/types/property";
import { getMapClusters } from "@/lib/api/client";
import { type MapClusterResponse, type MapCluster, type MapPropertyPreview, type SearchFilters } from "@/lib/api/types";
import { mapFiltersToAPI, type MapBounds } from "@/contexts/SearchContext";
import { type FilterState } from "@/components/desktop/DesktopFilterSheet";

// Use the global L from CDN scripts loaded in layout.tsx
// This avoids bundler issues with leaflet.markercluster's class system
declare const L: typeof import("leaflet");

interface UseLeafletMapOptions {
  filterState: FilterState;
  searchQuery?: string;
  onPropertySelect?: (property: Property) => void;
  onPropertyHover?: (propertyId: string | null) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  hoveredPropertyId?: string | null;
  center?: [number, number];
  zoom?: number;
  zoomControl?: boolean;
  attributionControl?: boolean;
}

function waitForLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof L !== "undefined") {
      resolve();
      return;
    }
    let iterations = 0;
    const interval = setInterval(() => {
      iterations++;
      if (typeof L !== "undefined") {
        clearInterval(interval);
        resolve();
      } else if (iterations >= 200) {
        clearInterval(interval);
        reject(new Error("Leaflet failed to load within 10 seconds"));
      }
    }, 50);
  });
}

function formatClusterCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function getClusterSize(count: number): number {
  if (count < 10) return 40;
  if (count < 50) return 46;
  if (count < 200) return 52;
  if (count < 1000) return 58;
  return 64;
}

/**
 * Merge overlapping clusters in pixel space so no two circles overlap on screen.
 * Greedy: largest clusters placed first, smaller ones merge into them if overlapping.
 */
function mergeOverlappingClusters(
  clusters: MapCluster[],
  map: any,
  padding: number = 8
): MapCluster[] {
  if (!clusters.length) return clusters;

  // Sort by count descending — largest clusters get priority placement
  const sorted = [...clusters].sort((a, b) => b.count - a.count);

  // Project to pixel space
  const projected = sorted.map(c => ({
    cluster: c,
    point: map.latLngToContainerPoint([c.centerLat, c.centerLon]),
    radius: getClusterSize(c.count) / 2,
  }));

  const merged: typeof projected = [];

  for (const item of projected) {
    let didMerge = false;

    for (const placed of merged) {
      const dx = item.point.x - placed.point.x;
      const dy = item.point.y - placed.point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = placed.radius + item.radius + padding;

      if (dist < minDist) {
        // Merge into the larger placed cluster
        const totalCount = placed.cluster.count + item.cluster.count;
        const w1 = placed.cluster.count / totalCount;
        const w2 = item.cluster.count / totalCount;

        placed.cluster = {
          ...placed.cluster,
          count: totalCount,
          centerLat: placed.cluster.centerLat * w1 + item.cluster.centerLat * w2,
          centerLon: placed.cluster.centerLon * w1 + item.cluster.centerLon * w2,
          avgPrice: placed.cluster.avgPrice * w1 + item.cluster.avgPrice * w2,
          minPrice: Math.min(placed.cluster.minPrice, item.cluster.minPrice),
          maxPrice: Math.max(placed.cluster.maxPrice, item.cluster.maxPrice),
          bounds: placed.cluster.bounds && item.cluster.bounds ? {
            north: Math.max(placed.cluster.bounds.north, item.cluster.bounds.north),
            south: Math.min(placed.cluster.bounds.south, item.cluster.bounds.south),
            east: Math.max(placed.cluster.bounds.east, item.cluster.bounds.east),
            west: Math.min(placed.cluster.bounds.west, item.cluster.bounds.west),
          } : placed.cluster.bounds || item.cluster.bounds,
        };
        // Update pixel position and radius after merge
        placed.point = map.latLngToContainerPoint([placed.cluster.centerLat, placed.cluster.centerLon]);
        placed.radius = getClusterSize(placed.cluster.count) / 2;
        didMerge = true;
        break;
      }
    }

    if (!didMerge) {
      merged.push(item);
    }
  }

  return merged.map(m => m.cluster);
}

export function useLeafletMap({
  filterState,
  searchQuery,
  onPropertySelect,
  onPropertyHover,
  onBoundsChange,
  hoveredPropertyId,
  center = [50.0755, 14.4378],
  zoom = 13,
  zoomControl = false,
  attributionControl = false,
}: UseLeafletMapOptions) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const clusterMarkersRef = useRef<any[]>([]);
  const initDoneRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResponseRef = useRef<MapClusterResponse | null>(null);

  // Stable callback refs
  const onPropertySelectRef = useRef(onPropertySelect);
  onPropertySelectRef.current = onPropertySelect;
  const onPropertyHoverRef = useRef(onPropertyHover);
  onPropertyHoverRef.current = onPropertyHover;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  // Keep filter refs for the debounced fetch
  const filterStateRef = useRef(filterState);
  filterStateRef.current = filterState;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const invalidateSize = useCallback(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    }
  }, []);

  // Clear all markers from the map
  const clearMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove cluster markers
    for (const marker of clusterMarkersRef.current) {
      map.removeLayer(marker);
    }
    clusterMarkersRef.current = [];

    // Remove individual property markers
    markersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current.clear();
  }, []);

  // Render clusters or individual properties based on API response
  // Uses atomic swap: new markers are added BEFORE old ones are removed (no flash)
  const renderClusters = useCallback((response: MapClusterResponse) => {
    const map = mapRef.current;
    if (!map) return;

    // Snapshot previous markers
    const prevIndividual = new Map(markersRef.current);
    const prevClusters = [...clusterMarkersRef.current];
    markersRef.current = new Map();
    clusterMarkersRef.current = [];

    lastResponseRef.current = response;

    const visibleIds = new Set<string>();

    // Render individual property markers (from 'individual' strategy or DBSCAN unclustered points)
    if (response.properties) {
      for (const prop of response.properties) {
        const isRent = prop.transactionType === 'rent';
        const isOnRequest = prop.price <= 1;
        const priceLabel = isOnRequest
          ? 'na dotaz'
          : isRent
            ? `${Math.round(prop.price).toLocaleString('cs-CZ')}\u00A0Kč/měsíc`
            : `${Math.round(prop.price).toLocaleString('cs-CZ')}\u00A0Kč`;

        const icon = L.divIcon({
          className: "custom-marker-icon",
          html: `<div class="price-marker${isRent ? ' rent-marker' : ''}" data-property-id="${prop.id}">${priceLabel}</div>`,
          iconSize: [120, 30] as [number, number],
          iconAnchor: [60, 15] as [number, number],
        });

        const marker = L.marker([prop.latitude, prop.longitude], { icon });

        marker.on("click", () => {
          const property: Property = {
            id: prop.id,
            title: prop.title,
            price: prop.price,
            currency: prop.currency || 'CZK',
            property_type: '',
            property_category: prop.propertyCategory as any,
            transaction_type: (prop.transactionType || 'sale') as any,
            city: '',
            region: '',
            country: 'czech',
            portal: '',
            portal_id: '',
            created_at: '',
            coordinates: { lat: prop.latitude, lng: prop.longitude },
            latitude: prop.latitude,
            longitude: prop.longitude,
            sqm: prop.sqm,
            bedrooms: prop.bedrooms,
            images: prop.thumbnailUrl ? [prop.thumbnailUrl] : undefined,
          };
          onPropertySelectRef.current?.(property);
        });
        marker.on("mouseover", () => onPropertyHoverRef.current?.(prop.id));
        marker.on("mouseout", () => onPropertyHoverRef.current?.(null));

        marker.addTo(map);
        markersRef.current.set(prop.id, marker);
        visibleIds.add(prop.id);
      }
    }

    // Merge overlapping clusters in pixel space, then render
    const mergedClusters = response.clusters ? mergeOverlappingClusters(response.clusters, map) : null;
    if (mergedClusters) {
      for (const cluster of mergedClusters) {
        const size = getClusterSize(cluster.count);
        const countLabel = formatClusterCount(cluster.count);

        const icon = L.divIcon({
          className: "server-cluster-icon",
          html: `<div class="server-cluster-marker" style="width:${size}px;height:${size}px;">
            <span class="server-cluster-count">${countLabel}</span>
          </div>`,
          iconSize: [size, size] as [number, number],
          iconAnchor: [size / 2, size / 2] as [number, number],
        });

        const marker = L.marker([cluster.centerLat, cluster.centerLon], { icon });

        marker.on("click", () => {
          const currentZoom = map.getZoom();
          const count = cluster.count;

          // Small cluster: jump straight to individual pin level
          if (count <= 8) {
            if (cluster.bounds) {
              map.fitBounds(
                [[cluster.bounds.south, cluster.bounds.west], [cluster.bounds.north, cluster.bounds.east]],
                { maxZoom: 17, padding: [40, 40] }
              );
            } else {
              map.setView([cluster.centerLat, cluster.centerLon], 17);
            }
            return;
          }

          // Medium/large cluster: progressive zoom — bigger clusters need more clicks
          // Zoom in 2-4 levels depending on cluster density
          const zoomIncrease = count > 500 ? 2 : count > 50 ? 3 : 4;
          const targetZoom = Math.min(currentZoom + zoomIncrease, 18);

          if (cluster.bounds) {
            // Use fitBounds but enforce a minimum zoom so we always drill deeper
            const fitResult = map.getBoundsZoom(
              L.latLngBounds([cluster.bounds.south, cluster.bounds.west], [cluster.bounds.north, cluster.bounds.east]),
              false, [40, 40]
            );
            const effectiveZoom = Math.max(fitResult, targetZoom);
            map.setView([cluster.centerLat, cluster.centerLon], effectiveZoom);
          } else {
            map.setView([cluster.centerLat, cluster.centerLon], targetZoom);
          }
        });

        marker.addTo(map);
        clusterMarkersRef.current.push(marker);
      }
    }

    // Report current map bounds so search context filters results to viewport
    const currentBounds = map.getBounds();
    onBoundsChangeRef.current?.({
      north: currentBounds.getNorth(),
      south: currentBounds.getSouth(),
      east: currentBounds.getEast(),
      west: currentBounds.getWest(),
    });

    // Atomic swap: remove previous markers now that new ones are rendered
    prevClusters.forEach(m => map.removeLayer(m));
    prevIndividual.forEach(m => map.removeLayer(m));
  }, []);

  // Fetch clusters from API for current viewport
  const fetchClusters = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const bounds = map.getBounds();
    const currentZoom = map.getZoom();

    // Get map container pixel dimensions for viewport-proportional clustering
    const container = map.getContainer();
    const viewportWidth = container?.clientWidth || undefined;
    const viewportHeight = container?.clientHeight || undefined;

    const apiFilters = mapFiltersToAPI(filterStateRef.current, searchQueryRef.current);

    getMapClusters({
      country: 'czech',
      zoom: Math.round(currentZoom),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      filters: apiFilters as Record<string, any>,
      viewport_width: viewportWidth,
      viewport_height: viewportHeight,
    }).then((response) => {
      if (controller.signal.aborted) return;
      renderClusters(response);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      console.error('Map cluster fetch failed:', err);
    });
  }, [renderClusters]);

  // Debounced version of fetchClusters
  const debouncedFetchClusters = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchClusters();
    }, 250);
  }, [fetchClusters]);

  // Initialize map (once)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await waitForLeaflet();
      if (cancelled) return;

      if (!initDoneRef.current && mapContainerRef.current && !mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl,
          preferCanvas: true,
        }).setView(center, zoom);

        setTimeout(() => map.invalidateSize(), 100);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          { attribution: "", maxZoom: 19 }
        ).addTo(map);

        if (zoomControl) {
          const CustomZoom = L.Control.extend({
            options: { position: "topright" as const },
            onAdd() {
              const container = L.DomUtil.create("div", "custom-zoom-controls");
              container.innerHTML = `
                <button class="zoom-button zoom-in" aria-label="Zoom in">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4V16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M4 10H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                </button>
                <button class="zoom-button zoom-out" aria-label="Zoom out">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                </button>
              `;
              L.DomEvent.disableClickPropagation(container);
              container.querySelector(".zoom-in")?.addEventListener("click", () => map.zoomIn());
              container.querySelector(".zoom-out")?.addEventListener("click", () => map.zoomOut());
              return container;
            },
          });
          map.addControl(new CustomZoom());
        }

        // Fetch clusters on viewport changes
        // Zoom: instant (fires once cleanly). Pan: debounced (fires continuously)
        map.on('moveend', debouncedFetchClusters);
        map.on('zoomend', fetchClusters);

        mapRef.current = map;
        initDoneRef.current = true;

        // Inject styles
        if (!document.getElementById("leaflet-custom-styles")) {
          const style = document.createElement("style");
          style.id = "leaflet-custom-styles";
          style.textContent = `
            @keyframes markerFadeIn { from { opacity:0;transform:scale(0.8); } to { opacity:1;transform:scale(1); } }
            .price-marker { background:#1c1c1e;color:white;padding:4px 8px;border-radius:16px;font-size:13px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.25);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;animation:markerFadeIn .18s ease-out; }
            .rent-marker { background:#1c1c1e;color:white; }
            .price-marker:hover { transform:scale(1.08);box-shadow:0 2px 8px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06); }
            .price-marker.hovered { transform:scale(1.08);z-index:1000!important;box-shadow:0 2px 12px rgba(0,0,0,.2),0 0 0 3px rgba(0,122,255,.3);color:#007AFF; }
            .price-marker.featured { background:#007AFF;border-color:#007AFF;z-index:1000!important; }
            .server-cluster-icon { background:none!important;border:none!important; }
            .server-cluster-marker { background:#1c1c1e;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:pointer;transition:transform .2s;animation:markerFadeIn .22s ease-out; }
            .server-cluster-marker:hover { transform:scale(1.12); }
            .server-cluster-count { color:white;font-weight:800;font-size:16px;line-height:1; }
            .leaflet-container { background:#f0f0f0; }
            .custom-zoom-controls { display:flex;flex-direction:column;gap:10px; }
            .zoom-button { width:48px;height:48px;background:white;border:1.5px solid rgba(0,0,0,.08);border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;color:#1c1c1e; }
            .zoom-button:hover { background:#f9f9f9;transform:scale(1.08); }
            .zoom-button:active { transform:scale(.96); }
          `;
          document.head.appendChild(style);
        }

        // Initial fetch after map is ready
        setTimeout(() => fetchClusters(), 300);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch clusters when filters change
  useEffect(() => {
    if (initDoneRef.current && mapRef.current) {
      debouncedFetchClusters();
    }
  }, [filterState, searchQuery, debouncedFetchClusters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      initDoneRef.current = false;
      markersRef.current.clear();
      clusterMarkersRef.current = [];
    };
  }, []);

  // Update hovered marker styling
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      marker.getElement()?.querySelector(".price-marker")?.classList.remove("hovered");
    });
    if (hoveredPropertyId) {
      const marker = markersRef.current.get(hoveredPropertyId);
      marker?.getElement()?.querySelector(".price-marker")?.classList.add("hovered");
    }
  }, [hoveredPropertyId]);

  return { mapRef, mapContainerRef, invalidateSize };
}
