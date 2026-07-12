/**
 * Чанкинг корпуса: статьи кодекса → «карточки» для поиска.
 *
 * Абзацы кодекса бывают по 5 слов («1) …подпункт»), поэтому склеиваем
 * соседние абзацы одной статьи до ~800 символов. У каждого чанка — метаданные
 * для цитирования: номер статьи, название, глава и якорь на adilet.zan.kz.
 */
import { readFileSync } from 'node:fs';

export interface CorpusArticle {
  article: string;
  title: string;
  section: string;
  chapter: string;
  anchor: string;
  paragraphs: { idx: number; text: string }[];
}

export interface Chunk {
  id: string; // "718#1" — статья + номер чанка внутри статьи
  article: string;
  title: string;
  section: string;
  chapter: string;
  anchor: string;
  paraFrom: number;
  paraTo: number;
  text: string;
}

export const ADILET_URL = 'https://adilet.zan.kz/rus/docs/K2500000214';

const MAX_CHUNK_CHARS = 800;

export function buildChunks(articles: CorpusArticle[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const a of articles) {
    let buf: string[] = [];
    let from = 1;
    let n = 0;
    const flush = (to: number) => {
      if (buf.length === 0) return;
      n += 1;
      chunks.push({
        id: `${a.article}#${n}`,
        article: a.article,
        title: a.title,
        section: a.section,
        chapter: a.chapter,
        anchor: a.anchor,
        paraFrom: from,
        paraTo: to,
        text: buf.join(' '),
      });
      buf = [];
    };
    for (const p of a.paragraphs) {
      if (buf.length > 0 && buf.join(' ').length + p.text.length > MAX_CHUNK_CHARS) {
        flush(p.idx - 1);
        from = p.idx;
      }
      buf.push(p.text);
    }
    flush(a.paragraphs.length);
  }
  return chunks;
}

/** Загрузить relevant.json и превратить в чанки. */
export function loadChunks(path = 'data/corpus/relevant.json'): Chunk[] {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as { articles: CorpusArticle[] };
  return buildChunks(raw.articles);
}

/** Ссылка на статью в официальном тексте. */
export function chunkUrl(c: Chunk): string {
  return c.anchor ? `${ADILET_URL}#${c.anchor}` : ADILET_URL;
}
