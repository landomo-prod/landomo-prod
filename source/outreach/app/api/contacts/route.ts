import { NextRequest, NextResponse } from "next/server";
import { listContacts, createContact } from "@/lib/db/contacts";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const q = url.get("q") || undefined;
  const tag = url.get("tag") || undefined;
  const status = url.get("status") || undefined;
  const page = url.get("page") ? Number(url.get("page")) : 1;
  const limit = url.get("limit") ? Number(url.get("limit")) : 50;

  const result = listContacts({ q, tag, status, page, limit });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  try {
    const contact = createContact(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "A contact with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
