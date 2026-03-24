import * as SQLite from 'expo-sqlite';
import { Message } from './api';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('onlyus.db');
    await initDatabase(db);
  }
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      encrypted_payload TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      reactions TEXT DEFAULT '[]',
      type TEXT DEFAULT 'text',
      media_uri TEXT,
      media_type TEXT,
      caption TEXT,
      duration REAL,
      is_deleted INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  `);
}

export async function saveMessage(msg: Message): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO messages (id, encrypted_payload, sender_id, sender_name, time, status, reactions, type, media_uri, media_type, caption, duration, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.encrypted_payload,
      msg.sender_id,
      msg.sender_name || '',
      msg.time,
      msg.status,
      msg.reactions || '[]',
      msg.type || 'text',
      msg.media_uri || null,
      msg.media_type || null,
      msg.caption || null,
      msg.duration || null,
      msg.is_deleted ? 1 : 0,
    ]
  );
}

export async function getMessages(limit: number = 50, offset: number = 0): Promise<Message[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM messages WHERE is_deleted = 0 ORDER BY time DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(row => ({
    ...row,
    is_deleted: row.is_deleted === 1,
    reactions: row.reactions || '[]',
  }));
}

export async function deleteMessage(msgId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE messages SET is_deleted = 1 WHERE id = ?`,
    [msgId]
  );
}

export async function updateMessageStatus(msgId: string, status: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE messages SET status = ? WHERE id = ?`,
    [status, msgId]
  );
}

export async function addReaction(msgId: string, reaction: string): Promise<void> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<any>(
    `SELECT reactions FROM messages WHERE id = ?`,
    [msgId]
  );
  if (row) {
    let reactions: string[] = [];
    try { reactions = JSON.parse(row.reactions); } catch {}
    if (!reactions.includes(reaction)) {
      reactions.push(reaction);
    }
    await database.runAsync(
      `UPDATE messages SET reactions = ? WHERE id = ?`,
      [JSON.stringify(reactions), msgId]
    );
  }
}

export async function clearAllMessages(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`DELETE FROM messages`);
}

export async function getMediaMessages(): Promise<Message[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM messages WHERE type IN ('image', 'video') AND is_deleted = 0 ORDER BY time DESC`
  );
  return rows.map(row => ({
    ...row,
    is_deleted: row.is_deleted === 1,
    reactions: row.reactions || '[]',
  }));
}
