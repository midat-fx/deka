/**
 * Кэш LLM-ответов + дневной лимит вопросов.
 *
 * Зачем: дневные квоты Gemini — реальная боль, а вопросы ИП кучкуются вокруг
 * 20-30 формулировок. Кэшируем готовый (уже отрендеренный) ответ по ключу
 * «стем-токены запроса + язык» — перефразировки одного вопроса попадают в один
 * ключ. При 429/сбое отдаём даже протухший кэш — лучше, чем сырые фрагменты.
 * Плюс мягкий лимит ~15 LLM-вопросов/день на юзера (сверх — фрагменты).
 *
 * Локально — SQLite, в проде — D1. Ключ юзера в лимите — хэш (приватность).
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { tokenize } from '../rag/search';
import { hashUser } from '../util/hash';

/** Ключ кэша: отсортированные стем-токены + язык → sha (перефразировки → один ключ). */
export function cacheKey(query: string, lang: string): string {
  const toks = [...new Set(tokenize(query))].sort().join(' ');
  return createHash('sha256').update(`${toks}|${lang}`).digest('hex').slice(0, 32);
}

export interface CachedAnswer {
  reply: string;
  ageMs: number;
}

export interface AnswerCache {
  get(qkey: string): Promise<CachedAnswer | null>;
  set(qkey: string, reply: string): Promise<void>;
  hitsToday(telegramId: number): Promise<number>;
  bumpToday(telegramId: number): Promise<void>;
}

export const CACHE_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS answer_cache (
  qkey TEXT PRIMARY KEY,
  reply TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS llm_usage (
  user_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_hash, day)
);`;

const GET_SQL =
  "SELECT reply, CAST((julianday('now') - julianday(created_at)) * 86400000 AS INTEGER) AS age_ms FROM answer_cache WHERE qkey=?";
const SET_SQL =
  "INSERT INTO answer_cache (qkey, reply, created_at) VALUES (?, ?, datetime('now')) ON CONFLICT(qkey) DO UPDATE SET reply=excluded.reply, created_at=datetime('now')";
const HITS_SQL = "SELECT n FROM llm_usage WHERE user_hash=? AND day=date('now')";
const BUMP_SQL =
  "INSERT INTO llm_usage (user_hash, day, n) VALUES (?, date('now'), 1) ON CONFLICT(user_hash, day) DO UPDATE SET n = n + 1";

export class SqliteAnswerCache implements AnswerCache {
  private db: DatabaseSync;
  private salt: string;
  constructor(dbPath: string, salt: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.salt = salt;
    this.db.exec(CACHE_SCHEMA_SQL);
  }
  async get(qkey: string): Promise<CachedAnswer | null> {
    const row = this.db.prepare(GET_SQL).get(qkey) as { reply: string; age_ms: number } | undefined;
    return row ? { reply: row.reply, ageMs: row.age_ms } : null;
  }
  async set(qkey: string, reply: string): Promise<void> {
    this.db.prepare(SET_SQL).run(qkey, reply);
  }
  async hitsToday(id: number): Promise<number> {
    const row = this.db.prepare(HITS_SQL).get(hashUser(this.salt, id)) as { n: number } | undefined;
    return row?.n ?? 0;
  }
  async bumpToday(id: number): Promise<void> {
    this.db.prepare(BUMP_SQL).run(hashUser(this.salt, id));
  }
}

export function createSqliteAnswerCache(): SqliteAnswerCache {
  return new SqliteAnswerCache(
    process.env.TELEMETRY_DB ?? 'data/deka.db',
    process.env.TELEMETRY_SALT ?? 'deka-mvp-salt',
  );
}

export interface D1CacheDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export class D1AnswerCache implements AnswerCache {
  constructor(
    private db: D1CacheDB,
    private salt: string,
  ) {}
  async get(qkey: string): Promise<CachedAnswer | null> {
    const row = await this.db.prepare(GET_SQL).bind(qkey).first<{ reply: string; age_ms: number }>();
    return row ? { reply: row.reply, ageMs: row.age_ms } : null;
  }
  async set(qkey: string, reply: string): Promise<void> {
    await this.db.prepare(SET_SQL).bind(qkey, reply).run();
  }
  async hitsToday(id: number): Promise<number> {
    const row = await this.db.prepare(HITS_SQL).bind(hashUser(this.salt, id)).first<{ n: number }>();
    return row?.n ?? 0;
  }
  async bumpToday(id: number): Promise<void> {
    await this.db.prepare(BUMP_SQL).bind(hashUser(this.salt, id)).run();
  }
}
