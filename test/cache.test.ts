import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteAnswerCache, cacheKey } from '../src/store/answer-cache';

const dirs: string[] = [];
const mk = () => {
  const dir = mkdtempSync(join(tmpdir(), 'deka-cache-'));
  dirs.push(dir);
  return new SqliteAnswerCache(join(dir, 'c.db'), 'salt');
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('cacheKey', () => {
  it('перефразировки с одними стем-основами → один ключ (порядок и число слов не важны)', () => {
    // «доход/доходы» и «самозанятого/самозанятых» сводятся к общим основам.
    // (NB: «лимит»→«лим», но «лимиты»→«лимит» — известный over-stemming, на
    //  корректность кэша не влияет, лишь чуть снижает hit-rate.)
    expect(cacheKey('доход самозанятого', 'ru')).toBe(cacheKey('самозанятых доходы', 'ru'));
  });
  it('разный язык → разный ключ', () => {
    expect(cacheKey('лимит', 'ru')).not.toBe(cacheKey('лимит', 'kk'));
  });
});

describe('SqliteAnswerCache', () => {
  it('set/get возвращает ответ со свежим возрастом', async () => {
    const c = mk();
    await c.set('k1', '<b>ответ</b>');
    const got = await c.get('k1');
    expect(got?.reply).toBe('<b>ответ</b>');
    expect(got?.ageMs).toBeLessThan(5000);
    expect(await c.get('нет')).toBeNull();
  });

  it('дневной счётчик растёт и разделяет пользователей', async () => {
    const c = mk();
    expect(await c.hitsToday(1)).toBe(0);
    await c.bumpToday(1);
    await c.bumpToday(1);
    expect(await c.hitsToday(1)).toBe(2);
    expect(await c.hitsToday(2)).toBe(0);
  });
});
