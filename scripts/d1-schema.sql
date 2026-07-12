-- Схема телеметрии в D1 — идентична локальной (src/telemetry/events.ts).
-- Применение: npx wrangler d1 execute deka-telemetry --remote --file scripts/d1-schema.sql
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

-- Трекер оборота (та же схема, что src/store/turnover.ts)
CREATE TABLE IF NOT EXISTS turnover (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_turnover_user ON turnover(user_hash);

-- Подписчики на напоминания о дедлайнах (тут НАСТОЯЩИЙ telegram-id, не хэш — нужно писать человеку)
CREATE TABLE IF NOT EXISTS reminder_subs (
  user_id INTEGER PRIMARY KEY,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
