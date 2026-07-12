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
/**
 * Синоним → вес: насколько «полноценной» заменой слова пользователя он
 * является. ВАЖНО: и ключи, и значения — в УЖЕ СТЕММИРОВАННОМ виде
 * («лимит» стеммер режет до «лим» — ключ должен быть «лим», иначе
 * расширение молча не сработает; проверяй через tokenize()).
 */
const QUERY_EXPANSIONS: Record<string, [string, number][]> = {
  // аббревиатуры: в кодексе почти всегда развёрнуты — замена почти полная
  ндс: [['добавлен', 0.7], ['стоимост', 0.7]],
  ипн: [['индивидуальн', 0.5], ['подоходн', 0.6]],
  ип: [['индивидуальн', 0.6], ['предпринимател', 0.9]],
  закр: [['прекращен', 0.7], ['снят', 0.6]], // «закрыть ИП» → «прекращение деятельности»
  закрыт: [['прекращен', 0.7], ['снят', 0.6]],
  упрощенк: [['упрощен', 0.9], ['декларац', 0.6]],
  // разговорное → термин кодекса
  лим: [['предельн', 0.7], ['превыша', 0.5]], // лимит/лимита → «предельный размер»
  превыс: [['превыша', 0.8], ['предельн', 0.5]], // превысить vs «превышает» — разные стемы
  месяц: [['месячн', 0.6]], // «в месяц» vs «месячного расчетного показателя»
  порог: [['предельн', 0.7]],
  // «вставать на учёт» → «(обязательная) постановка на регистрационный учет»
  встава: [['постановк', 0.8], ['обязательн', 0.4]],
  встат: [['постановк', 0.8], ['обязательн', 0.4]],
  учет: [['регистрацион', 0.5]],
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

/**
 * Сериализованный индекс: предвычисляется скриптом build-index и
 * бандлится в Cloudflare Worker (там нет файловой системы, а CPU-время
 * дорого — токенизировать 998 чанков на каждом старте нельзя).
 * Постинги хранятся плоско: [doc, tf, doc, tf, …] — компактнее в JSON.
 */
export interface SerializedIndex {
  v: 1;
  chunks: Chunk[];
  docLen: number[];
  avgLen: number;
  postings: Record<string, number[]>; // token → [docIdx, tf, docIdx, tf, …]
  titles: Record<string, number[]>; // token → [docIdx, …]
  contexts: Record<string, number[]>; // token → [docIdx, …]
}

export class SearchIndex {
  private chunks: Chunk[];
  private docLen: number[];
  private avgLen: number;
  /** Инвертированный индекс: токен → список (документ, частота). */
  private postings: Map<string, number[]>;
  private titles: Map<string, Set<number>>;
  private contexts: Map<string, Set<number>>;

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    this.postings = new Map();
    this.titles = new Map();
    this.contexts = new Map();

    // Название статьи добавляем в индексируемый текст: запрос «ставки ИПН»
    // должен находить статью «Ставки налога» даже без слова в теле.
    const docTokens = chunks.map((c) => tokenize(`${c.title}. ${c.text}`));
    this.docLen = docTokens.map((t) => t.length);
    this.avgLen = this.docLen.reduce((a, b) => a + b, 0) / Math.max(1, this.docLen.length);

    docTokens.forEach((tokens, i) => {
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, f] of tf) {
        let list = this.postings.get(t);
        if (!list) this.postings.set(t, (list = []));
        list.push(i, f);
      }
    });

    // Токены заголовка — отдельно: совпадение с названием статьи — сильный
    // сигнал («Ставки налога…» и есть ответ на «какая ставка»).
    chunks.forEach((c, i) => {
      for (const t of new Set(tokenize(c.title))) {
        let set = this.titles.get(t);
        if (!set) this.titles.set(t, (set = new Set()));
        set.add(i);
      }
      // Токены главы/раздела: «…у самозанятого» подтягивает всю главу 77 —
      // так ориентируется юрист.
      for (const t of new Set(tokenize(`${c.section} ${c.chapter}`))) {
        let set = this.contexts.get(t);
        if (!set) this.contexts.set(t, (set = new Set()));
        set.add(i);
      }
    });
  }

  get size(): number {
    return this.chunks.length;
  }

  toJSON(): SerializedIndex {
    const rec = <V>(m: Map<string, V>, f: (v: V) => number[]): Record<string, number[]> => {
      const out: Record<string, number[]> = {};
      for (const [k, v] of m) out[k] = f(v);
      return out;
    };
    return {
      v: 1,
      chunks: this.chunks,
      docLen: this.docLen,
      avgLen: this.avgLen,
      postings: rec(this.postings, (v) => v),
      titles: rec(this.titles, (v) => [...v]),
      contexts: rec(this.contexts, (v) => [...v]),
    };
  }

  static fromSerialized(data: SerializedIndex): SearchIndex {
    const idx = Object.create(SearchIndex.prototype) as SearchIndex;
    idx.chunks = data.chunks;
    idx.docLen = data.docLen;
    idx.avgLen = data.avgLen;
    idx.postings = new Map(Object.entries(data.postings));
    idx.titles = new Map(Object.entries(data.titles).map(([k, v]) => [k, new Set(v)]));
    idx.contexts = new Map(Object.entries(data.contexts).map(([k, v]) => [k, new Set(v)]));
    return idx;
  }

  /**
   * Топ-k результатов. По умолчанию — максимум один чанк на статью
   * (пользователю нужны РАЗНЫЕ статьи-кандидаты). Для LLM-контекста дедуп
   * отключается: модели полезны несколько кусков одной статьи — лимит и
   * его последствия часто лежат в соседних пунктах.
   */
  search(query: string, k = 5, opts: { dedupeByArticle?: boolean } = {}): SearchHit[] {
    const dedupeByArticle = opts.dedupeByArticle ?? true;
    const qTokens = expandQueryTokens([...new Set(tokenize(query))]);
    if (qTokens.length === 0) return [];

    const N = this.chunks.length;
    const scores = new Map<number, number>();
    const add = (i: number, s: number) => scores.set(i, (scores.get(i) ?? 0) + s);

    for (const { token: q, weight } of qTokens) {
      const list = this.postings.get(q);
      if (!list) continue; // токена нет в текстах — пропускаем целиком
      const df = list.length / 2;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const inTitle = this.titles.get(q);

      for (let j = 0; j < list.length; j += 2) {
        const i = list[j]!;
        const tf = list[j + 1]!;
        const denom = tf + K1 * (1 - B + (B * this.docLen[i]!) / this.avgLen);
        let s = idf * ((tf * (K1 + 1)) / denom);
        // Буст за совпадение с названием статьи.
        if (inTitle?.has(i)) s += idf * 0.8;
        add(i, s * weight);
      }
      // Буст за совпадение с названием главы/раздела (даже если в тексте
      // чанка слова нет).
      for (const i of this.contexts.get(q) ?? []) add(i, idf * 0.5 * weight);
    }

    const ranked = [...scores.entries()]
      .map(([i, score]) => ({ chunk: this.chunks[i]!, score }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const out: SearchHit[] = [];
    for (const h of ranked) {
      if (dedupeByArticle) {
        if (seen.has(h.chunk.article)) continue;
        seen.add(h.chunk.article);
      }
      out.push(h);
      if (out.length === k) break;
    }
    return out;
  }
}
