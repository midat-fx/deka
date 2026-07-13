import { describe, it, expect } from 'vitest';
import { matchFaq } from '../src/domain/faq';
import { shareUrl, resultKeyboard } from '../src/bot/keyboard';

describe('FAQ-слой (темы вне НК → полезный ответ вместо 🤷)', () => {
  it('соцплатежи / ОПВ / «сколько всего платит» → social_payments', () => {
    expect(matchFaq('какие соцплатежи у самозанятого')?.id).toBe('social_payments');
    expect(matchFaq('сколько всего платит самозанятый')?.id).toBe('social_payments');
    expect(matchFaq('что такое ОПВ и ВОСМС')?.id).toBe('social_payments');
  });
  it('регистрация ИП → register_ip', () => {
    expect(matchFaq('как открыть ип')?.id).toBe('register_ip');
    expect(matchFaq('как зарегистрировать ИП в Казахстане')?.id).toBe('register_ip');
  });
  it('штраф за несдачу → penalty_fine', () => {
    expect(matchFaq('какой штраф за несдачу декларации')?.id).toBe('penalty_fine');
    expect(matchFaq('что будет если не сдать 910')?.id).toBe('penalty_fine');
  });
  it('обычный вопрос по кодексу FAQ НЕ перехватывает', () => {
    expect(matchFaq('какой лимит дохода у самозанятого')).toBeNull();
    expect(matchFaq('ставка ндс в 2026')).toBeNull();
  });
  it('ответы честны: не выдумывают ставку соцплатежей, помечают «не из НК»', () => {
    const ru = matchFaq('соцплатежи')!.reply.ru;
    expect(ru).toContain('не Налоговый кодекс');
    expect(ru).toContain('0%'); // что точно из НК — ИПН 0%
    expect(ru).not.toMatch(/ОПВ\s*[—-]?\s*\d+\s*%/); // конкретной ставки ОПВ нет
  });
});

describe('кнопки под результатом (share + remind)', () => {
  it('shareUrl ведёт в диалог пересылки с реф-меткой', () => {
    const u = shareUrl('ru');
    expect(u).toContain('t.me/share/url');
    expect(decodeURIComponent(u)).toContain('start=ref');
  });
  it('resultKeyboard: share всегда, remind — по флагу', () => {
    const cbs = (kb: ReturnType<typeof resultKeyboard>) =>
      kb.inline_keyboard.flat().map((b) => (b as { callback_data?: string }).callback_data);
    expect(cbs(resultKeyboard('ru'))).not.toContain('rmd|910');
    expect(cbs(resultKeyboard('ru', { remind: true }))).toContain('rmd|910');
  });
});
