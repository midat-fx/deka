/**
 * Налоговые дедлайны для ИП/самозанятых — данные + чистая логика.
 *
 * Даты сверены (07.2026): форма 910 (упрощёнка) сдаётся дважды в год,
 * за 1-е полугодие — до 15 августа, налог — до 25 августа; за 2-е — до
 * 15/25 февраля. Если срок выпадает на выходной, он переносится на
 * ближайший рабочий день (в тексте предупреждаем; праздники не считаем).
 * Источники: mybuh.kz, bcc.kz.
 *
 * Список сознательно короткий и честный — только то, что сверено. Расширяем
 * по мере проверки других форм (200.00 и т.д.).
 */
import {
  formatDateI18n,
  pluralDaysI18n,
  DEADLINE_I18N,
  DEADLINES_UI,
  type Lang,
} from '../i18n/i18n';

export interface Deadline {
  id: string;
  title: string;
  /** Дата сдачи декларации (ISO, YYYY-MM-DD). */
  submitDate: string;
  /** Дата уплаты налога, если отличается. */
  payDate?: string;
  note: string;
}

export const DEADLINES: Deadline[] = [
  {
    id: '910-1h-2026',
    title: 'Форма 910 за 1-е полугодие 2026',
    submitDate: '2026-08-15',
    payDate: '2026-08-25',
    note: 'Упрощёнка: сдать декларацию за январь–июнь и уплатить налог.',
  },
  {
    id: '910-2h-2026',
    title: 'Форма 910 за 2-е полугодие 2026',
    submitDate: '2027-02-15',
    payDate: '2027-02-25',
    note: 'Упрощёнка: сдать декларацию за июль–декабрь и уплатить налог.',
  },
];

/** Целое число дней от даты `from` до ISO-даты (по UTC-полуночи, без времени). */
export function daysUntil(from: Date, isoDate: string): number {
  const to = new Date(`${isoDate}T00:00:00Z`).getTime();
  const fromMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((to - fromMidnight) / 86_400_000);
}

export interface UpcomingDeadline {
  deadline: Deadline;
  daysToSubmit: number;
}

/** Ещё не прошедшие дедлайны (по дате уплаты), отсортированные по близости. */
export function upcomingDeadlines(today: Date, deadlines: Deadline[] = DEADLINES): UpcomingDeadline[] {
  return deadlines
    .map((d) => ({ deadline: d, daysToSubmit: daysUntil(today, d.submitDate) }))
    .filter((x) => daysUntil(today, x.deadline.payDate ?? x.deadline.submitDate) >= 0)
    .sort((a, b) => a.daysToSubmit - b.daysToSubmit);
}

/** Дедлайны, до сдачи которых ровно N дней (для напоминаний по cron). */
export function dueReminders(
  today: Date,
  offsets: number[] = [7, 1],
  deadlines: Deadline[] = DEADLINES,
): Deadline[] {
  return deadlines.filter((d) => offsets.includes(daysUntil(today, d.submitDate)));
}

// --- Отрисовка (чистые функции, без Telegram — переиспользуются ботом и cron) ---

/** Заголовок и пояснение дедлайна на нужном языке (ru — из самого Deadline). */
function localized(d: Deadline, lang: Lang): { title: string; note: string } {
  const o = DEADLINE_I18N[d.id];
  if (!o || lang === 'ru') return { title: d.title, note: d.note };
  return { title: o.title[lang] ?? d.title, note: o.note[lang] ?? d.note };
}

export function renderUpcoming(today: Date, lang: Lang = 'ru'): string {
  const up = upcomingDeadlines(today);
  const ui = DEADLINES_UI;
  const lines = [ui.title[lang], ''];
  if (up.length === 0) {
    lines.push(ui.empty[lang]);
  } else {
    for (const u of up) {
      const d = u.deadline;
      const { title, note } = localized(d, lang);
      const when = u.daysToSubmit > 0 ? ui.inDays[lang](pluralDaysI18n(u.daysToSubmit, lang)) : ui.lastDay[lang];
      lines.push(`• <b>${title}</b> — ${when}`);
      const pay = d.payDate ? ui.payBy[lang](formatDateI18n(d.payDate, lang)) : '';
      lines.push(`  ${ui.submitBy[lang](formatDateI18n(d.submitDate, lang))}${pay}`);
      lines.push(`  <i>${note}</i>`);
      lines.push('');
    }
  }
  lines.push(ui.footer[lang]);
  return lines.join('\n');
}

export function renderReminder(deadline: Deadline, today: Date, lang: Lang = 'ru'): string {
  const ui = DEADLINES_UI;
  const days = daysUntil(today, deadline.submitDate);
  const { title, note } = localized(deadline, lang);
  const pay = deadline.payDate ? ui.payBy[lang](formatDateI18n(deadline.payDate, lang)) : '';
  return (
    `${ui.reminderTitle[lang]}\n\n` +
    `${ui.reminderBody[lang](pluralDaysI18n(days, lang), title)}\n${note}\n` +
    `${ui.submitBy[lang](formatDateI18n(deadline.submitDate, lang))}${pay}.\n\n` +
    `${ui.reminderOff[lang]}`
  );
}
