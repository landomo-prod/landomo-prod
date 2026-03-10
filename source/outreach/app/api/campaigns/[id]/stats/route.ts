import { NextRequest, NextResponse } from "next/server";
import { getCampaign, getCampaignStats } from "@/lib/db/campaigns";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stats = getCampaignStats(campaignId);
  return NextResponse.json({
    campaignId,
    status: campaign.status,
    ...stats,
  });
}
