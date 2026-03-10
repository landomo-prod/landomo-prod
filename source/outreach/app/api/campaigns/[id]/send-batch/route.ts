import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  getNextPendingContact,
  markContactSent,
  markContactFailed,
} from "@/lib/db/campaigns";
import { sendEmail } from "@/lib/mailer";
import { renderTemplate, sleep } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(parseInt(body.count, 10) || 50, 1), 200);

  const results: { email: string; name: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < count; i++) {
    const next = getNextPendingContact(campaignId);
    if (!next) break;

    const vars = {
      name: next.contact.name,
      company: next.contact.company || "",
      email: next.contact.email,
    };

    const renderedSubject = renderTemplate(campaign.subject, vars);
    const renderedBody = renderTemplate(campaign.body_html, vars);

    try {
      const resendId = await sendEmail({
        fromName: campaign.from_name,
        fromEmail: campaign.from_email,
        replyTo: campaign.reply_to || undefined,
        to: next.contact.email,
        subject: renderedSubject,
        html: renderedBody,
        campaignId: campaign.id,
      });

      markContactSent(next.id, resendId);
      results.push({ email: next.contact.email, name: next.contact.name, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markContactFailed(next.id, message);
      results.push({ email: next.contact.email, name: next.contact.name, ok: false, error: message });
    }

    // Rate limit: wait between sends (use campaign delay or 1s minimum)
    if (i < count - 1) {
      await sleep(Math.max(campaign.delay_ms, 1000));
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ ok: true, sent, failed, results });
}
