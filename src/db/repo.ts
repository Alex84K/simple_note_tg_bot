import { db } from "./db.ts";

export type NoteType = "text" | "link" | "image" | "file";

export interface Note {
  id: number;
  user_id: number;
  type: NoteType;
  content: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Находит пользователя по tg_user_id, создаёт при первом обращении. Возвращает внутренний id. */
export function getOrCreateUser(tgUserId: number): number {
  const existing = db
    .query<
      { id: number },
      [number]
    >("SELECT id FROM users WHERE tg_user_id = ?")
    .get(tgUserId);
  if (existing) return existing.id;

  const inserted = db
    .query<
      { id: number },
      [number]
    >("INSERT INTO users (tg_user_id) VALUES (?) RETURNING id")
    .get(tgUserId);
  return inserted!.id;
}

export interface CreateNoteInput {
  userId: number;
  type: NoteType;
  content?: string | null;
  filePath?: string | null;
  tags?: string[];
}

export function createNote(input: CreateNoteInput): number {
  const note = db
    .query<{ id: number }, [number, NoteType, string | null, string | null]>(
      `INSERT INTO notes (user_id, type, content, file_path)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(
      input.userId,
      input.type,
      input.content ?? null,
      input.filePath ?? null,
    );

  const noteId = note!.id;

  for (const name of input.tags ?? []) {
    attachTag(input.userId, noteId, name);
  }
  return noteId;
}

function attachTag(userId: number, noteId: number, rawName: string): void {
  const name = rawName.toLowerCase();
  db.query("INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)").run(
    userId,
    name,
  );
  const tag = db
    .query<
      { id: number },
      [number, string]
    >("SELECT id FROM tags WHERE user_id = ? AND name = ?")
    .get(userId, name)!;
  db.query(
    "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
  ).run(noteId, tag.id);
}

export function getNoteById(userId: number, noteId: number): Note | null {
  return (
    db
      .query<Note, [number, number]>(
        `SELECT * FROM notes
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      )
      .get(noteId, userId) ?? null
  );
}

export function listNotes(userId: number, limit = 20): Note[] {
  return db
    .query<Note, [number, number]>(
      `SELECT * FROM notes
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit);
}

export function searchNotes(userId: number, query: string, limit = 20): Note[] {
  const like = `%${query}%`;
  return db
    .query<Note, [number, string, number]>(
      `SELECT * FROM notes
       WHERE user_id = ? AND deleted_at IS NULL AND content LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(userId, like, limit);
}

/** Soft delete. Возвращает true, если заметка принадлежала пользователю и была удалена. */
export function softDeleteNote(userId: number, noteId: number): boolean {
  const res = db
    .query(
      `UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .run(noteId, userId);
  return res.changes > 0;
}
