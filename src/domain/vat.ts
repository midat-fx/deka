/**
 * Калькулятор НДС. Чистая логика.
 *
 * Ставка сверена по ПЕРВОИСТОЧНИКУ (data/corpus, НК РК-2026):
 *  - ОБЩАЯ ставка НДС = 16% — Ст. 503 п.1 («если иное не установлено… 16 процентов»).
 *  - В той же статье есть ЛЬГОТНЫЕ ставки (5% с 2026 / 10% с 2027 — п.2; 10% для
 *    периодики — п.3) для отдельных случаев. Калькулятор считает ОБЩУЮ 16% и
 *    честно предупреждает про исключения — не подставляет их молча.
 *
 * Это «живая витрина» рва свежести: обычный ИИ, обученный на старом кодексе,
 * назовёт 12% — Deka даёт 16% со ссылкой на статью.
 */
import { formatTenge } from './format';
import { VAT_CALC, type Lang } from '../i18n/i18n';

/** Общая ставка НДС (Ст. 503 п.1). */
export const VAT_RATE = 0.16;

const ADILET = 'https://adilet.zan.kz/rus/docs/K2500000214';
/** Якорь Ст. 503 в adilet (сверен с anchor из корпуса). */
const ART503 = `<a href="${ADILET}#z8609">Ст. 503</a>`;

/** НДС сверху (net → +16%). */
export function vatOnTop(net: number): { vat: number; gross: number } {
  const vat = Math.round(net * VAT_RATE);
  return { vat, gross: net + vat };
}

/** НДС внутри суммы (gross содержит НДС → выделить). */
export function vatIncluded(gross: number): { vat: number; net: number } {
  const net = Math.round(gross / (1 + VAT_RATE));
  return { vat: gross - net, net };
}

/**
 * Показать оба сценария (сумма без НДС ↔ с НДС) — «500 000» неоднозначно,
 * поэтому не гадаем, а даём и «начислить сверху», и «выделить из суммы».
 */
export function renderVatCalc(amount: number, lang: Lang = 'ru'): string {
  const v = VAT_CALC;
  const top = vatOnTop(amount);
  const inc = vatIncluded(amount);
  return [
    v.title[lang](formatTenge(amount)),
    '',
    v.onTop[lang](formatTenge(top.vat), formatTenge(top.gross)),
    v.included[lang](formatTenge(inc.vat), formatTenge(inc.net)),
    '',
    v.rateNote[lang](ART503),
    v.gptNote[lang],
  ].join('\n');
}
