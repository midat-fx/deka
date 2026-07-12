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
      registerWizard(bot, telemetry);
      registerTurnover(bot, turnover, telemetry);
      registerSearch(bot, index, telemetry, llm, retrieval); // после визарда: ловит свободный текст
      bot.catch((err) => console.error('bot error:', err.error));
      handleUpdate = webhookCallback(bot, 'cloudflare-mod') as (
        req: Request,
      ) => Promise<Response>;
    }

    const url = new URL(request.url);
    // Секретный путь = токен: Telegram знает его, посторонние — нет.
    if (request.method === 'POST' && url.pathname === `/${env.BOT_TOKEN}`) {
      try {
        return await handleUpdate!(request);
      } finally {
        telemetry!.flush(ctx);
      }
    }
    return new Response('Deka is running. Talk to me on Telegram: https://t.me/deka_tax_bot');
  },
};
