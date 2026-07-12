/**
 * Эмбеддинги корпуса → Neon (pgvector): npm run build:vectors
 * Требует DATABASE_URL и GEMINI_API_KEY.
 *
 * Устойчив к лимитам free tier: при 429 ждёт и повторяет; возобновляемый —
 * пропускает уже загруженные чанки, поэтому можно перезапускать сколько угодно,
 * пока не зальются все. Флаг --fresh пересоздаёт таблицу с нуля.
 *
 * Поиск потом (локально и в Worker) ходит в таблицу chunk_vectors.
 */
import { neon } from '@neondatabase/serverless';
import { loadChunks } from '../src/rag/chunks';
import { embedTexts, toVectorLiteral, EMBED_DIM } from '../src/rag/embed';

try {
  process.loadEnvFile('.env');
} catch {
  /* переменные из окружения */
}

const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY;
if (!dbUrl || !apiKey) {
  console.error('❌ Нужны DATABASE_URL и GEMINI_API_KEY в .env');
  process.exit(1);
}

const fresh = process.argv.includes('--fresh');
const sql = neon(dbUrl);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH = 20; // мельче пачка — надёжнее против минутного токен-лимита free tier

/** Эмбеддинг пачки с ретраями на rate-limit (429) и сетевые сбои. */
async function embedWithRetry(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedTexts(texts, apiKey!, 'RETRIEVAL_DOCUMENT');
    } catch (err) {
      const msg = String(err);
      const is429 = msg.includes('429');
      if (attempt > 6 || (!is429 && !msg.includes('fetch'))) throw err;
      const wait = is429 ? 65_000 : 5_000;
      console.log(`  ⏳ ${is429 ? 'лимит (429)' : 'сбой'}, жду ${wait / 1000}с и повторяю…`);
      await sleep(wait);
    }
  }
}

await sql.query('CREATE EXTENSION IF NOT EXISTS vector');
if (fresh) await sql.query('DROP TABLE IF EXISTS chunk_vectors');
await sql.query(`CREATE TABLE IF NOT EXISTS chunk_vectors (
  id text PRIMARY KEY,
  article text NOT NULL,
  embedding vector(${EMBED_DIM}) NOT NULL
)`);

const existing = new Set(
  ((await sql.query('SELECT id FROM chunk_vectors')) as { id: string }[]).map((r) => r.id),
);
const all = loadChunks();
const todo = all.filter((c) => !existing.has(c.id));
console.log(`Всего чанков: ${all.length}; уже в базе: ${existing.size}; осталось: ${todo.length}`);

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const vectors = await embedWithRetry(batch.map((c) => `${c.title}. ${c.text}`));
  const values = batch
    .map((c, j) => `('${c.id}', '${c.article}', '${toVectorLiteral(vectors[j]!)}'::vector)`)
    .join(',');
  await sql.query(
    `INSERT INTO chunk_vectors (id, article, embedding) VALUES ${values}
     ON CONFLICT (id) DO NOTHING`,
  );
  console.log(`  ${existing.size + i + batch.length}/${all.length}`);
  if (i + BATCH < todo.length) await sleep(1500);
}

await sql.query(`CREATE INDEX IF NOT EXISTS idx_chunk_vectors_cos
  ON chunk_vectors USING hnsw (embedding vector_cosine_ops)`);

const [{ n }] = (await sql.query('SELECT COUNT(*)::int AS n FROM chunk_vectors')) as { n: number }[];
console.log(`✅ Готово: ${n}/${all.length} векторов в Neon.`);
if (n < all.length) {
  console.log('   Не всё влезло в лимиты — просто запусти команду ещё раз, продолжит с места.');
  process.exit(1);
}
