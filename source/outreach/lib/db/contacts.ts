import { getDb } from "./client";

export interface Contact {
  id: number;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  website: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  status: "active" | "unsubscribed" | "bounced";
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: number;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  website: string | null;
  phone: string | null;
  tags: string;
  notes: string | null;
  status: "active" | "unsubscribed" | "bounced";
  created_at: string;
  updated_at: string;
}

function rowToContact(row: ContactRow): Contact {
  return {
    ...row,
    tags: JSON.parse(row.tags),
  };
}

export function listContacts(opts: {
  q?: string;
  tag?: string;
  status?: string;
  page?: number;
  limit?: number;
}): { contacts: Contact[]; total: number } {
  const db = getDb();
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.q) {
    conditions.push(
      "(name LIKE ? OR email LIKE ? OR company LIKE ?)"
    );
    const pattern = `%${opts.q}%`;
    params.push(pattern, pattern, pattern);
  }

  if (opts.status) {
    conditions.push("status = ?");
    params.push(opts.status);
  }

  if (opts.tag) {
    conditions.push("tags LIKE ?");
    params.push(`%${JSON.stringify(opts.tag)}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM contacts ${where}`).get(...params) as {
      count: number;
    }
  ).count;

  const rows = db
    .prepare(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as ContactRow[];

  return { contacts: rows.map(rowToContact), total };
}

export function getContact(id: number): Contact | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
    | ContactRow
    | undefined;
  return row ? rowToContact(row) : null;
}

export function createContact(data: {
  name: string;
  email: string;
  company?: string;
  title?: string;
  website?: string;
  phone?: string;
  tags?: string[];
  notes?: string;
}): Contact {
  const db = getDb();
  const tags = JSON.stringify(data.tags ?? []);
  const result = db
    .prepare(
      `INSERT INTO contacts (name, email, company, title, website, phone, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.name,
      data.email,
      data.company ?? null,
      data.title ?? null,
      data.website ?? null,
      data.phone ?? null,
      tags,
      data.notes ?? null
    );

  return getContact(Number(result.lastInsertRowid))!;
}

export function updateContact(
  id: number,
  data: Partial<{
    name: string;
    email: string;
    company: string;
    title: string;
    website: string;
    phone: string;
    tags: string[];
    notes: string;
    status: string;
  }>
): Contact | null {
  const db = getDb();
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "tags") {
      fields.push("tags = ?");
      params.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) return getContact(id);

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  params.push(id);

  db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).run(
    ...params
  );

  return getContact(id);
}

export function deleteContact(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
}

export function importContacts(
  contacts: Array<{
    name: string;
    email: string;
    company?: string;
    tags?: string[];
  }>
): { imported: number; skipped: number; errors: string[] } {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO contacts (name, email, company, tags) VALUES (?, ?, ?, ?)`
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const runImport = db.transaction(() => {
    for (const contact of contacts) {
      try {
        if (!contact.name || !contact.email) {
          errors.push(`Missing name or email for: ${contact.email || "unknown"}`);
          skipped++;
          continue;
        }

        const result = insert.run(
          contact.name,
          contact.email,
          contact.company ?? null,
          JSON.stringify(contact.tags ?? [])
        );

        if (result.changes > 0) {
          imported++;
        } else {
          skipped++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Error importing ${contact.email}: ${message}`);
        skipped++;
      }
    }
  });

  runImport();
  return { imported, skipped, errors };
}
