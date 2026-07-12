/**
 * Детерминированный подбор налогового режима.
 *
 * Здесь НЕТ LLM и нет обращений к сети — только чистая логика по сверенным
 * лимитам из regimes.ts. Это принципиально: подбор режима не должен ничего
 * «придумывать». Где данных не хватает (вид деятельности), честно возвращаем
 * статус needs_check, а не гадаем.
 */
import {
  LIMITS_TENGE,
  SOURCES,
  type RegimeId,
  type Source,
} from './regimes';
import { formatTenge } from './format';

export type EntityType = 'individual' | 'legal';
export type ActivityAnswer = 'in_list' | 'not_in_list' | 'unknown';

export interface WizardAnswers {
  /** Физлицо или ТОО/юрлицо. */
  entity: EntityType;
  /** Есть ли наёмные работники (спрашиваем только у физлица). */
  hasEmployees?: boolean;
  /** В разрешительном списке для самозанятых (спрашиваем только у физлица без работников). */
  activity?: ActivityAnswer;
  /** Оценка годового оборота в тенге (из выбранного диапазона). */
  annualTurnoverTenge: number;
}

export type EligStatus = 'recommended' | 'eligible' | 'needs_check' | 'not_eligible';

export interface RegimeEligibility {
  regime: RegimeId;
  status: EligStatus;
  reasons: string[];
}

export interface Recommendation {
  primary: RegimeId | 'needs_human';
  headline: string;
  eligibility: RegimeEligibility[];
  flags: string[];
  disclaimers: string[];
  sources: Source[];
}

export function recommendRegime(a: WizardAnswers): Recommendation {
  const annual = a.annualTurnoverTenge;
  const monthlyEstimate = annual / 12;
  const flags: string[] = [];

  // --- Самозанятый ---
  const seReasons: string[] = [];
  let seStatus: EligStatus = 'eligible';
  if (a.entity !== 'individual') {
    seStatus = 'not_eligible';
    seReasons.push('Доступен только физлицам, не ТОО.');
  } else if (a.hasEmployees) {
    seStatus = 'not_eligible';
    seReasons.push('Нельзя нанимать работников.');
  } else if (monthlyEstimate > LIMITS_TENGE.selfEmployedMonthly) {
    seStatus = 'not_eligible';
    seReasons.push(
      `Доход выше лимита 300 МРП/мес (${formatTenge(LIMITS_TENGE.selfEmployedMonthly)}).`,
    );
  } else if (a.activity === 'in_list') {
    seStatus = 'eligible';
    seReasons.push('Подходит: физлицо, без работников, доход в пределах лимита, деятельность в списке.');
  } else if (a.activity === 'not_in_list') {
    seStatus = 'not_eligible';
    seReasons.push('Вид деятельности не входит в разрешительный список для самозанятых.');
  } else {
    seStatus = 'needs_check';
    seReasons.push('Всё подходит, кроме одного: нужно проверить вид деятельности по разрешительному списку.');
  }

  // --- Упрощёнка ---
  const simpReasons: string[] = [];
  let simpStatus: EligStatus = 'eligible';
  if (annual > LIMITS_TENGE.simplifiedAnnualTurnover) {
    simpStatus = 'not_eligible';
    simpReasons.push(
      `Оборот выше лимита 600 000 МРП/год (${formatTenge(LIMITS_TENGE.simplifiedAnnualTurnover)}).`,
    );
  } else {
    simpReasons.push(
      `Оборот в пределах лимита 600 000 МРП/год (${formatTenge(LIMITS_TENGE.simplifiedAnnualTurnover)}).`,
    );
    simpReasons.push('Плательщиком НДС на упрощёнке быть нельзя (кроме импортного НДС).');
    simpReasons.push('Есть ограничения по видам деятельности — проверь свой ОКЭД по НК.');
  }

  // --- Общий режим (доступен всегда) ---
  const overVat = annual > LIMITS_TENGE.vatRegistrationAnnual;
  const genReasons: string[] = ['Доступен всегда, без лимита по обороту.'];
  genReasons.push(
    overVat
      ? `Оборот выше порога НДС 10 000 МРП/год (${formatTenge(LIMITS_TENGE.vatRegistrationAnnual)}) — постановка на учёт по НДС обязательна.`
      : `Оборот ниже порога НДС (${formatTenge(LIMITS_TENGE.vatRegistrationAnnual)}) — обязательной постановки по НДС нет.`,
  );

  // --- Выбор рекомендации: от простого/дешёвого к сложному ---
  let primary: RegimeId;
  let headline: string;
  if (seStatus === 'eligible') {
    primary = 'self_employed';
    headline = 'Скорее всего тебе подходит режим самозанятого.';
  } else if (seStatus === 'needs_check') {
    primary = 'self_employed';
    headline = 'Вероятно, самозанятый — но нужно проверить вид деятельности.';
  } else if (simpStatus === 'eligible') {
    primary = 'simplified';
    headline = 'Скорее всего тебе подходит упрощёнка.';
  } else {
    primary = 'general';
    headline = 'Похоже, тебе в общеустановленный режим.';
  }

  // Пометим рекомендованный (только если он «чисто» проходит).
  const markPrimary = (base: EligStatus, id: RegimeId): EligStatus =>
    id === primary && base === 'eligible' ? 'recommended' : base;

  // --- Предупреждения ---
  if (
    seStatus !== 'not_eligible' &&
    monthlyEstimate > LIMITS_TENGE.selfEmployedMonthly * 0.8 &&
    monthlyEstimate <= LIMITS_TENGE.selfEmployedMonthly
  ) {
    flags.push('Ты близко к лимиту самозанятого (300 МРП/мес). Подрастёт доход — придётся переходить на упрощёнку.');
  }
  if (
    simpStatus !== 'not_eligible' &&
    annual > LIMITS_TENGE.simplifiedAnnualTurnover * 0.8 &&
    annual <= LIMITS_TENGE.simplifiedAnnualTurnover
  ) {
    flags.push('Оборот приближается к потолку упрощёнки (600 000 МРП/год).');
  }
  if (primary === 'general' && overVat) {
    flags.push('Заявление на учёт по НДС подаётся не позже 5 рабочих дней после превышения порога.');
  }

  const eligibility: RegimeEligibility[] = [
    { regime: 'self_employed', status: markPrimary(seStatus, 'self_employed'), reasons: seReasons },
    { regime: 'simplified', status: markPrimary(simpStatus, 'simplified'), reasons: simpReasons },
    { regime: 'general', status: markPrimary('eligible', 'general'), reasons: genReasons },
  ];

  const disclaimers = [
    'Это ориентир, а не налоговая консультация. Итоговое решение — по НК РК и/или с бухгалтером.',
    'Расчёт по среднему доходу; сезонность и разовые крупные сделки могут менять картину.',
  ];

  const sources = [
    SOURCES.selfEmployed,
    SOURCES.selfEmployedList,
    SOURCES.simplified,
    SOURCES.vat2026,
    SOURCES.budget2026,
  ];

  return { primary, headline, eligibility, flags, disclaimers, sources };
}
