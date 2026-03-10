"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play, Pause, Trash2 } from "lucide-react";

interface Campaign {
  id: number;
  status: string;
}

export function CampaignActions({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}/send`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/campaigns");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete");
      }
    } finally {
      setLoading(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      {(campaign.status === "draft" || campaign.status === "paused") && (
        <Button onClick={handleStart} disabled={loading} size="sm">
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {campaign.status === "paused" ? "Resume" : "Start"}
        </Button>
      )}

      {campaign.status === "running" && (
        <Button
          onClick={handlePause}
          disabled={loading}
          size="sm"
          variant="secondary"
        >
          <Pause className="mr-1.5 h-3.5 w-3.5" />
          Pause
        </Button>
      )}

      {campaign.status === "draft" && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Campaign</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this campaign? This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
