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

const RU_MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${RU_MONTHS_GEN[(m ?? 1) - 1]} ${y}`;
}

/** Правильное склонение: «1 день», «2 дня», «7 дней», «11 дней». */
export function pluralDays(n: number): string {
  const abs = Math.abs(n);
  const last2 = abs % 100;
  const last1 = abs % 10;
  if (last2 >= 11 && last2 <= 14) return `${n} дней`;
  if (last1 === 1) return `${n} день`;
  if (last1 >= 2 && last1 <= 4) return `${n} дня`;
  return `${n} дней`;
}

export function renderUpcoming(today: Date): string {
  const up = upcomingDeadlines(today);
  const lines = ['📅 <b>Ближайшие налоговые дедлайны</b>', ''];
  if (up.length === 0) {
    lines.push('В моём списке ближайших сроков сейчас нет.');
  } else {
    for (const u of up) {
      const d = u.deadline;
      const when = u.daysToSubmit > 0 ? `через ${pluralDays(u.daysToSubmit)}` : 'сегодня последний день';
      lines.push(`• <b>${d.title}</b> — ${when}`);
      const pay = d.payDate ? `, уплатить до ${formatDate(d.payDate)}` : '';
      lines.push(`  Сдать до ${formatDate(d.submitDate)}${pay}`);
      lines.push(`  <i>${d.note}</i>`);
      lines.push('');
    }
  }
  lines.push('<i>Выпадает на выходной — переносится на ближайший рабочий день. Ориентир, сверяйся с КГД (1414).</i>');
  return lines.join('\n');
}

export function renderReminder(deadline: Deadline, today: Date): string {
  const days = daysUntil(today, deadline.submitDate);
  const pay = deadline.payDate ? `, уплатить до ${formatDate(deadline.payDate)}` : '';
  return (
    `🔔 <b>Напоминание о дедлайне</b>\n\n` +
    `Через ${pluralDays(days)} — <b>${deadline.title}</b>.\n${deadline.note}\n` +
    `Сдать до ${formatDate(deadline.submitDate)}${pay}.\n\n` +
    `<i>Отключить напоминания: /napomni стоп</i>`
  );
}
