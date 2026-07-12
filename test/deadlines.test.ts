import { describe, it, expect } from 'vitest';
import { daysUntil, upcomingDeadlines, dueReminders, type Deadline } from '../src/domain/deadlines';

const D: Deadline[] = [
  { id: 'a', title: 'A', submitDate: '2026-08-15', payDate: '2026-08-25', note: '' },
  { id: 'b', title: 'B', submitDate: '2027-02-15', payDate: '2027-02-25', note: '' },
];

describe('daysUntil', () => {
  it('считает дни без учёта времени', () => {
    expect(daysUntil(new Date('2026-08-08T10:00:00Z'), '2026-08-15')).toBe(7);
    expect(daysUntil(new Date('2026-08-15T23:00:00Z'), '2026-08-15')).toBe(0);
    expect(daysUntil(new Date('2026-08-16T00:00:00Z'), '2026-08-15')).toBe(-1);
  });
});

describe('upcomingDeadlines', () => {
  it('прошедшие (по дате уплаты) отсекаются, остальное по близости', () => {
    const up = upcomingDeadlines(new Date('2026-09-01T00:00:00Z'), D);
    expect(up.map((u) => u.deadline.id)).toEqual(['b']); // 910-1h уже оплачен 25.08
  });
  it('до 25 августа оба ещё актуальны, ближайший — первый', () => {
    const up = upcomingDeadlines(new Date('2026-08-01T00:00:00Z'), D);
    expect(up[0]?.deadline.id).toBe('a');
    expect(up[0]?.daysToSubmit).toBe(14);
  });
});

describe('dueReminders', () => {
  it('срабатывает ровно за 7 и за 1 день до сдачи', () => {
    expect(dueReminders(new Date('2026-08-08T00:00:00Z'), [7, 1], D).map((d) => d.id)).toEqual(['a']);
    expect(dueReminders(new Date('2026-08-14T00:00:00Z'), [7, 1], D).map((d) => d.id)).toEqual(['a']);
    expect(dueReminders(new Date('2026-08-10T00:00:00Z'), [7, 1], D)).toHaveLength(0);
  });
});
