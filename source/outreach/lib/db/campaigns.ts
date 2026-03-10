import { getDb } from "./client";
import type { Contact } from "./contacts";

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  delay_ms: number;
  status: "draft" | "running" | "paused" | "completed";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithStats extends Campaign {
  total: number;
  sent: number;
  pending: number;
  opened: number;
  replied: number;
  bounced: number;
  failed: number;
}

export interface CampaignContact {
  id: number;
  campaign_id: number;
  contact_id: number;
  status: "pending" | "sent" | "failed" | "opened" | "replied" | "bounced";
  resend_email_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  error: string | null;
  contact: Contact;
}

interface CampaignContactRow {
  id: number;
  campaign_id: number;
  contact_id: number;
  status: "pending" | "sent" | "failed" | "opened" | "replied" | "bounced";
  resend_email_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  error: string | null;
  contact_name: string;
  contact_email: string;
  contact_company: string | null;
  contact_title: string | null;
  contact_website: string | null;
  contact_phone: string | null;
  contact_tags: string;
  contact_notes: string | null;
  contact_status: "active" | "unsubscribed" | "bounced";
  contact_created_at: string;
  contact_updated_at: string;
}

function rowToCampaignContact(row: CampaignContactRow): CampaignContact {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
    status: row.status,
    resend_email_id: row.resend_email_id,
    sent_at: row.sent_at,
    opened_at: row.opened_at,
    replied_at: row.replied_at,
    bounced_at: row.bounced_at,
    error: row.error,
    contact: {
      id: row.contact_id,
      name: row.contact_name,
      email: row.contact_email,
      company: row.contact_company,
      title: row.contact_title,
      website: row.contact_website,
      phone: row.contact_phone,
      tags: JSON.parse(row.contact_tags),
      notes: row.contact_notes,
      status: row.contact_status,
      created_at: row.contact_created_at,
      updated_at: row.contact_updated_at,
    },
  };
}

export function listCampaigns(): CampaignWithStats[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*,
        COALESCE(s.total, 0) as total,
        COALESCE(s.sent, 0) as sent,
        COALESCE(s.pending, 0) as pending,
        COALESCE(s.opened, 0) as opened,
        COALESCE(s.replied, 0) as replied,
        COALESCE(s.bounced, 0) as bounced,
        COALESCE(s.failed, 0) as failed
      FROM campaigns c
      LEFT JOIN (
        SELECT campaign_id,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
          SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM campaign_contacts
        GROUP BY campaign_id
      ) s ON s.campaign_id = c.id
      ORDER BY c.created_at DESC`
    )
    .all() as CampaignWithStats[];

  return rows;
}

export function getCampaign(id: number): Campaign | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
    | Campaign
    | undefined;
  return row ?? null;
}

export function createCampaign(data: {
  name: string;
  subject: string;
  body_html: string;
  from_name?: string;
  from_email: string;
  reply_to?: string;
  delay_ms?: number;
}): Campaign {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO campaigns (name, subject, body_html, from_name, from_email, reply_to, delay_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.name,
      data.subject,
      data.body_html,
      data.from_name ?? "Landomo",
      data.from_email,
      data.reply_to ?? null,
      data.delay_ms ?? 3000
    );

  return getCampaign(Number(result.lastInsertRowid))!;
}

export function updateCampaign(
  id: number,
  data: Partial<{
    name: string;
    subject: string;
    body_html: string;
    from_name: string;
    from_email: string;
    reply_to: string;
    delay_ms: number;
    status: string;
  }>
): Campaign | null {
  const db = getDb();
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.length === 0) return getCampaign(id);

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  params.push(id);

  db.prepare(`UPDATE campaigns SET ${fields.join(", ")} WHERE id = ?`).run(
    ...params
  );

  return getCampaign(id);
}

export function deleteCampaign(id: number): boolean {
  const db = getDb();
  const campaign = getCampaign(id);
  if (!campaign || campaign.status !== "draft") return false;

  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  return true;
}

export function getCampaignContacts(campaignId: number): CampaignContact[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cc.*,
        c.name as contact_name,
        c.email as contact_email,
        c.company as contact_company,
        c.title as contact_title,
        c.website as contact_website,
        c.phone as contact_phone,
        c.tags as contact_tags,
        c.notes as contact_notes,
        c.status as contact_status,
        c.created_at as contact_created_at,
        c.updated_at as contact_updated_at
      FROM campaign_contacts cc
      JOIN contacts c ON c.id = cc.contact_id
      WHERE cc.campaign_id = ?
      ORDER BY cc.id`
    )
    .all(campaignId) as CampaignContactRow[];

  return rows.map(rowToCampaignContact);
}

export function assignContacts(
  campaignId: number,
  contactIds: number[]
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO campaign_contacts (campaign_id, contact_id) VALUES (?, ?)`
  );

  const run = db.transaction(() => {
    for (const contactId of contactIds) {
      insert.run(campaignId, contactId);
    }
  });

  run();
}

export function removeContacts(
  campaignId: number,
  contactIds: number[]
): void {
  const db = getDb();
  const remove = db.prepare(
    `DELETE FROM campaign_contacts WHERE campaign_id = ? AND contact_id = ? AND status = 'pending'`
  );

  const run = db.transaction(() => {
    for (const contactId of contactIds) {
      remove.run(campaignId, contactId);
    }
  });

  run();
}

export function getCampaignStats(campaignId: number): {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  opened: number;
  replied: number;
  bounced: number;
} {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced
      FROM campaign_contacts
      WHERE campaign_id = ?`
    )
    .get(campaignId) as {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    opened: number;
    replied: number;
    bounced: number;
  };

  return row;
}

export function getNextPendingContact(
  campaignId: number
): CampaignContact | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT cc.*,
        c.name as contact_name,
        c.email as contact_email,
        c.company as contact_company,
        c.title as contact_title,
        c.website as contact_website,
        c.phone as contact_phone,
        c.tags as contact_tags,
        c.notes as contact_notes,
        c.status as contact_status,
        c.created_at as contact_created_at,
        c.updated_at as contact_updated_at
      FROM campaign_contacts cc
      JOIN contacts c ON c.id = cc.contact_id
      WHERE cc.campaign_id = ? AND cc.status = 'pending'
      ORDER BY cc.id
      LIMIT 1`
    )
    .get(campaignId) as CampaignContactRow | undefined;

  return row ? rowToCampaignContact(row) : null;
}

export function markContactSent(ccId: number, resendEmailId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE campaign_contacts
     SET status = 'sent',
         sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         resend_email_id = ?
     WHERE id = ?`
  ).run(resendEmailId, ccId);
}

export function markContactFailed(ccId: number, error: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE campaign_contacts SET status = 'failed', error = ? WHERE id = ?`
  ).run(error, ccId);
}

export function updateCampaignStatus(
  campaignId: number,
  status: string
): void {
  const db = getDb();
  const updates: string[] = [
    "status = ?",
    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
  ];
  const params: unknown[] = [status];

  if (status === "running") {
    updates.push("started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  } else if (status === "completed") {
    updates.push("completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  }

  params.push(campaignId);
  db.prepare(
    `UPDATE campaigns SET ${updates.join(", ")} WHERE id = ?`
  ).run(...params);
}

export function getCampaignContactByResendId(
  resendId: string
): CampaignContact | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT cc.*,
        c.name as contact_name,
        c.email as contact_email,
        c.company as contact_company,
        c.title as contact_title,
        c.website as contact_website,
        c.phone as contact_phone,
        c.tags as contact_tags,
        c.notes as contact_notes,
        c.status as contact_status,
        c.created_at as contact_created_at,
        c.updated_at as contact_updated_at
      FROM campaign_contacts cc
      JOIN contacts c ON c.id = cc.contact_id
      WHERE cc.resend_email_id = ?`
    )
    .get(resendId) as CampaignContactRow | undefined;

  return row ? rowToCampaignContact(row) : null;
}

export function updateCampaignContactStatus(
  ccId: number,
  status: string,
  timestamps: Record<string, string>
): void {
  const db = getDb();
  const fields: string[] = ["status = ?"];
  const params: unknown[] = [status];

  for (const [key, value] of Object.entries(timestamps)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }

  params.push(ccId);
  db.prepare(
    `UPDATE campaign_contacts SET ${fields.join(", ")} WHERE id = ?`
  ).run(...params);
}
