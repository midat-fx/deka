import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderCard } from '../src/domain/card';
import { calcSimplifiedTax } from '../src/domain/form910';
import { SqlitePrefs } from '../src/store/prefs';

const AUG = new Date('2026-08-01T00:00:00Z');

describe('renderCard — «Моя карточка» из grounded-кусков', () => {
  it('без режима → приглашение пройти визард', () => {
    const c = renderCard(undefined, 0, 0, AUG, 'ru');
    expect(c).toContain('подбери режим');
    expect(c).not.toContain('Режим:');
  });
  it("пустой режим ('' от needs_human) → тоже приглашение", () => {
    expect(renderCard('', 0, 0, AUG, 'ru')).toContain('подбери режим');
  });
  it('упрощёнка: порог НДС (не потолок 2,6 млрд) + налог 4% (Ст.726) + 910', () => {
    const c = renderCard('simplified', 0, 3_000_000, AUG, 'ru');
    expect(c).toContain('Упрощёнка');
    expect(c).toContain('Порог НДС');
    expect(c).toContain('43 250 000 ₸'); // порог НДС 10000 МРП, а не потолок 2,6 млрд
    expect(c).toContain('Ст. 726');
    expect(c).toContain(`${calcSimplifiedTax(3_000_000).toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`); // 120 000 ₸
    expect(c).toContain('Форма 910'); // ближайший дедлайн на 01.08
  });
  it('самозанятый: ИПН 0% (Ст.720) БЕЗ чужого дедлайна 910', () => {
    const c = renderCard('self_employed', 500_000, 500_000, AUG, 'ru');
    expect(c).toContain('Самозанятый');
    expect(c).toContain('0%');
    expect(c).toContain('Ст. 720');
    expect(c).not.toContain('Форма 910'); // grounded: 910 — не для самозанятого
  });
  it('общий режим: порог НДС + общие правила, без 910', () => {
    const c = renderCard('general', 0, 40_000_000, AUG, 'ru');
    expect(c).toContain('Общеустановленный');
    expect(c).toContain('Порог НДС');
    expect(c).toContain('общим правилам');
    expect(c).not.toContain('Форма 910');
  });
  it('окно сдача→уплата (20 авг): НЕ «сегодня последний день», а «уплати до 25 августа»', () => {
    const c = renderCard('simplified', 0, 3_000_000, new Date('2026-08-20T00:00:00Z'), 'ru');
    expect(c).not.toContain('сегодня последний день');
    expect(c).toContain('уплати');
    expect(c).toContain('25 августа');
  });
  it('локализуется (en)', () => {
    expect(renderCard('simplified', 0, 1_000, AUG, 'en')).toContain('Simplified');
  });
});

describe('prefs: сохранение режима', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const mk = () => {
    const dir = mkdtempSync(join(tmpdir(), 'deka-regime-'));
    dirs.push(dir);
    return new SqlitePrefs(join(dir, 'p.db'), 'salt');
  };
  it('setRegime/getRegime, независимо от языка', async () => {
    const p = mk();
    expect(await p.getRegime(1)).toBeUndefined();
    await p.setRegime(1, 'simplified');
    expect(await p.getRegime(1)).toBe('simplified');
    await p.setLang(1, 'kk'); // язык не затирает режим
    expect(await p.getRegime(1)).toBe('simplified');
    expect(await p.getLang(1)).toBe('kk');
  });
  it('clear стирает и режим', async () => {
    const p = mk();
    await p.setRegime(2, 'general');
    await p.clear(2);
    expect(await p.getRegime(2)).toBeUndefined();
  });
});
