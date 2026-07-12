/**
 * Трекер оборота:
 *   /oborot 500000 — записать доход; /oborot — статус; /oborot сброс — обнулить
 *   (сброс — только через inline-подтверждение: годовой учёт нельзя терять
 *   по опечатке; после записи есть кнопка «отменить последнюю»).
 * Хелперы sendTurnoverStatus/logIncome экспортируются — их зовёт и меню-роутер.
 */
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { assessTurnover, parseAmount, type TurnoverView } from '../domain/turnover';
import { LIMITS_TENGE } from '../domain/regimes';
import { formatTenge } from '../domain/format';
import type { TurnoverStore } from '../store/turnover';
import type { EventTracker } from '../telemetry/types';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

function bar(pct: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(pct * 10)));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

function mark(pct: number): string {
  return pct > 1 ? '🔴' : pct >= 0.8 ? '⚠️' : '✅';
}

function line(name: string, total: number, limit: number, pct: number): string {
  return `${mark(pct)} <b>${name}</b>\n   ${bar(pct)} ${Math.round(pct * 100)}% — ${formatTenge(total)} из ${formatTenge(limit)}`;
}

export function renderStatus(view: TurnoverView, monthName: string, year: number): string {
  const lines: string[] = [
    '📊 <b>Твой оборот</b>',
    `${monthName}: <b>${formatTenge(view.monthTotal)}</b> · ${year} год: <b>${formatTenge(view.yearTotal)}</b>`,
    '',
    line('Самозанятый — лимит месяца', view.monthTotal, LIMITS_TENGE.selfEmployedMonthly, view.selfEmployedMonthPct),
    line('Порог НДС — за год', view.yearTotal, LIMITS_TENGE.vatRegistrationAnnual, view.vatYearPct),
    line('Упрощёнка — потолок года', view.yearTotal, LIMITS_TENGE.simplifiedAnnualTurnover, view.simplifiedYearPct),
  ];

  if (view.alerts.length > 0) {
    lines.push('');
    for (const a of view.alerts) lines.push(`${a.level === 'over' ? '🔴' : '⚠️'} ${a.text}`);
  }

  lines.push('');
  lines.push('<i>Записать доход: просто напиши сумму, например «500 000» или «1.3 млн». Кнопка ➕ в меню тоже работает.</i>');
  lines.push('<i>Данные анонимны (без имени), храним только суммы. Ориентир, не бухучёт.</i>');
  return lines.join('\n');
}

function periodNow(now: () => Date): { monthName: string; year: number } {
  const d = now();
  return { monthName: RU_MONTHS[d.getMonth()] ?? 'этот месяц', year: d.getFullYear() };
}

/** Показать статус оборота (используется /oborot и кнопкой меню). */
export async function sendTurnoverStatus(
  ctx: Context,
  store: TurnoverStore,
  uid: number,
  now: () => Date = () => new Date(),
): Promise<void> {
  const totals = await store.totals(uid);
  const { monthName, year } = periodNow(now);
  const view = assessTurnover(totals.monthTotal, totals.yearTotal);
  await ctx.reply(renderStatus(view, monthName, year), { parse_mode: 'HTML', ...NO_PREVIEW });
}

/** Записать доход и показать статус с кнопкой отмены (зовёт и intent-роутер). */
export async function logIncome(
  ctx: Context,
  store: TurnoverStore,
  uid: number,
  amount: number,
  now: () => Date = () => new Date(),
): Promise<void> {
  const totals = await store.add(uid, amount);
  const { monthName, year } = periodNow(now);
  const view = assessTurnover(totals.monthTotal, totals.yearTotal);
  await ctx.reply(
    `✅ Записал <b>+${formatTenge(amount)}</b>.\n\n${renderStatus(view, monthName, year)}`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('↩️ Отменить эту запись', 'turn|undo'),
      ...NO_PREVIEW,
    },
  );
}

export function registerTurnover(
  bot: Bot,
  store: TurnoverStore,
  telemetry?: EventTracker,
  now: () => Date = () => new Date(),
): void {
  bot.command('oborot', async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const arg = (ctx.match ?? '').toString().trim();

    if (/^(сброс|reset|очистить|обнулить)$/i.test(arg)) {
      const totals = await store.totals(uid);
      await ctx.reply(
        `Точно обнулить весь учёт (<b>${formatTenge(totals.yearTotal)}</b> за год)? Это безвозвратно.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🗑 Да, обнулить', 'turn|reset')
            .text('Отмена', 'turn|cancel'),
        },
      );
      return;
    }

    if (arg) {
      const amount = parseAmount(arg);
      if (amount === null) {
        await ctx.reply(
          'Не понял сумму. Напиши, например: /oborot 500000 (или «1.3 млн», «400 тыс»).',
          NO_PREVIEW,
        );
        return;
      }
      telemetry?.track(uid, 'turnover', 'add');
      await logIncome(ctx, store, uid, amount, now);
      return;
    }

    telemetry?.track(uid, 'turnover', 'show');
    await sendTurnoverStatus(ctx, store, uid, now);
  });

  bot.callbackQuery(/^turn\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const action = (ctx.callbackQuery.data ?? '').split('|')[1];

    if (action === 'reset') {
      await store.reset(uid);
      telemetry?.track(uid, 'turnover', 'reset');
      await ctx.answerCallbackQuery('Учёт обнулён');
      await ctx.editMessageText('Обнулил твой учёт оборота. Начнём заново: просто напиши сумму дохода.');
      return;
    }
    if (action === 'cancel') {
      await ctx.answerCallbackQuery('Отменено');
      await ctx.editMessageText('Ок, ничего не трогаю. Учёт на месте.');
      return;
    }
    if (action === 'undo') {
      const removed = await store.undoLast(uid);
      telemetry?.track(uid, 'turnover', 'undo');
      await ctx.answerCallbackQuery(removed !== null ? 'Запись отменена' : 'Нечего отменять');
      if (removed !== null) {
        await ctx.editMessageText(
          `↩️ Отменил запись <b>+${formatTenge(removed)}</b>. Статус: кнопка «📊 Мой оборот» в меню.`,
          { parse_mode: 'HTML' },
        );
      }
      return;
    }
  });
}
