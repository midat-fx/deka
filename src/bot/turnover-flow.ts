/**
 * Команда /oborot — трекер оборота с алертами о лимитах.
 *   /oborot 500000   — записать доход и показать статус
 *   /oborot          — показать текущий оборот и близость к лимитам
 *   /oborot сброс    — обнулить учёт
 */
import type { Bot } from 'grammy';
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
  lines.push('<i>Записать доход: /oborot 500000 (можно «1.3 млн», «400 тыс»). Обнулить: /oborot сброс.</i>');
  lines.push('<i>Данные анонимны (без имени), храним только суммы. Ориентир, не бухучёт.</i>');
  return lines.join('\n');
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
    const d = now();
    const monthName = RU_MONTHS[d.getMonth()] ?? 'этот месяц';
    const year = d.getFullYear();

    if (/^(сброс|reset|очистить|обнулить)$/i.test(arg)) {
      await store.reset(uid);
      telemetry?.track(uid, 'turnover', 'reset');
      await ctx.reply('Обнулил твой учёт оборота. Начнём заново: /oborot 500000', NO_PREVIEW);
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
      const totals = await store.add(uid, amount);
      telemetry?.track(uid, 'turnover', 'add');
      const view = assessTurnover(totals.monthTotal, totals.yearTotal);
      await ctx.reply(
        `✅ Записал <b>+${formatTenge(amount)}</b>.\n\n${renderStatus(view, monthName, year)}`,
        { parse_mode: 'HTML', ...NO_PREVIEW },
      );
      return;
    }

    const totals = await store.totals(uid);
    telemetry?.track(uid, 'turnover', 'show');
    const view = assessTurnover(totals.monthTotal, totals.yearTotal);
    await ctx.reply(renderStatus(view, monthName, year), { parse_mode: 'HTML', ...NO_PREVIEW });
  });
}
