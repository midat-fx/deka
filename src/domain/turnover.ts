/**
 * Трекер оборота: чистая логика без сети и хранилища.
 *
 * Считает, насколько пользователь близок к трём порогам НК РК-2026, и выдаёт
 * предупреждения. Все пороги — из тех же сверенных констант, что и визард
 * (LIMITS_TENGE), поэтому цифры согласованы во всём боте.
 */
import { LIMITS_TENGE } from './regimes';
import { formatTenge } from './format';
import { TURNOVER_ALERTS, MONTHLY_SUMMARY, MONTHS_NOM, type Lang } from '../i18n/i18n';

/** Порог предупреждения «приближаешься» — 80% лимита. */
const WARN_AT = 0.8;

export interface TurnoverAlert {
  level: 'warn' | 'over';
  text: string;
}

export interface TurnoverView {
  monthTotal: number;
  yearTotal: number;
  selfEmployedMonthPct: number; // доля месячного лимита самозанятого
  vatYearPct: number; // доля годового порога НДС
  simplifiedYearPct: number; // доля годового потолка упрощёнки
  alerts: TurnoverAlert[];
}

/**
 * Разобрать сумму из текста: «500000», «500 000», «1.3 млн», «1,3 млн»,
 * «400 тыс», «400к», «2 млрд», можно с «тг»/«₸». Вернёт null, если не понял.
 */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s/g, '').replace(',', '.');
  const m = s.match(/^([\d.]+)(млрд|млн|тыс|к)?(тг|тенге|₸)?$/);
  if (!m || !m[1]) return null;
  const base = parseFloat(m[1]);
  if (Number.isNaN(base)) return null;
  const mult = m[2] === 'млрд' ? 1e9 : m[2] === 'млн' ? 1e6 : m[2] === 'тыс' || m[2] === 'к' ? 1e3 : 1;
  const value = Math.round(base * mult);
  return value > 0 ? value : null;
}

export function assessTurnover(
  monthTotal: number,
  yearTotal: number,
  lang: Lang = 'ru',
): TurnoverView {
  const se = LIMITS_TENGE.selfEmployedMonthly;
  const vat = LIMITS_TENGE.vatRegistrationAnnual;
  const simp = LIMITS_TENGE.simplifiedAnnualTurnover;
  const alerts: TurnoverAlert[] = [];

  // Самозанятый — месячный лимит.
  if (monthTotal > se) {
    alerts.push({ level: 'over', text: TURNOVER_ALERTS.seOver[lang](formatTenge(monthTotal), formatTenge(se)) });
  } else if (monthTotal >= se * WARN_AT) {
    alerts.push({ level: 'warn', text: TURNOVER_ALERTS.seWarn[lang](formatTenge(monthTotal), formatTenge(se)) });
  }

  // НДС — годовой порог обязательной постановки на учёт.
  if (yearTotal > vat) {
    alerts.push({ level: 'over', text: TURNOVER_ALERTS.vatOver[lang](formatTenge(yearTotal), formatTenge(vat)) });
  } else if (yearTotal >= vat * WARN_AT) {
    alerts.push({ level: 'warn', text: TURNOVER_ALERTS.vatWarn[lang](formatTenge(yearTotal), formatTenge(vat)) });
  }

  // Упрощёнка — годовой потолок.
  if (yearTotal > simp) {
    alerts.push({ level: 'over', text: TURNOVER_ALERTS.simpOver[lang](formatTenge(yearTotal), formatTenge(simp)) });
  } else if (yearTotal >= simp * WARN_AT) {
    alerts.push({ level: 'warn', text: TURNOVER_ALERTS.simpWarn[lang](formatTenge(yearTotal), formatTenge(simp)) });
  }

  return {
    monthTotal,
    yearTotal,
    selfEmployedMonthPct: monthTotal / se,
    vatYearPct: yearTotal / vat,
    simplifiedYearPct: yearTotal / simp,
    alerts,
  };
}

/**
 * Текст ежемесячной сводки (для cron-пуша): оборот за прошлый месяц и за год
 * + предупреждения о ГОДОВЫХ лимитах (НДС/упрощёнка), если близко/превышено.
 * Чистая функция — данные (суммы, лимиты) одинаковы во всех языках.
 */
export function renderMonthlySummary(
  prevMonthTotal: number,
  yearTotal: number,
  prevMonthIndex: number,
  lang: Lang = 'ru',
): string {
  const ms = MONTHLY_SUMMARY;
  const monthName = MONTHS_NOM[lang][prevMonthIndex] ?? MONTHS_NOM.ru[prevMonthIndex]!;
  const lines: string[] = [
    ms.header[lang](monthName),
    '',
    ms.body[lang](formatTenge(prevMonthTotal), formatTenge(yearTotal)),
  ];
  // Годовые пороги (месяц=0 → месячный лимит самозанятого не срабатывает).
  const yearAlerts = assessTurnover(0, yearTotal, lang).alerts;
  if (yearAlerts.length > 0) {
    lines.push('');
    for (const a of yearAlerts) lines.push(`${a.level === 'over' ? '🔴' : '⚠️'} ${a.text}`);
  }
  lines.push('');
  lines.push(ms.optOut[lang]);
  return lines.join('\n');
}
