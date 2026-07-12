import { describe, it, expect } from 'vitest';
import { routeIntent } from '../src/bot/router';
import { encodeState, decodeState } from '../src/bot/wizard-flow';
import { MENU } from '../src/i18n/i18n';

describe('роутер намерений (инцидент «да» и человеческие фразы)', () => {
  it('«да» без контекста → bare_confirm, а не поиск', () => {
    expect(routeIntent('да')?.kind).toBe('bare_confirm');
    expect(routeIntent('Ок!')?.kind).toBe('bare_confirm');
    expect(routeIntent('иә')?.kind).toBe('bare_confirm');
    expect(routeIntent('yes')?.kind).toBe('bare_confirm');
  });

  it('смена языка фразой', () => {
    expect(routeIntent('переключи на казахский')).toEqual({ kind: 'set_lang', lang: 'kk' });
    expect(routeIntent('қазақша сөйле')).toEqual({ kind: 'set_lang', lang: 'kk' });
    expect(routeIntent('switch to english')).toEqual({ kind: 'set_lang', lang: 'en' });
    expect(routeIntent('давай на русском')).toEqual({ kind: 'set_lang', lang: 'ru' });
    expect(routeIntent('қазақша')).toEqual({ kind: 'set_lang', lang: 'kk' });
  });

  it('доход фразой и голой суммой → log_income с суммой', () => {
    expect(routeIntent('заработал 500 тысяч')).toEqual({ kind: 'log_income', amount: 500_000 });
    expect(routeIntent('запиши доход 1.3 млн')).toEqual({ kind: 'log_income', amount: 1_300_000 });
    expect(routeIntent('500000')).toEqual({ kind: 'log_income', amount: 500_000 });
    expect(routeIntent('1,3 млн тг')).toEqual({ kind: 'log_income', amount: 1_300_000 });
  });

  it('кнопки меню матчатся на всех языках', () => {
    expect(routeIntent(MENU.turnover.ru)).toEqual({ kind: 'menu', action: 'turnover' });
    expect(routeIntent(MENU.deadlines.kk)).toEqual({ kind: 'menu', action: 'deadlines' });
    expect(routeIntent(MENU.language.en)).toEqual({ kind: 'menu', action: 'language' });
  });

  it('«дедлайны» и «какой режим» — короткие формы', () => {
    expect(routeIntent('дедлайны')?.kind).toBe('deadlines');
    expect(routeIntent('какой режим мне подходит')?.kind).toBe('wizard');
  });

  it('настоящие вопросы НЕ перехватывает (идут в поиск)', () => {
    expect(routeIntent('какой лимит дохода у самозанятого?')).toBeNull();
    expect(routeIntent('когда вставать на учёт по НДС')).toBeNull();
    expect(routeIntent('да будет ли штраф за просрочку 910?')).toBeNull(); // «да» в начале вопроса
    expect(routeIntent('заработал ли я право на упрощёнку?')).toBeNull(); // глагол без суммы
  });
});

describe('stateless-кодирование визарда (переживает рестарты изолятов)', () => {
  it('encode → decode без потерь на всех ветках', () => {
    const cases = [
      {},
      { entity: 'individual' as const },
      { entity: 'individual' as const, hasEmployees: false },
      { entity: 'individual' as const, hasEmployees: false, activity: 'in_list' as const },
      { entity: 'individual' as const, hasEmployees: true },
      { entity: 'legal' as const },
    ];
    for (const a of cases) {
      expect(decodeState(encodeState(a))).toEqual(a);
    }
  });

  it('callback_data укладывается в лимит Telegram 64 байта', () => {
    const cb = `w|${encodeState({ entity: 'individual', hasEmployees: false, activity: 'in_list' })}|turn|t2`;
    expect(Buffer.byteLength(cb)).toBeLessThanOrEqual(64);
  });
});
