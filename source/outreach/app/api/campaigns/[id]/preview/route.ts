import { NextRequest, NextResponse } from "next/server";
import { getCampaign, getNextPendingContact, getCampaignStats } from "@/lib/db/campaigns";
import { renderTemplate } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const stats = getCampaignStats(campaignId);
  const next = getNextPendingContact(campaignId);

  if (!next) {
    return NextResponse.json({ done: true, stats });
  }

  const vars = {
    name: next.contact.name,
    company: next.contact.company || "",
    email: next.contact.email,
  };

  const renderedSubject = renderTemplate(campaign.subject, vars);
  const renderedBody = renderTemplate(campaign.body_html, vars);

  return NextResponse.json({
    done: false,
    stats,
    contact: {
      id: next.contact_id,
      name: next.contact.name,
      email: next.contact.email,
      company: next.contact.company,
    },
    preview: {
      from: `${campaign.from_name} <${campaign.from_email}>`,
      replyTo: campaign.reply_to,
      to: next.contact.email,
      subject: renderedSubject,
      html: renderedBody,
    },
  });
}
