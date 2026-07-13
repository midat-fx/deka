/**
 * Сборка корпуса НК РК-2026 из официального HTML (adilet.zan.kz).
 *
 * Вход:  data/raw/nk-2026.html — скачанный текст кодекса (K2500000214)
 * Выход: data/corpus/full.json     — все статьи (локально, в git не идёт)
 *        data/corpus/relevant.json — разделы, нужные ИП/самозанятым (идёт в git)
 *
 * Структура статьи: { article, title, section, chapter, anchor, paragraphs[] }
 * — это «карточки», из которых RAG потом будет цитировать до пункта.
 *
 * Примечания-сноски (<span class="note">: «в редакции Закона…») вырезаем —
 * это служебная мета-информация об изменениях, не текст нормы.
 */
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface Paragraph {
  idx: number;
  text: string;
}

export interface Article {
  article: string; // номер: «1», «88», иногда «88-1»
  title: string;
  section: string; // РАЗДЕЛ N. …
  chapter: string; // Глава N. …
  anchor: string; // id для ссылки adilet.zan.kz/rus/docs/K2500000214#anchor
  paragraphs: Paragraph[];
}

const SOURCE_URL = 'https://adilet.zan.kz/rus/docs/K2500000214';

/** Разделы, которые попадают в relevant.json (корпус v1 для ИП/самозанятых). */
const RELEVANT_SECTION_PATTERNS = [
  /СПЕЦИАЛЬНЫЕ\s+НАЛОГОВЫЕ\s+РЕЖИМЫ/i,
  /НАЛОГ\s+НА\s+ДОБАВЛЕННУЮ\s+СТОИМОСТЬ/i,
  /ИНДИВИДУАЛЬНЫЙ\s+ПОДОХОДНЫЙ\s+НАЛОГ/i,
  /СОЦИАЛЬНЫЙ\s+НАЛОГ/i,
  // Глава 7 «Налоговая регистрация» — здесь живёт порог постановки на учёт
  // по НДС (Ст. 99: «предельный порог оборота — 10 000-кратный МРП»)
  /НАЛОГОВАЯ\s+РЕГИСТРАЦИЯ/i,
  // Раздел 20 «Единый платёж» (Ст.820-825) — сколько ИП платит ЗА РАБОТНИКА:
  // ставка 24,8% с 2026 (Ст.822 п.2), объект — доход работника (Ст.821).
  /ЕДИНЫЙ\s+ПЛАТЕ[Ж]/i,
];

/**
 * Отдельные статьи из «нерелевантных» разделов, которые всё равно нужны ИП.
 * Ст.84 «Обеспечение исполнения…», Ст.85 «Пени» — из Раздела 2, отвечают на
 * частый вопрос «что будет за просрочку» (сегодня — отказ).
 */
const RELEVANT_ARTICLE_WHITELIST = new Set(['84', '85']);

function clean(text: string): string {
  return text
    .replace(/ /g, ' ') // nbsp → пробел
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCorpus(html: string): Article[] {
  const $ = cheerio.load(html);
  const articles: Article[] = [];

  let section = '';
  let chapter = '';
  let current: Article | null = null;

  // Идём по документу в исходном порядке: заголовки и абзацы.
  $('h3, p').each((_, el) => {
    const $el = $(el);

    if (el.tagName === 'h3') {
      const t = clean($el.text());
      if (/^РАЗДЕЛ\s+\d+/i.test(t)) {
        section = t;
        chapter = '';
      } else if (/^Глава\s+\d+/i.test(t)) {
        chapter = t;
      } else if (/^(ОБЩАЯ|ОСОБЕННАЯ)\s+ЧАСТЬ/i.test(t)) {
        section = t;
        chapter = '';
      }
      return;
    }

    // Сноски об изменениях выкидываем из текста абзаца.
    const $copy = $el.clone();
    $copy.find('span.note').remove();
    const text = clean($copy.text());
    if (!text) return;

    // Начало новой статьи: «Статья 12. Название» жирным.
    const m = text.match(/^Статья\s+(\d+(?:-\d+)?)\.\s*(.*)$/);
    const isBoldStart = $el.find('b').length > 0 && m;
    if (isBoldStart && m) {
      if (current) articles.push(current);
      const anchor = $el.find('a[name]').attr('name') ?? '';
      current = {
        article: m[1] ?? '',
        title: clean(m[2] ?? ''),
        section,
        chapter,
        anchor,
        paragraphs: [],
      };
      return;
    }

    if (current) {
      current.paragraphs.push({ idx: current.paragraphs.length + 1, text });
    }
  });
  if (current) articles.push(current);

  return articles;
}

export function filterRelevant(articles: Article[]): Article[] {
  return articles.filter(
    (a) =>
      RELEVANT_ARTICLE_WHITELIST.has(a.article) ||
      RELEVANT_SECTION_PATTERNS.some((re) => re.test(a.section) || re.test(a.chapter)),
  );
}

// --- запуск: npx tsx scripts/build-corpus.ts ---
const html = readFileSync('data/raw/nk-2026.html', 'utf-8');
const all = parseCorpus(html);
const relevant = filterRelevant(all);

mkdirSync('data/corpus', { recursive: true });
writeFileSync(
  'data/corpus/full.json',
  JSON.stringify({ source: SOURCE_URL, fetchedAt: '2026-07-12', articles: all }, null, 1),
);
writeFileSync(
  'data/corpus/relevant.json',
  JSON.stringify({ source: SOURCE_URL, fetchedAt: '2026-07-12', articles: relevant }, null, 1),
);

const totalParas = all.reduce((n, a) => n + a.paragraphs.length, 0);
const relParas = relevant.reduce((n, a) => n + a.paragraphs.length, 0);
const sections = new Set(all.map((a) => a.section));

console.log(`Всего статей:        ${all.length} (${totalParas} абзацев, ${sections.size} разделов)`);
console.log(`Релевантных статей:  ${relevant.length} (${relParas} абзацев)`);
console.log('\nРелевантные разделы/главы:');
for (const s of new Set(relevant.map((a) => `${a.section} :: ${a.chapter}`))) console.log('  ' + s);
console.log('\nПримеры статей из relevant.json:');
for (const a of relevant.slice(0, 5)) {
  console.log(`  Ст. ${a.article}. ${a.title} [абзацев: ${a.paragraphs.length}]`);
}
