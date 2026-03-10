import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  getCampaignContactByResendId,
  updateCampaignContactStatus,
} from "@/lib/db/campaigns";
import { getDb } from "@/lib/db/client";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// State machine: only allow forward transitions
const STATE_PRIORITY: Record<string, number> = {
  pending: 0,
  sent: 1,
  opened: 2,
  replied: 3,
  failed: 1,
  bounced: 1,
};

function canTransition(current: string, next: string): boolean {
  // Bounced and failed can override sent
  if (next === "bounced" || next === "failed") {
    return current === "sent" || current === "pending";
  }
  return (STATE_PRIORITY[next] ?? 0) > (STATE_PRIORITY[current] ?? 0);
}

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id?: string;
    created_at?: string;
    bounce_type?: string;
    [key: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  if (!RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();

  // Verify signature with svix
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  let payload: ResendWebhookPayload;
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const eventType = payload.type;
  const emailId = payload.data.email_id;
  const timestamp =
    payload.data.created_at || new Date().toISOString();

  if (!emailId) {
    return NextResponse.json({ ok: true, skipped: "no email_id" });
  }

  // Store raw webhook event
  const db = getDb();
  db.prepare(
    `INSERT INTO webhook_events (event_type, resend_id, payload) VALUES (?, ?, ?)`
  ).run(eventType, emailId, body);

  // Look up the campaign contact
  const cc = getCampaignContactByResendId(emailId);
  if (!cc) {
    return NextResponse.json({ ok: true, skipped: "no matching contact" });
  }

  // Map Resend event types to our status
  let newStatus: string | null = null;
  const timestamps: Record<string, string> = {};

  switch (eventType) {
    case "email.delivered":
      // delivered confirms sent — only upgrade if still pending/sent
      newStatus = "sent";
      break;
    case "email.opened":
      newStatus = "opened";
      timestamps.opened_at = timestamp;
      break;
    case "email.clicked":
      // Treat click as open if not already opened
      if (cc.status === "sent") {
        newStatus = "opened";
        timestamps.opened_at = timestamp;
      }
      break;
    case "email.bounced":
      newStatus = "bounced";
      timestamps.bounced_at = timestamp;
      // Also mark the contact as bounced
      db.prepare(
        `UPDATE contacts SET status = 'bounced', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(cc.contact_id);
      break;
    case "email.complained":
      newStatus = "bounced";
      timestamps.bounced_at = timestamp;
      // Complaint = unsubscribe the contact
      db.prepare(
        `UPDATE contacts SET status = 'unsubscribed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(cc.contact_id);
      break;
    default:
      return NextResponse.json({ ok: true, skipped: `unhandled: ${eventType}` });
  }

  if (newStatus && canTransition(cc.status, newStatus)) {
    updateCampaignContactStatus(cc.id, newStatus, timestamps);
  }

  return NextResponse.json({ ok: true, event: eventType });
}
