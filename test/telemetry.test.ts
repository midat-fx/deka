import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Telemetry } from '../src/telemetry/events';

const dirs: string[] = [];
function makeT(): Telemetry {
  const dir = mkdtempSync(join(tmpdir(), 'deka-tel-'));
  dirs.push(dir);
  return new Telemetry(join(dir, 'test.db'), 'test-salt');
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('телеметрия', () => {
  it('хэш юзера стабильный и не содержит исходный id', () => {
    const t = makeT();
    const h1 = t.hashUser(123456789);
    const h2 = t.hashUser(123456789);
    expect(h1).toBe(h2);
    expect(h1).not.toContain('123456789');
    expect(h1).toHaveLength(16);
    t.close();
  });

  it('считает уникальных юзеров и события', () => {
    const t = makeT();
    t.track(1, 'start');
    t.track(1, 'wizard_answer', 'entity=individual');
    t.track(1, 'wizard_result', 'self_employed');
    t.track(2, 'start');
    const s = t.summary();
    expect(s.uniqueUsers).toBe(2);
    expect(s.totalEvents).toBe(4);
    expect(s.funnel.started).toBe(2);
    expect(s.funnel.reachedResult).toBe(1);
    expect(s.regimes[0]?.regime).toBe('self_employed');
    t.close();
  });

  it('track с undefined id — тихо игнорируется', () => {
    const t = makeT();
    t.track(undefined, 'start');
    expect(t.summary().totalEvents).toBe(0);
    t.close();
  });
});
