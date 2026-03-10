import { NextRequest, NextResponse } from "next/server";
import { listCampaigns, createCampaign } from "@/lib/db/campaigns";

export async function GET() {
  const campaigns = listCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.subject || !body.body_html || !body.from_email) {
    return NextResponse.json(
      { error: "name, subject, body_html, and from_email are required" },
      { status: 400 }
    );
  }

  const campaign = createCampaign({
    name: body.name,
    subject: body.subject,
    body_html: body.body_html,
    from_email: body.from_email,
    from_name: body.from_name,
    reply_to: body.reply_to,
    delay_ms: body.delay_ms,
  });

  return NextResponse.json(campaign, { status: 201 });
}
