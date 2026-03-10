"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PropertyAlert } from "@/types/property";
import { useAuth } from "@/components/AuthProvider";
import {
  createWatchdog,
  updateWatchdog,
} from "@/lib/supabase/watchdog-api";

interface AlertConfigSheetProps {
  alert?: PropertyAlert;
  onSave: (alert: Partial<PropertyAlert>) => void;
  onClose: () => void;
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

export function AlertConfigSheet({ alert, onSave, onClose }: AlertConfigSheetProps) {
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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const alertData: Partial<PropertyAlert> = {
      type: alertType,
      frequency,
      priceThreshold: alertType === "price_drop" ? priceThreshold : undefined,
      channels: ["in_app"],
      active: true,
      muted: false,
    };

    // If user is authenticated, persist to Supabase
    if (user) {
      setSaving(true);
      try {
        const filters: Record<string, unknown> = {};
        if (alertType === "price_drop" && priceThreshold) {
          filters.price_threshold = priceThreshold;
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

    onSave(alertData);
  };

  const alertTypes: Array<{
    id: PropertyAlert["type"];
    label: string;
    description: string;
  }> = [
    { id: "price_drop", label: "Price Drop", description: "Track specific property" },
    {
      id: "new_listing",
      label: "New Listing",
      description: "Match saved search",
    },
    {
      id: "location_based",
      label: "Location",
      description: "Properties near location",
    },
  ];

  const frequencies: Array<{
    id: PropertyAlert["frequency"];
    label: string;
  }> = [
    { id: "instant", label: "Instant" },
    { id: "daily", label: "Daily Digest" },
    { id: "weekly", label: "Weekly Digest" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-2xl animate-slide-up">
        <div className="px-5 py-6">
          {/* Handle */}
          <div className="flex justify-center mb-4">
            <div className="h-1 w-12 rounded-full bg-gray-300"></div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-black mb-6">
            {alert ? "Edit Alert" : "Create Alert"}
          </h3>

          {/* Alert Type */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-black">Alert Type</h4>
            <div className="space-y-2">
              {alertTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setAlertType(type.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    alertType === type.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <div className="font-bold">{type.label}</div>
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
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Price Threshold</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Notify Below
                  </span>
                  <input
                    type="number"
                    value={priceThreshold}
                    onChange={(e) => setPriceThreshold(Number(e.target.value))}
                    className="w-full bg-transparent text-center text-sm font-black border-0 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Frequency */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-black">Frequency</h4>
            <div className="flex gap-2.5">
              {frequencies.map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => setFrequency(freq.id)}
                  className={`flex-1 rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                    frequency === freq.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-16 rounded-full bg-[#84CC16] px-8 text-base font-black text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)] transition-transform hover:bg-[#6aaa10] disabled:opacity-50"
            >
              {saving ? "Saving..." : alert ? "Save Changes" : "Create Alert"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
