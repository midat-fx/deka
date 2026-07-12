/**
 * Обработчик человеческих фраз и кнопок меню — регистрируется ПЕРЕД поиском.
 *
 * Ловит намерения из router.ts («переключи на казахский», «заработал 500
 * тысяч», «да», кнопки меню) и выполняет действие; всё остальное пропускает
 * дальше (next) — в поиск по кодексу. Запись дохода из фразы — только через
 * inline-подтверждение (защита от ложных срабатываний парсера).
 */
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { routeIntent } from './router';
import { mainKeyboard } from './keyboard';
import { sendWizardStart, languageKeyboard } from './wizard-flow';
import { sendTurnoverStatus, logIncome } from './turnover-flow';
import { sendDeadlinesView } from './deadlines-flow';
import { renderForm910 } from '../domain/form910';
import { formatTenge } from '../domain/format';
import {
  HELP,
  TIL_PROMPT,
  TIL_SET,
  CONFIRM_LOST,
  INCOME_CONFIRM,
  ASK_AMOUNT,
  YES,
  NO,
  CANCELLED,
  type Lang,
} from '../i18n/i18n';
import type { PrefsStore } from '../store/prefs';
import type { TurnoverStore } from '../store/turnover';
import type { ReminderStore } from '../store/reminders';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

/** Форма 910: чеклист + калькулятор с прикидкой из трекера. */
export async function sendForm910(ctx: Context, turnover: TurnoverStore, uid: number): Promise<void> {
  const totals = await turnover.totals(uid);
  await ctx.reply(renderForm910(totals.yearTotal > 0 ? totals.yearTotal : null), {
    parse_mode: 'HTML',
    ...NO_PREVIEW,
  });
}

export interface RouterDeps {
  prefs?: PrefsStore;
  turnover: TurnoverStore;
  reminders: ReminderStore;
  telemetry?: EventTracker;
}

export function registerTextRouter(bot: Bot, deps: RouterDeps): void {
  const { prefs, turnover, reminders, telemetry } = deps;
  const langOf = async (uid: number | undefined): Promise<Lang> =>
    (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? 'ru';

  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return next();
    const uid = ctx.from?.id;
    if (uid === undefined) return next();

    const intent = routeIntent(text);
    if (!intent) return next(); // настоящий вопрос — в поиск по кодексу

    const lang = await langOf(uid);
    telemetry?.track(uid, 'intent', intent.kind === 'menu' ? `menu:${intent.action}` : intent.kind);

    switch (intent.kind) {
      case 'menu':
        switch (intent.action) {
          case 'wizard':
            return sendWizardStart(ctx);
          case 'turnover':
            return sendTurnoverStatus(ctx, turnover, uid);
          case 'income':
            await ctx.reply(ASK_AMOUNT[lang], NO_PREVIEW);
            return;
          case 'deadlines':
            return sendDeadlinesView(ctx, reminders, uid);
          case 'form910':
            return sendForm910(ctx, turnover, uid);
          case 'language':
            await ctx.reply(TIL_PROMPT[lang], { reply_markup: languageKeyboard() });
            return;
          case 'help':
            await ctx.reply(HELP[lang], { reply_markup: mainKeyboard(lang), ...NO_PREVIEW });
            return;
        }
        return;

      case 'set_lang': {
        if (prefs) await prefs.setLang(uid, intent.lang);
        telemetry?.track(uid, 'lang', intent.lang);
        await ctx.reply(TIL_SET[intent.lang], { reply_markup: mainKeyboard(intent.lang) });
        return;
      }

      case 'choose_lang':
        await ctx.reply(TIL_PROMPT[lang], { reply_markup: languageKeyboard() });
        return;

      case 'bare_confirm':
        // «да/ок/иә» без контекста: не гадаем и не ищем по кодексу.
        await ctx.reply(CONFIRM_LOST[lang], { reply_markup: mainKeyboard(lang), ...NO_PREVIEW });
        return;

      case 'log_income': {
        const kb = new InlineKeyboard()
          .text(YES[lang], `inc|${intent.amount}`)
          .text(NO[lang], 'inc|no');
        await ctx.reply(INCOME_CONFIRM[lang](formatTenge(intent.amount)), {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      }

      case 'deadlines':
        return sendDeadlinesView(ctx, reminders, uid);

      case 'form910':
        return sendForm910(ctx, turnover, uid);

      case 'wizard':
        return sendWizardStart(ctx);
    }
  });

  bot.command('910', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    telemetry?.track(uid, 'intent', 'form910');
    await sendForm910(ctx, turnover, uid);
  });

  bot.callbackQuery(/^inc\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const value = (ctx.callbackQuery.data ?? '').split('|')[1] ?? '';
    const lang = await langOf(uid);

    if (value === 'no') {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(CANCELLED[lang]);
      return;
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery('✅');
    await ctx.editMessageText(INCOME_CONFIRM[lang](formatTenge(amount)) + ' — ✅');
    telemetry?.track(uid, 'turnover', 'add');
    await logIncome(ctx, turnover, uid, amount);
  });
}
