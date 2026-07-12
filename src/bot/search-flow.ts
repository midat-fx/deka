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
import type { Telemetry } from '../telemetry/events';

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

export function renderRefusal(): string {
  return (
    '🤷 В моих разделах кодекса (ИП, самозанятые, НДС, ИПН, соцналог) уверенного ответа не нашлось.\n\n' +
    'Попробуй переформулировать — например: «лимит дохода самозанятого», «когда вставать на учёт по НДС».\n\n' +
    'Или уточни в КГД: 1414 (бесплатно). Подбор налогового режима — /start.'
  );
}

export function registerSearch(bot: Bot, index: SearchIndex, telemetry?: Telemetry): void {
  // Сам текст вопроса НЕ логируем (приватность) — только метрики качества.
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const query = ctx.message.text;
    const hits = index.search(query, 3);
    const confident = hits.length > 0 && hits[0]!.score >= MIN_TOP_SCORE;

    telemetry?.track(
      ctx.from?.id,
      'search',
      confident
        ? `hits=${hits.length};top=${hits[0]!.chunk.article};score=${hits[0]!.score.toFixed(1)}`
        : `refused;score=${hits[0]?.score.toFixed(1) ?? '0'}`,
    );

    await ctx.reply(confident ? renderSearchReply(hits) : renderRefusal(), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });
}
