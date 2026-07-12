/**
 * Векторный поиск (pgvector в Neon) и гибрид BM25 + вектор.
 *
 * Зачем гибрид: BM25 находит по словам (точные термины, числа), вектор — по
 * смыслу (перефразировки, синонимы, которых нет в словаре расширений).
 * Faithfulness-eval показал ровно те промахи, где BM25 не поднял нужный чанк
 * по формулировке — их и должен закрыть семантический вектор.
 *
 * Слияние — Reciprocal Rank Fusion (RRF): не зависит от несопоставимых шкал
 * баллов BM25 и косинуса, устойчив и не требует калибровки.
 *
 * Neon-драйвер (@neondatabase/serverless) — HTTP, работает и в Node, и в
 * Cloudflare Workers одинаково.
 */
import { embedQuery, toVectorLiteral } from './embed';
import type { SearchIndex, SearchHit } from './search';

/** Минимальный интерфейс исполнителя SQL (neon()). */
export interface SqlExecutor {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface VectorHit {
  id: string;
  score: number; // косинусная близость 0..1
}

/** Топ-k ближайших чанков по косинусной близости в pgvector. */
export async function vectorSearchIds(
  sql: SqlExecutor,
  queryEmbedding: number[],
  k: number,
): Promise<VectorHit[]> {
  const lit = toVectorLiteral(queryEmbedding);
  const rows = await sql.query(
    `SELECT id, 1 - (embedding <=> $1::vector) AS score
     FROM chunk_vectors
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [lit, k],
  );
  return rows.map((r) => ({ id: String(r.id), score: Number(r.score) }));
}

/** Reciprocal Rank Fusion: id → суммарный RRF-балл по всем спискам. */
export function reciprocalRankFusion(lists: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}

export interface HybridOptions {
  apiKey: string;
  /** Сколько кандидатов брать из каждого источника до слияния. */
  pool?: number;
  /** Схлопывать до одного чанка на статью (для показа источников). */
  dedupeByArticle?: boolean;
}

/**
 * Гибридный поиск: BM25 (локально) + вектор (Neon), слияние RRF.
 * Возвращает до k результатов как SearchHit (chunk + RRF-балл).
 * Если векторный источник недоступен (нет ключа/сети) — тихо откатывается
 * к чистому BM25: поиск обязан работать всегда.
 */
export async function hybridSearch(
  index: SearchIndex,
  sql: SqlExecutor,
  query: string,
  k: number,
  opts: HybridOptions,
): Promise<SearchHit[]> {
  const pool = opts.pool ?? 12;
  const bm25 = index.search(query, pool, { dedupeByArticle: false });

  let vecIds: string[] = [];
  try {
    const emb = await embedQuery(query, opts.apiKey);
    const vec = await vectorSearchIds(sql, emb, pool);
    vecIds = vec.map((v) => v.id);
  } catch (err) {
    console.error('vector search failed, откат к BM25:', err);
    return index.search(query, k, { dedupeByArticle: opts.dedupeByArticle });
  }

  const fused = reciprocalRankFusion([bm25.map((h) => h.chunk.id), vecIds]);
  const ranked = [...fused.entries()]
    .map(([id, score]) => ({ chunk: index.chunkById(id), score }))
    .filter((h): h is SearchHit => h.chunk !== undefined)
    .sort((a, b) => b.score - a.score);

  if (!opts.dedupeByArticle) return ranked.slice(0, k);

  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of ranked) {
    if (seen.has(h.chunk.article)) continue;
    seen.add(h.chunk.article);
    out.push(h);
    if (out.length === k) break;
  }
  return out;
}
