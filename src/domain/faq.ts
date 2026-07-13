/**
 * FAQ-слой: короткие курируемые ответы на частые вопросы, которые лежат ВНЕ
 * Налогового кодекса (соцплатежи, регистрация ИП, штрафы по КоАП). Показываются
 * ПЕРЕД общим отказом «🤷 не нашёл» — чтобы вопрос №1 «сколько всего платит
 * самозанятый» не упирался в бесполезное «ИПН 0%».
 *
 * ЖЁСТКОЕ правило (тезис «grounded или молчит»): здесь НЕ выдумываем цифры.
 * Если ставка задаётся не НК (Соцкодекс/ОСМС/КоАП) — честно говорим об этом и
 * отправляем к первоисточнику (e-Salyq / 1414), а не подставляем число «по
 * памяти». Каждый ответ явно помечает, что это не из НК.
 */
import type { Lang } from '../i18n/i18n';

export interface FaqEntry {
  id: string;
  match: RegExp;
  reply: Record<Lang, string>;
}

export const FAQ: FaqEntry[] = [
  {
    id: 'social_payments',
    // NB: без \b — в JS word-boundary не работает вокруг кириллицы. Аббревиатуры
    // ОПВ/ВОСМС/ОСМС матчим как подстроки (в других налоговых словах не встречаются).
    match:
      /соцплатеж|соц\.?\s?платеж|социальн\w* (отчислен|платеж|взнос)|опв|восмс|осмс|пенсионн\w* (взнос|отчислен)|сколько всего плат|полн\w* сумм\w* налог|әлеуметтік төлем|зейнетақы жарна/i,
    reply: {
      ru: '💡 Кроме налога у самозанятого/ИП есть <b>соцплатежи</b>: пенсионные (ОПВ), социальные отчисления (СО), медстрахование (ВОСМС).\n\n⚠️ <b>Их размер задаёт не Налоговый кодекс</b>, а Социальный кодекс и закон об ОСМС — поэтому точные ставки на 2026 я не называю, чтобы не соврать. Их считает приложение <b>e-Salyq</b>, там же видна итоговая сумма.\n\nЧто точно из НК: у самозанятого ИПН = <b>0%</b> (Ст. 720). Уточнить соцплатежи — КГД <b>1414</b> или e-Salyq.',
      kk: '💡 Салықтан бөлек ЖК/өзін-өзі жұмыспен қамтығанда <b>әлеуметтік төлемдер</b> бар: зейнетақы (МЗЖ), әлеуметтік аударым (ӘА), медсақтандыру (МӘСЖ).\n\n⚠️ <b>Олардың мөлшерін Салық кодексі емес</b>, Әлеуметтік кодекс пен МӘСЖ туралы заң белгілейді — сондықтан 2026 нақты мөлшерлемелерін атамаймын. Оларды <b>e-Salyq</b> қосымшасы санайды.\n\nНК-ден нақтысы: өзін-өзі жұмыспен қамтығанда ЖТС = <b>0%</b> (720-бап). Нақтылау — МКК <b>1414</b> не e-Salyq.',
      en: '💡 Besides tax, a self-employed/SP pays <b>social payments</b>: pension (OPV), social contributions (SO), health insurance (VOSMS).\n\n⚠️ <b>Their size is set not by the Tax Code</b> but by the Social Code and the OSMS law — so I won\'t state 2026 rates, to avoid being wrong. The <b>e-Salyq</b> app calculates them and shows the total.\n\nWhat\'s certain from the Tax Code: self-employed income tax = <b>0%</b> (Art. 720). Verify social payments — tax office <b>1414</b> or e-Salyq.',
    },
  },
  {
    id: 'register_ip',
    match:
      /(как|қалай|how).{0,24}(открыть|зарегистр|оформить|тіркел|register|open).{0,16}(ип|жк|sole|indiv)|открыть ип|зарегистрировать ип|register.{0,10}sole|жк (ашу|тіркеу)/i,
    reply: {
      ru: '💡 Регистрация ИП — это не через Налоговый кодекс, а онлайн и бесплатно: приложение <b>e-Salyq Business</b> или портал <b>egov.kz</b> (нужен ЭЦП или биометрия).\n\nПосле регистрации выбери налоговый режим — нажми «🧮 Какой режим мне». Вопросы по самой регистрации — КГД <b>1414</b>.',
      kk: '💡 ЖК тіркеу — Салық кодексі арқылы емес, онлайн әрі тегін: <b>e-Salyq Business</b> қосымшасы не <b>egov.kz</b> порталы (ЭЦҚ не биометрия керек).\n\nТіркелгеннен кейін салық режимін таңда — «🧮 Қай режим маған». Тіркеу сұрақтары — МКК <b>1414</b>.',
      en: '💡 Registering as a sole proprietor isn\'t via the Tax Code — it\'s online and free: the <b>e-Salyq Business</b> app or <b>egov.kz</b> (needs a digital signature or biometrics).\n\nAfter that, pick a tax regime — tap «🧮 My tax regime». Registration questions — tax office <b>1414</b>.',
    },
  },
  {
    id: 'penalty_fine',
    match:
      /(штраф|айыппұл|fine|penalt)\w*.{0,26}(не сда|неуплат|уплат|просроч|деклар|910|кешік|late|declaration|filing)|что будет если не сдать|не сдал деклар|декларацияны тапсырмаса/i,
    reply: {
      ru: '💡 Тут два разных начисления:\n• <b>Пеня</b> за просрочку УПЛАТЫ налога — это в НК: спроси «пеня» (Ст. 85), покажу.\n• <b>Штраф</b> за несдачу декларации — в <b>Кодексе об административных правонарушениях (КоАП)</b>, а не в НК.\n\nТочную сумму штрафа уточни в КГД <b>1414</b> — по КоАП я не отвечаю, чтобы не ввести в заблуждение.',
      kk: '💡 Мұнда екі түрлі есептеу:\n• Салық ТӨЛЕУ мерзімін өткізгені үшін <b>өсімпұл</b> — ол НК-де: «өсімпұл» деп сұра (85-бап).\n• Декларация тапсырмағаны үшін <b>айыппұл</b> — <b>Әкімшілік құқық бұзушылық кодексінде (ӘҚБК)</b>, НК-де емес.\n\nАйыппұл сомасын МКК <b>1414</b>-тен нақтыла — ӘҚБК бойынша жауап бермеймін.',
      en: '💡 Two different charges here:\n• A <b>late-payment penalty (пеня)</b> — that\'s in the Tax Code: ask «пеня» (Art. 85).\n• A <b>fine</b> for not filing a declaration — that\'s in the <b>Administrative Offences Code</b>, not the Tax Code.\n\nCheck the exact fine with the tax office <b>1414</b> — I don\'t answer on the Administrative Code, to avoid misleading you.',
    },
  },
];

/** Первое совпадение по ключевым словам (или null). */
export function matchFaq(query: string): FaqEntry | null {
  for (const e of FAQ) if (e.match.test(query)) return e;
  return null;
}
