"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceRangeSelector } from "@/components/PriceRangeSelector";
import { PropertyAlert } from "@/types/property";
import { useAuth } from "@/components/AuthProvider";
import {
  createWatchdog,
  updateWatchdog,
} from "@/lib/supabase/watchdog-api";

interface AlertConfigScreenProps {
  onNavigate?: (screen: string) => void;
  alert?: PropertyAlert;
  onSave?: (alert: Partial<PropertyAlert>) => void;
}

/** Map frontend alert type to watchdog trigger_events */
function alertTypeToTriggerEvents(type: PropertyAlert["type"]): string[] {
  switch (type) {
    case "price_drop":
      return ["price_drop"];
    case "new_listing":
      return ["new_listing"];
    case "property_update":
      return ["property_update"];
    case "location_based":
      return ["new_listing", "price_drop"];
    default:
      return ["new_listing"];
  }
}

export function AlertConfigScreen({ onNavigate, alert, onSave }: AlertConfigScreenProps) {
  const { user } = useAuth();
  const [alertType, setAlertType] = useState<PropertyAlert["type"]>(
    alert?.type || "price_drop"
  );
  const [frequency, setFrequency] = useState<PropertyAlert["frequency"]>(
    alert?.frequency || "instant"
  );
  const [priceThreshold, setPriceThreshold] = useState(
    alert?.priceThreshold || 270000
  );
  const [minPrice, setMinPrice] = useState(100000);
  const [maxPrice, setMaxPrice] = useState(300000);
  const [selectedDispositions, setSelectedDispositions] = useState<string[]>(["2+kk", "3+kk"]);
  const [selectedCity, setSelectedCity] = useState("Praha 2");
  const [locationRadius, setLocationRadius] = useState(alert?.locationRadius || 500);
  const [saving, setSaving] = useState(false);

  const alertTypes: Array<{
    id: PropertyAlert["type"];
    label: string;
    description: string;
  }> = [
    { id: "price_drop", label: "Price Drop", description: "Track specific property for price changes" },
    { id: "new_listing", label: "New Listing", description: "Get notified when new properties match your search" },
    { id: "location_based", label: "Location Alert", description: "Properties within radius of a location" },
    { id: "property_update", label: "Property Updates", description: "Changes to saved properties" },
  ];

  const frequencies: Array<{
    id: PropertyAlert["frequency"];
    label: string;
  }> = [
    { id: "instant", label: "Instant" },
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
  ];

  const dispositions = ["1+kk", "2+kk", "3+kk", "4+kk", "5+kk"];
  const cities = ["Praha 1", "Praha 2", "Praha 3", "Praha 4", "Praha 5"];

  const toggleDisposition = (disposition: string) => {
    setSelectedDispositions((prev) =>
      prev.includes(disposition) ? prev.filter((d) => d !== disposition) : [...prev, disposition]
    );
  };

  const handleReset = () => {
    setAlertType("price_drop");
    setFrequency("instant");
    setPriceThreshold(270000);
    setMinPrice(100000);
    setMaxPrice(300000);
    setSelectedDispositions([]);
    setSelectedCity("Praha 2");
    setLocationRadius(500);
  };

  const handleSave = async () => {
    const alertData: Partial<PropertyAlert> = {
      type: alertType,
      frequency,
      channels: ["in_app"],
      active: true,
      muted: false,
    };

    // Add type-specific data
    if (alertType === "price_drop") {
      alertData.priceThreshold = priceThreshold;
    } else if (alertType === "new_listing") {
      alertData.searchCriteria = {
        price_min: minPrice,
        price_max: maxPrice,
        city: selectedCity,
      };
    } else if (alertType === "location_based") {
      alertData.locationRadius = locationRadius;
      alertData.searchCriteria = {
        price_min: minPrice,
        price_max: maxPrice,
      };
    }

    // If user is authenticated, persist to Supabase
    if (user) {
      setSaving(true);
      try {
        const filters: Record<string, unknown> = {};

        if (alertType === "price_drop") {
          filters.price_threshold = priceThreshold;
        } else if (alertType === "new_listing") {
          filters.price_min = minPrice;
          filters.price_max = maxPrice;
          filters.city = selectedCity;
          if (selectedDispositions.length > 0) {
            filters.disposition = selectedDispositions;
          }
        } else if (alertType === "location_based") {
          filters.radius = locationRadius;
          filters.price_min = minPrice;
          filters.price_max = maxPrice;
        }

        if (alert?.id) {
          await updateWatchdog(alert.id, {
            trigger_events: alertTypeToTriggerEvents(alertType),
            filters,
            frequency,
          });
        } else {
          await createWatchdog({
            trigger_events: alertTypeToTriggerEvents(alertType),
            filters,
            frequency,
            channels: ["in_app"],
          });
        }
      } catch (err) {
        console.error("Failed to save watchdog:", err);
      } finally {
        setSaving(false);
      }
    }

    onSave?.(alertData);
    onNavigate?.("notifications");
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Top background cover - prevents content showing through when scrolling */}
      <div className="absolute left-0 right-0 top-0 h-28 bg-white z-20"></div>

      {/* Header */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4 pb-4 bg-white">
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-sm font-bold text-gray-600 transition-colors hover:text-gray-900"
          >
            Reset
          </button>
          <h2 className="text-xl font-black">
            {alert ? "Edit Alert" : "Create Alert"}
          </h2>
          <button
            onClick={() => onNavigate?.("notifications")}
            className="flex h-12 w-12 items-center justify-center"
          >
            <X className="h-6 w-6 text-gray-400 cursor-pointer transition-colors hover:text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pt-32 px-4 pb-32">
        {/* Alert Type */}
        <div className="mb-10">
          <h4 className="mb-4 text-base font-black">Alert Type</h4>
          <div className="space-y-2">
            {alertTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setAlertType(type.id)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-colors border ${
                  alertType === type.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
                <div className="font-bold text-sm">{type.label}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    alertType === type.id ? "text-gray-300" : "text-gray-500"
                  }`}
                >
                  {type.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Price Threshold (only for price_drop) */}
        {alertType === "price_drop" && (
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Price Threshold</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Notify Below
                </span>
                <span className="text-sm font-black">
                  {priceThreshold.toLocaleString("cs-CZ")} Kč
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search Criteria (for new_listing and location_based) */}
        {(alertType === "new_listing" || alertType === "location_based") && (
          <>
            {/* Price Range */}
            <div className="mb-10">
              <h4 className="mb-4 text-base font-black">Price Range</h4>
              <PriceRangeSelector
                minPrice={minPrice}
                maxPrice={maxPrice}
                onMinChange={setMinPrice}
                onMaxChange={setMaxPrice}
                min={0}
                max={1000000}
                step={10000}
              />
            </div>

            {/* Disposition */}
            <div className="mb-10">
              <h4 className="mb-4 text-base font-black">Disposition</h4>
              <div className="flex flex-wrap gap-2.5">
                {dispositions.map((disposition) => {
                  const isSelected = selectedDispositions.includes(disposition);
                  return (
                    <button
                      key={disposition}
                      onClick={() => toggleDisposition(disposition)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {disposition}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City (only for new_listing) */}
            {alertType === "new_listing" && (
              <div className="mb-10">
                <h4 className="mb-4 text-base font-black">City</h4>
                <div className="flex flex-wrap gap-2.5">
                  {cities.map((city) => {
                    const isSelected = selectedCity === city;
                    return (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                          isSelected
                            ? "bg-gray-900 text-white border-gray-900"
                            : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        {city}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location Radius (only for location_based) */}
            {alertType === "location_based" && (
              <div className="mb-10">
                <h4 className="mb-4 text-base font-black">Location Radius</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
                    <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Radius
                    </span>
                    <span className="text-sm font-black">{locationRadius}m</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Frequency */}
        <div className="mb-10">
          <h4 className="mb-4 text-base font-black">Frequency</h4>
          <div className="flex flex-wrap gap-2.5">
            {frequencies.map((freq) => {
              const isSelected = frequency === freq.id;
              return (
                <button
                  key={freq.id}
                  onClick={() => setFrequency(freq.id)}
                  className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {freq.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Button - Fixed at bottom */}
      <div className="absolute bottom-[30px] left-0 right-0 flex justify-center z-50">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-16 rounded-full bg-[#84CC16] px-8 text-base font-black text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)] transition-transform hover:bg-[#6aaa10] disabled:opacity-50"
        >
          {saving ? "Saving..." : alert ? "Save Changes" : "Create Alert"}
        </Button>
      </div>
    </div>
  );
}
