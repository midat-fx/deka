/**
 * Эмбеддинги через Gemini (gemini-embedding-001, 768 измерений).
 *
 * taskType — важная деталь: для документов кодекса RETRIEVAL_DOCUMENT,
 * для вопроса пользователя RETRIEVAL_QUERY. Модель кладёт их в согласованное
 * пространство, что заметно поднимает качество поиска против «одинакового»
 * эмбеддинга для обоих.
 *
 * Платформо-нейтрально (fetch есть и в Node, и в Workers).
 */
export const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIM = 768;

export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;

/**
 * Эмбеддинги пачки текстов одним запросом (до ~100 за раз).
 * timeoutMs: для офлайн-загрузки корпуса щедрый, для запроса юзера в вебхуке —
 * жёсткий (Telegram не ждёт долго; при срыве поиск откатится на BM25).
 */
export async function embedTexts(
  texts: string[],
  apiKey: string,
  taskType: EmbedTaskType,
  dim: number = EMBED_DIM,
  timeoutMs = 30_000,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: dim,
      })),
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(`embed http ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { embeddings?: { values: number[] }[] };
  if (!data.embeddings) throw new Error('embed: пустой ответ');
  return data.embeddings.map((e) => normalize(e.values));
}

/** Эмбеддинг одного запроса пользователя (жёсткий таймаут — мы в вебхуке). */
export async function embedQuery(
  text: string,
  apiKey: string,
  dim: number = EMBED_DIM,
  timeoutMs = 3_500,
): Promise<number[]> {
  const [v] = await embedTexts([text], apiKey, 'RETRIEVAL_QUERY', dim, timeoutMs);
  if (!v) throw new Error('embed: не получен эмбеддинг запроса');
  return v;
}

/**
 * Нормируем в единичную длину: при усечении размерности (3072→768) Gemini
 * рекомендует ре-нормализацию, а с нормированными векторами косинус = скалярное
 * произведение, что упрощает и ускоряет поиск.
 */
function normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

/** Вектор → строковый литерал pgvector: [0.1,0.2,…]. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
