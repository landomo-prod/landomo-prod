import { NextRequest, NextResponse } from "next/server";
import { parseContactsCsv } from "@/lib/csv-parser";
import { importContacts } from "@/lib/db/contacts";

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { contacts, errors } = parseContactsCsv(buffer);

  if (action === "preview") {
    return NextResponse.json({
      contacts,
      errors,
      total: contacts.length,
    });
  }

  // action === "confirm" or default: actually import
  const result = importContacts(contacts);

  return NextResponse.json({
    imported: result.imported,
    skipped: result.skipped,
    errors: [...errors, ...result.errors],
  });
}
