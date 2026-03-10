import { NextRequest, NextResponse } from "next/server";
import { startCampaignSend, pauseCampaignSend, isCampaignRunning } from "@/lib/sender";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (isCampaignRunning(campaignId)) {
    return NextResponse.json(
      { error: "Campaign is already running" },
      { status: 409 }
    );
  }

  startCampaignSend(campaignId);
  return NextResponse.json({ ok: true, status: "running" });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  pauseCampaignSend(campaignId);
  return NextResponse.json({ ok: true, status: "paused" });
}
