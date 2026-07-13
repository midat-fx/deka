import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeIntent } from '../src/bot/router';
import { followupKeyboard } from '../src/bot/keyboard';
import { MENU } from '../src/i18n/i18n';
import { SqlitePrefs } from '../src/store/prefs';

describe('кнопка «⚙️ Настройки» роутится в меню на всех языках', () => {
  it('ru/kk/en → menu:settings', () => {
    expect(routeIntent(MENU.settings.ru)).toEqual({ kind: 'menu', action: 'settings' });
    expect(routeIntent(MENU.settings.kk)).toEqual({ kind: 'menu', action: 'settings' });
    expect(routeIntent(MENU.settings.en)).toEqual({ kind: 'menu', action: 'settings' });
  });
});

describe('follow-up кнопки под ответом', () => {
  it('три кнопки-воронки с ожидаемыми callback_data', () => {
    const rows = followupKeyboard('ru').inline_keyboard;
    const cbs = rows.flat().map((b) => (b as { callback_data?: string }).callback_data);
    expect(cbs).toEqual(['nav|910', 'nav|oborot', 'nav|dedlayny']);
  });
  it('подписи локализуются (казахская форма 910)', () => {
    const first = followupKeyboard('kk').inline_keyboard[0]![0] as { text: string };
    expect(first.text).toBe(MENU.form910.kk);
  });
});

describe('prefs.clear — удаление данных пользователя', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  it('после clear язык снова не задан (undefined)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deka-prefs-'));
    dirs.push(dir);
    const prefs = new SqlitePrefs(join(dir, 'p.db'), 'salt');
    await prefs.setLang(42, 'kk');
    expect(await prefs.getLang(42)).toBe('kk');
    await prefs.clear(42);
    expect(await prefs.getLang(42)).toBeUndefined();
  });
});
