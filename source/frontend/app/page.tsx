"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavigationBar, type Screen } from "@/components/NavigationBar";
import { MapScreen } from "@/components/screens/MapScreen";
import { ListScreen } from "@/components/screens/ListScreen";
import { DetailScreen } from "@/components/screens/DetailScreen";
import { SearchScreen } from "@/components/screens/SearchScreen";
import { FiltersScreen } from "@/components/screens/FiltersScreen";
import { NotificationsScreen } from "@/components/screens/NotificationsScreen";
import { AlertConfigScreen } from "@/components/screens/AlertConfigScreen";
import { SavedScreen } from "@/components/screens/SavedScreen";
import { LandingPage } from "@/components/LandingPage";
import { PropertyLikesProvider } from "@/contexts/PropertyLikesContext";
import { SearchProvider } from "@/contexts/SearchContext";

export default function Home() {
  const router = useRouter();
  const [activeScreen, setActiveScreen] = useState<Screen>("map");
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

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

  // Desktop: landing page only — explorer lives at /search
  if (isDesktop) {
    return (
      <PropertyLikesProvider>
        <SearchProvider>
          <LandingPage onNavigateToExplorer={() => router.push("/search")} />
        </SearchProvider>
      </PropertyLikesProvider>
    );
  }

  // Mobile/Tablet UI
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
      <SearchProvider>
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
