"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, MailOpen, MessageSquare, AlertTriangle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  opened: number;
  replied: number;
  bounced: number;
  status: string;
}

const statItems = [
  { key: "sent" as const, label: "Sent", icon: Send, color: "text-blue-600" },
  { key: "opened" as const, label: "Opened", icon: MailOpen, color: "text-green-600" },
  { key: "replied" as const, label: "Replied", icon: MessageSquare, color: "text-emerald-600" },
  { key: "bounced" as const, label: "Bounced", icon: AlertTriangle, color: "text-orange-600" },
  { key: "failed" as const, label: "Failed", icon: XCircle, color: "text-red-600" },
  { key: "pending" as const, label: "Pending", icon: Clock, color: "text-muted-foreground" },
];

export function StatsBar({
  campaignId,
  pollInterval = 5000,
}: {
  campaignId: number;
  pollInterval?: number;
}) {
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // silently retry on next interval
    }
  }, [campaignId]);

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStats, pollInterval]);

  if (!stats) {
    return (
      <div className="flex gap-6 py-3 px-4 bg-muted/50 rounded-lg animate-pulse">
        {statItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const isActive = stats.status === "running";

  return (
    <div className="flex items-center gap-6 py-3 px-4 bg-muted/50 rounded-lg">
      <div className="text-sm font-medium">
        {stats.total} contacts
      </div>
      <div className="h-4 w-px bg-border" />
      {statItems.map(({ key, label, icon: Icon, color }) => {
        const value = stats[key];
        if (value === 0 && key !== "pending" && key !== "sent") return null;
        const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
        return (
          <div key={key} className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", color)} />
            <span className="text-sm tabular-nums">
              {value}
            </span>
            <span className="text-xs text-muted-foreground">
              {label} ({pct}%)
            </span>
          </div>
        );
      })}
      {isActive && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </>
      )}
    </div>
  );
}
