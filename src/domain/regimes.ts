import { mrpToTenge } from './mrp';
import { formatTenge } from './format';

export interface Source {
  label: string;
  url: string;
  /** true — первоисточник (adilet.zan.kz / gov.kz), false — разъяснение бухпортала. */
  primary: boolean;
}

/**
 * Источники. Пока часть — вторичные разъяснения (mybuh/uchet/pro1c): по ним
 * цифры сходятся между собой. На этапе RAG заменим на первоисточники adilet.zan.kz
 * и закрепим цитату до пункта статьи — в этом весь смысл продукта.
 */
export const SOURCES = {
  budget2026: {
    label: 'Закон РК «О республиканском бюджете на 2026–2028 годы» — МРП 4 325 ₸',
    url: 'https://tengrinews.kz/kazakhstan_news/utverjden-novyiy-mrp-na-2026-god-v-kazahstane-586608/',
    primary: false, // TODO(corpus): заменить на adilet.zan.kz
  },
  selfEmployed: {
    label: 'Ст. 718 НК РК-2026 — СНР для самозанятых (условия, лимит 300 МРП/мес — п. 6)',
    url: 'https://adilet.zan.kz/rus/docs/K2500000214#z11814',
    primary: true,
  },
  selfEmployedList: {
    label: 'Разрешительный список видов деятельности для самозанятых (2026)',
    url: 'https://pro1c.kz/news/zakonodatelstvo/razreshitelnyy-spisok-dlya-samozanyatykh/',
    primary: false,
  },
  simplified: {
    label: 'Ст. 723 НК РК-2026 — условия упрощённой декларации (лимит 600 000 МРП/год)',
    url: 'https://adilet.zan.kz/rus/docs/K2500000214#z11859',
    primary: true,
  },
  vat2026: {
    label: 'Ст. 99 НК РК-2026 — регистрационный учёт по НДС (порог 10 000 МРП — п. 14)',
    url: 'https://adilet.zan.kz/rus/docs/K2500000214#z1654',
    primary: true,
  },
} satisfies Record<string, Source>;

/**
 * Пороги храним в МРП (так их задаёт кодекс), а тенге считаем от МРП года.
 * Сверено 07.2026 — см. комментарии к источникам.
 */
export const LIMITS_MRP = {
  /** Доход самозанятого — не более, в месяц. */
  selfEmployedMonthly: 300,
  /** Оборот на упрощёнке — не более, в год. */
  simplifiedAnnualTurnover: 600_000,
  /** Порог обязательной постановки на учёт по НДС (общий режим), в год. */
  vatRegistrationAnnual: 10_000,
} as const;

/** Те же пороги в тенге по МРП текущего года (2026). */
export const LIMITS_TENGE = {
  selfEmployedMonthly: mrpToTenge(LIMITS_MRP.selfEmployedMonthly),
  /** Годовой эквивалент месячного лимита самозанятого (×12) — для сравнения с годовым оборотом. */
  selfEmployedAnnualEquiv: mrpToTenge(LIMITS_MRP.selfEmployedMonthly * 12),
  simplifiedAnnualTurnover: mrpToTenge(LIMITS_MRP.simplifiedAnnualTurnover),
  vatRegistrationAnnual: mrpToTenge(LIMITS_MRP.vatRegistrationAnnual),
} as const;

export type RegimeId = 'self_employed' | 'simplified' | 'general';

export interface Regime {
  id: RegimeId;
  name: string;
  who: string;
  rateSummary: string;
  conditions: string[];
  sources: Source[];
}

export const REGIMES: Record<RegimeId, Regime> = {
  self_employed: {
    id: 'self_employed',
    name: 'Самозанятый (СНР для самозанятых)',
    who: 'Физлицо без наёмных работников, небольшой доход, деятельность из разрешительного списка.',
    rateSummary:
      'Единая ставка 4% от дохода (соцплатежи). ИПН не уплачивается. Учёт и чеки — через мобильное приложение.',
    conditions: [
      'Только физлицо (гражданин РК или кандас), не ТОО.',
      'Без наёмных работников.',
      `Доход ≤ 300 МРП в месяц (${formatTenge(LIMITS_TENGE.selfEmployedMonthly)}).`,
      'Вид деятельности — из утверждённого разрешительного списка.',
      'Плательщиком НДС быть нельзя.',
    ],
    sources: [SOURCES.selfEmployed, SOURCES.selfEmployedList],
  },
  simplified: {
    id: 'simplified',
    name: 'Упрощёнка (СНР на основе упрощённой декларации)',
    who: 'ИП и ТОО с оборотом до 600 000 МРП/год; можно нанимать работников.',
    rateSummary:
      'Налог с оборота по упрощённой декларации (ставку и порядок уточни по НК РК-2026). Плательщиком НДС быть нельзя (кроме импортного НДС).',
    conditions: [
      `Оборот ≤ 600 000 МРП/год (${formatTenge(LIMITS_TENGE.simplifiedAnnualTurnover)}).`,
      'По новому кодексу лимит по числу работников снят.',
      'Есть ограничения по видам деятельности — проверь свой ОКЭД по НК.',
      'Плательщиком НДС на упрощёнке быть нельзя.',
    ],
    sources: [SOURCES.simplified],
  },
  general: {
    id: 'general',
    name: 'Общеустановленный режим',
    who: 'Все, кто не проходит по лимитам спецрежимов или кому нужен НДС/работа с крупными контрагентами.',
    rateSummary:
      'ИПН/КПН по общим правилам с чистого дохода. При обороте выше порога — обязательная постановка на учёт по НДС.',
    conditions: [
      'Без лимита по обороту.',
      `Постановка на учёт по НДС обязательна при обороте > 10 000 МРП/год (${formatTenge(LIMITS_TENGE.vatRegistrationAnnual)}).`,
      'Полный учёт доходов и расходов.',
    ],
    sources: [SOURCES.vat2026],
  },
};
