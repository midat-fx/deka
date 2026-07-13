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
  /** Выбранный в визарде режим (для «Моей карточки»); undefined — ещё не выбирал. */
  getRegime(telegramId: number): Promise<string | undefined>;
  setRegime(telegramId: number, regime: string): Promise<void>;
  /** Удалить настройки пользователя (для «удалить мои данные»). */
  clear(telegramId: number): Promise<void>;
}

// regime — в CREATE, чтобы СВЕЖАЯ БД не зависела от миграции ниже.
export const PREFS_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS user_prefs (
  user_hash TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  regime TEXT
);`;

/**
 * Миграция для БД, созданных ДО колонки regime (тогда CREATE IF NOT EXISTS
 * пропускается и колонки нет). На свежей БД ALTER бросит «duplicate column» —
 * это ожидаемо и глушится в конструкторе; данные при этом уже целы (колонка
 * из CREATE), поэтому проглоченная ошибка не ломает функциональность.
 */
export const PREFS_MIGRATE_REGIME_SQL = 'ALTER TABLE user_prefs ADD COLUMN regime TEXT';

const GET_SQL = 'SELECT lang FROM user_prefs WHERE user_hash=?';
const SET_SQL =
  'INSERT INTO user_prefs (user_hash, lang) VALUES (?, ?) ON CONFLICT(user_hash) DO UPDATE SET lang=excluded.lang';
const GET_REGIME_SQL = 'SELECT regime FROM user_prefs WHERE user_hash=?';
// lang NOT NULL — при первой записи режима без языка ставим 'ru' по умолчанию.
const SET_REGIME_SQL =
  "INSERT INTO user_prefs (user_hash, lang, regime) VALUES (?, 'ru', ?) ON CONFLICT(user_hash) DO UPDATE SET regime=excluded.regime";
const CLEAR_SQL = 'DELETE FROM user_prefs WHERE user_hash=?';

export class SqlitePrefs implements PrefsStore {
  private db: DatabaseSync;
  private salt: string;
  constructor(dbPath: string, salt: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.salt = salt;
    this.db.exec(PREFS_SCHEMA_SQL);
    // Миграция для БД, созданных до колонки regime; «duplicate column» глушим.
    try {
      this.db.exec(PREFS_MIGRATE_REGIME_SQL);
    } catch {
      /* колонка уже есть */
    }
  }
  async getLang(id: number): Promise<Lang | undefined> {
    const row = this.db.prepare(GET_SQL).get(hashUser(this.salt, id)) as { lang: Lang } | undefined;
    return row?.lang;
  }
  async setLang(id: number, lang: Lang): Promise<void> {
    this.db.prepare(SET_SQL).run(hashUser(this.salt, id), lang);
  }
  async getRegime(id: number): Promise<string | undefined> {
    const row = this.db.prepare(GET_REGIME_SQL).get(hashUser(this.salt, id)) as
      | { regime: string | null }
      | undefined;
    return row?.regime ?? undefined;
  }
  async setRegime(id: number, regime: string): Promise<void> {
    this.db.prepare(SET_REGIME_SQL).run(hashUser(this.salt, id), regime);
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
  async getRegime(id: number): Promise<string | undefined> {
    const row = await this.db
      .prepare(GET_REGIME_SQL)
      .bind(hashUser(this.salt, id))
      .first<{ regime: string | null }>();
    return row?.regime ?? undefined;
  }
  async setRegime(id: number, regime: string): Promise<void> {
    await this.db.prepare(SET_REGIME_SQL).bind(hashUser(this.salt, id), regime).run();
  }
  async clear(id: number): Promise<void> {
    await this.db.prepare(CLEAR_SQL).bind(hashUser(this.salt, id)).run();
  }
}
