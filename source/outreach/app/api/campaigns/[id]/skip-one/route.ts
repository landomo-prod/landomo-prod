import { NextRequest, NextResponse } from "next/server";
import { getCampaign, getNextPendingContact, markContactFailed } from "@/lib/db/campaigns";

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

  markContactFailed(next.id, "Skipped");

  return NextResponse.json({
    ok: true,
    skipped: {
      contactId: next.contact_id,
      name: next.contact.name,
      email: next.contact.email,
    },
  });
}
