/**
 * Трекер оборота:
 *   /oborot 500000 — записать доход; /oborot — статус; /oborot сброс — обнулить
 *   (сброс — только через inline-подтверждение: годовой учёт нельзя терять
 *   по опечатке; после записи есть кнопка «отменить последнюю»).
 * Хелперы sendTurnoverStatus/logIncome экспортируются — их зовёт и меню-роутер.
 * Язык интерфейса — из prefs (сохранённый выбор), иначе русский.
 */
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { assessTurnover, parseAmount, type TurnoverView } from '../domain/turnover';
import { LIMITS_TENGE } from '../domain/regimes';
import { formatTenge } from '../domain/format';
import { TURNOVER_UI, MONTHS_NOM, type Lang } from '../i18n/i18n';
import type { TurnoverStore } from '../store/turnover';
import type { PrefsStore } from '../store/prefs';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

function bar(pct: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(pct * 10)));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

function mark(pct: number): string {
  return pct > 1 ? '🔴' : pct >= 0.8 ? '⚠️' : '✅';
}

function line(name: string, total: number, limit: number, pct: number, lang: Lang): string {
  return `${mark(pct)} <b>${name}</b>\n   ${bar(pct)} ${Math.round(pct * 100)}% — ${formatTenge(total)} ${TURNOVER_UI.of[lang]} ${formatTenge(limit)}`;
}

export function renderStatus(
  view: TurnoverView,
  monthName: string,
  year: number,
  lang: Lang = 'ru',
): string {
  const t = TURNOVER_UI;
  const lines: string[] = [
    t.title[lang],
    t.period[lang](monthName, year, formatTenge(view.monthTotal), formatTenge(view.yearTotal)),
    '',
    line(t.lineSelfEmployed[lang], view.monthTotal, LIMITS_TENGE.selfEmployedMonthly, view.selfEmployedMonthPct, lang),
    line(t.lineVat[lang], view.yearTotal, LIMITS_TENGE.vatRegistrationAnnual, view.vatYearPct, lang),
    line(t.lineSimplified[lang], view.yearTotal, LIMITS_TENGE.simplifiedAnnualTurnover, view.simplifiedYearPct, lang),
  ];

  if (view.alerts.length > 0) {
    lines.push('');
    for (const a of view.alerts) lines.push(`${a.level === 'over' ? '🔴' : '⚠️'} ${a.text}`);
  }

  lines.push('');
  lines.push(t.logHint[lang]);
  lines.push(t.privacyNote[lang]);
  return lines.join('\n');
}

function periodNow(now: () => Date, lang: Lang): { monthName: string; year: number } {
  const d = now();
  return { monthName: MONTHS_NOM[lang][d.getMonth()] ?? MONTHS_NOM.ru[d.getMonth()]!, year: d.getFullYear() };
}

/** Показать статус оборота (используется /oborot и кнопкой меню). */
export async function sendTurnoverStatus(
  ctx: Context,
  store: TurnoverStore,
  uid: number,
  lang: Lang = 'ru',
  now: () => Date = () => new Date(),
): Promise<void> {
  const totals = await store.totals(uid);
  const { monthName, year } = periodNow(now, lang);
  const view = assessTurnover(totals.monthTotal, totals.yearTotal, lang);
  await ctx.reply(renderStatus(view, monthName, year, lang), { parse_mode: 'HTML', ...NO_PREVIEW });
}

/** Записать доход и показать статус с кнопкой отмены (зовёт и intent-роутер). */
export async function logIncome(
  ctx: Context,
  store: TurnoverStore,
  uid: number,
  amount: number,
  lang: Lang = 'ru',
  now: () => Date = () => new Date(),
): Promise<void> {
  const totals = await store.add(uid, amount);
  const { monthName, year } = periodNow(now, lang);
  const view = assessTurnover(totals.monthTotal, totals.yearTotal, lang);
  await ctx.reply(
    `${TURNOVER_UI.logged[lang](formatTenge(amount))}\n\n${renderStatus(view, monthName, year, lang)}`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(TURNOVER_UI.undoBtn[lang], 'turn|undo'),
      ...NO_PREVIEW,
    },
  );
}

export function registerTurnover(
  bot: Bot,
  store: TurnoverStore,
  telemetry?: EventTracker,
  prefs?: PrefsStore,
  now: () => Date = () => new Date(),
): void {
  const langOf = async (uid: number | undefined): Promise<Lang> =>
    (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? 'ru';

  bot.command('oborot', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    const arg = (ctx.match ?? '').toString().trim();

    if (/^(сброс|reset|очистить|обнулить)$/i.test(arg)) {
      const totals = await store.totals(uid);
      await ctx.reply(TURNOVER_UI.resetConfirm[lang](formatTenge(totals.yearTotal)), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text(TURNOVER_UI.resetYes[lang], 'turn|reset')
          .text(TURNOVER_UI.resetNo[lang], 'turn|cancel'),
      });
      return;
    }

    if (arg) {
      const amount = parseAmount(arg);
      if (amount === null) {
        await ctx.reply(TURNOVER_UI.parseFail[lang], NO_PREVIEW);
        return;
      }
      telemetry?.track(uid, 'turnover', 'add');
      await logIncome(ctx, store, uid, amount, lang, now);
      return;
    }

    telemetry?.track(uid, 'turnover', 'show');
    await sendTurnoverStatus(ctx, store, uid, lang, now);
  });

  bot.callbackQuery(/^turn\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const lang = await langOf(uid);
    const action = (ctx.callbackQuery.data ?? '').split('|')[1];

    if (action === 'reset') {
      await store.reset(uid);
      telemetry?.track(uid, 'turnover', 'reset');
      await ctx.answerCallbackQuery(TURNOVER_UI.resetDone[lang]);
      await ctx.editMessageText(TURNOVER_UI.resetDoneMsg[lang]);
      return;
    }
    if (action === 'cancel') {
      await ctx.answerCallbackQuery(TURNOVER_UI.resetCancelled[lang]);
      await ctx.editMessageText(TURNOVER_UI.resetCancelMsg[lang]);
      return;
    }
    if (action === 'undo') {
      const removed = await store.undoLast(uid);
      telemetry?.track(uid, 'turnover', 'undo');
      await ctx.answerCallbackQuery(removed !== null ? TURNOVER_UI.undoDone[lang] : TURNOVER_UI.undoNothing[lang]);
      if (removed !== null) {
        await ctx.editMessageText(TURNOVER_UI.undoMsg[lang](formatTenge(removed)), { parse_mode: 'HTML' });
      }
      return;
    }
  });
}
