import { describe, it, expect } from 'vitest';
import { assessTurnover } from '../src/domain/turnover';
import { renderStatus } from '../src/bot/turnover-flow';
import { renderUpcoming, renderReminder, DEADLINES } from '../src/domain/deadlines';
import { renderForm910 } from '../src/domain/form910';
import { LIMITS_TENGE } from '../src/domain/regimes';
import { formatDateI18n, pluralDaysI18n, artRef } from '../src/i18n/i18n';

describe('locale-хелперы дат и склонений', () => {
  it('formatDateI18n по языкам', () => {
    expect(formatDateI18n('2026-08-15', 'ru')).toBe('15 августа 2026');
    expect(formatDateI18n('2026-08-15', 'kk')).toBe('2026 жылғы 15 тамыз');
    expect(formatDateI18n('2026-08-15', 'en')).toBe('15 August 2026');
  });
  it('pluralDaysI18n: ru склоняет, kk без склонения, en day/days', () => {
    expect(pluralDaysI18n(1, 'ru')).toBe('1 день');
    expect(pluralDaysI18n(2, 'ru')).toBe('2 дня');
    expect(pluralDaysI18n(7, 'ru')).toBe('7 дней');
    expect(pluralDaysI18n(7, 'kk')).toBe('7 күн');
    expect(pluralDaysI18n(1, 'en')).toBe('1 day');
    expect(pluralDaysI18n(7, 'en')).toBe('7 days');
  });
});

describe('трекер оборота локализован (цифры не меняются, меняется язык)', () => {
  it('алерт НДС: kk упоминает ҚҚС, en — VAT/business days', () => {
    const over = LIMITS_TENGE.vatRegistrationAnnual + 1;
    const kk = assessTurnover(0, over, 'kk').alerts.find((a) => a.level === 'over');
    const en = assessTurnover(0, over, 'en').alerts.find((a) => a.level === 'over');
    expect(kk?.text).toContain('ҚҚС');
    expect(kk?.text).toContain('5 жұмыс күн');
    expect(en?.text).toContain('VAT');
    expect(en?.text).toContain('5 business days');
  });
  it('renderStatus: заголовок на нужном языке, лимит-цифры идентичны', () => {
    const view = assessTurnover(400_000, 400_000, 'kk');
    const kk = renderStatus(view, 'шілде', 2026, 'kk');
    const ru = renderStatus(assessTurnover(400_000, 400_000), 'июль', 2026);
    expect(kk).toContain('Сенің айналымың');
    expect(kk).toContain('ҚҚС');
    // Форматирование суммы одинаково во всех языках (₸-разделитель).
    expect(kk).toContain('400 000 ₸');
    expect(ru).toContain('400 000 ₸');
  });
});

describe('дедлайны локализованы', () => {
  const AUG = new Date('2026-08-01T00:00:00Z');
  it('renderUpcoming: заголовок и название формы 910 по языку', () => {
    expect(renderUpcoming(AUG, 'kk')).toContain('Жақындағы салық мерзімдері');
    expect(renderUpcoming(AUG, 'kk')).toContain('910-нысан');
    expect(renderUpcoming(AUG, 'en')).toContain('Upcoming tax deadlines');
    expect(renderUpcoming(AUG, 'en')).toContain('Form 910 for H1 2026');
  });
  it('renderReminder: en «Deadline reminder» + локализованная дата', () => {
    const d = DEADLINES[0]!;
    const rem = renderReminder(d, new Date('2026-08-08T00:00:00Z'), 'en');
    expect(rem).toContain('Deadline reminder');
    expect(rem).toContain('15 August 2026');
    expect(rem).toContain('7 days');
  });
});

describe('форма 910 локализована (ставка/сумма идентичны)', () => {
  it('artRef по языкам', () => {
    expect(artRef('726', 'ru')).toBe('Ст. 726');
    expect(artRef('726', 'kk')).toBe('726-бап');
    expect(artRef('726', 'en')).toBe('Art. 726');
  });
  it('kk: 910-нысан + ставка 4% + сумма налога идентична', () => {
    const kk = renderForm910(3_000_000, 'kk');
    expect(kk).toContain('910-нысан');
    expect(kk).toContain('4%');
    expect(kk).toContain('120 000 ₸'); // 4% от 3 000 000 — одинаково во всех языках
  });
  it('en: Form 910 + 4% of turnover', () => {
    const en = renderForm910(null, 'en');
    expect(en).toContain('Form 910');
    expect(en).toContain('4% of turnover');
  });
});
