/**
 * Сравнение ретривалов на одном golden-set: npm run eval:hybrid
 * Требует DATABASE_URL и GEMINI_API_KEY (делает эмбеддинги запросов + ходит в Neon).
 *
 * Печатает hit@1/hit@3/MRR для BM25 и для гибрида (BM25+вектор, RRF) рядом —
 * прямое доказательство, что даёт векторный слой. Не в CI (сеть + ключ).
 */
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadChunks } from '../src/rag/chunks';
import { SearchIndex, type SearchHit } from '../src/rag/search';
import { hybridSearch } from '../src/rag/vector-search';

try {
  process.loadEnvFile('.env');
} catch {
  /* окружение */
}

const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY;
if (!dbUrl || !apiKey) {
  console.error('❌ Нужны DATABASE_URL и GEMINI_API_KEY');
  process.exit(1);
}

const golden = JSON.parse(readFileSync('eval/retrieval-golden.json', 'utf-8')) as {
  cases: { q: string; expect: string[] }[];
};
const index = new SearchIndex(loadChunks());
const sql = neon(dbUrl);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function metrics(name: string, results: { expect: string[]; hits: SearchHit[] }[]): void {
  let h1 = 0;
  let h3 = 0;
  let mrr = 0;
  for (const { expect, hits } of results) {
    const pos = hits.slice(0, 3).findIndex((h) => expect.includes(h.chunk.article));
    if (pos === 0) h1++;
    if (pos >= 0) {
      h3++;
      mrr += 1 / (pos + 1);
    }
  }
  const n = results.length;
  const pct = (x: number) => `${Math.round((x / n) * 100)}%`.padStart(4);
  console.log(`  ${name.padEnd(8)}  hit@1 ${pct(h1)}   hit@3 ${pct(h3)}   MRR ${(mrr / n).toFixed(2)}`);
}

const bm25: { expect: string[]; hits: SearchHit[] }[] = [];
const hybrid: { expect: string[]; hits: SearchHit[] }[] = [];

for (const c of golden.cases) {
  bm25.push({ expect: c.expect, hits: index.search(c.q, 3) });
  hybrid.push({
    expect: c.expect,
    hits: await hybridSearch(index, sql, c.q, 3, { apiKey, dedupeByArticle: true }),
  });
  await sleep(6500); // rate limit эмбеддингов
}

console.log(`\n📊 Ретривал на ${golden.cases.length} вопросах:\n`);
metrics('BM25', bm25);
metrics('Гибрид', hybrid);
