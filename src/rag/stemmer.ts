/**
 * Стеммер русского языка (алгоритм Snowball/Porter для русского).
 *
 * Зачем: пользователь пишет «лимит самозанятого», а в кодексе — «самозанятых»,
 * «самозанятым». Стеммер срезает окончания и приводит словоформы к одной
 * основе («самозанят»), чтобы поиск их сопоставил. Без этого лексический
 * поиск по русскому тексту почти бесполезен.
 *
 * Реализация следует официальному описанию алгоритма
 * (snowballstem.org/algorithms/russian/stemmer.html): RV/R2-регионы,
 * шаги 1–4. Компактная, без внешних зависимостей, покрыта тестами.
 */

const VOWELS = 'аеиоуыэюя';

// Окончания. Группы с пометкой (а|я) требуют, чтобы перед окончанием стояла
// а или я — эту букву не срезаем. Кодируем такие окончания с ведущей а/я и
// при удалении оставляем первую букву.
const PERFECTIVE_GERUND_1 = ['вшись', 'вши', 'в']; // после а/я
const PERFECTIVE_GERUND_2 = ['ившись', 'ывшись', 'ивши', 'ывши', 'ив', 'ыв'];
const REFLEXIVE = ['ся', 'сь'];
const ADJECTIVE = [
  'ими', 'ыми', 'его', 'ого', 'ему', 'ому', 'ее', 'ие', 'ые', 'ое', 'ей',
  'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом', 'их', 'ых', 'ую', 'юю', 'ая',
  'яя', 'ою', 'ею',
];
const PARTICIPLE_1 = ['ем', 'нн', 'вш', 'ющ', 'щ']; // после а/я
const PARTICIPLE_2 = ['ивш', 'ывш', 'ующ'];
const VERB_1 = [
  'ете', 'йте', 'ешь', 'нно', 'ла', 'на', 'ли', 'ем', 'ло', 'но', 'ет',
  'ют', 'ны', 'ть', 'й', 'л', 'н',
]; // после а/я
const VERB_2 = [
  'ейте', 'уйте', 'ила', 'ыла', 'ена', 'ите', 'или', 'ыли', 'ило', 'ыло',
  'ено', 'ует', 'уют', 'ены', 'ить', 'ыть', 'ишь', 'ей', 'уй', 'ил', 'ыл',
  'им', 'ым', 'ен', 'ят', 'ит', 'ыт', 'ую', 'ю',
];
const NOUN = [
  'иями', 'ями', 'ами', 'ией', 'иям', 'ием', 'иях', 'ев', 'ов', 'ие', 'ье',
  'еи', 'ии', 'ей', 'ой', 'ий', 'ям', 'ем', 'ам', 'ом', 'ах', 'ях', 'ию',
  'ью', 'ия', 'ья', 'а', 'е', 'и', 'й', 'о', 'у', 'ы', 'ь', 'ю', 'я',
];
const SUPERLATIVE = ['ейше', 'ейш'];
const DERIVATIONAL = ['ость', 'ост'];

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch);
}

/** Начало региона RV: после первой гласной. */
function rvStart(word: string): number {
  for (let i = 0; i < word.length; i++) {
    if (isVowel(word[i]!)) return i + 1;
  }
  return word.length;
}

/** Начало региона R2 (для деривационных суффиксов). */
function r2Start(word: string): number {
  let r1 = word.length;
  for (let i = 0; i < word.length - 1; i++) {
    if (isVowel(word[i]!) && !isVowel(word[i + 1]!)) {
      r1 = i + 2;
      break;
    }
  }
  for (let i = r1; i < word.length - 1; i++) {
    if (isVowel(word[i]!) && !isVowel(word[i + 1]!)) return i + 2;
  }
  return word.length;
}

/** Срезать самое длинное окончание из списка (в пределах RV). */
function cut(word: string, endings: string[], rv: number): string | null {
  for (const end of endings) {
    if (word.length - end.length >= rv && word.endsWith(end)) {
      return word.slice(0, -end.length);
    }
  }
  return null;
}

/** То же, но окончание должно идти после а/я (букву а/я оставляем). */
function cutAfterAYa(word: string, endings: string[], rv: number): string | null {
  for (const end of endings) {
    if (word.length - end.length - 1 >= rv - 1 && word.endsWith(end)) {
      const prev = word[word.length - end.length - 1];
      if (prev === 'а' || prev === 'я') return word.slice(0, -end.length);
    }
  }
  return null;
}

/** Стем одного слова (ожидается lowercase, ё уже заменена на е). */
export function stemRu(input: string): string {
  let w = input;
  if (w.length <= 2 || !/[а-я]/.test(w)) return w;

  const rv = rvStart(w);

  // Шаг 1: деепричастие → иначе (рефлексив → прилагательное/причастие | глагол | существительное)
  let step1 = cutAfterAYa(w, PERFECTIVE_GERUND_1, rv) ?? cut(w, PERFECTIVE_GERUND_2, rv);
  if (step1 !== null) {
    w = step1;
  } else {
    w = cut(w, REFLEXIVE, rv) ?? w;
    const adj = cut(w, ADJECTIVE, rv);
    if (adj !== null) {
      w = adj;
      w = cutAfterAYa(w, PARTICIPLE_1, rv) ?? cut(w, PARTICIPLE_2, rv) ?? w;
    } else {
      const verb = cutAfterAYa(w, VERB_1, rv) ?? cut(w, VERB_2, rv);
      w = verb ?? cut(w, NOUN, rv) ?? w;
    }
  }

  // Шаг 2: конечная «и»
  if (w.length - 1 >= rv && w.endsWith('и')) w = w.slice(0, -1);

  // Шаг 3: деривационные (-ость) в R2
  const r2 = r2Start(input);
  for (const end of DERIVATIONAL) {
    if (w.endsWith(end) && w.length - end.length >= r2) {
      w = w.slice(0, -end.length);
      break;
    }
  }

  // Шаг 4: нн → н; превосходная степень; конечный ь
  if (w.endsWith('нн')) w = w.slice(0, -1);
  else {
    const sup = cut(w, SUPERLATIVE, rv);
    if (sup !== null) {
      w = sup;
      if (w.endsWith('нн')) w = w.slice(0, -1);
    }
  }
  if (w.endsWith('ь')) w = w.slice(0, -1);

  return w;
}
