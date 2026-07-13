/**
 * Свободный вопрос → поиск по кодексу → дословные фрагменты с цитатами.
 *
 * Это «честная v0» ответов на вопросы: бот НЕ генерирует текст, а показывает,
 * что написано в самом кодексе, со ссылкой на статью. Галлюцинации исключены
 * по построению. Следующий этап (LLM поверх этих фрагментов) добавит
 * человеческий пересказ — но цитата и ссылка останутся обязательными.
 */
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { SearchIndex, type SearchHit } from '../rag/search';
import { chunkUrl } from '../rag/chunks';
import { generateAnswer, type AnswerOptions } from '../rag/answer';
import { hybridSearchDetailed, type SqlExecutor } from '../rag/vector-search';
import {
  detectLang,
  SEARCH_REFUSAL,
  REFUSAL_EXAMPLES,
  WIZARD_BUTTON,
  KGD_BUTTON,
  SEARCH_UI,
  VERIFIED_BADGE,
  FACTCHECK_PROMPT,
  FACTCHECK_TITLE,
  FACTCHECK_NOCODE,
  FACTCHECK_DISCLAIMER,
  LANGS,
  artRef,
  type Lang,
} from '../i18n/i18n';
import { followupKeyboard } from './keyboard';
import type { PrefsStore } from '../store/prefs';
import { cacheKey, type AnswerCache } from '../store/answer-cache';
import type { EventTracker } from '../telemetry/types';

/** Ниже этого BM25-балла лексический поиск не уверен. */
const MIN_TOP_SCORE = 7;
/**
 * Порог «спасения» вектором: если BM25 пуст, но косинус ≥ порога — тема
 * в корпусе есть (например, казахский вопрос к русскому тексту). Грубая
 * калибровка; уточняем по телеметрии rescued/refused_after_hybrid.
 */
const MIN_VECTOR_COSINE = 0.58;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function trimFragment(text: string, max = 350): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 200 ? lastSpace : max)}…`;
}

export function renderSearchReply(hits: SearchHit[], lang: Lang = 'ru'): string {
  const lines: string[] = [SEARCH_UI.fragmentsHeader[lang], ''];
  hits.forEach((h, i) => {
    const c = h.chunk;
    lines.push(`${i + 1}. <b>${esc(artRef(c.article, lang))}. ${esc(c.title)}</b>`);
    lines.push(`«${esc(trimFragment(c.text))}»`);
    lines.push(`<a href="${chunkUrl(c)}">${SEARCH_UI.openArticle[lang]}</a>`);
    lines.push('');
  });
  lines.push(SEARCH_UI.fragmentsFooter[lang]);
  return lines.join('\n');
}

export function renderRefusal(lang: Lang = 'ru'): string {
  return SEARCH_REFUSAL[lang];
}

/** Кнопки под отказом: готовые вопросы (заведомо рабочие) + визард + КГД. */
export function refusalKeyboard(lang: Lang): InlineKeyboard {
  const kb = new InlineKeyboard();
  REFUSAL_EXAMPLES[lang].forEach((q, i) => {
    kb.text(`💬 ${q}`, `ask|${lang}|${i}`).row();
  });
  kb.text(WIZARD_BUTTON[lang], 'w|---|restart|go').row();
  kb.text(KGD_BUTTON[lang], 'noop|kgd');
  return kb;
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
export function renderAnswer(
  text: string,
  hits: SearchHit[],
  lang: Lang = 'ru',
  verifiedPct = false,
): string {
  const lines: string[] = [esc(text), ''];
  if (verifiedPct) lines.push(VERIFIED_BADGE[lang], '');
  lines.push(SEARCH_UI.sourcesHeader[lang]);
  for (const h of hits) {
    lines.push(`• <a href="${chunkUrl(h.chunk)}">${esc(artRef(h.chunk.article, lang))}. ${esc(h.chunk.title)}</a>`);
  }
  lines.push('');
  lines.push(SEARCH_UI.answerDisclaimer[lang]);
  return lines.join('\n');
}

/** Вердикт фактчекера: проверка чужого текста + обязательные ссылки на статьи. */
export function renderFactCheck(text: string, hits: SearchHit[], lang: Lang = 'ru'): string {
  const lines: string[] = [FACTCHECK_TITLE[lang], '', esc(text), '', SEARCH_UI.sourcesHeader[lang]];
  for (const h of hits) {
    lines.push(`• <a href="${chunkUrl(h.chunk)}">${esc(artRef(h.chunk.article, lang))}. ${esc(h.chunk.title)}</a>`);
  }
  lines.push('', FACTCHECK_DISCLAIMER[lang]);
  return lines.join('\n');
}

/** Тексты-приглашения фактчекера на всех языках — маркер для reply_to. */
const FACTCHECK_PROMPTS = new Set(LANGS.map((l) => FACTCHECK_PROMPT[l]));

/** Ответ свежий, если моложе 7 дней. */
const CACHE_FRESH_MS = 7 * 24 * 3600 * 1000;
/** Мягкий дневной лимит LLM-вопросов на пользователя. */
const LLM_DAILY_LIMIT = 15;

export function registerSearch(
  bot: Bot,
  index: SearchIndex,
  telemetry?: EventTracker,
  llm?: AnswerOptions,
  retrieval?: { sql: SqlExecutor; apiKey: string },
  prefs?: PrefsStore,
  cache?: AnswerCache,
): void {
  /** Общий путь ответа на вопрос — вызывается и текстом, и кнопкой-примером. */
  const answerQuestion = async (
    ctx: Context,
    query: string,
    uid: number | undefined,
    lang: Lang,
  ): Promise<void> => {
    // «Печатаю…» сразу: гибридный поиск + LLM занимают секунды.
    await ctx.replyWithChatAction('typing').catch(() => {});

    // 0) Кэш ответа ДО поиска — экономит и поиск, и квоту LLM.
    const qkey = cache && llm ? cacheKey(query, lang) : null;
    const cached = qkey ? await cache!.get(qkey) : null;
    if (cached && cached.ageMs < CACHE_FRESH_MS) {
      telemetry?.track(uid, 'answer', 'cache_hit');
      await ctx.reply(cached.reply, {
        parse_mode: 'HTML',
        reply_markup: followupKeyboard(lang),
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // 1) Лексический кандидат.
    const bm25 = index.search(query, 4);
    let confident = bm25.length > 0 && bm25[0]!.score >= MIN_TOP_SCORE;

    // 2) Гибрид (если подключён Neon): и контекст для LLM, и спасение отказа
    //    вектором — BM25 не видит перефразировок и казахских вопросов.
    let llmHits: SearchHit[] = [];
    let rescued = false;
    if (retrieval) {
      const detailed = await hybridSearchDetailed(index, retrieval.sql, query, 8, {
        apiKey: retrieval.apiKey,
        pool: 12,
      });
      llmHits = detailed.hits;
      if (!confident && detailed.topCosine !== null && detailed.topCosine >= MIN_VECTOR_COSINE) {
        confident = true;
        rescued = true;
      }
    }
    if (llmHits.length === 0) llmHits = index.search(query, 8, { dedupeByArticle: false });

    telemetry?.track(
      uid,
      'search',
      confident
        ? `${rescued ? 'rescued_by_vector' : 'ok'};top=${(llmHits[0] ?? bm25[0])?.chunk.article ?? '-'}`
        : `refused_after_hybrid;bm25=${bm25[0]?.score.toFixed(1) ?? '0'}`,
    );

    if (!confident) {
      await ctx.reply(renderRefusal(lang), {
        reply_markup: refusalKeyboard(lang),
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    const sourceHits = topByArticle(llmHits, 4);

    // С LLM — человеческий пересказ (grounded или откат к дословным
    // фрагментам); без LLM — сразу фрагменты. Таймаут 8с: мы внутри вебхука.
    let reply = renderSearchReply(sourceHits, lang);
    if (llm) {
      // Дневной лимит LLM на юзера: сверх — фрагменты (или протухший кэш).
      const overLimit =
        cache && uid !== undefined ? (await cache.hitsToday(uid)) >= LLM_DAILY_LIMIT : false;
      if (overLimit) {
        telemetry?.track(uid, 'answer', 'rate_limited');
        if (cached) reply = cached.reply; // протухший кэш лучше сырых фрагментов
      } else {
        const out = await generateAnswer(query, llmHits, {
          ...llm,
          lang,
          timeoutMs: llm.timeoutMs ?? 8_000,
        });
        telemetry?.track(uid, 'answer', out.kind === 'error' ? `error:${out.reason}` : out.kind);
        if (out.kind === 'answered') {
          reply = renderAnswer(out.text, sourceHits, lang, out.verifiedPct);
          if (qkey && cache) await cache.set(qkey, reply);
          if (cache && uid !== undefined) await cache.bumpToday(uid);
        } else if (cached && out.kind === 'error') {
          reply = cached.reply; // при 429/сбое отдаём протухший кэш вместо фрагментов
        }
      }
    }

    await ctx.reply(reply, {
      parse_mode: 'HTML',
      reply_markup: followupKeyboard(lang),
      link_preview_options: { is_disabled: true },
    });
  };

  /** Фактчекер: сверить вставленный ответ ИИ с текстом кодекса (grounded). */
  const factCheck = async (ctx: Context, pasted: string, uid: number | undefined, lang: Lang): Promise<void> => {
    await ctx.replyWithChatAction('typing').catch(() => {});
    // BM25 по вставленному тексту (бесплатно, без эмбеддинга длинного текста).
    const hits = index.search(pasted, 8, { dedupeByArticle: false });
    const confident = hits.length > 0 && hits[0]!.score >= MIN_TOP_SCORE;
    if (!confident || !llm) {
      telemetry?.track(uid, 'answer', 'factcheck_nocode');
      await ctx.reply(FACTCHECK_NOCODE[lang], {
        reply_markup: refusalKeyboard(lang),
        link_preview_options: { is_disabled: true },
      });
      return;
    }
    const sourceHits = topByArticle(hits, 5);
    const out = await generateAnswer(pasted, hits, {
      ...llm,
      lang,
      mode: 'factcheck',
      timeoutMs: llm.timeoutMs ?? 9_000,
    });
    telemetry?.track(uid, 'answer', out.kind === 'answered' ? 'factcheck_ok' : `factcheck_${out.kind}`);
    if (out.kind === 'answered') {
      await ctx.reply(renderFactCheck(out.text, sourceHits, lang), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } else {
      // NO_ANSWER / ошибка / 429 → честно не беремся судить.
      await ctx.reply(FACTCHECK_NOCODE[lang], {
        reply_markup: refusalKeyboard(lang),
        link_preview_options: { is_disabled: true },
      });
    }
  };

  // Команда фактчекера: просим вставить ответ ИИ ответом на это сообщение.
  bot.command('proverit', async (ctx) => {
    const lang: Lang =
      (prefs && ctx.from?.id !== undefined ? await prefs.getLang(ctx.from.id) : undefined) ?? 'ru';
    telemetry?.track(ctx.from?.id, 'intent', 'factcheck');
    await ctx.reply(FACTCHECK_PROMPT[lang], { reply_markup: { force_reply: true } });
  });

  // Сам текст вопроса НЕ логируем (приватность) — только метрики качества.
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const uid = ctx.from?.id;
    const lang: Lang =
      (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? detectLang(ctx.message.text);
    // Ответ на приглашение фактчекера → это вставленный текст ИИ, не вопрос.
    const replyTo = ctx.message.reply_to_message?.text;
    if (replyTo && FACTCHECK_PROMPTS.has(replyTo)) {
      await factCheck(ctx, ctx.message.text, uid, lang);
      return;
    }
    await answerQuestion(ctx, ctx.message.text, uid, lang);
  });

  // Кнопка-пример под отказом: прогоняем готовый вопрос через тот же путь.
  bot.callbackQuery(/^ask\|/, async (ctx) => {
    const parts = (ctx.callbackQuery.data ?? '').split('|');
    const lang = (parts[1] ?? 'ru') as Lang;
    const idx = Number(parts[2] ?? '0');
    const q = REFUSAL_EXAMPLES[lang]?.[idx];
    await ctx.answerCallbackQuery();
    if (!q) return;
    telemetry?.track(ctx.from?.id, 'intent', 'refusal_example');
    await answerQuestion(ctx, q, ctx.from?.id, lang);
  });

  bot.callbackQuery(/^noop\|/, (ctx) => ctx.answerCallbackQuery());
}
