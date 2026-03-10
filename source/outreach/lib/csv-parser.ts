import Papa from "papaparse";

export interface ParsedContact {
  name: string;
  email: string;
  company?: string;
  tags?: string[];
}

export function parseContactsCsv(buffer: Buffer): {
  contacts: ParsedContact[];
  errors: string[];
} {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const contacts: ParsedContact[] = [];
  const errors: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const rowNum = i + 2; // 1-indexed + header row

    const email = (row.email || "").trim();
    const name = (row.name || "").trim();

    if (!email) {
      errors.push(`Row ${rowNum}: missing email, skipped`);
      continue;
    }

    if (!emailRegex.test(email)) {
      errors.push(`Row ${rowNum}: invalid email "${email}", skipped`);
      continue;
    }

    if (!name) {
      errors.push(`Row ${rowNum}: missing name for ${email}, skipped`);
      continue;
    }

    const contact: ParsedContact = { name, email };

    const company = (row.company || "").trim();
    if (company) contact.company = company;

    const tagsRaw = (row.tags || "").trim();
    if (tagsRaw) {
      contact.tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    contacts.push(contact);
  }

  for (const err of result.errors) {
    errors.push(`Parse error at row ${(err.row ?? 0) + 2}: ${err.message}`);
  }

  return { contacts, errors };
}
