/**
 * Команды дедлайнов и напоминаний:
 *   /dedlayny — показать ближайшие налоговые сроки (+ кнопка подписки)
 *   /napomni  — включить напоминания (за 7 и 1 день); /napomni стоп — выключить
 *
 * Сами напоминания шлёт cron в worker.ts (scheduled). Тут — только подписка
 * и показ. Логика дат — в src/domain/deadlines.ts (чистая, тестируемая).
 * Язык интерфейса — из prefs, иначе русский.
 */
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { renderUpcoming } from '../domain/deadlines';
import { DEADLINES_UI, type Lang } from '../i18n/i18n';
import type { ReminderStore } from '../store/reminders';
import type { PrefsStore } from '../store/prefs';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

function subKeyboard(subscribed: boolean, lang: Lang): InlineKeyboard {
  return subscribed
    ? new InlineKeyboard().text(DEADLINES_UI.subBtnOn[lang], 'rem|off')
    : new InlineKeyboard().text(DEADLINES_UI.subBtnOff[lang], 'rem|on');
}

/** Показать дедлайны с кнопкой подписки (зовёт и /dedlayny, и меню-роутер). */
export async function sendDeadlinesView(
  ctx: Context,
  reminders: ReminderStore,
  uid: number | undefined,
  lang: Lang = 'ru',
  now: () => Date = () => new Date(),
): Promise<void> {
  const subbed = uid !== undefined ? await reminders.isSubscribed(uid) : false;
  await ctx.reply(renderUpcoming(now(), lang), {
    parse_mode: 'HTML',
    reply_markup: subKeyboard(subbed, lang),
    ...NO_PREVIEW,
  });
}

export function registerDeadlines(
  bot: Bot,
  reminders: ReminderStore,
  telemetry?: EventTracker,
  prefs?: PrefsStore,
  now: () => Date = () => new Date(),
): void {
  const langOf = async (uid: number | undefined): Promise<Lang> =>
    (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? 'ru';

  bot.command('dedlayny', async (ctx) => {
    telemetry?.track(ctx.from?.id, 'deadlines', 'show');
    await sendDeadlinesView(ctx, reminders, ctx.from?.id, await langOf(ctx.from?.id), now);
  });

  bot.command('napomni', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    const arg = (ctx.match ?? '').toString().trim().toLowerCase();
    if (/^(стоп|стой|off|выкл|отписаться|отключить)$/.test(arg)) {
      await reminders.unsubscribe(uid);
      telemetry?.track(uid, 'deadlines', 'unsub');
      await ctx.reply(DEADLINES_UI.unsubDone[lang], NO_PREVIEW);
      return;
    }
    await reminders.subscribe(uid);
    telemetry?.track(uid, 'deadlines', 'sub');
    await ctx.reply(DEADLINES_UI.subDone[lang], NO_PREVIEW);
  });

  bot.callbackQuery(/^rem\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    const on = ctx.callbackQuery.data === 'rem|on';
    if (on) await reminders.subscribe(uid);
    else await reminders.unsubscribe(uid);
    telemetry?.track(uid, 'deadlines', on ? 'sub' : 'unsub');
    await ctx.answerCallbackQuery(on ? DEADLINES_UI.remOn[lang] : DEADLINES_UI.remOff[lang]);
    await ctx.editMessageReplyMarkup({ reply_markup: subKeyboard(on, lang) });
  });
}
