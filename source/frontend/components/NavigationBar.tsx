"use client";

import { Map, List, Heart, Bell } from "lucide-react";

export type Screen = "map" | "list" | "saved" | "detail" | "search" | "filters" | "notifications" | "alert-config";

interface NavigationBarProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function NavigationBar({ activeScreen, onScreenChange }: NavigationBarProps) {
  const tabs = [
    { id: "map" as Screen, icon: Map, label: "Map" },
    { id: "list" as Screen, icon: List, label: "List" },
    { id: "saved" as Screen, icon: Heart, label: "Saved" },
    { id: "notifications" as Screen, icon: Bell, label: "Alerts" },
  ];

  return (
    <div className="flex h-16 w-[230px] items-center justify-between gap-0 rounded-full bg-white/90 px-3 shadow-[0_10px_40px_rgba(0,0,0,0.15)] backdrop-blur-[25px] border border-black/[0.08]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeScreen === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onScreenChange(tab.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              size={28}
              className={isActive ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)]"}
              strokeWidth={2}
            />
          </button>
        );
      })}
    </div>
  );
}
