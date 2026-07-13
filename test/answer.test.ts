import { describe, it, expect } from 'vitest';
import { buildPrompt, buildFactCheckPrompt, validateAnswer, unverifiedPercents } from '../src/rag/answer';
import type { SearchHit } from '../src/rag/search';

const hits: SearchHit[] = [
  {
    score: 10,
    chunk: {
      id: '718#1',
      article: '718',
      title: 'Общие положения',
      section: 'РАЗДЕЛ 16',
      chapter: 'Глава 77',
      anchor: 'z11814',
      paraFrom: 1,
      paraTo: 3,
      text: 'Специальный налоговый режим для самозанятых вправе применять самозанятые…',
    },
  },
  {
    score: 8,
    chunk: {
      id: '720#1',
      article: '720',
      title: 'Порядок исчисления',
      section: 'РАЗДЕЛ 16',
      chapter: 'Глава 77',
      anchor: 'z11830',
      paraFrom: 1,
      paraTo: 2,
      text: 'Исчисление суммы индивидуального подоходного налога…',
    },
  },
];

describe('промпт LLM', () => {
  it('содержит фрагменты, вопрос и правило NO_ANSWER', () => {
    const p = buildPrompt('какой лимит?', hits);
    expect(p).toContain('Ст. 718. Общие положения');
    expect(p).toContain('какой лимит?');
    expect(p).toContain('NO_ANSWER');
    expect(p).toContain('ТОЛЬКО эти фрагменты');
  });
});

describe('промпт фактчекера', () => {
  it('содержит проверяемый текст, фрагменты, правила вердикта и NO_ANSWER', () => {
    const p = buildFactCheckPrompt('ChatGPT сказал: НДС в Казахстане 12%.', hits);
    expect(p).toContain('НДС в Казахстане 12%');
    expect(p).toContain('Ст. 718. Общие положения');
    expect(p).toContain('✅ подтверждается');
    expect(p).toContain('❌ неверно');
    expect(p).toContain('NO_ANSWER');
  });
});

describe('валидация ответа (grounded или брак)', () => {
  it('принимает ответ со ссылкой на статью из фрагментов', () => {
    expect(validateAnswer('Лимит — 300 МРП в месяц (Ст. 718).', hits)).toBe(true);
    expect(validateAnswer('См. ст 720 кодекса.', hits)).toBe(true);
  });

  it('бракует ответ без цитаты', () => {
    expect(validateAnswer('Лимит примерно миллион тенге в месяц.', hits)).toBe(false);
  });

  it('бракует ответ с цитатой на ЧУЖУЮ статью (не из фрагментов)', () => {
    expect(validateAnswer('Это регулирует Ст. 999.', hits)).toBe(false);
  });

  it('принимает казахскую («718-бап») и английскую («Art. 718») формы', () => {
    expect(validateAnswer('Шек 718-бапта белгіленген.', hits)).toBe(true);
    expect(validateAnswer('The limit is set by Art. 718 of the code.', hits)).toBe(true);
    expect(validateAnswer('See Article 720 for details.', hits)).toBe(true);
  });
});

describe('F1 — сверка ставок с текстом (unverifiedPercents)', () => {
  const vatHits: SearchHit[] = [
    {
      score: 10,
      chunk: {
        id: '503#1',
        article: '503',
        title: 'Ставки НДС',
        section: 'РАЗДЕЛ 7',
        chapter: 'Глава 51',
        anchor: 'z8609',
        paraFrom: 1,
        paraTo: 3,
        text: 'ставка налога на добавленную стоимость составляет 16 процентов … с 1 января 2026 года – 5 процентов … 10 процентов … не более чем на 4 процента',
      },
    },
  ];

  it('верная ставка «16%» подтверждается (16 процентов есть в тексте)', () => {
    expect(unverifiedPercents('Ставка НДС — 16% (Ст. 503).', vatHits)).toEqual([]);
  });
  it('галлюцинация «12%» НЕ подтверждается (в тексте только 16/5/10)', () => {
    expect(unverifiedPercents('Ставка НДС — 12%.', vatHits)).toEqual(['12']);
  });
  it('«%» и «процентов» нормализуются одинаково; запятая тоже', () => {
    expect(unverifiedPercents('4% от оборота', vatHits)).toEqual([]);
    expect(unverifiedPercents('4 процента от оборота', vatHits)).toEqual([]);
    expect(unverifiedPercents('ставка 24,8%', vatHits)).toEqual(['24.8']); // нет в тексте → флаг
  });
  it('ответ без процентов — нечего проверять', () => {
    expect(unverifiedPercents('Лимит 300 МРП в месяц.', vatHits)).toEqual([]);
  });

  // Регрессии из сквозной верификации
  it('хвостовой ноль: «7%» ≡ «7,0 процента» в тексте — НЕ ложный отказ', () => {
    const h822: SearchHit[] = [{ score: 9, chunk: { id: '822#1', article: '822', title: 't', section: '', chapter: '', anchor: '', paraFrom: 1, paraTo: 1, text: 'доля составляет 7,0 процента и 24,8 процента' } }];
    expect(unverifiedPercents('Доля ИПН 7% (Ст.822).', h822)).toEqual([]);
  });
  it('казахское «пайыз» извлекается и сверяется', () => {
    expect(unverifiedPercents('ҚҚС 16 пайыз (Ст.503).', vatHits)).toEqual([]);
    expect(unverifiedPercents('ҚҚС 12 пайыз (Ст.503).', vatHits)).toEqual(['12']);
  });
  it('сверка только по ЦИТИРУЕМОЙ статье, не по всем хитам', () => {
    const h822: SearchHit[] = [{ score: 8, chunk: { id: '822#1', article: '822', title: 't', section: '', chapter: '', anchor: '', paraFrom: 1, paraTo: 1, text: 'доля 24,8 процента' } }];
    // 24,8% есть в 822, но ответ цитирует ТОЛЬКО 503 → 24,8 не подтверждается
    expect(unverifiedPercents('Ставка НДС 24,8% (Ст.503).', [...vatHits, ...h822])).toEqual(['24.8']);
  });
});
