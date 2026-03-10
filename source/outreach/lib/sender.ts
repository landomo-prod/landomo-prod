import { getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/mailer";
import { renderTemplate, sleep } from "@/lib/utils";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  delay_ms: number;
  status: string;
}

interface PendingContact {
  cc_id: number;
  email: string;
  name: string;
  company: string | null;
}

const activeRuns = new Map<number, { abort: boolean }>();

function getCampaign(campaignId: number): Campaign | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM campaigns WHERE id = ?")
      .get(campaignId) as Campaign | undefined) ?? null
  );
}

function getNextPendingContact(campaignId: number): PendingContact | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT cc.id as cc_id, c.email, c.name, c.company
       FROM campaign_contacts cc
       JOIN contacts c ON c.id = cc.contact_id
       WHERE cc.campaign_id = ? AND cc.status = 'pending' AND c.status = 'active'
       ORDER BY cc.id ASC
       LIMIT 1`
    )
    .get(campaignId) as PendingContact | undefined;
  return row ?? null;
}

function markContactSent(ccId: number, resendEmailId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE campaign_contacts
     SET status = 'sent', resend_email_id = ?, sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).run(resendEmailId, ccId);
}

function markContactFailed(ccId: number, error: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE campaign_contacts SET status = 'failed', error = ? WHERE id = ?`
  ).run(error, ccId);
}

function updateCampaignStatus(
  campaignId: number,
  status: string
): void {
  const db = getDb();
  const extras: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"];

  if (status === "running") {
    extras.push("started_at = COALESCE(started_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))");
  } else if (status === "completed") {
    extras.push("completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  }

  db.prepare(
    `UPDATE campaigns SET status = ?, ${extras.join(", ")} WHERE id = ?`
  ).run(status, campaignId);
}

export function startCampaignSend(campaignId: number): void {
  if (activeRuns.has(campaignId)) return;

  const run = { abort: false };
  activeRuns.set(campaignId, run);

  (async () => {
    try {
      const campaign = getCampaign(campaignId);
      if (!campaign) {
        console.error(`Campaign ${campaignId} not found`);
        return;
      }

      updateCampaignStatus(campaignId, "running");

      while (!run.abort) {
        const contact = getNextPendingContact(campaignId);
        if (!contact) break;

        const vars = {
          name: contact.name,
          company: contact.company || "",
        };

        const subject = renderTemplate(campaign.subject, vars);
        const html = renderTemplate(campaign.body_html, vars);

        try {
          const emailId = await sendEmail({
            fromName: campaign.from_name,
            fromEmail: campaign.from_email,
            replyTo: campaign.reply_to || undefined,
            to: contact.email,
            subject,
            html,
            campaignId: campaign.id,
          });

          markContactSent(contact.cc_id, emailId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          markContactFailed(contact.cc_id, message);
          console.error(
            `Failed to send to ${contact.email} (cc=${contact.cc_id}): ${message}`
          );
        }

        if (!run.abort && campaign.delay_ms > 0) {
          await sleep(campaign.delay_ms);
        }
      }

      const finalStatus = run.abort ? "paused" : "completed";
      updateCampaignStatus(campaignId, finalStatus);
    } catch (err) {
      console.error(`Campaign ${campaignId} send loop error:`, err);
      updateCampaignStatus(campaignId, "paused");
    } finally {
      activeRuns.delete(campaignId);
    }
  })();
}

export function pauseCampaignSend(campaignId: number): void {
  const run = activeRuns.get(campaignId);
  if (run) {
    run.abort = true;
  }
  updateCampaignStatus(campaignId, "paused");
}

export function isCampaignRunning(campaignId: number): boolean {
  return activeRuns.has(campaignId);
}

export function resumeRunningCampaigns(): void {
  const db = getDb();
  const rows = db
    .prepare("SELECT id FROM campaigns WHERE status = 'running'")
    .all() as Array<{ id: number }>;

  for (const row of rows) {
    startCampaignSend(row.id);
  }
}
