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
  /**
   * 'answer' (по умолчанию) — пересказ фрагментов на вопрос.
   * 'factcheck' — сверка ЧУЖОГО текста (ответа ChatGPT) с кодексом: вердикт
   * упоминает и неверные числа (чтобы их опровергнуть), поэтому per-claim
   * сверка процентов (F1) для этого режима НЕ применяется.
   */
  mode?: 'answer' | 'factcheck';
}

export type AnswerOutcome =
  | { kind: 'answered'; text: string; verifiedPct: boolean }
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

/** Промпт для режима фактчекинга: проверить чужой текст по фрагментам кодекса. */
export function buildFactCheckPrompt(pastedText: string, hits: SearchHit[], lang: Lang = 'ru'): string {
  const fragments = hits
    .map((h, i) => {
      const c = h.chunk;
      const text = c.text.length > 2500 ? `${c.text.slice(0, 2500)}…` : c.text;
      return `[${i + 1}] Ст. ${c.article}. ${c.title}\n${text}`;
    })
    .join('\n\n');

  return `Ты — проверяющий по Налоговому кодексу Республики Казахстан 2026 года. Ниже — ТЕКСТ (ответ другого ИИ или пересказ), который надо проверить, и фрагменты официального кодекса.

Для каждого проверяемого утверждения из ТЕКСТА (ставки, лимиты, сроки, номера статей) вынеси вердикт СТРОГО по фрагментам, по одному в строке:
• ✅ подтверждается — <коротко> (Ст. N)
• ❌ неверно — в кодексе <как на самом деле> (Ст. N)
• ⚠️ не могу проверить — этой темы нет в моих фрагментах

Жёсткие правила:
1. Опирайся ТОЛЬКО на фрагменты. Не знаешь — ставь ⚠️, не угадывай и не подтверждай по памяти.
2. Каждый ✅ и ❌ обязан ссылаться на статью (Ст. N) из фрагментов.
3. В конце — одна строка «Итог:» — можно ли доверять тексту.
4. Если во фрагментах вообще НЕТ ничего по теме текста — выведи ровно одно слово: ${NO_ANSWER_SENTINEL}.
5. ${ANSWER_LANG_INSTRUCTION[lang]} Обычный текст, без markdown-звёздочек.

ФРАГМЕНТЫ КОДЕКСА:
${fragments}

ПРОВЕРЯЕМЫЙ ТЕКСТ:
${pastedText.length > 3000 ? pastedText.slice(0, 3000) + '…' : pastedText}

ВЕРДИКТ:`;
}

/**
 * Ответ обязан ссылаться хотя бы на одну статью из переданных фрагментов.
 * Формы цитат по языкам: «Ст. 99 / статье 99» (ru), «99-бап» (kk),
 * «Art. 99 / Article 99» (en) — иначе казахские/английские ответы браковались
 * бы валидатором и юзер получал сырые фрагменты.
 */
const CITE_PATTERNS = [
  /(?:ст\.?|стать[а-яё]+)\s*(\d+(?:-\d+)?)/gi, // Ст. 99, статье 99
  /(\d+(?:-\d+)?)\s*-\s*бап/gi, // 99-бап
  /(?:art\.?|article)\s*(\d+(?:-\d+)?)/gi, // Art. 99, Article 99
];

export function validateAnswer(text: string, hits: SearchHit[]): boolean {
  const allowed = new Set(hits.map((h) => h.chunk.article));
  for (const re of CITE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (m[1] && allowed.has(m[1])) return true;
    }
  }
  return false;
}

/**
 * Число перед «%»/«процент»/«пайыз» → КАНОНИЧЕСКОЕ числовое значение как строка
 * («24,8%»→«24.8», «7,0 процента»→«7», «16 пайыз»→«16»). parseFloat убирает
 * хвостовой ноль, поэтому «7%» ≡ «7,0 процента» (иначе корректный ответ бракуется).
 */
function extractPercents(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|процент|пайыз|percent)/gi)) {
    const n = parseFloat(m[1]!.replace(',', '.'));
    if (!Number.isNaN(n)) out.push(String(n));
  }
  return out;
}

/** Номера статей, на которые ССЫЛАЕТСЯ ответ (по формам цитат ru/kk/en). */
function citedArticles(text: string): Set<string> {
  const out = new Set<string>();
  for (const re of CITE_PATTERNS) for (const m of text.matchAll(re)) if (m[1]) out.add(m[1]);
  return out;
}

/**
 * F1 — сверка ставок: КАЖДЫЙ процент в ответе обязан дословно присутствовать в
 * тексте статей, НА КОТОРЫЕ ССЫЛАЕТСЯ ответ (а не во всех 8 хитах — иначе
 * проценты соседних статей «легализуют» чужую ставку). Ловит подмену ставки
 * (модель сказала «НДС 12%», а в кодексе 16%). Проверяем по ПОЛНОМУ тексту чанка.
 * Остаточное ограничение: если одна статья перечисляет несколько ставок (Ст.503:
 * 16/5/10), подмену на льготную в рамках ЭТОЙ статьи не поймать без семантики.
 */
export function unverifiedPercents(text: string, hits: SearchHit[]): string[] {
  const cited = citedArticles(text);
  const scope = hits.filter((h) => cited.has(h.chunk.article));
  const base = scope.length > 0 ? scope : hits;
  const inCode = new Set(base.flatMap((h) => extractPercents(h.chunk.text)));
  return extractPercents(text).filter((p) => !inCode.has(p));
}

export async function generateAnswer(
  query: string,
  hits: SearchHit[],
  opts: AnswerOptions,
): Promise<AnswerOutcome> {
  const model = opts.model ?? DEFAULT_MODEL;
  const factcheck = opts.mode === 'factcheck';
  const prompt = factcheck
    ? buildFactCheckPrompt(query, hits, opts.lang ?? 'ru')
    : buildPrompt(query, hits, opts.lang ?? 'ru');
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
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
    // F1: ставка в ответе, которой нет в тексте статей → подмена, бракуем.
    // В режиме фактчека НЕ применяем — там вердикт нарочно называет неверные
    // числа, чтобы их опровергнуть.
    if (!factcheck) {
      const badPct = unverifiedPercents(text, hits);
      if (badPct.length > 0) {
        return { kind: 'error', reason: `unverified_pct:${badPct.join(',')}`, raw: text };
      }
    }

    // verifiedPct=true, если в ответе была хотя бы одна (сверенная) ставка —
    // для бейджа «✅ ставки сверены с кодексом» (только для обычных ответов).
    return { kind: 'answered', text, verifiedPct: !factcheck && extractPercents(text).length > 0 };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'fetch_failed';
    return { kind: 'error', reason };
  } finally {
    clearTimeout(timer);
  }
}
