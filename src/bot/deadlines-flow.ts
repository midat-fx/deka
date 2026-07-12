/**
 * Команды дедлайнов и напоминаний:
 *   /dedlayny — показать ближайшие налоговые сроки (+ кнопка подписки)
 *   /napomni  — включить напоминания (за 7 и 1 день); /napomni стоп — выключить
 *
 * Сами напоминания шлёт cron в worker.ts (scheduled). Тут — только подписка
 * и показ. Логика дат — в src/domain/deadlines.ts (чистая, тестируемая).
 */
import { InlineKeyboard, type Bot } from 'grammy';
import { renderUpcoming } from '../domain/deadlines';
import type { ReminderStore } from '../store/reminders';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

function subKeyboard(subscribed: boolean): InlineKeyboard {
  return subscribed
    ? new InlineKeyboard().text('🔕 Отключить напоминания', 'rem|off')
    : new InlineKeyboard().text('🔔 Напоминать о дедлайнах', 'rem|on');
}

export function registerDeadlines(
  bot: Bot,
  reminders: ReminderStore,
  telemetry?: EventTracker,
  now: () => Date = () => new Date(),
): void {
  bot.command('dedlayny', async (ctx) => {
    const uid = ctx.from?.id;
    telemetry?.track(uid, 'deadlines', 'show');
    const subbed = uid !== undefined ? await reminders.isSubscribed(uid) : false;
    await ctx.reply(renderUpcoming(now()), {
      parse_mode: 'HTML',
      reply_markup: subKeyboard(subbed),
      ...NO_PREVIEW,
    });
  });

  bot.command('napomni', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const arg = (ctx.match ?? '').toString().trim().toLowerCase();
    if (/^(стоп|стой|off|выкл|отписаться|отключить)$/.test(arg)) {
      await reminders.unsubscribe(uid);
      telemetry?.track(uid, 'deadlines', 'unsub');
      await ctx.reply('Отключил напоминания о дедлайнах. Включить снова: /napomni', NO_PREVIEW);
      return;
    }
    await reminders.subscribe(uid);
    telemetry?.track(uid, 'deadlines', 'sub');
    await ctx.reply(
      '🔔 Готово — напомню за 7 и за 1 день до сдачи.\nБлижайшие сроки: /dedlayny · Отключить: /napomni стоп',
      NO_PREVIEW,
    );
  });

  bot.callbackQuery(/^rem\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const on = ctx.callbackQuery.data === 'rem|on';
    if (on) await reminders.subscribe(uid);
    else await reminders.unsubscribe(uid);
    telemetry?.track(uid, 'deadlines', on ? 'sub' : 'unsub');
    await ctx.answerCallbackQuery(on ? 'Напоминания включены 🔔' : 'Напоминания отключены');
    await ctx.editMessageReplyMarkup({ reply_markup: subKeyboard(on) });
  });
}
