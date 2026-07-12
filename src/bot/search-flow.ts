/**
 * Свободный вопрос → поиск по кодексу → дословные фрагменты с цитатами.
 *
 * Это «честная v0» ответов на вопросы: бот НЕ генерирует текст, а показывает,
 * что написано в самом кодексе, со ссылкой на статью. Галлюцинации исключены
 * по построению. Следующий этап (LLM поверх этих фрагментов) добавит
 * человеческий пересказ — но цитата и ссылка останутся обязательными.
 */
import type { Bot } from 'grammy';
import { SearchIndex, type SearchHit } from '../rag/search';
import { chunkUrl } from '../rag/chunks';
import { generateAnswer, type AnswerOptions } from '../rag/answer';
import { hybridSearch, type SqlExecutor } from '../rag/vector-search';
import { detectLang, SEARCH_REFUSAL, type Lang } from '../i18n/i18n';
import type { PrefsStore } from '../store/prefs';
import type { EventTracker } from '../telemetry/types';

/** Ниже этого балла считаем, что уверенного ответа в корпусе нет. */
const MIN_TOP_SCORE = 7;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function trimFragment(text: string, max = 350): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 200 ? lastSpace : max)}…`;
}

export function renderSearchReply(hits: SearchHit[]): string {
  const lines: string[] = ['🔎 <b>Вот что говорит НК РК-2026:</b>', ''];
  hits.forEach((h, i) => {
    const c = h.chunk;
    lines.push(`${i + 1}. <b>Ст. ${esc(c.article)}. ${esc(c.title)}</b>`);
    lines.push(`«${esc(trimFragment(c.text))}»`);
    lines.push(`<a href="${chunkUrl(c)}">Открыть статью на adilet.zan.kz</a>`);
    lines.push('');
  });
  lines.push(
    '<i>Это дословные фрагменты кодекса, найденные по твоему вопросу, — не готовый совет. ' +
      'Человеческий пересказ с цитатами — скоро. Подбор режима — /start.</i>',
  );
  return lines.join('\n');
}

export function renderRefusal(lang: Lang = 'ru'): string {
  return SEARCH_REFUSAL[lang];
}

/** Уникальные статьи из ранжированного списка, максимум n (для показа источников). */
function topByArticle(hits: SearchHit[], n: number): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.chunk.article)) continue;
    seen.add(h.chunk.article);
    out.push(h);
    if (out.length === n) break;
  }
  return out;
}

/** Человеческий ответ LLM + обязательные ссылки на статьи-источники. */
export function renderAnswer(text: string, hits: SearchHit[]): string {
  const lines: string[] = [esc(text), '', '<b>Источники (проверь сам):</b>'];
  for (const h of hits) {
    lines.push(`• <a href="${chunkUrl(h.chunk)}">Ст. ${esc(h.chunk.article)}. ${esc(h.chunk.title)}</a>`);
  }
  lines.push('');
  lines.push('<i>Ответ составлен по приведённым статьям НК РК-2026 и не является налоговой консультацией.</i>');
  return lines.join('\n');
}

export function registerSearch(
  bot: Bot,
  index: SearchIndex,
  telemetry?: EventTracker,
  llm?: AnswerOptions,
  retrieval?: { sql: SqlExecutor; apiKey: string },
  prefs?: PrefsStore,
): void {
  // Сам текст вопроса НЕ логируем (приватность) — только метрики качества.
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const query = ctx.message.text;
    const uid = ctx.from?.id;
    // Язык: сохранённый выбор (/til) важнее, иначе — по буквам вопроса.
    const lang: Lang =
      (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? detectLang(query);
    // 4 статьи-кандидата: LLM получает больше контекста (окно у моделей
    // огромное), а пользователю в источниках 4 ссылки ещё читабельны.
    const hits = index.search(query, 4);
    const confident = hits.length > 0 && hits[0]!.score >= MIN_TOP_SCORE;

    telemetry?.track(
      ctx.from?.id,
      'search',
      confident
        ? `hits=${hits.length};top=${hits[0]!.chunk.article};score=${hits[0]!.score.toFixed(1)}`
        : `refused;score=${hits[0]?.score.toFixed(1) ?? '0'}`,
    );

    if (!confident) {
      await ctx.reply(renderRefusal(lang), { link_preview_options: { is_disabled: true } });
      return;
    }

    // Ретривал для ответа: гибрид BM25+вектор, если подключён Neon; иначе BM25.
    // Топ-8 кусков без склейки по статьям (лимит и его последствия часто в
    // соседних пунктах одной статьи).
    let llmHits: SearchHit[];
    if (retrieval) {
      const fused = await hybridSearch(index, retrieval.sql, query, 8, {
        apiKey: retrieval.apiKey,
        pool: 12,
      });
      llmHits = fused.length > 0 ? fused : index.search(query, 8, { dedupeByArticle: false });
    } else {
      llmHits = index.search(query, 8, { dedupeByArticle: false });
    }
    const sourceHits = topByArticle(llmHits, 4);

    // С LLM — человеческий пересказ (grounded или откат к дословным
    // фрагментам); без LLM — сразу фрагменты.
    let reply = renderSearchReply(sourceHits);
    if (llm) {
      await ctx.replyWithChatAction('typing');
      const out = await generateAnswer(query, llmHits, { ...llm, lang });
      telemetry?.track(ctx.from?.id, 'answer', out.kind === 'error' ? `error:${out.reason}` : out.kind);
      if (out.kind === 'answered') reply = renderAnswer(out.text, sourceHits);
    }

    await ctx.reply(reply, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });
}
