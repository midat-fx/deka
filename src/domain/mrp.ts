/**
 * МРП — месячный расчётный показатель. Базовая величина, от которой в РК
 * считается почти всё: налоговые лимиты, пороги, штрафы, пошлины.
 * Устанавливается ежегодно законом о республиканском бюджете.
 *
 * 2026 год — 4 325 ₸ (рост с 3 932 ₸ в 2025-м, +10%).
 * Источник: Закон РК «О республиканском бюджете на 2026–2028 годы»
 * (подписан 08.12.2025, действует с 01.01.2026).
 * Сверено 07.2026 по Tengrinews и uchet.kz; первоисточник — adilet.zan.kz
 * (закрепим точную ссылку при сборке корпуса на этапе RAG).
 *
 * Всё, что зависит от МРП, считаем ОТ этой константы, а не хардкодим в тенге:
 * поменяется МРП — правим одно число, а не двадцать.
 */
export const MRP_BY_YEAR = {
  2025: 3932,
  2026: 4325,
} as const satisfies Record<number, number>;

export const CURRENT_TAX_YEAR = 2026;

/** Значение МРП (в тенге) за указанный год. Бросает, если год не задан. */
export function mrp(year: number = CURRENT_TAX_YEAR): number {
  const value = (MRP_BY_YEAR as Record<number, number>)[year];
  if (value === undefined) {
    throw new Error(
      `МРП на ${year} год не задан. Добавь значение в MRP_BY_YEAR (src/domain/mrp.ts).`,
    );
  }
  return value;
}

/** Сумма в МРП → тенге за указанный год. */
export function mrpToTenge(amountInMrp: number, year: number = CURRENT_TAX_YEAR): number {
  return amountInMrp * mrp(year);
}
