import { describe, it, expect } from 'vitest';
import { recommendRegime, type WizardAnswers } from '../src/domain/wizard';
import { LIMITS_TENGE } from '../src/domain/regimes';
import { mrp, mrpToTenge } from '../src/domain/mrp';

const base: WizardAnswers = {
  entity: 'individual',
  hasEmployees: false,
  activity: 'in_list',
  annualTurnoverTenge: 4_800_000, // ~400 тыс ₸/мес
};

describe('константы порогов (сверены с НК РК-2026)', () => {
  it('МРП 2026 = 4 325 ₸', () => {
    expect(mrp(2026)).toBe(4325);
  });
  it('лимит самозанятого = 300 МРП/мес = 1 297 500 ₸', () => {
    expect(LIMITS_TENGE.selfEmployedMonthly).toBe(1_297_500);
  });
  it('лимит упрощёнки = 600 000 МРП/год = 2 595 000 000 ₸', () => {
    expect(LIMITS_TENGE.simplifiedAnnualTurnover).toBe(2_595_000_000);
  });
  it('порог НДС = 10 000 МРП/год = 43 250 000 ₸', () => {
    expect(LIMITS_TENGE.vatRegistrationAnnual).toBe(43_250_000);
  });
  it('mrp() бросает на незаданный год', () => {
    expect(() => mrp(1999)).toThrow();
  });
  it('mrpToTenge считает от МРП года', () => {
    expect(mrpToTenge(300)).toBe(1_297_500);
  });
});

describe('recommendRegime — сценарии', () => {
  it('кондитер (физлицо, без работников, в списке, ~400к/мес) → самозанятый', () => {
    const rec = recommendRegime(base);
    expect(rec.primary).toBe('self_employed');
    const se = rec.eligibility.find((e) => e.regime === 'self_employed');
    expect(se?.status).toBe('recommended');
  });

  it('вид деятельности неизвестен → самозанятый, но needs_check', () => {
    const rec = recommendRegime({ ...base, activity: 'unknown' });
    expect(rec.primary).toBe('self_employed');
    const se = rec.eligibility.find((e) => e.regime === 'self_employed');
    expect(se?.status).toBe('needs_check');
  });

  it('вид деятельности не в списке → самозанятый недоступен, уходим в упрощёнку', () => {
    const rec = recommendRegime({ ...base, activity: 'not_in_list' });
    expect(rec.primary).toBe('simplified');
    const se = rec.eligibility.find((e) => e.regime === 'self_employed');
    expect(se?.status).toBe('not_eligible');
  });

  it('доход выше лимита самозанятого (20 млн/год) → упрощёнка, без НДС', () => {
    const rec = recommendRegime({ ...base, activity: 'in_list', annualTurnoverTenge: 20_000_000 });
    expect(rec.primary).toBe('simplified');
    const se = rec.eligibility.find((e) => e.regime === 'self_employed');
    expect(se?.status).toBe('not_eligible');
    // 20 млн < 43,25 млн — обязательного НДС нет
    expect(rec.flags.some((f) => f.includes('НДС'))).toBe(false);
  });

  it('есть работники → самозанятый недоступен даже при малом доходе', () => {
    const rec = recommendRegime({ ...base, hasEmployees: true });
    const se = rec.eligibility.find((e) => e.regime === 'self_employed');
    expect(se?.status).toBe('not_eligible');
    expect(rec.primary).toBe('simplified');
  });

  it('ТОО с оборотом 5 млрд/год → общий режим + предупреждение о НДС', () => {
    const rec = recommendRegime({ entity: 'legal', annualTurnoverTenge: 5_000_000_000 });
    expect(rec.primary).toBe('general');
    const simp = rec.eligibility.find((e) => e.regime === 'simplified');
    expect(simp?.status).toBe('not_eligible');
    expect(rec.flags.some((f) => f.includes('5 рабочих дней'))).toBe(true);
  });

  it('доход у самого потолка самозанятого → флаг о близости к лимиту', () => {
    // 14,4 млн/год = 1,2 млн/мес: выше 0,8×лимита (1 038 000) и ниже лимита (1 297 500)
    const rec = recommendRegime({ ...base, annualTurnoverTenge: 14_400_000 });
    expect(rec.primary).toBe('self_employed');
    expect(rec.flags.some((f) => f.includes('близко к лимиту'))).toBe(true);
  });

  it('в ответе всегда есть дисклеймер и источники', () => {
    const rec = recommendRegime(base);
    expect(rec.disclaimers.length).toBeGreaterThan(0);
    expect(rec.sources.length).toBeGreaterThan(0);
  });
});
