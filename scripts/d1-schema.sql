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

-- Настройки пользователя (хэш id → язык + выбранный режим для «Моей карточки»)
CREATE TABLE IF NOT EXISTS user_prefs (
  user_hash TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  regime TEXT
);
-- Миграция для БД, созданных до колонки regime (на новой БД — no-op с ошибкой):
--   wrangler d1 execute deka-telemetry --remote --command "ALTER TABLE user_prefs ADD COLUMN regime TEXT"

-- Кэш LLM-ответов (ключ = стем-токены+язык) и дневной лимит вопросов
CREATE TABLE IF NOT EXISTS answer_cache (
  qkey TEXT PRIMARY KEY,
  reply TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS llm_usage (
  user_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_hash, day)
);
