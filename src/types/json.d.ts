/**
 * JSON-импорты (индекс поиска в worker.ts) объявлены как unknown:
 * резолвит и бандлит их esbuild/wrangler, а tsc не должен тайпчекать
 * 1,8 МБ данных индекса на каждую проверку. Типизация — через явный
 * каст к SerializedIndex на месте импорта.
 */
declare module '*.json' {
  const data: unknown;
  export default data;
}
