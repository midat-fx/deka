/**
 * Подписчики на напоминания о дедлайнах.
 *
 * ВАЖНО: тут храним НАСТОЯЩИЙ telegram-id (chat id), а не хэш — потому что
 * боту нужно написать этому человеку. Это осознанный обмен: пользователь
 * подписывается сам (/napomni), и /napomni стоп удаляет его id. В телеметрии
 * и трекере, где обратная связь не нужна, id по-прежнему хэшируется.
 *
 * Локально — SQLite, в проде — D1.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ReminderStore {
  subscribe(telegramId: number): Promise<void>;
  unsubscribe(telegramId: number): Promise<void>;
  isSubscribed(telegramId: number): Promise<boolean>;
  listSubscribers(): Promise<number[]>;
}

export const REMINDERS_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS reminder_subs (
  user_id INTEGER PRIMARY KEY,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

const SUB_SQL = 'INSERT OR IGNORE INTO reminder_subs (user_id) VALUES (?)';
const UNSUB_SQL = 'DELETE FROM reminder_subs WHERE user_id=?';
const IS_SUB_SQL = 'SELECT 1 AS x FROM reminder_subs WHERE user_id=?';
const LIST_SQL = 'SELECT user_id FROM reminder_subs';

export class SqliteReminders implements ReminderStore {
  private db: DatabaseSync;
  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(REMINDERS_SCHEMA_SQL);
  }
  async subscribe(id: number) {
    this.db.prepare(SUB_SQL).run(id);
  }
  async unsubscribe(id: number) {
    this.db.prepare(UNSUB_SQL).run(id);
  }
  async isSubscribed(id: number) {
    return this.db.prepare(IS_SUB_SQL).get(id) !== undefined;
  }
  async listSubscribers() {
    return (this.db.prepare(LIST_SQL).all() as { user_id: number }[]).map((r) => r.user_id);
  }
}

export function createSqliteReminders(): SqliteReminders {
  return new SqliteReminders(process.env.TELEMETRY_DB ?? 'data/deka.db');
}

/** Минимальный интерфейс D1 (bind + run/first/all). */
export interface D1RemindersDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  };
}

export class D1Reminders implements ReminderStore {
  constructor(private db: D1RemindersDB) {}
  async subscribe(id: number) {
    await this.db.prepare(SUB_SQL).bind(id).run();
  }
  async unsubscribe(id: number) {
    await this.db.prepare(UNSUB_SQL).bind(id).run();
  }
  async isSubscribed(id: number) {
    return (await this.db.prepare(IS_SUB_SQL).bind(id).first()) !== null;
  }
  async listSubscribers() {
    const res = await this.db.prepare(LIST_SQL).all<{ user_id: number }>();
    return res.results.map((r) => r.user_id);
  }
}
