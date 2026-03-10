"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, LogIn } from "lucide-react";
import { NotificationTabs } from "@/components/NotificationTabs";
import { AlertCard } from "@/components/AlertCard";
import { PropertyAlertsView } from "@/components/PropertyAlertsView";
import { useAuth } from "@/components/AuthProvider";
import {
  getWatchdogs,
  deleteWatchdog,
  updateWatchdog,
  getNotifications,
  subscribeToNotifications,
  type Watchdog,
  type Notification,
} from "@/lib/supabase/watchdog-api";
import { PropertyAlert } from "@/types/property";

interface NotificationsScreenProps {
  onNavigate?: (screen: string) => void;
}

/** Map a Supabase watchdog row to the frontend PropertyAlert shape */
function watchdogToAlert(w: Watchdog): PropertyAlert {
  const typeMap: Record<string, PropertyAlert["type"]> = {
    price_drop: "price_drop",
    new_listing: "new_listing",
    property_update: "property_update",
    location_based: "location_based",
  };

  const primaryEvent = w.trigger_events[0] ?? "new_listing";

  return {
    id: w.id,
    type: typeMap[primaryEvent] ?? "new_listing",
    propertyId: (w.filters?.property_id as string) ?? undefined,
    priceThreshold: (w.filters?.price_threshold as number) ?? undefined,
    searchCriteria: w.filters as PropertyAlert["searchCriteria"],
    locationRadius: (w.filters?.radius as number) ?? undefined,
    frequency: w.frequency as PropertyAlert["frequency"],
    channels: w.channels as PropertyAlert["channels"],
    active: w.active,
    muted: w.muted,
    createdAt: w.created_at,
    triggerCount: 0,
  };
}

export function NotificationsScreen({ onNavigate }: NotificationsScreenProps) {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"listings" | "manage">("listings");
  const [alerts, setAlerts] = useState<PropertyAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [watchdogs, notifs] = await Promise.all([
        getWatchdogs(),
        getNotifications({ limit: 50 }),
      ]);
      setAlerts(watchdogs.map(watchdogToAlert));
      setNotifications(notifs);
    } catch (err) {
      console.error("Failed to fetch watchdogs/notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = subscribeToNotifications(user.id, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
    });
    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const handleCreateAlert = () => {
    onNavigate?.("alert-config");
  };

  const handleEditAlert = (alertId: string) => {
    onNavigate?.("alert-config");
  };

  const handleMuteAlert = async (alertId: string) => {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return;
    try {
      await updateWatchdog(alertId, { muted: !alert.muted });
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, muted: !a.muted } : a
        )
      );
    } catch (err) {
      console.error("Failed to mute watchdog:", err);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteWatchdog(alertId);
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (err) {
      console.error("Failed to delete watchdog:", err);
    }
  };

  // Not logged in — show sign-in prompt
  if (!authLoading && !user) {
    return (
      <div className="relative flex h-full flex-col bg-white">
        <div className="absolute left-0 right-0 top-0 h-28 z-20"></div>
        <div className="absolute left-0 right-0 top-14 z-20 px-4 pb-2 bg-white/90 backdrop-blur-md backdrop-saturate-200">
          <div className="flex gap-2">
            <div className="flex flex-1 items-center py-3">
              <h1 className="text-2xl font-black">Notifications</h1>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <LogIn className="h-16 w-16 text-gray-200 mb-4" />
          <p className="text-base font-bold text-gray-400 mb-2">
            Sign in to manage alerts
          </p>
          <p className="text-sm text-gray-500 mb-6 text-center">
            Create alerts to track price changes and new listings
          </p>
          <a
            href="/auth/login"
            className="flex items-center gap-2 rounded-full bg-[#84CC16] px-6 py-3 text-sm font-bold text-white transition-transform hover:bg-[#6aaa10]"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Top background cover */}
      <div className="absolute left-0 right-0 top-0 h-28 z-20"></div>

      {/* Header - Title and Add Button (matches search bar height) */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4 pb-2 bg-white/90 backdrop-blur-md backdrop-saturate-200">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center py-3">
            <h1 className="text-2xl font-black">Notifications</h1>
          </div>
          <button
            onClick={handleCreateAlert}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-50 bg-white shadow-sm transition-transform hover:bg-gray-50"
          >
            <Plus className="h-5 w-5 text-gray-800" />
          </button>
        </div>
      </div>

      {/* Tabs Row (matches property count bar height) */}
      <div className="relative z-10 px-5 pt-32 bg-white/90 backdrop-blur-md backdrop-saturate-200">
        <NotificationTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Easing Gradient Overlay - positioned at bottom of this row */}
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{
            height: '40px',
            transform: 'translateY(calc(100% - 1px))',
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.987) 8.1%, rgba(255, 255, 255, 0.951) 15.5%, rgba(255, 255, 255, 0.896) 22.5%, rgba(255, 255, 255, 0.825) 29%, rgba(255, 255, 255, 0.741) 35.3%, rgba(255, 255, 255, 0.648) 41.2%, rgba(255, 255, 255, 0.550) 47.1%, rgba(255, 255, 255, 0.450) 52.9%, rgba(255, 255, 255, 0.352) 58.8%, rgba(255, 255, 255, 0.259) 64.7%, rgba(255, 255, 255, 0.175) 71%, rgba(255, 255, 255, 0.104) 77.5%, rgba(255, 255, 255, 0.049) 84.5%, rgba(255, 255, 255, 0.013) 91.9%, rgba(255, 255, 255, 0) 100%)'
          }}
        />
      </div>

      {/* Tab Content */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#84CC16]" />
          </div>
        ) : activeTab === "listings" ? (
          // Listings Tab - Show Properties with Alerts (like ListScreen)
          alerts.filter((a) => a.propertyId).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Bell className="h-16 w-16 text-gray-200 mb-4" />
              <p className="text-base font-bold text-gray-400 mb-2">
                No properties tracked
              </p>
              <p className="text-sm text-gray-500 mb-6 text-center">
                Create an alert to start tracking properties
              </p>
              <button
                onClick={() => setActiveTab("manage")}
                className="flex items-center gap-2 rounded-full bg-[#84CC16] px-6 py-3 text-sm font-bold text-white transition-transform hover:bg-[#6aaa10]"
              >
                Go to Manage
              </button>
            </div>
          ) : (
            <PropertyAlertsView
              alerts={alerts}
              onNavigate={onNavigate}
              onEditAlert={handleEditAlert}
              onMuteAlert={handleMuteAlert}
              onDeleteAlert={handleDeleteAlert}
            />
          )
        ) : (
          // Manage Tab - Alert Management Interface
          alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Bell className="h-16 w-16 text-gray-200 mb-4" />
              <p className="text-base font-bold text-gray-400 mb-2">
                No active alerts
              </p>
              <p className="text-sm text-gray-500 mb-6 text-center">
                Create an alert to stay updated on properties
              </p>
              <button
                onClick={handleCreateAlert}
                className="flex items-center gap-2 rounded-full bg-[#84CC16] px-6 py-3 text-sm font-bold text-white transition-transform hover:bg-[#6aaa10]"
              >
                <Plus className="h-4 w-4" />
                Create Alert
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={handleEditAlert}
                  onMute={handleMuteAlert}
                  onDelete={handleDeleteAlert}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
