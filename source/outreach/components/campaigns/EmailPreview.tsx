"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle, AlertCircle, Loader2, SkipForward, Zap } from "lucide-react";

interface PreviewData {
  done: boolean;
  stats: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    opened: number;
    replied: number;
    bounced: number;
  };
  contact?: {
    id: number;
    name: string;
    email: string;
    company: string | null;
  };
  preview?: {
    from: string;
    replyTo: string | null;
    to: string;
    subject: string;
    html: string;
  };
}

export function EmailPreview({ campaignId }: { campaignId: number }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/preview`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleSend = async () => {
    setSending(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-one`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setLastResult({
          ok: true,
          message: `Sent to ${json.sent.name} (${json.sent.email})`,
        });
      } else {
        setLastResult({
          ok: false,
          message: json.error || "Send failed",
        });
      }
      // Refresh preview to show next contact
      await fetchPreview();
    } catch (err) {
      setLastResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSending(false);
    }
  };

  const handleBatchSend = async (count: number) => {
    setBatchSending(true);
    setBatchProgress({ sent: 0, failed: 0, total: count });
    setLastResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const json = await res.json();
      if (res.ok) {
        setBatchProgress(null);
        setLastResult({
          ok: true,
          message: `Batch complete: ${json.sent} sent, ${json.failed} failed`,
        });
      } else {
        setLastResult({ ok: false, message: json.error || "Batch send failed" });
      }
      await fetchPreview();
    } catch (err) {
      setLastResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBatchSending(false);
      setBatchProgress(null);
    }
  };

  const handleSkip = async () => {
    setSending(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/skip-one`, { method: "POST" });
      await fetchPreview();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading preview...
        </CardContent>
      </Card>
    );
  }

  if (!data || data.done) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium">All contacts processed!</p>
          {data?.stats && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.stats.sent} sent, {data.stats.failed} failed out of{" "}
              {data.stats.total} total
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const { contact, preview, stats } = data;

  return (
    <div className="space-y-4">
      {lastResult && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            lastResult.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {lastResult.ok ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {lastResult.message}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Next Email Preview</CardTitle>
            <Badge variant="secondary">
              {stats.sent + stats.failed} / {stats.total} processed
              {stats.pending > 0 && ` · ${stats.pending} remaining`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-[80px_1fr] gap-y-1 text-sm border-b pb-3">
            <span className="text-muted-foreground">From:</span>
            <span>{preview?.from}</span>
            <span className="text-muted-foreground">To:</span>
            <span className="font-medium">
              {contact?.name} &lt;{preview?.to}&gt;
              {contact?.company && (
                <span className="text-muted-foreground ml-1">
                  ({contact.company})
                </span>
              )}
            </span>
            {preview?.replyTo && (
              <>
                <span className="text-muted-foreground">Reply-To:</span>
                <span>{preview.replyTo}</span>
              </>
            )}
            <span className="text-muted-foreground">Subject:</span>
            <span className="font-medium">{preview?.subject}</span>
          </div>

          {/* Email body */}
          <div
            className="border rounded-md p-4 bg-white text-sm"
            dangerouslySetInnerHTML={{ __html: preview?.html || "" }}
          />

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Button onClick={handleSend} disabled={sending || batchSending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to {contact?.name?.split(" ")[0] || "Contact"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={sending || batchSending}
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip
            </Button>
            <div className="border-l pl-2 ml-1">
              <Button
                variant="secondary"
                onClick={() => handleBatchSend(Math.min(50, stats.pending))}
                disabled={sending || batchSending}
              >
                {batchSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {batchSending
                  ? `Sending batch...`
                  : `Send Next ${Math.min(50, stats.pending)}`}
              </Button>
            </div>
          </div>
          {batchProgress && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Batch in progress — this may take a few minutes (delay between each email)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
