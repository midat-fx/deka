/**
 * Пакет «Форма 910»: чеклист + калькулятор налога. Чистая логика.
 *
 * Ставки сверены по ПЕРВОИСТОЧНИКУ (data/corpus, НК РК-2026):
 *  - упрощёнка: ИПН/КПН = 4% от объекта налогообложения — Ст. 726 п.1
 *    (местный акимат вправе менять ставку ±50% — Ст. 726 п.2);
 *  - самозанятый: ИПН = 0% — Ст. 720 п.1 (платятся только соцплатежи по
 *    Соцкодексу через приложение — их размер НЕ в НК, поэтому не считаем);
 *  - сроки: сдать до 15-го, уплатить до 25-го числа 2-го месяца после
 *    полугодия — Ст. 727. За 1-е полугодие 2026 → 15/25 августа.
 */
import { formatTenge } from './format';
import { FORM910, SET_ASIDE, artRef, type Lang } from '../i18n/i18n';

/** Базовая ставка упрощёнки (Ст. 726 п.1). Акимат может менять ±50%. */
export const SIMPLIFIED_RATE = 0.04;

const ADILET = 'https://adilet.zan.kz/rus/docs/K2500000214';
const art = (anchor: string, label: string) => `<a href="${ADILET}#${anchor}">${label}</a>`;

/** Налог по упрощёнке за период (4% от оборота). */
export function calcSimplifiedTax(turnover: number): number {
  return Math.round(turnover * SIMPLIFIED_RATE);
}

/**
 * «Сколько отложить с этого дохода» — режим юзера неизвестен, поэтому честно
 * показываем оба варианта: упрощёнка 4% (Ст.726) и самозанятый ИПН 0% (Ст.720).
 * Ничего не пишет в учёт — просто прикидка при поступлении.
 */
export function renderSetAside(amount: number, lang: Lang = 'ru'): string {
  const s = SET_ASIDE;
  return [
    s.title[lang](formatTenge(amount)),
    '',
    s.simplified[lang](formatTenge(calcSimplifiedTax(amount)), art('z11961', artRef('726', lang))),
    s.selfEmployed[lang](art('z11830', artRef('720', lang))),
    '',
    s.note[lang],
  ].join('\n');
}

/**
 * Чеклист формы 910 + калькулятор. Если известен оборот из трекера —
 * подставляем реальную прикидку, иначе показываем пример. Язык — из настроек.
 * Ставки/статьи/даты (grounded) идентичны во всех языках, меняется только текст.
 */
export function renderForm910(yearTurnover: number | null, lang: Lang = 'ru'): string {
  const f = FORM910;
  const lines: string[] = [
    f.title[lang],
    '',
    f.who[lang],
    '',
    f.deadlinesTitle[lang](art('z11967', artRef('727', lang))),
    f.submitBy[lang],
    f.payBy[lang],
    f.weekendNote[lang],
    '',
    f.howMuch[lang],
    f.rateSimplified[lang](art('z11961', artRef('726', lang))),
    f.rateSelfEmployed[lang](art('z11830', artRef('720', lang))),
    '',
  ];

  if (yearTurnover !== null && yearTurnover > 0) {
    const tax = calcSimplifiedTax(yearTurnover);
    lines.push(f.estimateTitle[lang]);
    lines.push(f.estimateLine[lang](formatTenge(yearTurnover), formatTenge(tax)));
    lines.push(f.estimateNote[lang]);
  } else {
    const example = 3_000_000;
    lines.push(f.exampleLine[lang](formatTenge(example), formatTenge(calcSimplifiedTax(example))));
    lines.push(f.exampleNote[lang]);
  }

  lines.push('');
  lines.push(f.where[lang]);
  lines.push('');
  lines.push(f.footer[lang]);
  return lines.join('\n');
}
