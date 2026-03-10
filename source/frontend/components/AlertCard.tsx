"use client";

import { Home, TrendingDown, MapPin, Bell, Settings, BellOff, Trash2 } from "lucide-react";
import { PropertyAlert } from "@/types/property";
import { getAlertDisplayName, getAlertTypeName, formatFrequency } from "@/lib/alerts";

interface AlertCardProps {
  alert: PropertyAlert;
  onEdit?: (alertId: string) => void;
  onMute?: (alertId: string) => void;
  onDelete?: (alertId: string) => void;
  onClick?: (alertId: string) => void;
}

const getIcon = (type: PropertyAlert["type"]) => {
  switch (type) {
    case "price_drop":
      return TrendingDown;
    case "new_listing":
      return Home;
    case "location_based":
      return MapPin;
    case "property_update":
      return Bell;
    default:
      return Bell;
  }
};

export function AlertCard({ alert, onEdit, onMute, onDelete, onClick }: AlertCardProps) {
  const Icon = getIcon(alert.type);
  const displayName = getAlertDisplayName(alert);
  const typeName = getAlertTypeName(alert.type);
  const frequency = formatFrequency(alert.frequency);

  return (
    <div
      className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition-colors cursor-pointer hover:bg-gray-50"
      onClick={() => onClick?.(alert.id)}
    >
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
          alert.muted ? "bg-gray-100" : "bg-blue-100"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${
            alert.muted ? "text-gray-600" : "text-[#84CC16]"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-gray-900">
              {typeName}
            </h3>
            <p className="mt-1 text-sm font-medium text-gray-600 truncate">
              {displayName}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">
                {frequency}
              </span>
              {alert.triggerCount > 0 && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs font-bold text-gray-400">
                    {alert.triggerCount} {alert.triggerCount === 1 ? "alert" : "alerts"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(alert.id);
            }}
            className="flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-100"
          >
            <Settings className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMute?.(alert.id);
            }}
            className="flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-100"
          >
            <BellOff className="h-3.5 w-3.5" />
            {alert.muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(alert.id);
            }}
            className="flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
