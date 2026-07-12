/**
 * Общие типы телеметрии — без привязки к хранилищу.
 * Локально события пишутся в SQLite (events.ts, node:sqlite),
 * на Cloudflare Workers — в D1 (d1.ts). Схема таблицы одна и та же.
 */

export type EventName =
  | 'start' // пользователь запустил /start
  | 'help' // открыл /help
  | 'wizard_answer' // ответил на вопрос визарда (detail: поле=значение)
  | 'wizard_result' // дошёл до рекомендации (detail: какой режим)
  | 'wizard_restart' // нажал «пройти заново»
  | 'free_text' // (устар.) свободный текст до появления поиска
  | 'search' // поиск по кодексу (detail: hits/top/score либо refused; сам текст не храним)
  | 'answer' // LLM-пересказ (detail: answered | no_answer | error:<причина>)
  | 'turnover' // трекер оборота (detail: add | show | reset)
  | 'deadlines' // дедлайны/напоминания (detail: show | sub | unsub)
  | 'lang'; // смена языка (detail: ru | kk)

export interface EventTracker {
  /** Записать событие. Никогда не бросает — телеметрия не роняет бота. */
  track(telegramId: number | undefined, event: EventName, detail?: string): void;
}
