"use client";

interface NotificationTabsProps {
  activeTab: "listings" | "manage";
  onTabChange: (tab: "listings" | "manage") => void;
}

export function NotificationTabs({ activeTab, onTabChange }: NotificationTabsProps) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <button
        onClick={() => onTabChange("listings")}
        className={`flex-1 rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
          activeTab === "listings"
            ? "bg-gray-900 text-white border-gray-900"
            : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
        }`}
      >
        Listings
      </button>
      <button
        onClick={() => onTabChange("manage")}
        className={`flex-1 rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
          activeTab === "manage"
            ? "bg-gray-900 text-white border-gray-900"
            : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
        }`}
      >
        Manage
      </button>
    </div>
  );
}
