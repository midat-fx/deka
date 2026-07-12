/**
 * Сценарий визарда — платформо-независимый.
 *
 * Здесь описано, КАКИЕ вопросы задавать и В КАКОМ порядке, без единого
 * упоминания Telegram или браузера. Бот рисует эти шаги inline-кнопками,
 * лендинг — HTML-кнопками, но логика одна: поменял вопрос здесь — поменялся
 * везде. (Принцип «одна кодовая база на все платформы», см. DECISIONS.md.)
 */
import type { WizardAnswers, EntityType } from './wizard';

export interface FlowOption {
  code: string;
  label: string;
}

export interface FlowStep {
  /** Поле ответа: entity | emp | act | turn (коротко — для callback-данных). */
  field: 'entity' | 'emp' | 'act' | 'turn';
  step: number;
  question: string;
  hint?: string;
  options: FlowOption[];
  /** Внешняя ссылка-подсказка (например, разрешительный список). */
  linkOut?: { label: string; url: string };
}

/** Диапазоны годового оборота. estimate — репрезентативная точка для расчёта. */
export const TURNOVER_BUCKETS = [
  { code: 't1', label: 'до 15 млн ₸/год', estimate: 10_000_000 },
  { code: 't2', label: '15–43 млн ₸/год', estimate: 30_000_000 },
  { code: 't3', label: '43 млн – 2,6 млрд ₸/год', estimate: 500_000_000 },
  { code: 't4', label: 'больше 2,6 млрд ₸/год', estimate: 3_000_000_000 },
] as const;

const ACTIVITY_LIST_URL =
  'https://pro1c.kz/news/zakonodatelstvo/razreshitelnyy-spisok-dlya-samozanyatykh/';

const STEP_ENTITY: FlowStep = {
  field: 'entity',
  step: 1,
  question: 'Ты оформляешься как физлицо или как ТОО (юрлицо)?',
  options: [
    { code: 'individual', label: 'Физлицо' },
    { code: 'legal', label: 'ТОО / юрлицо' },
  ],
};

const STEP_EMPLOYEES: FlowStep = {
  field: 'emp',
  step: 2,
  question: 'У тебя есть наёмные работники?',
  options: [
    { code: 'no', label: 'Без работников' },
    { code: 'yes', label: 'Есть работники' },
  ],
};

const STEP_ACTIVITY: FlowStep = {
  field: 'act',
  step: 3,
  question: 'Твой вид деятельности входит в разрешительный список для самозанятых?',
  hint: 'Не уверен — открой список по ссылке или выбери «Не знаю».',
  options: [
    { code: 'in', label: 'Да, в списке' },
    { code: 'no', label: 'Нет, не в списке' },
    { code: 'dk', label: 'Не знаю' },
  ],
  linkOut: { label: '📋 Открыть список видов деятельности', url: ACTIVITY_LIST_URL },
};

const STEP_TURNOVER: FlowStep = {
  field: 'turn',
  step: 4,
  question: 'Какой у тебя примерный доход (оборот) за год?',
  options: TURNOVER_BUCKETS.map((b) => ({ code: b.code, label: b.label })),
};

/** Какой вопрос задать дальше по уже собранным ответам; null — данных достаточно. */
export function nextStep(a: Partial<WizardAnswers>): FlowStep | null {
  if (!a.entity) return STEP_ENTITY;
  if (a.entity === 'individual' && a.hasEmployees === undefined) return STEP_EMPLOYEES;
  if (a.entity === 'individual' && a.hasEmployees === false && !a.activity) return STEP_ACTIVITY;
  if (a.annualTurnoverTenge === undefined) return STEP_TURNOVER;
  return null;
}

/** Применить ответ (field + code кнопки) к состоянию. */
export function applyAnswer(a: Partial<WizardAnswers>, field: string, value: string): void {
  switch (field) {
    case 'entity':
      a.entity = value as EntityType;
      break;
    case 'emp':
      a.hasEmployees = value === 'yes';
      break;
    case 'act':
      a.activity = value === 'in' ? 'in_list' : value === 'no' ? 'not_in_list' : 'unknown';
      break;
    case 'turn': {
      const bucket = TURNOVER_BUCKETS.find((b) => b.code === value);
      if (bucket) a.annualTurnoverTenge = bucket.estimate;
      break;
    }
  }
}
