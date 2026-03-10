"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DesktopExplorer } from "@/components/DesktopExplorer";
import { PropertyLikesProvider } from "@/contexts/PropertyLikesContext";
import { SearchProvider, paramsToFilterState } from "@/contexts/SearchContext";
import { NavigationBar, type Screen } from "@/components/NavigationBar";
import { MapScreen } from "@/components/screens/MapScreen";
import { ListScreen } from "@/components/screens/ListScreen";
import { DetailScreen } from "@/components/screens/DetailScreen";
import { SearchScreen } from "@/components/screens/SearchScreen";
import { FiltersScreen } from "@/components/screens/FiltersScreen";
import { NotificationsScreen } from "@/components/screens/NotificationsScreen";
import { AlertConfigScreen } from "@/components/screens/AlertConfigScreen";
import { SavedScreen } from "@/components/screens/SavedScreen";

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [activeScreen, setActiveScreen] = useState<Screen>("map");

  // Parse initial filter state from URL on mount
  const { filterState: initialFilterState, sortBy: initialSortBy, propertyId: initialPropertyId } = useMemo(
    () => paramsToFilterState(searchParams),
    [] // only on mount
  );

  // Sync filter changes back to URL
  const handleParamsChange = useCallback((params: Record<string, string>) => {
    const url = new URLSearchParams(params);
    const qs = url.toString();
    const newPath = qs ? `/search?${qs}` : '/search';
    window.history.replaceState(null, '', newPath);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  if (isDesktop === null) return null;

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen as Screen);
  };

  // Desktop: map explorer
  if (isDesktop) {
    return (
      <PropertyLikesProvider>
        <SearchProvider
          initialFilterState={initialFilterState}
          initialSortBy={initialSortBy}
          onParamsChange={handleParamsChange}
        >
          <DesktopExplorer onNavigateToLanding={() => router.push("/")} initialPropertyId={initialPropertyId} />
        </SearchProvider>
      </PropertyLikesProvider>
    );
  }

  // Mobile: same screen-based UI
  const hideNavBarScreens: Screen[] = ["search", "filters", "detail", "alert-config"];
  const showNavBar = !hideNavBarScreens.includes(activeScreen);

  const renderScreen = () => {
    switch (activeScreen) {
      case "map":        return <MapScreen onNavigate={handleNavigate} />;
      case "list":       return <ListScreen onNavigate={handleNavigate} />;
      case "detail":     return <DetailScreen onNavigate={handleNavigate} />;
      case "search":     return <SearchScreen onNavigate={handleNavigate} />;
      case "filters":    return <FiltersScreen onNavigate={handleNavigate} />;
      case "notifications": return <NotificationsScreen onNavigate={handleNavigate} />;
      case "alert-config":  return <AlertConfigScreen onNavigate={handleNavigate} />;
      case "saved":      return <SavedScreen onNavigate={handleNavigate} />;
      default:           return <MapScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <PropertyLikesProvider>
      <SearchProvider
        initialFilterState={initialFilterState}
        initialSortBy={initialSortBy}
        onParamsChange={handleParamsChange}
      >
        <div className="app-shell bg-[var(--bg-card)]">
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {renderScreen()}
          </div>
          {showNavBar && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center z-50 safe-bottom-with-padding pb-[30px]">
              <div className="pointer-events-auto">
                <NavigationBar activeScreen={activeScreen} onScreenChange={setActiveScreen} />
              </div>
            </div>
          )}
        </div>
      </SearchProvider>
    </PropertyLikesProvider>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
