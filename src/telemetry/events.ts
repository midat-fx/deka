/**
 * Телеметрия Deka: события в локальном SQLite.
 *
 * Зачем: Telegram не даёт ботам никакой статистики. Все цифры для кейсов и
 * резюме («N пользователей, M вопросов, X% дошли до результата») существуют,
 * только если мы записываем их сами с первого дня.
 *
 * Приватность: сырой telegram-id НЕ храним — только необратимый хэш
 * (sha256 + соль). Тексты сообщений НЕ храним — только тип события
 * и служебные детали (какая кнопка, какой режим выпал).
 *
 * Почему node:sqlite: встроен в Node с 22.5+ (у нас Node 26) — ноль
 * зависимостей, нечему ломаться. На Cloudflare Workers заменим на D1
 * (это тот же SQLite, схема переедет как есть).
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type EventName =
  | 'start' // пользователь запустил /start
  | 'help' // открыл /help
  | 'wizard_answer' // ответил на вопрос визарда (detail: поле=значение)
  | 'wizard_result' // дошёл до рекомендации (detail: какой режим)
  | 'wizard_restart' // нажал «пройти заново»
  | 'free_text' // (устар.) свободный текст до появления поиска
  | 'search'; // поиск по кодексу (detail: hits/top/score либо refused; сам текст не храним)

export class Telemetry {
  private db: DatabaseSync;
  private insert: ReturnType<DatabaseSync['prepare']>;
  private salt: string;

  constructor(dbPath: string, salt: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.salt = salt;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL DEFAULT (datetime('now')),
        user_hash TEXT NOT NULL,
        event TEXT NOT NULL,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
      CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_hash);
      CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
    `);
    this.insert = this.db.prepare(
      'INSERT INTO events (user_hash, event, detail) VALUES (?, ?, ?)',
    );
  }

  /** Необратимый хэш telegram-id: идентифицирует юзера, не раскрывая его. */
  hashUser(telegramId: number): string {
    return createHash('sha256')
      .update(`${this.salt}:${telegramId}`)
      .digest('hex')
      .slice(0, 16);
  }

  /** Записать событие. Никогда не бросает — телеметрия не должна ронять бота. */
  track(telegramId: number | undefined, event: EventName, detail?: string): void {
    if (telegramId === undefined) return;
    try {
      this.insert.run(this.hashUser(telegramId), event, detail ?? null);
    } catch (err) {
      console.error('telemetry error (ignored):', err);
    }
  }

  /** Сводка для npm run stats и для кейсов. */
  summary(): {
    uniqueUsers: number;
    totalEvents: number;
    byEvent: { event: string; count: number }[];
    byDay: { day: string; users: number; events: number }[];
    funnel: { started: number; reachedResult: number };
    regimes: { regime: string; count: number }[];
  } {
    const one = (sql: string) => this.db.prepare(sql).get() as Record<string, number>;
    const all = (sql: string) => this.db.prepare(sql).all() as Record<string, unknown>[];

    const uniq = one('SELECT COUNT(DISTINCT user_hash) AS n FROM events');
    const total = one('SELECT COUNT(*) AS n FROM events');
    const byEvent = all(
      'SELECT event, COUNT(*) AS count FROM events GROUP BY event ORDER BY count DESC',
    ) as { event: string; count: number }[];
    const byDay = all(
      `SELECT date(ts) AS day, COUNT(DISTINCT user_hash) AS users, COUNT(*) AS events
       FROM events GROUP BY date(ts) ORDER BY day DESC LIMIT 31`,
    ) as { day: string; users: number; events: number }[];
    const started = one(
      "SELECT COUNT(DISTINCT user_hash) AS n FROM events WHERE event = 'start'",
    );
    const reached = one(
      "SELECT COUNT(DISTINCT user_hash) AS n FROM events WHERE event = 'wizard_result'",
    );
    const regimes = all(
      `SELECT detail AS regime, COUNT(*) AS count FROM events
       WHERE event = 'wizard_result' GROUP BY detail ORDER BY count DESC`,
    ) as { regime: string; count: number }[];

    return {
      uniqueUsers: uniq.n ?? 0,
      totalEvents: total.n ?? 0,
      byEvent,
      byDay,
      funnel: { started: started.n ?? 0, reachedResult: reached.n ?? 0 },
      regimes,
    };
  }

  close(): void {
    this.db.close();
  }
}

/** Единый экземпляр для бота (путь и соль можно переопределить через env). */
export function createTelemetry(): Telemetry {
  const dbPath = process.env.TELEMETRY_DB ?? 'data/deka.db';
  const salt = process.env.TELEMETRY_SALT ?? 'deka-mvp-salt';
  return new Telemetry(dbPath, salt);
}
