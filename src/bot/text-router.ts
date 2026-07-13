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
import { mainKeyboard, resultKeyboard } from './keyboard';
import { sendWizardStart, languageKeyboard } from './wizard-flow';
import { sendTurnoverStatus, logIncome } from './turnover-flow';
import { sendDeadlinesView } from './deadlines-flow';
import { renderForm910, renderSetAside } from '../domain/form910';
import { renderVatCalc } from '../domain/vat';
import { parseAmount } from '../domain/turnover';
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
  SETTINGS_TITLE,
  SETTINGS_BTN,
  REM_TOGGLED,
  PRO_ABOUT,
  PRO_JOIN_BUTTON,
  PRO_JOINED,
  PRIVACY_CONFIRM,
  PRIVACY_YES,
  PRIVACY_DONE,
  FACTCHECK_PROMPT,
  type Lang,
} from '../i18n/i18n';
import type { PrefsStore } from '../store/prefs';
import type { TurnoverStore } from '../store/turnover';
import type { ReminderStore } from '../store/reminders';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

/** Форма 910: чеклист + калькулятор с прикидкой из трекера. */
export async function sendForm910(
  ctx: Context,
  turnover: TurnoverStore,
  uid: number,
  lang: Lang = 'ru',
): Promise<void> {
  const totals = await turnover.totals(uid);
  await ctx.reply(renderForm910(totals.yearTotal > 0 ? totals.yearTotal : null, lang), {
    parse_mode: 'HTML',
    reply_markup: resultKeyboard(lang, { remind: true }),
    ...NO_PREVIEW,
  });
}

/** Клавиатура экрана настроек. Кнопка напоминаний отражает текущее состояние. */
function settingsKeyboard(lang: Lang, remindersOn: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text(SETTINGS_BTN.language[lang], 'set|lang')
    .row()
    .text(remindersOn ? SETTINGS_BTN.remindersOn[lang] : SETTINGS_BTN.remindersOff[lang], 'set|rem')
    .row()
    .text(SETTINGS_BTN.pro[lang], 'set|pro')
    .row()
    .text(SETTINGS_BTN.wipe[lang], 'set|wipe');
}

/** Показать экран «⚙️ Настройки» (зовёт и меню-кнопка, и /settings). */
export async function sendSettings(
  ctx: Context,
  reminders: ReminderStore,
  uid: number,
  lang: Lang,
): Promise<void> {
  const on = await reminders.isSubscribed(uid);
  await ctx.reply(SETTINGS_TITLE[lang], {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(lang, on),
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
            return sendTurnoverStatus(ctx, turnover, uid, lang);
          case 'income':
            await ctx.reply(ASK_AMOUNT[lang], NO_PREVIEW);
            return;
          case 'deadlines':
            return sendDeadlinesView(ctx, reminders, uid, lang);
          case 'form910':
            return sendForm910(ctx, turnover, uid, lang);
          case 'language':
            await ctx.reply(TIL_PROMPT[lang], { reply_markup: languageKeyboard() });
            return;
          case 'settings':
            telemetry?.track(uid, 'settings', 'show');
            return sendSettings(ctx, reminders, uid, lang);
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

      case 'vat':
        await ctx.reply(renderVatCalc(intent.amount, lang), {
          parse_mode: 'HTML',
          reply_markup: resultKeyboard(lang),
          ...NO_PREVIEW,
        });
        return;

      case 'setaside':
        await ctx.reply(renderSetAside(intent.amount, lang), {
          parse_mode: 'HTML',
          reply_markup: resultKeyboard(lang),
          ...NO_PREVIEW,
        });
        return;

      case 'factcheck':
        // Просим вставить ответ ИИ ответом на это сообщение (force_reply —
        // маркер: сам фактчек ловит reply_to в search-flow, где есть LLM).
        await ctx.reply(FACTCHECK_PROMPT[lang], { reply_markup: { force_reply: true } });
        return;

      case 'deadlines':
        return sendDeadlinesView(ctx, reminders, uid, lang);

      case 'form910':
        return sendForm910(ctx, turnover, uid, lang);

      case 'wizard':
        return sendWizardStart(ctx);
    }
  });

  bot.command('910', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    telemetry?.track(uid, 'intent', 'form910');
    await sendForm910(ctx, turnover, uid, await langOf(uid));
  });

  bot.command('nds', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    telemetry?.track(uid, 'intent', 'vat');
    const amount = parseAmount((ctx.match ?? '').toString().trim());
    if (amount === null) {
      await ctx.reply(ASK_AMOUNT[lang], NO_PREVIEW);
      return;
    }
    await ctx.reply(renderVatCalc(amount, lang), {
      parse_mode: 'HTML',
      reply_markup: resultKeyboard(lang),
      ...NO_PREVIEW,
    });
  });

  bot.command('settings', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    telemetry?.track(uid, 'settings', 'show');
    await sendSettings(ctx, reminders, uid, await langOf(uid));
  });

  bot.command('privacy', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    await ctx.reply(PRIVACY_CONFIRM[lang], {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(PRIVACY_YES[lang], 'set|wipe2')
        .row()
        .text(NO[lang], 'set|wipex'),
    });
  });

  // Экран настроек: язык · напоминания (тумблер) · Deka Pro · удалить данные.
  bot.callbackQuery(/^set\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const action = (ctx.callbackQuery.data ?? '').split('|')[1] ?? '';
    const lang = await langOf(uid);

    switch (action) {
      case 'lang':
        await ctx.answerCallbackQuery();
        await ctx.reply(TIL_PROMPT[lang], { reply_markup: languageKeyboard() });
        return;

      case 'rem': {
        const on = !(await reminders.isSubscribed(uid));
        if (on) await reminders.subscribe(uid);
        else await reminders.unsubscribe(uid);
        telemetry?.track(uid, 'deadlines', on ? 'sub' : 'unsub');
        await ctx.answerCallbackQuery(REM_TOGGLED[lang](on));
        await ctx.editMessageReplyMarkup({ reply_markup: settingsKeyboard(lang, on) });
        return;
      }

      case 'pro':
        telemetry?.track(uid, 'pro', 'view');
        await ctx.answerCallbackQuery();
        await ctx.reply(PRO_ABOUT[lang], {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(PRO_JOIN_BUTTON[lang], 'set|projoin'),
          ...NO_PREVIEW,
        });
        return;

      case 'projoin':
        // Реальный сигнал готовности платить (в отличие от простого «view»).
        telemetry?.track(uid, 'pro', 'waitlist');
        await ctx.answerCallbackQuery('🙌');
        await ctx.editMessageText(PRO_JOINED[lang]);
        return;

      case 'wipe':
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(PRIVACY_CONFIRM[lang], {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(PRIVACY_YES[lang], 'set|wipe2')
            .row()
            .text(NO[lang], 'set|wipex'),
        });
        return;

      case 'wipe2':
        await turnover.reset(uid);
        await reminders.unsubscribe(uid);
        if (prefs) await prefs.clear(uid);
        telemetry?.track(uid, 'privacy', 'wipe');
        await ctx.answerCallbackQuery('🗑️');
        await ctx.editMessageText(PRIVACY_DONE[lang]);
        return;

      case 'wipex':
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(SETTINGS_TITLE[lang], {
          parse_mode: 'HTML',
          reply_markup: settingsKeyboard(lang, await reminders.isSubscribed(uid)),
        });
        return;
    }
  });

  // Follow-up кнопки под ответом → инструменты (обработчик здесь: есть все зависимости).
  bot.callbackQuery(/^nav\|/, async (ctx) => {
    const uid = ctx.from?.id;
    await ctx.answerCallbackQuery();
    if (uid === undefined) return;
    const dest = (ctx.callbackQuery.data ?? '').split('|')[1] ?? '';
    const lang = await langOf(uid);
    telemetry?.track(uid, 'intent', `nav:${dest}`);
    switch (dest) {
      case '910':
        return sendForm910(ctx, turnover, uid, lang);
      case 'oborot':
        return sendTurnoverStatus(ctx, turnover, uid, lang);
      case 'dedlayny':
        return sendDeadlinesView(ctx, reminders, uid, lang);
    }
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
    await logIncome(ctx, turnover, uid, amount, lang);
  });
}
