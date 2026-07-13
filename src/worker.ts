/**
 * Cloudflare Workers-версия Deka: Telegram шлёт апдейты на webhook,
 * Worker отвечает. 24/7 без сервера, free tier 100k запросов/день.
 *
 * Отличия от локального рантайма (src/bot/index.ts):
 *  - индекс поиска НЕ строится, а загружается предвычисленным
 *    (data/corpus/index.json, собирается `npm run build:index`) — на проде
 *    нет файловой системы и лимит CPU не позволяет токенизировать корпус;
 *  - телеметрия — в D1 (облачный SQLite), вставки уходят через waitUntil
 *    после ответа пользователю (см. src/telemetry/d1.ts).
 *
 * Деплой: см. SETUP.md → «Прод на Cloudflare».
 */
import { Bot, webhookCallback } from 'grammy';
import { registerWizard } from './bot/wizard-flow';
import { registerSearch } from './bot/search-flow';
import { SearchIndex, type SerializedIndex } from './rag/search';
import { D1Telemetry, type D1Like, type CtxLike } from './telemetry/d1';
import { neon } from '@neondatabase/serverless';
import type { SqlExecutor } from './rag/vector-search';
import { registerTurnover } from './bot/turnover-flow';
import { D1Turnover, type D1TurnoverDB } from './store/turnover';
import { registerDeadlines } from './bot/deadlines-flow';
import { registerTextRouter } from './bot/text-router';
import { D1Reminders, type D1RemindersDB } from './store/reminders';
import { D1Prefs, type D1PrefsDB } from './store/prefs';
import { D1AnswerCache, type D1CacheDB } from './store/answer-cache';
import { dueReminders, renderReminder } from './domain/deadlines';
import type { Lang } from './i18n/i18n';
import indexData from '../data/corpus/index.json';

export interface Env {
  BOT_TOKEN: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TELEMETRY_SALT?: string;
  DATABASE_URL?: string;
  DB: D1Like;
}

// Кэш на тёплый isolate: бот и индекс создаются при первом запросе.
let bot: Bot | null = null;
let telemetry: D1Telemetry | null = null;
let handleUpdate: ((req: Request) => Promise<Response>) | null = null;
const seenUpdates = new Set<number>();

export default {
  async fetch(request: Request, env: Env, ctx: CtxLike): Promise<Response> {
    if (!env.BOT_TOKEN) return new Response('BOT_TOKEN is not set', { status: 500 });

    if (!bot) {
      const index = SearchIndex.fromSerialized(indexData as unknown as SerializedIndex);
      telemetry = new D1Telemetry(env.DB, env.TELEMETRY_SALT ?? 'deka-mvp-salt');
      const llm = env.GEMINI_API_KEY
        ? { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }
        : undefined;
      const retrieval =
        env.DATABASE_URL && env.GEMINI_API_KEY
          ? { sql: neon(env.DATABASE_URL) as unknown as SqlExecutor, apiKey: env.GEMINI_API_KEY }
          : undefined;
      bot = new Bot(env.BOT_TOKEN);
      const turnover = new D1Turnover(
        env.DB as unknown as D1TurnoverDB,
        env.TELEMETRY_SALT ?? 'deka-mvp-salt',
      );
      const reminders = new D1Reminders(env.DB as unknown as D1RemindersDB);
      const prefs = new D1Prefs(env.DB as unknown as D1PrefsDB, env.TELEMETRY_SALT ?? 'deka-mvp-salt');
      const cache = new D1AnswerCache(env.DB as unknown as D1CacheDB, env.TELEMETRY_SALT ?? 'deka-mvp-salt');
      registerWizard(bot, telemetry, prefs);
      registerTurnover(bot, turnover, telemetry, prefs);
      registerDeadlines(bot, reminders, telemetry, prefs);
      // Роутер человеческих фраз и кнопок меню — ДО поиска.
      registerTextRouter(bot, { prefs, turnover, reminders, telemetry });
      registerSearch(bot, index, telemetry, llm, retrieval, prefs, cache); // последним: ловит свободный текст
      bot.catch((err) => console.error('bot error:', err.error));
      // Дефолт grammy — 10s и throw: Telegram получает 500 и ретраит апдейт,
      // сжигая квоту Gemini дважды. Даём запас (гибрид+LLM ≤ ~12s) и на
      // таймауте отвечаем 200 — ретрай не нужен.
      handleUpdate = webhookCallback(bot, 'cloudflare-mod', {
        timeoutMilliseconds: 25_000,
        onTimeout: 'return',
      }) as (req: Request) => Promise<Response>;
    }

    const url = new URL(request.url);
    // Секретный путь = токен: Telegram знает его, посторонние — нет.
    if (request.method === 'POST' && url.pathname === `/${env.BOT_TOKEN}`) {
      // Дедуп ретраев Telegram по update_id (память изолята, последние 200:
      // ловит типичный ретрай в тёплый изолят; межизолятные дубли редки).
      try {
        const body = (await request.clone().json()) as { update_id?: number };
        if (body.update_id !== undefined) {
          if (seenUpdates.has(body.update_id)) return new Response('ok (dup)');
          seenUpdates.add(body.update_id);
          if (seenUpdates.size > 200) {
            const first = seenUpdates.values().next().value;
            if (first !== undefined) seenUpdates.delete(first);
          }
        }
      } catch {
        /* не JSON — пусть разбирается grammy */
      }
      try {
        return await handleUpdate!(request);
      } finally {
        telemetry!.flush(ctx);
      }
    }
    return new Response('Deka is running. Talk to me on Telegram: https://t.me/deka_tax_bot');
  },

  // Cron (см. wrangler.jsonc → triggers.crons): раз в сутки шлём напоминания
  // подписчикам о дедлайнах, до сдачи которых 7 или 1 день.
  // Закалено: 403 (юзер заблокировал бота) → отписка, 429 → пауза retry_after,
  // отправка пачками по 25 с паузой — лимит Telegram ~30 сообщений/сек.
  async scheduled(_event: unknown, env: Env, _ctx: CtxLike): Promise<void> {
    const today = new Date();
    const due = dueReminders(today);
    if (due.length === 0) return;
    const reminders = new D1Reminders(env.DB as unknown as D1RemindersDB);
    const subs = await reminders.listSubscribers();
    if (subs.length === 0) return;

    // Язык каждого подписчика (один раз) — напоминание придёт на его языке.
    const salt = env.TELEMETRY_SALT ?? 'deka-mvp-salt';
    const prefs = new D1Prefs(env.DB as unknown as D1PrefsDB, salt);
    const langByChat = new Map<number, Lang>();
    await Promise.all(
      subs.map(async (id) => langByChat.set(id, (await prefs.getLang(id)) ?? 'ru')),
    );

    for (const d of due) {
      // Рендерим на всех языках заранее — потом раздаём по языку подписчика.
      const texts: Record<Lang, string> = {
        ru: renderReminder(d, today, 'ru'),
        kk: renderReminder(d, today, 'kk'),
        en: renderReminder(d, today, 'en'),
      };
      for (let i = 0; i < subs.length; i += 25) {
        const chunk = subs.slice(i, i + 25);
        await Promise.allSettled(
          chunk.map((chatId) =>
            sendReminder(env.BOT_TOKEN, chatId, texts[langByChat.get(chatId) ?? 'ru'], reminders),
          ),
        );
        if (i + 25 < subs.length) await sleep(1_100);
      }
    }
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendReminder(
  token: string,
  chatId: number,
  text: string,
  reminders: D1Reminders,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    });
    if (res.ok) return;
    if (res.status === 403) {
      // Юзер заблокировал бота — отписываем, чтобы не долбиться вечно.
      await reminders.unsubscribe(chatId).catch(() => {});
      return;
    }
    if (res.status === 429) {
      const data = (await res.json().catch(() => null)) as {
        parameters?: { retry_after?: number };
      } | null;
      await sleep(Math.min((data?.parameters?.retry_after ?? 3) * 1000, 30_000));
      continue; // одна повторная попытка
    }
    console.error(`reminder to ${chatId} failed: ${res.status}`);
    return;
  }
}
