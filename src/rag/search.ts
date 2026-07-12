/**
 * Лексический поиск по кодексу: BM25 поверх чанков.
 *
 * Почему BM25, а не сразу эмбеддинги: (1) работает без API-ключей и сети,
 * (2) детерминирован и дёшев, (3) это измеримый бейзлайн — когда добавим
 * векторный поиск, eval покажет, насколько он реально лучше. Классическая
 * связка для RAG — гибрид BM25 + вектора; BM25-половина готова уже сейчас.
 */
import { stemRu } from './stemmer';
import type { Chunk } from './chunks';

/** Частые слова, которые ничего не различают (включая «юридический шум»). */
const STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'на', 'с', 'со', 'по', 'о', 'об', 'от', 'до', 'за',
  'из', 'у', 'к', 'ко', 'для', 'при', 'или', 'а', 'но', 'же', 'ли', 'бы',
  'что', 'как', 'это', 'этот', 'эта', 'то', 'тот', 'так', 'также', 'их',
  'его', 'ее', 'ей', 'им', 'них', 'том', 'чем', 'где', 'когда', 'если',
  'может', 'могут', 'быть', 'есть', 'нужно', 'надо', 'какой', 'какая',
  'какие', 'сколько', 'мне', 'мой', 'моя', 'я', 'ты', 'вы', 'мы', 'кто',
  'кем', 'ком', 'чей', 'ли',
  // юридический шум — встречается почти в каждой статье и топит релевантность:
  'настоящий', 'настоящего', 'кодекс', 'кодекса', 'кодексом', 'статья',
  'статьи', 'статьей', 'пункт', 'пункта', 'пунктом', 'подпункт', 'подпункта',
  'случай', 'случае', 'случаях', 'соответствие', 'соответствии', 'порядок',
  'порядке', 'указанный', 'указанных', 'предусмотренный', 'предусмотренных',
]);

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    const t = stemRu(w);
    if (t.length >= 2 && !STOPWORDS.has(t)) out.push(t);
  }
  return out;
}

/**
 * Расширение ЗАПРОСА (не документов): люди пишут «НДС» и «упрощёнка»,
 * кодекс — «налог на добавленную стоимость» и «упрощенная декларация».
 * Ключи и значения — уже в стеммированном виде.
 */
/** Синоним → вес: насколько «полноценной» заменой слова пользователя он является. */
const QUERY_EXPANSIONS: Record<string, [string, number][]> = {
  // аббревиатуры: в кодексе почти всегда развёрнуты — замена почти полная
  ндс: [['добавлен', 0.7], ['стоимост', 0.7]],
  ипн: [['индивидуальн', 0.5], ['подоходн', 0.6]],
  ип: [['индивидуальн', 0.6], ['предпринимател', 0.9]],
  закр: [['прекращен', 0.7], ['снят', 0.6]], // «закрыть ИП» → «прекращение деятельности»
  закрыт: [['прекращен', 0.7], ['снят', 0.6]],
  упрощенк: [['упрощен', 0.9], ['декларац', 0.6]],
  // разговорное → термин кодекса
  лимит: [['предельн', 0.7], ['превыша', 0.5]],
  порог: [['предельн', 0.7]],
  встава: [['постановк', 0.8]], // «вставать на учёт» → «постановка на учёт»
  встат: [['постановк', 0.8]],
  зарплат: [['оплат', 0.5], ['труд', 0.5]],
  сотрудник: [['работник', 0.9]],
  плат: [['плательщик', 0.9], ['уплат', 0.4]], // «кто платит» → «плательщики»
  оплачива: [['уплат', 0.6], ['плательщик', 0.6]],
  облага: [['объект', 0.8], ['налогообложен', 0.8]], // «что облагается» → «объект налогообложения»
  облагаем: [['объект', 0.8], ['налогообложен', 0.8]],
};

export interface WeightedToken {
  token: string;
  weight: number;
}

/**
 * Слова пользователя — вес 1, синонимы — их собственный вес (<1): расширение
 * помогает находить, но не перекрикивает точные совпадения.
 */
export function expandQueryTokens(tokens: string[]): WeightedToken[] {
  const weights = new Map<string, number>();
  for (const t of tokens) weights.set(t, 1);
  for (const t of tokens) {
    for (const [extra, w] of QUERY_EXPANSIONS[t] ?? []) {
      if ((weights.get(extra) ?? 0) < w) weights.set(extra, w);
    }
  }
  return [...weights].map(([token, weight]) => ({ token, weight }));
}

export interface SearchHit {
  chunk: Chunk;
  score: number;
}

const K1 = 1.5;
const B = 0.75;

export class SearchIndex {
  private chunks: Chunk[];
  private docTokens: string[][];
  private titleTokens: Set<string>[];
  private contextTokens: Set<string>[];
  private docLen: number[];
  private avgLen: number;
  private df = new Map<string, number>();

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    // Название статьи добавляем в индексируемый текст: запрос «ставки ИПН»
    // должен находить статью «Ставки налога» даже без слова в теле.
    this.docTokens = chunks.map((c) => tokenize(`${c.title}. ${c.text}`));
    // Токены заголовка держим отдельно: совпадение с названием статьи —
    // сильный сигнал («Ставки налога…» и есть ответ на «какая ставка»).
    this.titleTokens = chunks.map((c) => new Set(tokenize(c.title)));
    // Токены главы/раздела: запрос «…у самозанятого» должен подтягивать
    // ВСЮ главу 77 «СНР для самозанятых» — так ориентируется юрист.
    this.contextTokens = chunks.map((c) => new Set(tokenize(`${c.section} ${c.chapter}`)));
    this.docLen = this.docTokens.map((t) => t.length);
    this.avgLen = this.docLen.reduce((a, b) => a + b, 0) / Math.max(1, this.docLen.length);
    for (const tokens of this.docTokens) {
      for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
  }

  get size(): number {
    return this.chunks.length;
  }

  /**
   * Топ-k результатов, максимум один чанк на статью: пользователю нужны
   * РАЗНЫЕ статьи-кандидаты, а не три куска одной и той же.
   */
  search(query: string, k = 5): SearchHit[] {
    const qTokens = expandQueryTokens([...new Set(tokenize(query))]);
    if (qTokens.length === 0) return [];

    const N = this.chunks.length;
    const scores = new Array<number>(N).fill(0);

    for (const { token: q, weight } of qTokens) {
      const df = this.df.get(q);
      if (!df) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let i = 0; i < N; i++) {
        let tf = 0;
        for (const t of this.docTokens[i]!) if (t === q) tf++;
        const inContext = this.contextTokens[i]!.has(q);
        if (tf === 0 && !inContext) continue;
        let s = 0;
        if (tf > 0) {
          const denom = tf + K1 * (1 - B + (B * this.docLen[i]!) / this.avgLen);
          s = idf * ((tf * (K1 + 1)) / denom);
          // Буст за совпадение с названием статьи (см. конструктор).
          if (this.titleTokens[i]!.has(q)) s += idf * 0.8;
        }
        // Буст за совпадение с названием главы/раздела.
        if (inContext) s += idf * 0.5;
        scores[i] = (scores[i] ?? 0) + s * weight;
      }
    }

    const ranked = scores
      .map((score, i) => ({ chunk: this.chunks[i]!, score }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const out: SearchHit[] = [];
    for (const h of ranked) {
      if (seen.has(h.chunk.article)) continue;
      seen.add(h.chunk.article);
      out.push(h);
      if (out.length === k) break;
    }
    return out;
  }
}
