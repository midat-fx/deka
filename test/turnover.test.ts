import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAmount, assessTurnover } from '../src/domain/turnover';
import { LIMITS_TENGE } from '../src/domain/regimes';
import { SqliteTurnover } from '../src/store/turnover';
import { renderStatus } from '../src/bot/turnover-flow';

describe('parseAmount', () => {
  it('простые числа и с пробелами', () => {
    expect(parseAmount('500000')).toBe(500_000);
    expect(parseAmount('500 000')).toBe(500_000);
    expect(parseAmount('1 297 500 тг')).toBe(1_297_500);
  });
  it('сокращения к/тыс/млн/млрд', () => {
    expect(parseAmount('400к')).toBe(400_000);
    expect(parseAmount('400 тыс')).toBe(400_000);
    expect(parseAmount('1.3 млн')).toBe(1_300_000);
    expect(parseAmount('1,3 млн')).toBe(1_300_000);
    expect(parseAmount('2 млрд')).toBe(2_000_000_000);
  });
  it('мусор и ноль → null', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('assessTurnover — алерты о лимитах', () => {
  it('малый оборот — без алертов', () => {
    const v = assessTurnover(300_000, 300_000);
    expect(v.alerts).toHaveLength(0);
    expect(v.selfEmployedMonthPct).toBeCloseTo(300_000 / LIMITS_TENGE.selfEmployedMonthly);
  });
  it('месяц у самого лимита самозанятого → warn', () => {
    const nearly = Math.round(LIMITS_TENGE.selfEmployedMonthly * 0.85);
    const v = assessTurnover(nearly, nearly);
    expect(v.alerts.some((a) => a.level === 'warn' && a.text.includes('самозанят'))).toBe(true);
  });
  it('месяц выше лимита самозанятого → over', () => {
    const v = assessTurnover(LIMITS_TENGE.selfEmployedMonthly + 1, LIMITS_TENGE.selfEmployedMonthly + 1);
    expect(v.alerts.some((a) => a.level === 'over' && a.text.includes('самозанят'))).toBe(true);
  });
  it('год выше порога НДС → over с упоминанием 5 рабочих дней', () => {
    const v = assessTurnover(0, LIMITS_TENGE.vatRegistrationAnnual + 1);
    expect(v.alerts.some((a) => a.level === 'over' && a.text.includes('5 рабочих дней'))).toBe(true);
  });
});

describe('SqliteTurnover — учёт по пользователю', () => {
  const dirs: string[] = [];
  const mk = () => {
    const dir = mkdtempSync(join(tmpdir(), 'deka-turn-'));
    dirs.push(dir);
    return new SqliteTurnover(join(dir, 't.db'), 'salt');
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('складывает доходы и разделяет пользователей', async () => {
    const s = mk();
    await s.add(1, 100_000);
    await s.add(1, 250_000);
    await s.add(2, 999_000);
    const a = await s.totals(1);
    expect(a.monthTotal).toBe(350_000);
    expect(a.yearTotal).toBe(350_000);
    expect((await s.totals(2)).monthTotal).toBe(999_000);
  });

  it('сброс обнуляет только своего пользователя', async () => {
    const s = mk();
    await s.add(1, 500_000);
    await s.add(2, 700_000);
    await s.reset(1);
    expect((await s.totals(1)).yearTotal).toBe(0);
    expect((await s.totals(2)).yearTotal).toBe(700_000);
  });
});

describe('renderStatus', () => {
  it('содержит суммы, лимиты и подсказку', () => {
    const html = renderStatus(assessTurnover(400_000, 400_000), 'июль', 2026);
    expect(html).toContain('Твой оборот');
    expect(html).toContain('/oborot');
    expect(html).toContain('НДС');
  });
});
