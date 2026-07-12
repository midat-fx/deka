import { describe, it, expect } from 'vitest';
import { calcSimplifiedTax, renderForm910, SIMPLIFIED_RATE } from '../src/domain/form910';

describe('форма 910 — калькулятор (сверено по Ст. 726/720/727)', () => {
  it('ставка упрощёнки — 4% (Ст. 726 п.1)', () => {
    expect(SIMPLIFIED_RATE).toBe(0.04);
    expect(calcSimplifiedTax(3_000_000)).toBe(120_000);
    expect(calcSimplifiedTax(2_000_000)).toBe(80_000);
  });

  it('чеклист содержит сроки, ставку и ссылки на первоисточник', () => {
    const html = renderForm910(null);
    expect(html).toContain('15 августа');
    expect(html).toContain('25 августа');
    expect(html).toContain('4%');
    expect(html).toContain('0%'); // самозанятый ИПН 0
    expect(html).toContain('adilet.zan.kz');
  });

  it('с оборотом из трекера показывает прикидку налога', () => {
    expect(renderForm910(2_000_000)).toContain('80 000');
  });
});
