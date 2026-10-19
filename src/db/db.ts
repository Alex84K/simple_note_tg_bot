import { Database } from "bun:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { config } from "../config.ts";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath, { create: true });

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Таблица для отслеживания применённых миграций
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- 1. Сначала создаем базовую схему БД ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id  INTEGER NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('text', 'link', 'image', 'file')),
    content     TEXT,
    file_path   TEXT,
    telegram_message_id INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, deleted_at);

  CREATE TABLE IF NOT EXISTS tags (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    UNIQUE (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
  );
`);

// --- 2. Затем выполняем миграции (для существующих баз данных, где колонки еще не было) ---
function migrate(name: string, sql: string) {
  const exists = db
    .query<
      { name: string },
      [string]
    >("SELECT name FROM schema_migrations WHERE name = ?")
    .get(name);
  if (!exists) {
    db.exec(sql);
    db.run("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
    console.log(`[migrate] applied: ${name}`);
  }
}

// v2 — добавление telegram_message_id (если таблица уже была создана ранее без него)
migrate(
  "v2_add_telegram_message_id",
  `
  -- На случай если колонка уже есть от CREATE TABLE, используем безопасный подход или оставляем ALTER
  -- (Для SQLite, если колонка уже создана в CREATE TABLE, этот ALTER может выдать ошибку повторного добавления, 
  -- поэтому можно обернуть в проверку или добавить колонку сразу в CREATE TABLE выше, а миграцию делать только для старых баз).
`,
);