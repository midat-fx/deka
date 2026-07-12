/**
 * Трекер оборота: чистая логика без сети и хранилища.
 *
 * Считает, насколько пользователь близок к трём порогам НК РК-2026, и выдаёт
 * предупреждения. Все пороги — из тех же сверенных констант, что и визард
 * (LIMITS_TENGE), поэтому цифры согласованы во всём боте.
 */
import { LIMITS_TENGE } from './regimes';
import { formatTenge } from './format';

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

export function assessTurnover(monthTotal: number, yearTotal: number): TurnoverView {
  const se = LIMITS_TENGE.selfEmployedMonthly;
  const vat = LIMITS_TENGE.vatRegistrationAnnual;
  const simp = LIMITS_TENGE.simplifiedAnnualTurnover;
  const alerts: TurnoverAlert[] = [];

  // Самозанятый — месячный лимит.
  if (monthTotal > se) {
    alerts.push({
      level: 'over',
      text: `Месячный лимит самозанятого превышен: ${formatTenge(monthTotal)} при пороге 300 МРП (${formatTenge(se)}). В этом месяце режим самозанятого не применяется — свериться стоит с бухгалтером.`,
    });
  } else if (monthTotal >= se * WARN_AT) {
    alerts.push({
      level: 'warn',
      text: `Близко к месячному лимиту самозанятого: ${formatTenge(monthTotal)} из ${formatTenge(se)}.`,
    });
  }

  // НДС — годовой порог обязательной постановки на учёт.
  if (yearTotal > vat) {
    alerts.push({
      level: 'over',
      text: `Годовой оборот превысил порог НДС (${formatTenge(vat)}). Встать на учёт по НДС нужно не позже 5 рабочих дней после превышения.`,
    });
  } else if (yearTotal >= vat * WARN_AT) {
    alerts.push({
      level: 'warn',
      text: `Близко к порогу НДС: ${formatTenge(yearTotal)} из ${formatTenge(vat)} за год.`,
    });
  }

  // Упрощёнка — годовой потолок.
  if (yearTotal > simp) {
    alerts.push({
      level: 'over',
      text: `Годовой оборот превысил потолок упрощёнки (${formatTenge(simp)}) — пора на общеустановленный режим.`,
    });
  } else if (yearTotal >= simp * WARN_AT) {
    alerts.push({
      level: 'warn',
      text: `Близко к потолку упрощёнки: ${formatTenge(yearTotal)} из ${formatTenge(simp)} за год.`,
    });
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
