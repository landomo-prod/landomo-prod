import type Database from "better-sqlite3";

interface Migration {
  id: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: 1,
    name: "create_contacts",
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        company TEXT,
        title TEXT,
        website TEXT,
        phone TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
    `,
  },
  {
    id: 2,
    name: "create_campaigns",
    sql: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        from_name TEXT NOT NULL DEFAULT 'Landomo',
        from_email TEXT NOT NULL,
        reply_to TEXT,
        delay_ms INTEGER NOT NULL DEFAULT 3000,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `,
  },
  {
    id: 3,
    name: "create_campaign_contacts",
    sql: `
      CREATE TABLE IF NOT EXISTS campaign_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'replied', 'bounced')),
        resend_email_id TEXT UNIQUE,
        sent_at TEXT,
        opened_at TEXT,
        replied_at TEXT,
        bounced_at TEXT,
        error TEXT,
        UNIQUE(campaign_id, contact_id)
      );
      CREATE INDEX IF NOT EXISTS idx_cc_campaign_id ON campaign_contacts(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_cc_contact_id ON campaign_contacts(contact_id);
      CREATE INDEX IF NOT EXISTS idx_cc_status ON campaign_contacts(status);
      CREATE INDEX IF NOT EXISTS idx_cc_resend_email_id ON campaign_contacts(resend_email_id);
    `,
  },
  {
    id: 4,
    name: "create_webhook_events",
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        resend_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_we_resend_id ON webhook_events(resend_id);
      CREATE INDEX IF NOT EXISTS idx_we_processed ON webhook_events(processed);
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT id FROM _migrations")
      .all()
      .map((row) => (row as { id: number }).id)
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)").run(
        migration.id,
        migration.name
      );
    })();
  }
}
