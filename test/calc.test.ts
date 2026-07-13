import { describe, it, expect } from 'vitest';
import { vatOnTop, vatIncluded, renderVatCalc, VAT_RATE } from '../src/domain/vat';
import { renderSetAside, calcSimplifiedTax } from '../src/domain/form910';
import { routeIntent } from '../src/bot/router';

describe('НДС-калькулятор (Ст.503, ставка 16%)', () => {
  it('ставка = 16%, не 12%', () => {
    expect(VAT_RATE).toBe(0.16);
  });
  it('начисление сверху и выделение — обратимы', () => {
    expect(vatOnTop(500_000)).toEqual({ vat: 80_000, gross: 580_000 });
    const inc = vatIncluded(580_000);
    expect(inc.net).toBe(500_000);
    expect(inc.vat).toBe(80_000);
  });
  it('renderVatCalc: 16%, сумма НДС, ссылка на Ст.503, оба языка', () => {
    const ru = renderVatCalc(500_000, 'ru');
    expect(ru).toContain('16%');
    expect(ru).toContain('80 000 ₸');
    expect(ru).toContain('Ст. 503');
    expect(renderVatCalc(500_000, 'en')).toContain('VAT');
    expect(renderVatCalc(500_000, 'kk')).toContain('ҚҚС');
  });
});

describe('«сколько отложить» (упрощёнка 4% / самозанятый 0%)', () => {
  it('4% от 300000 = 12000, citation Ст.726 и Ст.720', () => {
    expect(calcSimplifiedTax(300_000)).toBe(12_000);
    const ru = renderSetAside(300_000, 'ru');
    expect(ru).toContain('12 000 ₸');
    expect(ru).toContain('Ст. 726');
    expect(ru).toContain('0%'); // самозанятый ИПН 0%
    expect(ru).toContain('Ст. 720');
  });
});

describe('роутер: НДС/отложить срабатывают только с суммой', () => {
  it('«ндс с 500000» → vat; «посчитай ндс 300 тыс» → vat', () => {
    expect(routeIntent('ндс с 500000')).toEqual({ kind: 'vat', amount: 500_000 });
    expect(routeIntent('посчитай ндс 300 тыс')).toEqual({ kind: 'vat', amount: 300_000 });
  });
  it('«сколько отложить с 300000» → setaside', () => {
    expect(routeIntent('сколько отложить с 300000')).toEqual({ kind: 'setaside', amount: 300_000 });
    expect(routeIntent('сколько налог с 500000')).toEqual({ kind: 'setaside', amount: 500_000 });
  });
  it('вопрос про НДС без суммы НЕ перехватывается (идёт в поиск)', () => {
    expect(routeIntent('какой порог ндс?')).toBeNull();
    expect(routeIntent('что такое ндс')).toBeNull();
  });
  it('доход по-прежнему логируется, а не считается как НДС', () => {
    expect(routeIntent('заработал 500000')).toEqual({ kind: 'log_income', amount: 500_000 });
  });
});
