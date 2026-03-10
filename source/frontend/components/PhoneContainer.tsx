"use client";

import { useState } from "react";
import { StatusBar } from "./StatusBar";
import { DynamicIsland } from "./DynamicIsland";
import { NavigationBar, type Screen } from "./NavigationBar";
import { MapScreen } from "./screens/MapScreen";
import { ListScreen } from "./screens/ListScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { FiltersScreen } from "./screens/FiltersScreen";
import { useSearchContext } from "@/contexts/SearchContext";
import type { Property } from "@/types/property";

interface PhoneContainerProps {
  initialScreen?: Screen;
  onScreenChange?: (screen: Screen) => void;
}

/**
 * PhoneContainer Component
 *
 * Mimics an iPhone device mockup with:
 * - 375x812px dimensions (iPhone X/11/12/13 Pro size)
 * - Rounded corners (32px border-radius)
 * - Status bar (time, signal, wifi, battery)
 * - Dynamic Island (black rounded pill at top)
 * - Bottom navigation bar (floating, glassmorphic)
 * - Screen management for switching between views
 *
 * Based on the design specifications from final.pen
 */
export function PhoneContainer({
  initialScreen = "map",
  onScreenChange
}: PhoneContainerProps) {
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const { setSelectedPropertyId } = useSearchContext();

  const handleScreenChange = (screen: Screen) => {
    setActiveScreen(screen);
    onScreenChange?.(screen);
  };

  // Navigation handler for screen components (converts string to Screen type)
  const handleNavigate = (screen: string) => {
    handleScreenChange(screen as Screen);
  };

  // Handle property card click → set ID in context, navigate to detail
  const handlePropertyClick = (property: Property) => {
    setSelectedPropertyId(property.id);
    handleScreenChange("detail");
  };

  // Determine if navbar should be visible
  const hideNavBarScreens: Screen[] = ["search", "filters", "detail"];
  const showNavBar = !hideNavBarScreens.includes(activeScreen);

  // Render the appropriate screen based on activeScreen
  const renderScreen = () => {
    switch (activeScreen) {
      case "map":
        return <MapScreen onNavigate={handleNavigate} onPropertyClick={handlePropertyClick} />;
      case "list":
        return <ListScreen onNavigate={handleNavigate} onPropertyClick={handlePropertyClick} />;
      case "detail":
        return <DetailScreen onNavigate={handleNavigate} />;
      case "search":
        return <SearchScreen onNavigate={handleNavigate} />;
      case "filters":
        return <FiltersScreen onNavigate={handleNavigate} />;
      case "saved":
        // TODO: Implement SavedScreen
        return (
          <div className="flex h-full items-center justify-center bg-white">
            <div className="text-center">
              <h2 className="text-2xl font-black text-gray-900">
                Saved Properties
              </h2>
              <p className="mt-2 text-gray-500">Coming soon...</p>
            </div>
          </div>
        );
      default:
        return <MapScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-3 py-6">
      {/* iPhone Device Container - 375x812px with rounded corners and shadow */}
      <div className="relative flex h-[852px] w-full max-w-[393px] flex-col overflow-hidden rounded-[32px] bg-[var(--bg-card)] shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
        {/* Status Bar - fixed at top */}
        <StatusBar />

        {/* Dynamic Island - positioned absolutely over content */}
        <DynamicIsland />

        {/* Main Content Area - fills remaining space */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {renderScreen()}
        </div>

        {/* Bottom Navigation Bar - floating above content, hidden on certain screens */}
        {showNavBar && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[50px] flex justify-center z-50">
            <div className="pointer-events-auto">
              <NavigationBar
                activeScreen={activeScreen}
                onScreenChange={handleScreenChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
