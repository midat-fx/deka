/**
 * Faithfulness-eval LLM-ответов: npm run eval:answers  (нужен GEMINI_API_KEY)
 *
 * Для каждого вопроса из eval/answer-golden.json:
 *   1) ищем фрагменты (как бот) → 2) генерируем ответ Gemini →
 *   3) проверяем, что ответ: пришёл (не отказ/ошибка), сослался на ОЖИДАЕМУЮ
 *      статью и содержит ключевой факт (число/термин из кодекса).
 *
 * «Faithful» = всё три галочки. Это и есть измерение того, что ответ
 * grounded в правильном месте кодекса, а не просто «звучит правдоподобно».
 *
 * Делает реальные вызовы Gemini, поэтому НЕ в CI (там — детерминированный
 * eval поиска). Запускается вручную, результат публикуется в README/DECISIONS.
 */
import { readFileSync } from 'node:fs';
import { loadChunks } from '../src/rag/chunks';
import { SearchIndex } from '../src/rag/search';
import { generateAnswer, type AnswerOutcome } from '../src/rag/answer';

try {
  process.loadEnvFile('.env');
} catch {
  /* переменные могут быть в окружении */
}

interface Case {
  q: string;
  cite: string[];
  mustContain: string[];
}

const golden = JSON.parse(readFileSync('eval/answer-golden.json', 'utf-8')) as {
  threshold: number;
  cases: Case[];
};

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Нет GEMINI_API_KEY в .env — faithfulness-eval требует реальных вызовов.');
  process.exit(1);
}

const index = new SearchIndex(loadChunks());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function citesAny(text: string, articles: string[]): boolean {
  const re = /(?:ст\.?|стать[а-яё]+)\s*(\d+(?:-\d+)?)/gi;
  const found = new Set<string>();
  for (const m of text.matchAll(re)) if (m[1]) found.add(m[1]);
  return articles.some((a) => found.has(a));
}

/** Вызов с одним ретраем на случай rate-limit free tier (10 RPM). */
async function answerWithRetry(q: string): Promise<AnswerOutcome> {
  const hits = index.search(q, 8, { dedupeByArticle: false });
  let out = await generateAnswer(q, hits, { apiKey });
  if (out.kind === 'error' && (out.reason === 'http_429' || out.reason === 'timeout')) {
    await sleep(20_000);
    out = await generateAnswer(q, hits, { apiKey });
  }
  return out;
}

let answered = 0;
let cited = 0;
let factOk = 0;
let faithful = 0;
const failures: string[] = [];

console.log(`📏 Faithfulness-eval LLM-ответов (${golden.cases.length} вопросов, Gemini)\n`);

for (const c of golden.cases) {
  const out = await answerWithRetry(c.q);
  const isAnswered = out.kind === 'answered';
  const text = isAnswered ? out.text : '';
  const isCited = isAnswered && citesAny(text, c.cite);
  const isFact = isAnswered && c.mustContain.every((s) => text.includes(s));
  const isFaithful = isAnswered && isCited && isFact;

  if (isAnswered) answered++;
  if (isCited) cited++;
  if (isFact) factOk++;
  if (isFaithful) faithful++;

  const mark = isFaithful ? '✓' : '✗';
  console.log(`${mark} ${c.q}`);
  if (!isFaithful) {
    const why =
      out.kind !== 'answered'
        ? `исход ${out.kind}${out.kind === 'error' ? `(${out.reason})` : ''}`
        : [!isCited ? `нет цитаты на Ст. ${c.cite.join('/')}` : '', !isFact ? `нет факта [${c.mustContain.join(', ')}]` : '']
            .filter(Boolean)
            .join('; ');
    failures.push(`  ✗ «${c.q}» — ${why}`);
  }
  await sleep(6500); // держимся под 10 RPM free tier
}

const n = golden.cases.length;
const pct = (x: number) => `${Math.round((x / n) * 100)}%`;

console.log(`\n  ответ дан:        ${pct(answered)}  (${answered}/${n})`);
console.log(`  цитата верна:     ${pct(cited)}  (${cited}/${n})`);
console.log(`  ключевой факт:    ${pct(factOk)}  (${factOk}/${n})`);
console.log(`  FAITHFUL (всё 3): ${pct(faithful)}  (${faithful}/${n})`);

if (failures.length > 0) {
  console.log('\nПромахи:');
  for (const f of failures) console.log(f);
}

if (faithful / n < golden.threshold) {
  console.error(`\n❌ Faithful ниже порога ${golden.threshold * 100}%.`);
  process.exit(1);
}
console.log(`\n✅ Гейт пройден (faithful ≥ ${golden.threshold * 100}%).`);
