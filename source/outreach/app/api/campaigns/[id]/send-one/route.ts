import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  getNextPendingContact,
  markContactSent,
  markContactFailed,
} from "@/lib/db/campaigns";
import { sendEmail } from "@/lib/mailer";
import { renderTemplate } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const next = getNextPendingContact(campaignId);
  if (!next) {
    return NextResponse.json({ error: "No pending contacts" }, { status: 404 });
  }

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

    return NextResponse.json({
      ok: true,
      sent: {
        contactId: next.contact_id,
        name: next.contact.name,
        email: next.contact.email,
        resendId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markContactFailed(next.id, message);
    return NextResponse.json({ error: message, contactEmail: next.contact.email }, { status: 500 });
  }
}
