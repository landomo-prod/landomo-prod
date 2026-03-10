import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignContacts,
  assignContacts,
  removeContacts,
} from "@/lib/db/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const contacts = getCampaignContacts(campaignId);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
    return NextResponse.json(
      { error: "contactIds array is required" },
      { status: 400 }
    );
  }

  assignContacts(campaignId, body.contactIds);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
    return NextResponse.json(
      { error: "contactIds array is required" },
      { status: 400 }
    );
  }

  removeContacts(campaignId, body.contactIds);
  return NextResponse.json({ ok: true });
}
