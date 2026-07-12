/**
 * Хранилище оборота пользователя. Локально — SQLite (node:sqlite),
 * в проде на Cloudflare — D1 (тот же SQLite, та же схема).
 *
 * Отличие от телеметрии: тут нужен read-after-write (записал доход → сразу
 * показал сумму), поэтому операции ожидаются (await), а не отправляются
 * «в фоне» через waitUntil.
 *
 * Приватность: ключ — хэш telegram-id (см. util/hash), а не сам id.
 * Храним только суммы, без имён.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashUser } from '../util/hash';

export interface Totals {
  monthTotal: number;
  yearTotal: number;
}

export interface TurnoverStore {
  add(telegramId: number, amount: number): Promise<Totals>;
  totals(telegramId: number): Promise<Totals>;
  reset(telegramId: number): Promise<void>;
  /** Удалить последнюю запись; вернуть её сумму (null — нечего отменять). */
  undoLast(telegramId: number): Promise<number | null>;
}

export const TURNOVER_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS turnover (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_turnover_user ON turnover(user_hash);`;

// Периоды считаем в SQL от «сейчас»: текущий календарный месяц и год.
const MONTH_SQL =
  "SELECT COALESCE(SUM(amount),0) AS s FROM turnover WHERE user_hash=? AND strftime('%Y-%m',ts)=strftime('%Y-%m','now')";
const YEAR_SQL =
  "SELECT COALESCE(SUM(amount),0) AS s FROM turnover WHERE user_hash=? AND strftime('%Y',ts)=strftime('%Y','now')";
const INSERT_SQL = 'INSERT INTO turnover (user_hash, amount) VALUES (?, ?)';
const DELETE_SQL = 'DELETE FROM turnover WHERE user_hash=?';
const UNDO_SQL =
  'DELETE FROM turnover WHERE id = (SELECT id FROM turnover WHERE user_hash=? ORDER BY id DESC LIMIT 1) RETURNING amount';

/** Локальное хранилище (dev): синхронный node:sqlite, обёрнутый в Promise. */
export class SqliteTurnover implements TurnoverStore {
  private db: DatabaseSync;
  private salt: string;

  constructor(dbPath: string, salt: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.salt = salt;
    this.db.exec(TURNOVER_SCHEMA_SQL);
  }

  private read(hash: string): Totals {
    const m = this.db.prepare(MONTH_SQL).get(hash) as { s: number };
    const y = this.db.prepare(YEAR_SQL).get(hash) as { s: number };
    return { monthTotal: m.s, yearTotal: y.s };
  }

  async add(telegramId: number, amount: number): Promise<Totals> {
    const hash = hashUser(this.salt, telegramId);
    this.db.prepare(INSERT_SQL).run(hash, amount);
    return this.read(hash);
  }

  async totals(telegramId: number): Promise<Totals> {
    return this.read(hashUser(this.salt, telegramId));
  }

  async reset(telegramId: number): Promise<void> {
    this.db.prepare(DELETE_SQL).run(hashUser(this.salt, telegramId));
  }

  async undoLast(telegramId: number): Promise<number | null> {
    const row = this.db.prepare(UNDO_SQL).get(hashUser(this.salt, telegramId)) as
      | { amount: number }
      | undefined;
    return row?.amount ?? null;
  }
}

export function createSqliteTurnover(): SqliteTurnover {
  const dbPath = process.env.TELEMETRY_DB ?? 'data/deka.db';
  const salt = process.env.TELEMETRY_SALT ?? 'deka-mvp-salt';
  return new SqliteTurnover(dbPath, salt);
}

/** Минимальный интерфейс D1 (с .first() для чтения сумм). */
export interface D1TurnoverDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

/** Прод-хранилище на Cloudflare D1. */
export class D1Turnover implements TurnoverStore {
  constructor(
    private db: D1TurnoverDB,
    private salt: string,
  ) {}

  private async read(hash: string): Promise<Totals> {
    const m = await this.db.prepare(MONTH_SQL).bind(hash).first<{ s: number }>();
    const y = await this.db.prepare(YEAR_SQL).bind(hash).first<{ s: number }>();
    return { monthTotal: m?.s ?? 0, yearTotal: y?.s ?? 0 };
  }

  async add(telegramId: number, amount: number): Promise<Totals> {
    const hash = hashUser(this.salt, telegramId);
    await this.db.prepare(INSERT_SQL).bind(hash, amount).run();
    return this.read(hash);
  }

  async totals(telegramId: number): Promise<Totals> {
    return this.read(hashUser(this.salt, telegramId));
  }

  async reset(telegramId: number): Promise<void> {
    await this.db.prepare(DELETE_SQL).bind(hashUser(this.salt, telegramId)).run();
  }

  async undoLast(telegramId: number): Promise<number | null> {
    const row = await this.db
      .prepare(UNDO_SQL)
      .bind(hashUser(this.salt, telegramId))
      .first<{ amount: number }>();
    return row?.amount ?? null;
  }
}
