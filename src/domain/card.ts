/**
 * «Моя налоговая карточка» (B1) — персональный экран из уже проверенных кусков:
 * выбранный режим + ОДИН релевантный лимит с прогрессом + ближайший дедлайн +
 * прикидка налога. Ничего не выдумывает: режим — из визарда (prefs), лимиты —
 * из LIMITS_TENGE, дедлайн — из domain/deadlines, налог — из calcSimplifiedTax.
 * Именно этого stateless-ChatGPT собрать не может — он не помнит тебя.
 */
import { LIMITS_TENGE } from './regimes';
import { formatTenge } from './format';
import { calcSimplifiedTax } from './form910';
import { upcomingDeadlines, localizeDeadline, deadlineWhen } from './deadlines';
import { CARD, REGIME_NAME, type Lang } from '../i18n/i18n';

const pct = (a: number, b: number): number => (b > 0 ? Math.min(999, Math.round((a / b) * 100)) : 0);

export function renderCard(
  regime: string | undefined,
  monthTotal: number,
  yearTotal: number,
  now: Date,
  lang: Lang = 'ru',
): string {
  const c = CARD;
  if (!regime || !REGIME_NAME[regime]) {
    return `${c.title[lang]}\n\n${c.noRegime[lang]}`;
  }
  const lines: string[] = [c.title[lang], '', c.regime[lang](REGIME_NAME[regime][lang])];

  // Показываем ТОЛЬКО лимит, релевантный режиму. Для самозанятого — месячный
  // порог. Для упрощёнки/общего — порог НДС (10 000 МРП): это единственный
  // лимит, к которому реально приближается растущий ИП (потолок упрощёнки —
  // 600 000 МРП, ~2,6 млрд ₸ — на практике недостижим, показывать «0%» бесполезно).
  if (regime === 'self_employed') {
    const lim = LIMITS_TENGE.selfEmployedMonthly;
    lines.push(c.limitLine[lang](c.limitLabelSE[lang], pct(monthTotal, lim), formatTenge(monthTotal), formatTenge(lim)));
    lines.push(c.taxSE[lang]);
  } else if (regime === 'simplified') {
    const lim = LIMITS_TENGE.vatRegistrationAnnual;
    lines.push(c.limitLine[lang](c.limitLabelVat[lang], pct(yearTotal, lim), formatTenge(yearTotal), formatTenge(lim)));
    lines.push(c.taxSimp[lang](formatTenge(calcSimplifiedTax(yearTotal))));
  } else {
    const lim = LIMITS_TENGE.vatRegistrationAnnual;
    lines.push(c.limitLine[lang](c.limitLabelVat[lang], pct(yearTotal, lim), formatTenge(yearTotal), formatTenge(lim)));
    lines.push(c.taxGen[lang]);
  }

  // Дедлайн — ТОЛЬКО для упрощёнки: форма 910 относится исключительно к ней.
  // Самозанятый (ИПН 0%, отчёт через e-Salyq) и общий режим её НЕ сдают —
  // приписывать им 910 = нарушить «grounded или молчит». Молчим, пока не
  // добавим сверенные по кодексу сроки для их форм.
  if (regime === 'simplified') {
    const up = upcomingDeadlines(now)[0];
    if (up) {
      lines.push(c.deadline[lang](localizeDeadline(up.deadline, lang).title, deadlineWhen(up, lang)));
    }
  }

  lines.push('', c.footer[lang]);
  return lines.join('\n');
}
