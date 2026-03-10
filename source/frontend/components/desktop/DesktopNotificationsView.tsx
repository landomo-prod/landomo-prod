"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Home, TrendingDown, Calendar, Star, LogIn, ArrowLeft } from "lucide-react";
import { AlertCard } from "@/components/AlertCard";
import { PropertyAlertsView } from "@/components/PropertyAlertsView";
import { useAuth } from "@/components/AuthProvider";
import {
  getWatchdogs,
  deleteWatchdog,
  updateWatchdog,
  getNotifications,
  markNotificationRead,
  subscribeToNotifications,
  type Watchdog,
  type Notification,
} from "@/lib/supabase/watchdog-api";
import { Property, PropertyAlert } from "@/types/property";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";
import { useSearchContext } from "@/contexts/SearchContext";
import { DesktopPropertyDetailPanel } from "./DesktopPropertyDetailPanel";

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

/** Map notification event_type to an icon key */
function getNotificationIcon(eventType: string): string {
  if (eventType.includes("price")) return "price";
  if (eventType.includes("new") || eventType.includes("listing")) return "home";
  if (eventType.includes("calendar") || eventType.includes("viewing")) return "calendar";
  return "star";
}

/** Format a timestamp into a relative string */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return new Date(isoDate).toLocaleDateString();
}

/** Group notifications into "today" vs "week" */
function getNotificationGroup(isoDate: string): "today" | "week" {
  const now = new Date();
  const date = new Date(isoDate);
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return isToday ? "today" : "week";
}

interface DesktopNotificationsViewProps {
  onNavigate?: (screen: string) => void;
  onClose?: () => void;
  onPropertySelect?: (property: Property) => void;
}

export function DesktopNotificationsView({
  onNavigate,
  onClose,
  onPropertySelect,
}: DesktopNotificationsViewProps) {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"notifications" | "listings" | "manage">("notifications");
  const [alerts, setAlerts] = useState<PropertyAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const { toggleLike, isLiked } = usePropertyLikes();

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

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    // If notification has a property, open detail via parent callback
    if (notif.property_id && onPropertySelect) {
      const snapshot = notif.property_snapshot as Record<string, unknown> | null;
      if (snapshot) {
        onPropertySelect(snapshot as unknown as Property);
      }
    }
  };

  const { results } = useSearchContext();

  const openDetail = (propertyId: string) => {
    const property = results.find((p) => p.id === propertyId);
    if (property) {
      if (onPropertySelect) {
        onPropertySelect(property);
      } else {
        setSelectedProperty(property);
        setDetailPanelOpen(true);
      }
    }
  };

  const closeDetail = () => {
    setDetailPanelOpen(false);
  };

  // Not logged in — show sign-in prompt
  if (!authLoading && !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32">
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 mb-8">
          <LogIn className="h-20 w-20 text-gray-300" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3">
          Sign in to manage alerts
        </h2>
        <p className="text-center text-base text-gray-500 font-bold mb-10 max-w-md">
          Create alerts to track price changes and new listings matching your criteria.
        </p>
        <a
          href="/auth/login"
          className="flex items-center gap-2 px-8 py-4 text-base font-bold text-[#171717] bg-[#84CC16] rounded-full transition-all hover:bg-[#6aaa10]"
        >
          Sign In
        </a>
      </div>
    );
  }

  const todayNotifs = notifications.filter((n) => getNotificationGroup(n.created_at) === "today");
  const weekNotifs = notifications.filter((n) => getNotificationGroup(n.created_at) === "week");

  return (
    <div className="flex-1 flex flex-col">
      {/* Compact Header with Tabs and Action */}
      <header className="flex flex-col border-b border-gray-100 bg-white z-40 flex-shrink-0">
        <div className="h-16 px-8 flex items-center justify-between border-b border-gray-50">
          {/* Back button + Tab Pills */}
          <div className="flex items-center gap-4">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Back to listings"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all ${
                  activeTab === "notifications"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Updates ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab("listings")}
                className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all ${
                  activeTab === "listings"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Listings ({alerts.filter((a) => a.propertyId).length})
              </button>
              <button
                onClick={() => setActiveTab("manage")}
                className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all ${
                  activeTab === "manage"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Manage ({alerts.length})
              </button>
            </div>
          </div>

          {/* Create Alert Button */}
          <button
            onClick={handleCreateAlert}
            className="flex items-center gap-2 bg-[#84CC16] text-[#171717] px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-lime-100 hover:bg-[#6aaa10] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Alert
          </button>
        </div>
      </header>

      {/* Content Area - Flex layout to squeeze grid when detail opens */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Container - Shrinks when detail panel opens */}
        <div
          className={`flex-1 overflow-auto bg-white transition-all duration-300 ${
            detailPanelOpen ? 'mr-0' : ''
          }`}
        >
          <div className="w-full p-8">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#84CC16]" />
              </div>
            ) : activeTab === "notifications" ? (
              // Notifications Tab - Grouped by time
              notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 mb-8">
                    <Bell className="h-20 w-20 text-gray-300" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-3">
                    No notifications yet
                  </h2>
                  <p className="text-center text-base text-gray-500 font-bold mb-10 max-w-md">
                    Create alerts and we will notify you when matching properties appear.
                  </p>
                </div>
              ) : (
                <div className="max-w-3xl">
                  {/* Today */}
                  {todayNotifs.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Today</h3>
                      <div className="space-y-3">
                        {todayNotifs.map((notification) => {
                          const icon = getNotificationIcon(notification.event_type);
                          return (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer ${
                                notification.read ? "bg-white" : "bg-gray-50"
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                icon === "home" ? "bg-blue-100 text-[#84CC16]" :
                                icon === "price" ? "bg-green-100 text-green-600" :
                                icon === "calendar" ? "bg-orange-100 text-orange-600" :
                                "bg-lime-100 text-lime-600"
                              }`}>
                                {icon === "home" && <Home className="w-4 h-4" />}
                                {icon === "price" && <TrendingDown className="w-4 h-4" />}
                                {icon === "calendar" && <Calendar className="w-4 h-4" />}
                                {icon === "star" && <Star className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900">{notification.title}</h4>
                                <p className="text-xs font-medium text-gray-500 mt-0.5">{notification.message}</p>
                              </div>
                              <span className="text-[11px] font-medium text-gray-400 flex-shrink-0 whitespace-nowrap">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* This Week */}
                  {weekNotifs.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">This week</h3>
                      <div className="space-y-3">
                        {weekNotifs.map((notification) => {
                          const icon = getNotificationIcon(notification.event_type);
                          return (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer ${
                                notification.read ? "bg-white" : "bg-gray-50"
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                icon === "home" ? "bg-blue-100 text-[#84CC16]" :
                                icon === "price" ? "bg-green-100 text-green-600" :
                                icon === "calendar" ? "bg-orange-100 text-orange-600" :
                                "bg-lime-100 text-lime-600"
                              }`}>
                                {icon === "home" && <Home className="w-4 h-4" />}
                                {icon === "price" && <TrendingDown className="w-4 h-4" />}
                                {icon === "calendar" && <Calendar className="w-4 h-4" />}
                                {icon === "star" && <Star className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900">{notification.title}</h4>
                                <p className="text-xs font-medium text-gray-500 mt-0.5">{notification.message}</p>
                              </div>
                              <span className="text-[11px] font-medium text-gray-400 flex-shrink-0 whitespace-nowrap">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : activeTab === "listings" ? (
              // Listings Tab
              alerts.filter((a) => a.propertyId).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 mb-8">
                    <Bell className="h-20 w-20 text-gray-300" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-3">
                    No properties tracked
                  </h2>
                  <p className="text-center text-base text-gray-500 font-bold mb-10 max-w-md">
                    Create an alert to start tracking properties and get notified about new listings.
                  </p>
                  <button
                    onClick={() => setActiveTab("manage")}
                    className="flex items-center gap-2 px-8 py-4 text-base font-bold text-[#171717] bg-[#84CC16] rounded-full transition-all hover:bg-[#6aaa10]"
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
                  gridClassName={`grid gap-8 transition-all duration-300 ${
                    detailPanelOpen
                      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}
                  onPropertyClick={openDetail}
                />
              )
            ) : // Manage Tab
            alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 mb-8">
                  <Bell className="h-20 w-20 text-gray-300" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-3">
                  No active alerts
                </h2>
                <p className="text-center text-base text-gray-500 font-bold mb-10 max-w-md">
                  Create an alert to stay updated on properties matching your criteria.
                </p>
                <button
                  onClick={handleCreateAlert}
                  className="flex items-center gap-2 px-8 py-4 text-base font-bold text-[#171717] bg-[#84CC16] rounded-full transition-all hover:bg-[#6aaa10]"
                >
                  <Plus className="h-4 w-4" />
                  Create Alert
                </button>
              </div>
            ) : (
              <>
                {/* Header with count */}
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-gray-900">
                    {alerts.length} {alerts.length === 1 ? "alert" : "alerts"}
                  </h2>
                  <p className="text-sm text-gray-500 font-bold mt-1">
                    Active property alerts
                  </p>
                </div>

                {/* Responsive grid matching property list and saved views */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
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
              </>
            )}
          </div>
        </div>

        {/* Detail Panel - Squeezes grid instead of overlaying */}
        <DesktopPropertyDetailPanel
          property={selectedProperty}
          isOpen={detailPanelOpen}
          onClose={closeDetail}
          isLiked={selectedProperty ? isLiked(selectedProperty.id) : false}
          onToggleLike={toggleLike}
        />
      </div>
    </div>
  );
}
