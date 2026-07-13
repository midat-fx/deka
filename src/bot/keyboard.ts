/**
 * Постоянное меню внизу экрана (reply keyboard) — главный вход для нетехнаря.
 * Кнопки — обычные слова на языке пользователя, никаких слэшей.
 * Роутинг нажатий — в router.ts (кнопка приходит обычным текстом).
 */
import { Keyboard, InlineKeyboard } from 'grammy';
import { MENU, LANGS, SHARE_BTN, SHARE_TEXT, REMIND910_BTN, type Lang } from '../i18n/i18n';

const BOT_LINK = 'https://t.me/deka_tax_bot';

/** Ссылка на нативный диалог пересылки Telegram с реф-меткой (?start=ref). */
export function shareUrl(lang: Lang): string {
  const link = `${BOT_LINK}?start=ref`;
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(SHARE_TEXT[lang])}`;
}

/**
 * Клавиатура под результатом расчёта: «поделиться» (рост, K-фактор) и опц.
 * «напомнить про 910» (one-tap подписка в момент интереса, callback rmd|910).
 */
export function resultKeyboard(lang: Lang, opts: { remind?: boolean } = {}): InlineKeyboard {
  const kb = new InlineKeyboard().url(SHARE_BTN[lang], shareUrl(lang));
  if (opts.remind) kb.row().text(REMIND910_BTN[lang], 'rmd|910');
  return kb;
}

export function mainKeyboard(lang: Lang): Keyboard {
  return new Keyboard()
    .text(MENU.wizard[lang])
    .text(MENU.form910[lang]) // магнит августовской волны — наверх
    .row()
    .text(MENU.turnover[lang])
    .text(MENU.income[lang])
    .row()
    .text(MENU.deadlines[lang])
    .text(MENU.language[lang]) // язык остаётся на виду — частая боль нетехнаря
    .row()
    .text(MENU.settings[lang])
    .text(MENU.help[lang])
    .resized()
    .persistent();
}

/**
 * Ряд inline-кнопок «что дальше» под успешным ответом — мягкая воронка к
 * инструментам. Обработчик nav| — в text-router (там все зависимости).
 */
export function followupKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(MENU.form910[lang], 'nav|910')
    .text(MENU.turnover[lang], 'nav|oborot')
    .text(MENU.deadlines[lang], 'nav|dedlayny');
}

export type MenuAction = keyof typeof MENU;

/** Текст сообщения → действие меню (кнопки матчим на всех языках сразу). */
export function matchMenuButton(text: string): MenuAction | null {
  const t = text.trim();
  for (const action of Object.keys(MENU) as MenuAction[]) {
    for (const lang of LANGS) {
      if (MENU[action][lang] === t) return action;
    }
  }
  return null;
}
