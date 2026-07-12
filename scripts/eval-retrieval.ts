/**
 * Eval поиска по кодексу: npm run eval
 *
 * Метрики:
 *  - hit@1: доля вопросов, где правильная статья — первым результатом
 *  - hit@3: доля вопросов, где правильная статья в топ-3
 *  - MRR:   средний 1/позиция первого правильного результата
 *
 * Скрипт выходит с ошибкой, если hit@3 ниже порога — готовый CI-гейт:
 * «улучшение» поиска, которое ломает больше вопросов, чем чинит, не пройдёт.
 */
import { readFileSync } from 'node:fs';
import { loadChunks } from '../src/rag/chunks';
import { SearchIndex } from '../src/rag/search';

const HIT3_THRESHOLD = 0.75;

interface GoldenCase {
  q: string;
  expect: string[];
}

const golden = JSON.parse(readFileSync('eval/retrieval-golden.json', 'utf-8')) as {
  cases: GoldenCase[];
};

const index = new SearchIndex(loadChunks());

let hit1 = 0;
let hit3 = 0;
let mrrSum = 0;
const failures: string[] = [];

for (const c of golden.cases) {
  const hits = index.search(c.q, 3);
  const articles = hits.map((h) => h.chunk.article);
  const pos = articles.findIndex((a) => c.expect.includes(a));

  if (pos === 0) hit1++;
  if (pos >= 0) {
    hit3++;
    mrrSum += 1 / (pos + 1);
  } else {
    failures.push(
      `  ✗ «${c.q}»\n    ожидали: Ст. ${c.expect.join('/')}, получили: ${articles.map((a) => `Ст.${a}`).join(', ') || 'ничего'}`,
    );
  }
}

const n = golden.cases.length;
const pct = (x: number) => `${Math.round((x / n) * 100)}%`;

console.log(`📏 Eval поиска по НК РК-2026 (${n} вопросов, ${index.size} чанков)\n`);
console.log(`  hit@1: ${pct(hit1)}  (${hit1}/${n})`);
console.log(`  hit@3: ${pct(hit3)}  (${hit3}/${n})`);
console.log(`  MRR:   ${(mrrSum / n).toFixed(2)}`);

if (failures.length > 0) {
  console.log('\nПромахи:');
  for (const f of failures) console.log(f);
}

if (hit3 / n < HIT3_THRESHOLD) {
  console.error(`\n❌ hit@3 ниже порога ${HIT3_THRESHOLD * 100}% — гейт не пройден.`);
  process.exit(1);
}
console.log(`\n✅ Гейт пройден (порог hit@3 ≥ ${HIT3_THRESHOLD * 100}%).`);
