import { describe, it, expect } from 'vitest';
import { buildPrompt, validateAnswer } from '../src/rag/answer';
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
