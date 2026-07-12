import { describe, it, expect } from 'vitest';
import { stemRu } from '../src/rag/stemmer';
import { tokenize, expandQueryTokens, SearchIndex } from '../src/rag/search';
import { buildChunks, loadChunks, chunkUrl, type CorpusArticle } from '../src/rag/chunks';

describe('стеммер русского', () => {
  it('словоформы сводятся к одной основе', () => {
    expect(stemRu('самозанятого')).toBe(stemRu('самозанятым'));
    expect(stemRu('налога')).toBe(stemRu('налогов'));
    expect(stemRu('декларации')).toBe(stemRu('деклараций'));
    expect(stemRu('оборота')).toBe(stemRu('обороты'));
    expect(stemRu('работников')).toBe(stemRu('работника'));
  });

  it('не трогает аббревиатуры и латиницу', () => {
    expect(stemRu('ндс')).toBe('ндс');
    expect(stemRu('api')).toBe('api');
  });
});

describe('токенизация и расширение запроса', () => {
  it('режет стоп-слова и юридический шум', () => {
    const t = tokenize('как мне нужно платить налог в соответствии с настоящим кодексом');
    expect(t).not.toContain('как');
    expect(t).not.toContain('кодекс');
    expect(t).toContain('налог');
  });

  it('НДС расширяется до «добавленной стоимости» с весом < 1', () => {
    const tokens = expandQueryTokens(tokenize('ставка НДС'));
    const nds = tokens.find((t) => t.token === 'ндс');
    const dob = tokens.find((t) => t.token === 'добавлен');
    expect(nds?.weight).toBe(1);
    expect(dob?.weight).toBeLessThan(1);
  });
});

describe('чанкинг', () => {
  const article: CorpusArticle = {
    article: '1',
    title: 'Тест',
    section: 'РАЗДЕЛ 1',
    chapter: 'Глава 1',
    anchor: 'z1',
    paragraphs: Array.from({ length: 10 }, (_, i) => ({
      idx: i + 1,
      text: 'абзац '.repeat(30) + i, // ~180 символов каждый
    })),
  };

  it('склеивает абзацы до лимита и сохраняет диапазоны', () => {
    const chunks = buildChunks([article]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.paraFrom).toBe(1);
    expect(chunks.at(-1)?.paraTo).toBe(10);
    // диапазоны непрерывны
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]?.paraFrom).toBe(chunks[i - 1]!.paraTo + 1);
    }
  });

  it('ссылка ведёт на якорь статьи', () => {
    const chunks = buildChunks([article]);
    expect(chunkUrl(chunks[0]!)).toContain('#z1');
  });
});

describe('поиск по реальному корпусу (relevant.json)', () => {
  const index = new SearchIndex(loadChunks());

  it('индекс не пустой', () => {
    expect(index.size).toBeGreaterThan(500);
  });

  it('вопрос про лимит самозанятого находит главу 77', () => {
    const hits = index.search('какой лимит дохода у самозанятого', 3);
    expect(hits.map((h) => h.chunk.article)).toContain('718');
  });

  it('вопрос про НДС-учёт находит Ст. 99', () => {
    const hits = index.search('когда нужно вставать на учёт по НДС', 3);
    expect(hits.map((h) => h.chunk.article)).toContain('99');
  });

  it('результаты дедуплицированы по статьям', () => {
    const hits = index.search('самозанятый интернет-платформа', 5);
    const arts = hits.map((h) => h.chunk.article);
    expect(new Set(arts).size).toBe(arts.length);
  });

  it('мусорный запрос набирает низкий балл или ничего', () => {
    const hits = index.search('посоветуй фильм на вечер', 3);
    expect(hits.length === 0 || hits[0]!.score < 7).toBe(true);
  });
});
