/**
 * Телеметрия для Cloudflare Workers: события → D1 (облачный SQLite).
 *
 * Схема таблицы идентична локальной (см. events.ts). Отличие рантайма:
 * D1 асинхронный, а track() должен быть sync и не ронять бота. Поэтому
 * события копятся в очередь, а после обработки апдейта worker вызывает
 * flush(ctx) — вставки уезжают через ctx.waitUntil (Workers гарантирует,
 * что промисы в waitUntil доживут после отправки ответа).
 *
 * node:crypto доступен через compatibility_flags: ["nodejs_compat"].
 */
import { createHash } from 'node:crypto';
import type { EventName, EventTracker } from './types';

/** Минимальные типы D1/ExecutionContext — без зависимости от workers-types. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}
export interface CtxLike {
  waitUntil(promise: Promise<unknown>): void;
}

interface PendingEvent {
  userHash: string;
  event: EventName;
  detail: string | null;
}

export const EVENTS_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  user_hash TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_hash);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);`;

export class D1Telemetry implements EventTracker {
  private queue: PendingEvent[] = [];

  constructor(
    private db: D1Like,
    private salt: string,
  ) {}

  hashUser(telegramId: number): string {
    return createHash('sha256')
      .update(`${this.salt}:${telegramId}`)
      .digest('hex')
      .slice(0, 16);
  }

  track(telegramId: number | undefined, event: EventName, detail?: string): void {
    if (telegramId === undefined) return;
    try {
      this.queue.push({ userHash: this.hashUser(telegramId), event, detail: detail ?? null });
    } catch (err) {
      console.error('telemetry error (ignored):', err);
    }
  }

  /** Отправить накопленное в D1, не блокируя ответ пользователю. */
  flush(ctx: CtxLike): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    ctx.waitUntil(
      Promise.all(
        batch.map((e) =>
          this.db
            .prepare('INSERT INTO events (user_hash, event, detail) VALUES (?, ?, ?)')
            .bind(e.userHash, e.event, e.detail)
            .run(),
        ),
      ).catch((err) => console.error('telemetry flush error (ignored):', err)),
    );
  }
}
