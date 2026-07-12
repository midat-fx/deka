/**
 * Постоянное меню внизу экрана (reply keyboard) — главный вход для нетехнаря.
 * Кнопки — обычные слова на языке пользователя, никаких слэшей.
 * Роутинг нажатий — в router.ts (кнопка приходит обычным текстом).
 */
import { Keyboard } from 'grammy';
import { MENU, LANGS, type Lang } from '../i18n/i18n';

export function mainKeyboard(lang: Lang): Keyboard {
  return new Keyboard()
    .text(MENU.wizard[lang])
    .text(MENU.form910[lang]) // магнит августовской волны — наверх
    .row()
    .text(MENU.turnover[lang])
    .text(MENU.income[lang])
    .row()
    .text(MENU.deadlines[lang])
    .text(MENU.language[lang])
    .row()
    .text(MENU.help[lang])
    .resized()
    .persistent();
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
