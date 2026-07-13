/**
 * Языковая настройка пользователя (ru/kk). Ключ — хэш telegram-id (обратная
 * связь не нужна, поэтому хэшируем, как в телеметрии/трекере).
 * Локально — SQLite, в проде — D1.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashUser } from '../util/hash';
import type { Lang } from '../i18n/i18n';

export interface PrefsStore {
  getLang(telegramId: number): Promise<Lang | undefined>;
  setLang(telegramId: number, lang: Lang): Promise<void>;
  /** Удалить настройки пользователя (для «удалить мои данные»). */
  clear(telegramId: number): Promise<void>;
}

export const PREFS_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS user_prefs (
  user_hash TEXT PRIMARY KEY,
  lang TEXT NOT NULL
);`;

const GET_SQL = 'SELECT lang FROM user_prefs WHERE user_hash=?';
const SET_SQL =
  'INSERT INTO user_prefs (user_hash, lang) VALUES (?, ?) ON CONFLICT(user_hash) DO UPDATE SET lang=excluded.lang';
const CLEAR_SQL = 'DELETE FROM user_prefs WHERE user_hash=?';

export class SqlitePrefs implements PrefsStore {
  private db: DatabaseSync;
  private salt: string;
  constructor(dbPath: string, salt: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.salt = salt;
    this.db.exec(PREFS_SCHEMA_SQL);
  }
  async getLang(id: number): Promise<Lang | undefined> {
    const row = this.db.prepare(GET_SQL).get(hashUser(this.salt, id)) as { lang: Lang } | undefined;
    return row?.lang;
  }
  async setLang(id: number, lang: Lang): Promise<void> {
    this.db.prepare(SET_SQL).run(hashUser(this.salt, id), lang);
  }
  async clear(id: number): Promise<void> {
    this.db.prepare(CLEAR_SQL).run(hashUser(this.salt, id));
  }
}

export function createSqlitePrefs(): SqlitePrefs {
  return new SqlitePrefs(
    process.env.TELEMETRY_DB ?? 'data/deka.db',
    process.env.TELEMETRY_SALT ?? 'deka-mvp-salt',
  );
}

export interface D1PrefsDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export class D1Prefs implements PrefsStore {
  constructor(
    private db: D1PrefsDB,
    private salt: string,
  ) {}
  async getLang(id: number): Promise<Lang | undefined> {
    const row = await this.db.prepare(GET_SQL).bind(hashUser(this.salt, id)).first<{ lang: Lang }>();
    return row?.lang;
  }
  async setLang(id: number, lang: Lang): Promise<void> {
    await this.db.prepare(SET_SQL).bind(hashUser(this.salt, id), lang).run();
  }
  async clear(id: number): Promise<void> {
    await this.db.prepare(CLEAR_SQL).bind(hashUser(this.salt, id)).run();
  }
}
