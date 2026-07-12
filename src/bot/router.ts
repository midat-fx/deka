/**
 * Детерминированный роутер намерений — работает ДО поиска по кодексу.
 *
 * Зачем: нетехнарь пишет «переключи на казахский», «заработал 500 тысяч»,
 * «да» — раньше всё это уходило в поиск по кодексу и получало отказ
 * (реальный инцидент). Роутер ловит такие фразы правилами (regex) — без LLM:
 * дёшево, предсказуемо (юридически значимые действия вроде записи дохода
 * не должны зависеть от настроения модели) и не трогает grounded-тезис.
 *
 * Порядок: кнопки меню → смена языка → голое подтверждение → доход → дедлайны
 * → запуск визарда → null (значит, это настоящий вопрос — в поиск).
 */
import { parseAmount } from '../domain/turnover';
import { matchMenuButton, type MenuAction } from './keyboard';
import type { Lang } from '../i18n/i18n';

export type Intent =
  | { kind: 'menu'; action: MenuAction }
  | { kind: 'set_lang'; lang: Lang }
  | { kind: 'choose_lang' } // «смени язык» без указания какого
  | { kind: 'bare_confirm' } // «да/ок/иә» без контекста
  | { kind: 'log_income'; amount: number }
  | { kind: 'deadlines' }
  | { kind: 'form910' }
  | { kind: 'wizard' };

const LANG_TARGETS: [RegExp, Lang][] = [
  [/қазақша|казахск|казакш|kazakh|qazaq/i, 'kk'],
  [/русск|орысша|орыс тіл|russian|по-русски/i, 'ru'],
  [/англ|ағылшын|english/i, 'en'],
];

/** «переключи на казахский», «қазақша сөйле», «switch to english», «на русском» */
const LANG_SWITCH =
  /(перекл|смени|поменя|давай на|отвечай (на|по))|тілд[іi]|сөйле|ауыстыр|switch|change.*language|speak/i;

const BARE_CONFIRM =
  /^(да|ага|угу|ок|окей|давай|хорошо|конечно|иә|жарайды|болады|мақұл|yes|ok|okay|sure|yep)[.!)\s]*$/i;

const INCOME_VERB = /(заработал|получил|пришл[оа]|запиши|доход|выручка|прибыль|таптым|табыс|earned|income|got paid)/i;
/** Голая сумма: «500000», «1.3 млн тг», «400 тыс» — без других слов. */
const BARE_AMOUNT = /^[\d\s.,]+(млрд|млн|тыс|мың|к|k|m)?\s*(тг|тенге|₸|kzt)?[.!\s]*$/i;

const FORM910_ONLY = /^(форма\s*910|910[-\s]?нысан|form\s*910|910|деклараци\w*)[?.!\s]*$/i;
const DEADLINES_ONLY = /^(дедлайны?|сроки( сдачи)?|мерзімдер|deadlines?)[?.!\s]*$/i;
const WIZARD_ONLY = /^(какой режим( мне( подходит)?)?|подобрать режим|режим|қай режим|which regime|tax regime)[?.!\s]*$/i;

/** Вытащить сумму из фразы с «глаголом дохода»: берём числовую часть. */
function amountFromPhrase(text: string): number | null {
  const m = text.match(/([\d][\d\s.,]*)\s*(млрд|млн|тыс|мың|к|k|m)?\s*(тг|тенге|₸|kzt)?/i);
  if (!m) return null;
  const unitRaw = (m[2] ?? '').toLowerCase();
  const unit = unitRaw === 'мың' || unitRaw === 'k' ? 'к' : unitRaw === 'm' ? 'млн' : unitRaw;
  return parseAmount(`${m[1]}${unit}`);
}

export function routeIntent(text: string): Intent | null {
  const t = text.trim();

  // 1. Кнопки постоянного меню (точное совпадение на любом языке).
  const menu = matchMenuButton(t);
  if (menu) return { kind: 'menu', action: menu };

  // 2. Смена языка человеческой фразой. Сначала ищем целевой язык.
  for (const [re, lang] of LANG_TARGETS) {
    if (re.test(t) && (LANG_SWITCH.test(t) || t.split(/\s+/).length <= 3)) {
      // «переключи на казахский» ИЛИ короткое «қазақша» / «english»
      return { kind: 'set_lang', lang };
    }
  }
  if (/^(смени|поменяй|переключи)\s+(язык|тіл)|change language|тілді ауыстыр/i.test(t)) {
    return { kind: 'choose_lang' };
  }

  // 3. Голое подтверждение без контекста — не в поиск.
  if (BARE_CONFIRM.test(t)) return { kind: 'bare_confirm' };

  // 4. «Форма 910» / «910» / «декларация» — ДО дохода, иначе «910» съест парсер сумм.
  if (FORM910_ONLY.test(t)) return { kind: 'form910' };

  // 5. Доход: «заработал 500 тысяч» или просто «500000».
  if (INCOME_VERB.test(t)) {
    const amount = amountFromPhrase(t);
    if (amount !== null) return { kind: 'log_income', amount };
  }
  if (BARE_AMOUNT.test(t)) {
    const amount = parseAmount(t.replace(/[.!\s]+$/, ''));
    if (amount !== null) return { kind: 'log_income', amount };
  }

  // 6. Короткие «дедлайны» / «какой режим».
  if (DEADLINES_ONLY.test(t)) return { kind: 'deadlines' };
  if (WIZARD_ONLY.test(t)) return { kind: 'wizard' };

  return null; // настоящий вопрос — пропускаем в поиск по кодексу
}
