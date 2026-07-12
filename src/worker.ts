/**
 * Cloudflare Workers-версия Deka: Telegram шлёт апдейты на webhook,
 * Worker отвечает. Работает 24/7 без сервера, free tier 100k запросов/день.
 *
 * Локальная разработка остаётся на long-polling (src/bot/index.ts) —
 * там не нужен публичный URL. Один и тот же registerWizard в обоих режимах.
 *
 * TODO(D1): телеметрия на Workers поедет в Cloudflare D1 (тот же SQLite,
 * та же схема events) — подключим при деплое. Пока webhook-версия работает
 * без телеметрии, локальная — с ней.
 *
 * Деплой (после `npx wrangler login`):
 *   npx wrangler secret put BOT_TOKEN     # вставить токен
 *   npx wrangler deploy
 *   затем один раз назначить webhook:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker-url>/<секретный-путь>"
 */
import { Bot, webhookCallback } from 'grammy';
import { registerWizard } from './bot/wizard-flow';

export interface Env {
  BOT_TOKEN: string;
}

let bot: Bot | null = null;
let handleUpdate: ((req: Request) => Promise<Response>) | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.BOT_TOKEN) return new Response('BOT_TOKEN is not set', { status: 500 });

    // Ленивая инициализация: бот создаётся при первом запросе и переживает
    // тёплые вызовы Workers.
    if (!bot) {
      bot = new Bot(env.BOT_TOKEN);
      registerWizard(bot);
      handleUpdate = webhookCallback(bot, 'cloudflare-mod') as (
        req: Request,
      ) => Promise<Response>;
    }

    const url = new URL(request.url);
    // Секретный путь = токен: Telegram знает его, посторонние — нет.
    if (request.method === 'POST' && url.pathname === `/${env.BOT_TOKEN}`) {
      return handleUpdate!(request);
    }
    return new Response('Deka bot is running. Talk to me on Telegram: @deka_tax_bot');
  },
};
