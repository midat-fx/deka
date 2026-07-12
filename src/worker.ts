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
import indexData from '../data/corpus/index.json';

export interface Env {
  BOT_TOKEN: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TELEMETRY_SALT?: string;
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
      bot = new Bot(env.BOT_TOKEN);
      registerWizard(bot, telemetry);
      registerSearch(bot, index, telemetry, llm); // после визарда: ловит свободный текст
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
