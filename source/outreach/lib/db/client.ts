import Database from "better-sqlite3";
import { runMigrations } from "./migrations";

const globalForDb = globalThis as unknown as { __db?: Database.Database };

function createDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || "./outreach.db";
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db;
}
