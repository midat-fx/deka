/**
 * LLM-слой поверх поиска: человеческий ответ строго по фрагментам кодекса.
 *
 * Правила безопасности (тезис продукта — «grounded или молчит»):
 *  1. Модель видит ТОЛЬКО фрагменты, найденные BM25-поиском, — не «знания
 *     из интернета». Просим отвечать исключительно по ним.
 *  2. Ответ обязан ссылаться на статьи (валидируем регуляркой: упомянута
 *     хотя бы одна статья из переданных фрагментов). Нет цитаты — ответ
 *     бракуется, пользователь получает дословные фрагменты.
 *  3. Если модель не находит ответа во фрагментах, она обязана вывести
 *     NO_ANSWER — тогда показываем фрагменты, а не сочинение.
 *  4. Любая ошибка (сеть, таймаут, кривой ответ) → тихий откат к фрагментам.
 *     Пользователь ВСЕГДА получает ответ.
 *
 * Модуль платформо-нейтрален (fetch есть и в Node, и в Workers).
 */
import type { SearchHit } from './search';
import { ANSWER_LANG_INSTRUCTION, type Lang } from '../i18n/i18n';

export interface AnswerOptions {
  apiKey: string;
  /** По умолчанию стабильная gemini-2.5-flash; preview-модели — через env. */
  model?: string;
  timeoutMs?: number;
  /** Язык ответа (казахский вопрос → казахский ответ). */
  lang?: Lang;
}

export type AnswerOutcome =
  | { kind: 'answered'; text: string }
  | { kind: 'no_answer' }
  | { kind: 'error'; reason: string; raw?: string };

export const DEFAULT_MODEL = 'gemini-2.5-flash';
const NO_ANSWER_SENTINEL = 'NO_ANSWER';

export function buildPrompt(query: string, hits: SearchHit[], lang: Lang = 'ru'): string {
  const fragments = hits
    .map((h, i) => {
      const c = h.chunk;
      const text = c.text.length > 2500 ? `${c.text.slice(0, 2500)}…` : c.text;
      return `[${i + 1}] Ст. ${c.article}. ${c.title}\n${text}`;
    })
    .join('\n\n');

  return `Ты — ассистент по Налоговому кодексу Республики Казахстан 2026 года для ИП и самозанятых.

Ниже — фрагменты официального текста кодекса. Ответь на вопрос пользователя, используя ТОЛЬКО эти фрагменты.

Жёсткие правила:
1. Никаких сведений, которых нет во фрагментах. Числа, ставки, сроки, лимиты — только дословно из текста.
2. В ответе обязательно указывай статьи-источники в виде (Ст. 718) — сразу после утверждения, которое на них опирается.
3. Если во фрагментах НЕТ информации по теме вопроса — выведи ровно одно слово: ${NO_ANSWER_SENTINEL}. Но если информация есть, хоть и неполная, — ответь тем, что есть, и честно скажи, чего во фрагментах не хватает.
4. ${ANSWER_LANG_INSTRUCTION[lang]} Пиши просто и коротко (3–6 предложений), на «ты». Без markdown, без списков со звёздочками — обычный текст.
5. Суммы в МРП поясняй только если пересчёт есть в самих фрагментах — сам не пересчитывай.

ФРАГМЕНТЫ КОДЕКСА:
${fragments}

ВОПРОС: ${query}

ОТВЕТ:`;
}

/**
 * Ответ обязан ссылаться хотя бы на одну статью из переданных фрагментов.
 * Принимаем обе формы: «Ст. 99» и «статье 99» (модель пишет по-разному).
 */
export function validateAnswer(text: string, hits: SearchHit[]): boolean {
  const allowed = new Set(hits.map((h) => h.chunk.article));
  const mentions = text.matchAll(/(?:ст\.?|стать[а-яё]+)\s*(\d+(?:-\d+)?)/gi);
  for (const m of mentions) {
    if (m[1] && allowed.has(m[1])) return true;
  }
  return false;
}

export async function generateAnswer(
  query: string,
  hits: SearchHit[],
  opts: AnswerOptions,
): Promise<AnswerOutcome> {
  const model = opts.model ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': opts.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(query, hits, opts.lang ?? 'ru') }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            // У gemini-2.5 «размышления» включены по умолчанию и съедают
            // бюджет maxOutputTokens — ответ обрезается на полуслове.
            // Для grounded-пересказа размышления не нужны: выключаем.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) return { kind: 'error', reason: `http_${res.status}` };

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) return { kind: 'error', reason: 'empty' };
    // Обрезанный на полуслове ответ хуже дословных фрагментов — бракуем.
    if (cand?.finishReason && cand.finishReason !== 'STOP') {
      return { kind: 'error', reason: `finish_${cand.finishReason}`, raw: text };
    }
    if (text.includes(NO_ANSWER_SENTINEL)) return { kind: 'no_answer' };
    if (!validateAnswer(text, hits)) return { kind: 'error', reason: 'no_citation', raw: text };

    return { kind: 'answered', text };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'fetch_failed';
    return { kind: 'error', reason };
  } finally {
    clearTimeout(timer);
  }
}
