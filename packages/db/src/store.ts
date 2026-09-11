import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { DEFAULT_CONFIG, DEMO_CREDENTIALS, seedCatalog, seedRoster } from "@rotation/shared";
import type { Assignment, EngineConfig, Shift, Staff, UserAccount } from "@rotation/shared";
import { hashPassword } from "./password.js";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "../../..");
export const DB_PATH = process.env.ROTATION_DB || resolve(REPO_ROOT, "data/rotation.db");

let _db: Database.Database | null = null;

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      side TEXT NOT NULL,
      json TEXT NOT NULL
    );
  `);
  seedIfEmpty(db);
  _db = db;
  return db;
}

function seedIfEmpty(db: Database.Database) {
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (userCount.n === 0) {
    const insert = db.prepare(
      "INSERT INTO users (id, username, name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
    );
    insert.run("U-admin", DEMO_CREDENTIALS.admin.username, DEMO_CREDENTIALS.admin.name, "admin", hashPassword(DEMO_CREDENTIALS.admin.password));
    insert.run("U-charge", DEMO_CREDENTIALS.charge.username, DEMO_CREDENTIALS.charge.name, "charge-nurse", hashPassword(DEMO_CREDENTIALS.charge.password));
  }

  const staffCount = db.prepare("SELECT COUNT(*) AS n FROM staff").get() as { n: number };
  if (staffCount.n === 0) {
    const insert = db.prepare("INSERT INTO staff (id, json) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const w of seedRoster()) insert.run(w.id, JSON.stringify(w));
    });
    tx();
  }

  const catCount = db.prepare("SELECT COUNT(*) AS n FROM assignments").get() as { n: number };
  if (catCount.n === 0) {
    const insert = db.prepare("INSERT INTO assignments (id, json) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const a of seedCatalog()) insert.run(a.id, JSON.stringify(a));
    });
    tx();
  }

  const cfg = db.prepare("SELECT value FROM meta WHERE key = 'config'").get() as { value: string } | undefined;
  if (!cfg) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('config', ?)").run(JSON.stringify(DEFAULT_CONFIG));
  }
}

export function listUsers(): Array<UserAccount & { password_hash: string }> {
  return getDb()
    .prepare("SELECT id, username, name, role, password_hash FROM users ORDER BY username")
    .all() as Array<UserAccount & { password_hash: string }>;
}

export function getUserByUsername(username: string) {
  return getDb()
    .prepare("SELECT id, username, name, role, password_hash FROM users WHERE username = ?")
    .get(username) as (UserAccount & { password_hash: string }) | undefined;
}

export function getUserById(id: string) {
  return getDb()
    .prepare("SELECT id, username, name, role, password_hash FROM users WHERE id = ?")
    .get(id) as (UserAccount & { password_hash: string }) | undefined;
}

export function upsertUser(user: UserAccount & { password_hash: string }) {
  getDb()
    .prepare(
      `INSERT INTO users (id, username, name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username=excluded.username, name=excluded.name, role=excluded.role, password_hash=excluded.password_hash`,
    )
    .run(user.id, user.username, user.name, user.role, user.password_hash);
}

export function deleteUser(id: string) {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createSession(id: string, userId: string, expiresAt: number) {
  getDb().prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expiresAt);
}

export function getSession(id: string) {
  return getDb()
    .prepare("SELECT id, user_id, expires_at FROM sessions WHERE id = ?")
    .get(id) as { id: string; user_id: string; expires_at: number } | undefined;
}

export function deleteSession(id: string) {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function listStaff(): Staff[] {
  return (getDb().prepare("SELECT json FROM staff ORDER BY id").all() as { json: string }[]).map((r) => JSON.parse(r.json));
}

export function replaceStaff(rows: Staff[]) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM staff").run();
    const insert = db.prepare("INSERT INTO staff (id, json) VALUES (?, ?)");
    for (const w of rows) insert.run(w.id, JSON.stringify(w));
  });
  tx();
}

export function upsertStaff(row: Staff) {
  getDb()
    .prepare(
      `INSERT INTO staff (id, json) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET json=excluded.json`,
    )
    .run(row.id, JSON.stringify(row));
}

export function deleteStaff(id: string) {
  getDb().prepare("DELETE FROM staff WHERE id = ?").run(id);
}

export function listCatalog(): Assignment[] {
  return (getDb().prepare("SELECT json FROM assignments ORDER BY id").all() as { json: string }[]).map((r) =>
    JSON.parse(r.json),
  );
}

export function replaceCatalog(rows: Assignment[]) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM assignments").run();
    const insert = db.prepare("INSERT INTO assignments (id, json) VALUES (?, ?)");
    for (const a of rows) insert.run(a.id, JSON.stringify(a));
  });
  tx();
}

export function upsertAssignment(row: Assignment) {
  getDb()
    .prepare(
      `INSERT INTO assignments (id, json) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET json=excluded.json`,
    )
    .run(row.id, JSON.stringify(row));
}

export function deleteAssignment(id: string) {
  getDb().prepare("DELETE FROM assignments WHERE id = ?").run(id);
}

export function getConfig(): EngineConfig {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'config'").get() as { value: string };
  return JSON.parse(row.value);
}

export function setConfig(cfg: EngineConfig) {
  getDb().prepare("INSERT INTO meta (key, value) VALUES ('config', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(
    JSON.stringify(cfg),
  );
}

export function listShifts(): Shift[] {
  return (getDb().prepare("SELECT json FROM shifts ORDER BY date DESC, side").all() as { json: string }[]).map((r) =>
    JSON.parse(r.json),
  );
}

export function getShift(id: string): Shift | undefined {
  const row = getDb().prepare("SELECT json FROM shifts WHERE id = ?").get(id) as { json: string } | undefined;
  return row ? JSON.parse(row.json) : undefined;
}

export function upsertShift(shift: Shift) {
  getDb()
    .prepare(
      `INSERT INTO shifts (id, date, side, json) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET date=excluded.date, side=excluded.side, json=excluded.json`,
    )
    .run(shift.id, shift.date, shift.side, JSON.stringify(shift));
}

export function deleteShift(id: string) {
  getDb().prepare("DELETE FROM shifts WHERE id = ?").run(id);
}

export function resetAll() {
  const db = getDb();
  db.exec("DELETE FROM sessions; DELETE FROM shifts; DELETE FROM staff; DELETE FROM assignments; DELETE FROM users; DELETE FROM meta;");
  seedIfEmpty(db);
}

export function publicUser(u: UserAccount & { password_hash?: string }): UserAccount {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}
