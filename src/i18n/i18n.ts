/**
 * Язык интерфейса: русский, казахский, английский.
 *
 * Scope: приветствие, справка, меню-клавиатура, отказ поиска, подтверждения
 * и язык ОТВЕТОВ LLM. Полная локализация визарда/трекера — отдельный проход
 * (с проверкой формулировок носителем). Казахские строки — бета.
 */
export type Lang = 'ru' | 'kk' | 'en';

export const LANGS: Lang[] = ['ru', 'kk', 'en'];

/** Определить язык по буквам: казахские → kk, латиница без кириллицы → en. */
const KZ_LETTERS = /[әғқңөұүһі]/i;
const CYRILLIC = /[а-яё]/i;
const LATIN = /[a-z]/i;
export function detectLang(text: string): Lang {
  if (KZ_LETTERS.test(text)) return 'kk';
  if (!CYRILLIC.test(text) && LATIN.test(text)) return 'en';
  return 'ru';
}

export const LANG_NAME: Record<Lang, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

/** Инструкция для LLM: на каком языке отвечать. */
export const ANSWER_LANG_INSTRUCTION: Record<Lang, string> = {
  ru: 'Отвечай на русском языке.',
  kk: 'Жауапты қазақ тілінде бер (баптардың нөмірлері мен сілтемелерін сол күйінде қалдыр).',
  en: 'Answer in English (keep article numbers and references as they are).',
};

export const WELCOME: Record<Lang, string> = {
  ru:
    '👋 Привет! Я <b>Deka</b> — помогаю ИП и самозанятым Казахстана разобраться с налогами по <b>кодексу 2026</b>. Отвечаю по первоисточнику, со ссылками на статьи. Неофициальный помощник, не связан с КГД.\n\n' +
    '<b>Что я умею</b> — кнопки в меню внизу 👇\n' +
    '🧮 Подобрать налоговый режим\n' +
    '📊 Следить за оборотом и лимитами\n' +
    '📅 Напоминать о дедлайнах\n' +
    '💬 Отвечать на вопросы про ИП, самозанятых, НДС, ИПН, соцналог — со ссылкой на статью\n\n' +
    '<i>Это ориентир, а не налоговая консультация.</i>',
  kk:
    '👋 Сәлем! Мен — <b>Deka</b>, Қазақстандағы ЖК мен өзін-өзі жұмыспен қамтығандарға <b>2026 салық кодексі</b> бойынша көмектесемін. Бастапқы дереккөзге сүйеніп, баптарға сілтемемен жауап беремін. Бейресми көмекші.\n\n' +
    '<b>Не істей аламын</b> — төмендегі мәзір батырмалары 👇\n' +
    '🧮 Салық режимін таңдау\n' +
    '📊 Айналым мен шектерді бақылау\n' +
    '📅 Мерзімдерді еске салу\n' +
    '💬 ЖК, өзін-өзі жұмыспен қамту, ҚҚС, ЖТС, әлеуметтік салық туралы сұрақтарға — бап сілтемесімен\n\n' +
    '<i>Бұл бағдар, салықтық кеңес емес.</i>',
  en:
    "👋 Hi! I'm <b>Deka</b> — I help Kazakhstan's sole proprietors and self-employed navigate the <b>2026 Tax Code</b>. Answers come from the official text with article references. Unofficial assistant, not affiliated with the tax authority.\n\n" +
    '<b>What I can do</b> — use the menu buttons below 👇\n' +
    '🧮 Pick your tax regime\n' +
    '📊 Track turnover against limits\n' +
    '📅 Remind about deadlines\n' +
    '💬 Answer questions on sole proprietors, self-employed, VAT, income tax, social tax — with an article link\n\n' +
    '<i>Guidance only, not tax advice.</i>',
};

export const HELP: Record<Lang, string> = {
  ru:
    'Пользуйся кнопками меню внизу экрана — или просто пиши по-человечески:\n' +
    '• «какой режим мне подходит» — подбор режима\n' +
    '• «заработал 500 тысяч» — запишу доход и сверю с лимитами\n' +
    '• «ндс с 500000» — посчитаю НДС 16%; «сколько отложить с 300000» — прикину налог\n' +
    '• «проверь ответ chatgpt» — сверю чужой ответ ИИ с кодексом и покажу ошибки\n' +
    '• «дедлайны» — сроки и напоминания\n' +
    '• «переключи на казахский / english» — сменю язык\n' +
    '• Любой вопрос по налогам — найду ответ в кодексе со ссылками на статьи.',
  kk:
    'Экранның астындағы мәзір батырмаларын қолданыңыз — немесе жай ғана жазыңыз:\n' +
    '• «маған қай режим келеді» — режим таңдау\n' +
    '• «500 мың таптым» — табысты жазып, шектермен салыстырамын\n' +
    '• «500000-нан ққс» — ҚҚС 16% есептеймін; «300000-нан қанша бөлу» — салықты болжаймын\n' +
    '• «chatgpt жауабын тексер» — ЖИ жауабын кодекспен салыстырамын\n' +
    '• «мерзімдер» — мерзімдер мен еске салулар\n' +
    '• «орысша сөйле / english» — тілді ауыстырамын\n' +
    '• Салық туралы кез келген сұрақ — кодекстен баптарға сілтемемен жауап табамын.',
  en:
    'Use the menu buttons at the bottom — or just type naturally:\n' +
    '• "which regime fits me" — regime wizard\n' +
    '• "earned 500000" — I will log income and check limits\n' +
    '• "vat on 500000" — I calculate 16% VAT; "how much to set aside from 300000" — tax estimate\n' +
    '• "check chatgpt answer" — I verify an AI answer against the code\n' +
    '• "deadlines" — dates and reminders\n' +
    '• "switch to Russian / қазақша" — change language\n' +
    '• Any tax question — I will find the answer in the code with article references.',
};

export const SEARCH_REFUSAL: Record<Lang, string> = {
  ru:
    '🤷 В моих разделах кодекса (ИП, самозанятые, НДС, ИПН, соцналог) уверенного ответа не нашлось.\n\n' +
    'Попробуй один из примеров ниже — или переформулируй свой вопрос.',
  kk:
    '🤷 Кодекстің менде бар бөлімдерінен (ЖК, өзін-өзі жұмыспен қамтыған, ҚҚС, ЖТС, әлеуметтік салық) нақты жауап табылмады.\n\n' +
    'Төмендегі мысалдардың бірін көріңіз — немесе сұрақты басқаша тұжырымдаңыз.',
  en:
    '🤷 I could not find a confident answer in my sections of the code (sole proprietors, self-employed, VAT, income tax, social tax).\n\n' +
    'Try one of the examples below — or rephrase your question.',
};

/** Готовые вопросы-кнопки под отказом (гарантированно проходят golden-set). */
export const REFUSAL_EXAMPLES: Record<Lang, string[]> = {
  ru: ['Какой лимит дохода у самозанятого?', 'Когда вставать на учёт по НДС?'],
  kk: ['Өзін-өзі жұмыспен қамтығанның табыс шегі қандай?', 'ҚҚС есебіне қашан тұру керек?'],
  en: ['What is the self-employed income limit?', 'When must I register for VAT?'],
};

export const TIL_PROMPT: Record<Lang, string> = {
  ru: '🌐 Выбери язык:',
  kk: '🌐 Тілді таңдаңыз:',
  en: '🌐 Choose a language:',
};

export const TIL_SET: Record<Lang, string> = {
  ru: '✅ Готово, теперь говорим по-русски.',
  kk: '✅ Дайын, енді қазақша сөйлесеміз.',
  en: '✅ Done, switching to English.',
};

/** «Да/ок» без контекста: не гадаем, а показываем меню. */
export const CONFIRM_LOST: Record<Lang, string> = {
  ru: 'Я не понял, что подтвердить 🙂 Выбери действие кнопками меню внизу — или напиши вопрос по налогам.',
  kk: 'Нені растау керегін түсінбедім 🙂 Төмендегі мәзірден әрекет таңдаңыз — немесе салық туралы сұрақ жазыңыз.',
  en: "I'm not sure what you're confirming 🙂 Pick an action from the menu below — or type a tax question.",
};

/** Подтверждение записи дохода из фразы (защита от ложных срабатываний). */
export const INCOME_CONFIRM: Record<Lang, (amount: string) => string> = {
  ru: (a) => `Записать <b>+${a}</b> как доход?`,
  kk: (a) => `<b>+${a}</b> табыс ретінде жазайын ба?`,
  en: (a) => `Log <b>+${a}</b> as income?`,
};

export const YES: Record<Lang, string> = { ru: '✅ Да', kk: '✅ Иә', en: '✅ Yes' };
export const NO: Record<Lang, string> = { ru: '❌ Нет', kk: '❌ Жоқ', en: '❌ No' };
export const CANCELLED: Record<Lang, string> = { ru: 'Ок, не записываю.', kk: 'Жарайды, жазбаймын.', en: 'Ok, not logging it.' };

export const ASK_AMOUNT: Record<Lang, string> = {
  ru: 'Напиши сумму дохода — например: 500 000, «1.3 млн» или «400 тыс».',
  kk: 'Табыс сомасын жазыңыз — мысалы: 500 000, «1.3 млн» немесе «400 мың».',
  en: 'Type the income amount — e.g. 500000, "1.3m".',
};

/** Кнопки постоянного меню (reply keyboard). */
export const MENU = {
  wizard: { ru: '🧮 Какой режим мне', kk: '🧮 Қай режим маған', en: '🧮 My tax regime' },
  form910: { ru: '📋 Форма 910', kk: '📋 910-нысан', en: '📋 Form 910' },
  turnover: { ru: '📊 Мой оборот', kk: '📊 Менің айналымым', en: '📊 My turnover' },
  income: { ru: '➕ Записать доход', kk: '➕ Табыс жазу', en: '➕ Log income' },
  deadlines: { ru: '📅 Дедлайны', kk: '📅 Мерзімдер', en: '📅 Deadlines' },
  language: { ru: '🌐 Язык / Тіл', kk: '🌐 Тіл / Язык', en: '🌐 Language' },
  settings: { ru: '⚙️ Настройки', kk: '⚙️ Баптаулар', en: '⚙️ Settings' },
  help: { ru: '❓ Помощь', kk: '❓ Көмек', en: '❓ Help' },
} satisfies Record<string, Record<Lang, string>>;

export const WIZARD_BUTTON: Record<Lang, string> = {
  ru: '🧮 Подобрать налоговый режим',
  kk: '🧮 Салық режимін таңдау',
  en: '🧮 Pick my tax regime',
};

export const KGD_BUTTON: Record<Lang, string> = {
  ru: '📞 КГД: 1414 (бесплатно)',
  kk: '📞 МКК: 1414 (тегін)',
  en: '📞 Tax authority: 1414 (free)',
};

// ── Экран «⚙️ Настройки» ──────────────────────────────────────────────────
export const SETTINGS_TITLE: Record<Lang, string> = {
  ru: '⚙️ <b>Настройки</b>\n\nСмени язык, включи или выключи напоминания о дедлайнах, управляй своими данными.',
  kk: '⚙️ <b>Баптаулар</b>\n\nТілді ауыстырыңыз, мерзімдер туралы еске салуларды қосып-өшіріңіз, деректеріңізді басқарыңыз.',
  en: '⚙️ <b>Settings</b>\n\nChange the language, turn deadline reminders on or off, and manage your data.',
};

/** Кнопки экрана настроек (напоминания показывают текущее состояние). */
export const SETTINGS_BTN = {
  language: { ru: '🌐 Язык интерфейса', kk: '🌐 Интерфейс тілі', en: '🌐 Interface language' },
  remindersOn: { ru: '🔔 Напоминания: включены', kk: '🔔 Еске салу: қосулы', en: '🔔 Reminders: on' },
  remindersOff: { ru: '🔕 Напоминания: выключены', kk: '🔕 Еске салу: өшулі', en: '🔕 Reminders: off' },
  pro: { ru: '💎 Deka Pro — ранний доступ', kk: '💎 Deka Pro — ерте қол жеткізу', en: '💎 Deka Pro — early access' },
  wipe: { ru: '🗑️ Удалить мои данные', kk: '🗑️ Деректерімді жою', en: '🗑️ Delete my data' },
} satisfies Record<string, Record<Lang, string>>;

export const REM_TOGGLED: Record<Lang, (on: boolean) => string> = {
  ru: (on) => (on ? '🔔 Напоминания включены' : '🔕 Напоминания выключены'),
  kk: (on) => (on ? '🔔 Еске салу қосылды' : '🔕 Еске салу өшірілді'),
  en: (on) => (on ? '🔔 Reminders on' : '🔕 Reminders off'),
};

// ── Deka Pro (лист ожидания — замеряем готовность платить) ─────────────────
export const PRO_ABOUT: Record<Lang, string> = {
  ru:
    '💎 <b>Deka Pro</b> — для тех, кому нужно больше:\n' +
    '• Безлимит вопросов и приоритетные ответы\n' +
    '• Персональные напоминания под твои сроки сдачи\n' +
    '• Выгрузка оборота и расчёта налога файлом\n\n' +
    'Пока в разработке. Нажми «Записаться» — напишу, когда откроется ранний доступ. Это ни к чему не обязывает.',
  kk:
    '💎 <b>Deka Pro</b> — көбірек қажет ететіндерге:\n' +
    '• Шексіз сұрақтар мен басым жауаптар\n' +
    '• Сіздің тапсыру мерзіміңізге бейімделген еске салулар\n' +
    '• Айналым мен салық есебін файлмен жүктеу\n\n' +
    'Әзірге әзірленуде. «Тіркелу» батырмасын басыңыз — ерте қол жеткізу ашылғанда жазамын. Бұл ешнәрсеге міндеттемейді.',
  en:
    '💎 <b>Deka Pro</b> — for those who need more:\n' +
    '• Unlimited questions and priority answers\n' +
    '• Personal reminders tuned to your filing dates\n' +
    '• Export of turnover and tax estimate as a file\n\n' +
    "Still in the works. Tap «Join» and I'll message you when early access opens. No commitment.",
};

export const PRO_JOIN_BUTTON: Record<Lang, string> = {
  ru: '✅ Записаться в лист ожидания',
  kk: '✅ Күту тізіміне тіркелу',
  en: '✅ Join the waitlist',
};

export const PRO_JOINED: Record<Lang, string> = {
  ru: '🙌 Готово! Ты в списке — напишу, когда откроется ранний доступ Deka Pro. Спасибо за интерес!',
  kk: '🙌 Дайын! Сіз тізімдесіз — Deka Pro ерте қол жеткізуі ашылғанда жазамын. Қызығушылығыңызға рахмет!',
  en: "🙌 Done! You're on the list — I'll message you when Deka Pro early access opens. Thanks for your interest!",
};

// ── Приватность (удаление своих данных) ────────────────────────────────────
export const PRIVACY_CONFIRM: Record<Lang, string> = {
  ru:
    '🗑️ Удалить все твои данные?\n\n' +
    'Сотру записи оборота и отпишу от напоминаний. Это <b>безвозвратно</b>.\n' +
    '<i>Сами вопросы к боту я и так не храню.</i>',
  kk:
    '🗑️ Барлық деректеріңізді жоямын ба?\n\n' +
    'Айналым жазбаларын өшіріп, еске салулардан бас тартамын. Бұл <b>қайтарылмайды</b>.\n' +
    '<i>Ботқа қойған сұрақтарыңызды бәрібір сақтамаймын.</i>',
  en:
    '🗑️ Delete all your data?\n\n' +
    "I'll erase turnover records and unsubscribe you from reminders. This is <b>permanent</b>.\n" +
    '<i>Your questions to the bot are never stored anyway.</i>',
};

export const PRIVACY_YES: Record<Lang, string> = {
  ru: '🗑️ Да, удалить всё',
  kk: '🗑️ Иә, бәрін жою',
  en: '🗑️ Yes, delete everything',
};

export const PRIVACY_DONE: Record<Lang, string> = {
  ru: '✅ Готово. Все твои данные удалены. Можешь начать с чистого листа в любой момент.',
  kk: '✅ Дайын. Барлық деректеріңіз жойылды. Кез келген уақытта таза беттен бастай аласыз.',
  en: '✅ Done. All your data is deleted. You can start fresh anytime.',
};

/** Подсказка «что дальше» под успешным ответом — воронка к инструментам. */
export const FOLLOWUP_HINT: Record<Lang, string> = {
  ru: 'Что дальше? 👇',
  kk: 'Әрі қарай ше? 👇',
  en: "What's next? 👇",
};

// ── Названия месяцев и склонения (для трекера и дедлайнов) ─────────────────
/** Именительный падеж — для «июль 2026 год» в статусе оборота. */
export const MONTHS_NOM: Record<Lang, string[]> = {
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** Родительный падеж (только ru) — для дат «15 августа». kk/en берут именительный. */
const RU_MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «2026-08-15» → дата словами на языке пользователя. */
export function formatDateI18n(iso: string, lang: Lang = 'ru'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const mi = (m ?? 1) - 1;
  if (lang === 'kk') return `${y} жылғы ${d} ${MONTHS_NOM.kk[mi]}`;
  if (lang === 'en') return `${d} ${MONTHS_NOM.en[mi]} ${y}`;
  return `${d} ${RU_MONTHS_GEN[mi]} ${y}`;
}

/** Склонение дней: ru — «1 день/2 дня/7 дней»; kk — «7 күн»; en — «1 day/7 days». */
export function pluralDaysI18n(n: number, lang: Lang = 'ru'): string {
  if (lang === 'kk') return `${n} күн`;
  if (lang === 'en') return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
  const abs = Math.abs(n);
  const last2 = abs % 100;
  const last1 = abs % 10;
  if (last2 >= 11 && last2 <= 14) return `${n} дней`;
  if (last1 === 1) return `${n} день`;
  if (last1 >= 2 && last1 <= 4) return `${n} дня`;
  return `${n} дней`;
}

// ── Трекер оборота ─────────────────────────────────────────────────────────
type Amt = string; // отформатированная сумма (formatTenge)

export const TURNOVER_UI = {
  title: { ru: '📊 <b>Твой оборот</b>', kk: '📊 <b>Сенің айналымың</b>', en: '📊 <b>Your turnover</b>' },
  period: {
    ru: (m: string, y: number, mt: Amt, yt: Amt) => `${m}: <b>${mt}</b> · ${y} год: <b>${yt}</b>`,
    kk: (m: string, y: number, mt: Amt, yt: Amt) => `${m}: <b>${mt}</b> · ${y} жыл: <b>${yt}</b>`,
    en: (m: string, y: number, mt: Amt, yt: Amt) => `${m}: <b>${mt}</b> · ${y}: <b>${yt}</b>`,
  },
  lineSelfEmployed: { ru: 'Самозанятый — лимит месяца', kk: 'Өзін-өзі жұмыспен қамту — ай шегі', en: 'Self-employed — monthly limit' },
  lineVat: { ru: 'Порог НДС — за год', kk: 'ҚҚС шегі — жылына', en: 'VAT threshold — per year' },
  lineSimplified: { ru: 'Упрощёнка — потолок года', kk: 'Оңайлатылған — жылдық шегі', en: 'Simplified — annual cap' },
  of: { ru: 'из', kk: '/', en: 'of' },
  logHint: {
    ru: '<i>Записать доход: просто напиши сумму, например «500 000» или «1.3 млн». Кнопка ➕ в меню тоже работает.</i>',
    kk: '<i>Табыс жазу: жай ғана соманы жазыңыз, мысалы «500 000» немесе «1.3 млн». Мәзірдегі ➕ батырмасы да жұмыс істейді.</i>',
    en: '<i>Log income: just type the amount, e.g. «500 000» or «1.3m». The ➕ menu button works too.</i>',
  },
  privacyNote: {
    ru: '<i>Данные анонимны (без имени), храним только суммы. Ориентир, не бухучёт.</i>',
    kk: '<i>Деректер анонимді (атсыз), тек сомаларды сақтаймыз. Бағдар, бухгалтерия емес.</i>',
    en: '<i>Data is anonymous (no name), we store only amounts. Guidance, not bookkeeping.</i>',
  },
  logged: {
    ru: (a: Amt) => `✅ Записал <b>+${a}</b>.`,
    kk: (a: Amt) => `✅ <b>+${a}</b> жаздым.`,
    en: (a: Amt) => `✅ Logged <b>+${a}</b>.`,
  },
  undoBtn: { ru: '↩️ Отменить эту запись', kk: '↩️ Бұл жазбаны болдырмау', en: '↩️ Undo this entry' },
  parseFail: {
    ru: 'Не понял сумму. Напиши, например: 500000 (или «1.3 млн», «400 тыс»).',
    kk: 'Соманы түсінбедім. Мысалы: 500000 (немесе «1.3 млн», «400 мың») деп жазыңыз.',
    en: "Couldn't parse the amount. Type e.g. 500000 (or «1.3m»).",
  },
  resetConfirm: {
    ru: (yt: Amt) => `Точно обнулить весь учёт (<b>${yt}</b> за год)? Это безвозвратно.`,
    kk: (yt: Amt) => `Барлық есепті нөлдейміз бе (жылына <b>${yt}</b>)? Бұл қайтарылмайды.`,
    en: (yt: Amt) => `Reset all records (<b>${yt}</b> for the year)? This is permanent.`,
  },
  resetYes: { ru: '🗑 Да, обнулить', kk: '🗑 Иә, нөлдеу', en: '🗑 Yes, reset' },
  resetNo: { ru: 'Отмена', kk: 'Болдырмау', en: 'Cancel' },
  resetDone: { ru: 'Учёт обнулён', kk: 'Есеп нөлденді', en: 'Records reset' },
  resetDoneMsg: {
    ru: 'Обнулил твой учёт оборота. Начнём заново: просто напиши сумму дохода.',
    kk: 'Айналым есебіңді нөлдедім. Қайта бастайық: жай ғана табыс сомасын жаз.',
    en: 'Your turnover records are reset. Start over: just type an income amount.',
  },
  resetCancelled: { ru: 'Отменено', kk: 'Болдырылмады', en: 'Cancelled' },
  resetCancelMsg: {
    ru: 'Ок, ничего не трогаю. Учёт на месте.',
    kk: 'Жарайды, ештеңеге тиіспеймін. Есеп орнында.',
    en: 'Ok, leaving everything as is. Records intact.',
  },
  undoDone: { ru: 'Запись отменена', kk: 'Жазба болдырылмады', en: 'Entry undone' },
  undoNothing: { ru: 'Нечего отменять', kk: 'Болдырмайтын ештеңе жоқ', en: 'Nothing to undo' },
  undoMsg: {
    ru: (a: Amt) => `↩️ Отменил запись <b>+${a}</b>. Статус: кнопка «📊 Мой оборот» в меню.`,
    kk: (a: Amt) => `↩️ <b>+${a}</b> жазбасын болдырмадым. Күйі: мәзірдегі «📊 Менің айналымым».`,
    en: (a: Amt) => `↩️ Undid the entry <b>+${a}</b>. Status: «📊 My turnover» in the menu.`,
  },
} satisfies Record<string, unknown>;

/** Алерты о лимитах — текст по языку. (t — оборот, l — лимит.) */
export const TURNOVER_ALERTS = {
  seOver: {
    ru: (t: Amt, l: Amt) => `Месячный лимит самозанятого превышен: ${t} при пороге 300 МРП (${l}). В этом месяце режим самозанятого не применяется — свериться стоит с бухгалтером.`,
    kk: (t: Amt, l: Amt) => `Өзін-өзі жұмыспен қамтудың айлық шегі асып кетті: ${t}, шек — 300 АЕК (${l}). Бұл айда өзін-өзі жұмыспен қамту режимі қолданылмайды — бухгалтермен тексерген жөн.`,
    en: (t: Amt, l: Amt) => `Self-employed monthly limit exceeded: ${t}, the limit is 300 MCI (${l}). The self-employed regime doesn't apply this month — worth checking with an accountant.`,
  },
  seWarn: {
    ru: (t: Amt, l: Amt) => `Близко к месячному лимиту самозанятого: ${t} из ${l}.`,
    kk: (t: Amt, l: Amt) => `Өзін-өзі жұмыспен қамтудың айлық шегіне жақынсың: ${t} / ${l}.`,
    en: (t: Amt, l: Amt) => `Close to the self-employed monthly limit: ${t} of ${l}.`,
  },
  vatOver: {
    ru: (_t: Amt, l: Amt) => `Годовой оборот превысил порог НДС (${l}). Встать на учёт по НДС нужно не позже 5 рабочих дней после превышения.`,
    kk: (_t: Amt, l: Amt) => `Жылдық айналым ҚҚС шегінен (${l}) асып кетті. ҚҚС есебіне асып кеткеннен кейін 5 жұмыс күнінен кешіктірмей тұру керек.`,
    en: (_t: Amt, l: Amt) => `Annual turnover has exceeded the VAT threshold (${l}). You must register for VAT within 5 business days of exceeding it.`,
  },
  vatWarn: {
    ru: (t: Amt, l: Amt) => `Близко к порогу НДС: ${t} из ${l} за год.`,
    kk: (t: Amt, l: Amt) => `ҚҚС шегіне жақынсың: жылына ${t} / ${l}.`,
    en: (t: Amt, l: Amt) => `Close to the VAT threshold: ${t} of ${l} for the year.`,
  },
  simpOver: {
    ru: (_t: Amt, l: Amt) => `Годовой оборот превысил потолок упрощёнки (${l}) — пора на общеустановленный режим.`,
    kk: (_t: Amt, l: Amt) => `Жылдық айналым оңайлатылған режим шегінен (${l}) асты — жалпыға белгіленген режимге көшу уақыты.`,
    en: (_t: Amt, l: Amt) => `Annual turnover has exceeded the simplified-regime cap (${l}) — time to move to the general regime.`,
  },
  simpWarn: {
    ru: (t: Amt, l: Amt) => `Близко к потолку упрощёнки: ${t} из ${l} за год.`,
    kk: (t: Amt, l: Amt) => `Оңайлатылған режим шегіне жақынсың: жылына ${t} / ${l}.`,
    en: (t: Amt, l: Amt) => `Close to the simplified-regime cap: ${t} of ${l} for the year.`,
  },
} satisfies Record<string, Record<Lang, (t: Amt, l: Amt) => string>>;

export type AlertCode = keyof typeof TURNOVER_ALERTS;

// ── Дедлайны ───────────────────────────────────────────────────────────────
/** Локализация конкретных дедлайнов по id (ru берётся из самого Deadline). */
export const DEADLINE_I18N: Record<string, { title: Record<Lang, string>; note: Record<Lang, string> }> = {
  '910-1h-2026': {
    title: {
      ru: 'Форма 910 за 1-е полугодие 2026',
      kk: '2026 жылдың 1-жартыжылдығына 910-нысан',
      en: 'Form 910 for H1 2026',
    },
    note: {
      ru: 'Упрощёнка: сдать декларацию за январь–июнь и уплатить налог.',
      kk: 'Оңайлатылған: қаңтар–маусым декларациясын тапсырып, салық төлеу.',
      en: 'Simplified regime: file the January–June declaration and pay the tax.',
    },
  },
  '910-2h-2026': {
    title: {
      ru: 'Форма 910 за 2-е полугодие 2026',
      kk: '2026 жылдың 2-жартыжылдығына 910-нысан',
      en: 'Form 910 for H2 2026',
    },
    note: {
      ru: 'Упрощёнка: сдать декларацию за июль–декабрь и уплатить налог.',
      kk: 'Оңайлатылған: шілде–желтоқсан декларациясын тапсырып, салық төлеу.',
      en: 'Simplified regime: file the July–December declaration and pay the tax.',
    },
  },
};

export const DEADLINES_UI = {
  title: {
    ru: '📅 <b>Ближайшие налоговые дедлайны</b>',
    kk: '📅 <b>Жақындағы салық мерзімдері</b>',
    en: '📅 <b>Upcoming tax deadlines</b>',
  },
  empty: {
    ru: 'В моём списке ближайших сроков сейчас нет.',
    kk: 'Менің тізімімде жақын мерзімдер қазір жоқ.',
    en: 'No upcoming deadlines in my list right now.',
  },
  inDays: { ru: (d: string) => `через ${d}`, kk: (d: string) => `${d} қалды`, en: (d: string) => `in ${d}` },
  lastDay: { ru: 'сегодня последний день сдачи', kk: 'бүгін тапсырудың соңғы күні', en: 'today is the last day to file' },
  submitOver: {
    ru: (d: string) => `срок сдачи прошёл — уплати налог до ${d}`,
    kk: (d: string) => `тапсыру мерзімі өтті — салықты ${d} дейін төле`,
    en: (d: string) => `filing deadline passed — pay the tax by ${d}`,
  },
  submitBy: { ru: (d: string) => `Сдать до ${d}`, kk: (d: string) => `Тапсыру мерзімі: ${d}`, en: (d: string) => `File by ${d}` },
  payBy: { ru: (d: string) => `, уплатить до ${d}`, kk: (d: string) => `, төлеу мерзімі: ${d}`, en: (d: string) => `, pay by ${d}` },
  footer: {
    ru: '<i>Выпадает на выходной — переносится на ближайший рабочий день. Ориентир, сверяйся с КГД (1414).</i>',
    kk: '<i>Демалысқа сәйкес келсе — келесі жұмыс күніне ауысады. Бағдар, МКК-мен тексер (1414).</i>',
    en: '<i>If it falls on a weekend, it moves to the next business day. Guidance — verify with the tax office (1414).</i>',
  },
  reminderTitle: { ru: '🔔 <b>Напоминание о дедлайне</b>', kk: '🔔 <b>Мерзім туралы еске салу</b>', en: '🔔 <b>Deadline reminder</b>' },
  reminderBody: {
    ru: (d: string, title: string) => `Через ${d} — <b>${title}</b>.`,
    kk: (d: string, title: string) => `${d} қалды — <b>${title}</b>.`,
    en: (d: string, title: string) => `In ${d} — <b>${title}</b>.`,
  },
  reminderOff: {
    ru: '<i>Отключить напоминания: /napomni стоп</i>',
    kk: '<i>Еске салуды өшіру: /napomni стоп</i>',
    en: '<i>Turn off reminders: /napomni стоп</i>',
  },
  subBtnOn: { ru: '🔕 Отключить напоминания', kk: '🔕 Еске салуды өшіру', en: '🔕 Turn off reminders' },
  subBtnOff: { ru: '🔔 Напоминать о дедлайнах', kk: '🔔 Мерзімдерді еске салу', en: '🔔 Remind me of deadlines' },
  subDone: {
    ru: '🔔 Готово — напомню за 7 и за 1 день до сдачи.\nБлижайшие сроки: /dedlayny · Отключить: /napomni стоп',
    kk: '🔔 Дайын — тапсыруға 7 және 1 күн қалғанда еске саламын.\nЖақын мерзімдер: /dedlayny · Өшіру: /napomni стоп',
    en: "🔔 Done — I'll remind you 7 and 1 day before filing.\nUpcoming: /dedlayny · Turn off: /napomni стоп",
  },
  unsubDone: {
    ru: 'Отключил напоминания о дедлайнах. Включить снова: /napomni',
    kk: 'Мерзімдер туралы еске салуды өшірдім. Қайта қосу: /napomni',
    en: 'Turned off deadline reminders. Turn back on: /napomni',
  },
  remOn: { ru: 'Напоминания включены 🔔', kk: 'Еске салу қосылды 🔔', en: 'Reminders on 🔔' },
  remOff: { ru: 'Напоминания отключены', kk: 'Еске салу өшірілді', en: 'Reminders off' },
} satisfies Record<string, unknown>;

// ── Ссылка на статью в списке источников ───────────────────────────────────
/** «726» → «Ст. 726» (ru) · «726-бап» (kk) · «Art. 726» (en). */
export function artRef(article: string, lang: Lang = 'ru'): string {
  if (lang === 'kk') return `${article}-бап`;
  if (lang === 'en') return `Art. ${article}`;
  return `Ст. ${article}`;
}

// ── Обёртка ответа поиска (сам ответ LLM — уже на языке пользователя) ───────
export const SEARCH_UI = {
  fragmentsHeader: {
    ru: '🔎 <b>Вот что говорит НК РК-2026:</b>',
    kk: '🔎 <b>ҚР СК-2026 не дейді:</b>',
    en: '🔎 <b>Here is what the 2026 Tax Code says:</b>',
  },
  openArticle: {
    ru: 'Открыть статью на adilet.zan.kz',
    kk: 'adilet.zan.kz сайтында ашу',
    en: 'Open the article on adilet.zan.kz',
  },
  fragmentsFooter: {
    ru: '<i>Это дословные фрагменты кодекса, найденные по твоему вопросу, — не готовый совет. Подбор режима — /start.</i>',
    kk: '<i>Бұл сұрағың бойынша табылған кодекстің дәлме-дәл үзінділері — дайын кеңес емес. Режим таңдау — /start.</i>',
    en: '<i>These are verbatim fragments of the code found for your question — not ready-made advice. Regime wizard — /start.</i>',
  },
  sourcesHeader: {
    ru: '<b>Источники (проверь сам):</b>',
    kk: '<b>Дереккөздер (өзің тексер):</b>',
    en: '<b>Sources (verify yourself):</b>',
  },
  answerDisclaimer: {
    ru: '<i>Ответ составлен по приведённым статьям НК РК-2026 и не является налоговой консультацией.</i>',
    kk: '<i>Жауап көрсетілген ҚР СК-2026 баптары бойынша жасалған және салықтық кеңес емес.</i>',
    en: '<i>The answer is based on the cited articles of the 2026 Tax Code and is not tax advice.</i>',
  },
} satisfies Record<string, Record<Lang, string>>;

/** Бейдж «ставки сверены» — когда каждая ставка в ответе есть в тексте статей (F1). */
export const VERIFIED_BADGE: Record<Lang, string> = {
  ru: '✅ Ставки в ответе сверены с текстом кодекса.',
  kk: '✅ Жауаптағы мөлшерлемелер кодекс мәтінімен тексерілді.',
  en: '✅ The rates in this answer are verified against the code text.',
};

// ── Фактчекер «Проверь ответ ChatGPT» (Q5 — прямой ответ на «зачем не ГПТ») ──
/** Текст-приглашение вставить ответ ИИ (он же — маркер force_reply). */
export const FACTCHECK_PROMPT: Record<Lang, string> = {
  ru: '🔍 Вставь ответ ChatGPT (или любого ИИ) про налоги — я сверю каждую цифру и статью с кодексом и покажу, где он ошибся.\n\n👉 Ответь на это сообщение текстом ответа.',
  kk: '🔍 Салық туралы ChatGPT (немесе кез келген ЖИ) жауабын қой — әр санды кодекспен салыстырып, қателерін көрсетемін.\n\n👉 Осы хабарламаға жауап ретінде мәтінді жіберіңіз.',
  en: '🔍 Paste a ChatGPT (or any AI) answer about taxes — I\'ll check every number and article against the code and show where it\'s wrong.\n\n👉 Reply to this message with the answer text.',
};
export const FACTCHECK_TITLE: Record<Lang, string> = {
  ru: '🔍 <b>Проверка по НК РК-2026:</b>',
  kk: '🔍 <b>ҚР СК-2026 бойынша тексеру:</b>',
  en: '🔍 <b>Checked against the 2026 Tax Code:</b>',
};
export const FACTCHECK_NOCODE: Record<Lang, string> = {
  ru: '🤷 В моих разделах кодекса не нашлось того, что нужно, чтобы честно проверить этот текст. Не берусь судить наугад — уточни у КГД (1414) или бухгалтера.',
  kk: '🤷 Бұл мәтінді адал тексеру үшін қажет нәрсе менің бөлімдерімде табылмады. Кездейсоқ айтпаймын — МКК (1414) не бухгалтерден нақтылаңыз.',
  en: "🤷 My sections of the code don't have what's needed to honestly check this text. I won't guess — check with the tax office (1414) or an accountant.",
};
export const FACTCHECK_DISCLAIMER: Record<Lang, string> = {
  ru: '<i>Проверка по приведённым статьям НК РК-2026. «⚠️ не могу проверить» = темы нет в моих разделах, а не «неверно».</i>',
  kk: '<i>Тексеру көрсетілген ҚР СК-2026 баптары бойынша. «⚠️ тексере алмаймын» = тақырып бөлімдерімде жоқ, «қате» дегенді білдірмейді.</i>',
  en: '<i>Checked against the cited 2026 Tax Code articles. «⚠️ can\'t verify» means the topic isn\'t in my sections, not «wrong».</i>',
};

// ── Форма 910 (сезонный магнит) ────────────────────────────────────────────
type Lnk = string; // готовая HTML-ссылка на статью

export const FORM910 = {
  title: {
    ru: '📋 <b>Форма 910 — упрощённая декларация</b>',
    kk: '📋 <b>910-нысан — оңайлатылған декларация</b>',
    en: '📋 <b>Form 910 — simplified declaration</b>',
  },
  who: {
    ru: '<b>Кто сдаёт:</b> ИП и ТОО на упрощёнке (СНР на основе упрощённой декларации).',
    kk: '<b>Кім тапсырады:</b> оңайлатылғандағы ЖК мен ЖШС (оңайлатылған декларация негізіндегі АСР).',
    en: '<b>Who files:</b> sole proprietors and LLPs on the simplified regime.',
  },
  deadlinesTitle: {
    ru: (l: Lnk) => `<b>Сроки за 1-е полугодие 2026</b> (${l}):`,
    kk: (l: Lnk) => `<b>2026 жылдың 1-жартыжылдығы мерзімдері</b> (${l}):`,
    en: (l: Lnk) => `<b>Deadlines for H1 2026</b> (${l}):`,
  },
  submitBy: {
    ru: '• Сдать декларацию — до <b>15 августа</b>',
    kk: '• Декларацияны тапсыру — <b>15 тамызға</b> дейін',
    en: '• File the declaration — by <b>15 August</b>',
  },
  payBy: {
    ru: '• Уплатить налог — до <b>25 августа</b>',
    kk: '• Салықты төлеу — <b>25 тамызға</b> дейін',
    en: '• Pay the tax — by <b>25 August</b>',
  },
  weekendNote: {
    ru: '<i>Выпадает на выходной — переносится на ближайший рабочий день.</i>',
    kk: '<i>Демалысқа сәйкес келсе — келесі жұмыс күніне ауысады.</i>',
    en: '<i>If it falls on a weekend, it moves to the next business day.</i>',
  },
  howMuch: { ru: '<b>Сколько платить:</b>', kk: '<b>Қанша төлеу керек:</b>', en: '<b>How much to pay:</b>' },
  rateSimplified: {
    ru: (l: Lnk) => `• Упрощёнка: <b>4% от оборота</b> (${l}). Акимат может менять ставку ±50%.`,
    kk: (l: Lnk) => `• Оңайлатылған: <b>айналымнан 4%</b> (${l}). Әкімдік мөлшерлемені ±50% өзгерте алады.`,
    en: (l: Lnk) => `• Simplified: <b>4% of turnover</b> (${l}). The local authority may change the rate by ±50%.`,
  },
  rateSelfEmployed: {
    ru: (l: Lnk) => `• Самозанятый: ИПН <b>0%</b> (${l}) — только соцплатежи через приложение e-Salyq.`,
    kk: (l: Lnk) => `• Өзін-өзі жұмыспен қамтыған: ЖТС <b>0%</b> (${l}) — тек e-Salyq арқылы әлеуметтік төлемдер.`,
    en: (l: Lnk) => `• Self-employed: income tax <b>0%</b> (${l}) — only social payments via the e-Salyq app.`,
  },
  estimateTitle: {
    ru: '<b>Твоя прикидка</b> (из трекера, оборот за 2026):',
    kk: '<b>Сенің болжамың</b> (трекерден, 2026 айналымы):',
    en: '<b>Your estimate</b> (from the tracker, 2026 turnover):',
  },
  estimateLine: {
    ru: (t: string, tax: string) => `Оборот ${t} → налог по упрощёнке 4% ≈ <b>${tax}</b> за год.`,
    kk: (t: string, tax: string) => `Айналым ${t} → оңайлатылған 4% салық ≈ жылына <b>${tax}</b>.`,
    en: (t: string, tax: string) => `Turnover ${t} → simplified 4% tax ≈ <b>${tax}</b> per year.`,
  },
  estimateNote: {
    ru: '<i>Форма 910 — за полугодие; это годовой ориентир, точную сумму бери за отчётный период.</i>',
    kk: '<i>910-нысан — жартыжылдыққа; бұл жылдық бағдар, нақты соманы есепті кезеңге ал.</i>',
    en: '<i>Form 910 is per half-year; this is an annual guide — take the exact amount for the reporting period.</i>',
  },
  exampleLine: {
    ru: (t: string, tax: string) => `<b>Пример:</b> при обороте ${t} налог по упрощёнке 4% = ${tax}.`,
    kk: (t: string, tax: string) => `<b>Мысал:</b> айналым ${t} болса, оңайлатылған 4% салық = ${tax}.`,
    en: (t: string, tax: string) => `<b>Example:</b> with turnover ${t}, the simplified 4% tax = ${tax}.`,
  },
  exampleNote: {
    ru: '<i>Записывай доход (просто напиши сумму) — посчитаю по твоим цифрам.</i>',
    kk: '<i>Табысты жаз (жай ғана соманы жаз) — сенің цифрларың бойынша есептеймін.</i>',
    en: '<i>Log your income (just type the amount) — I will calculate from your numbers.</i>',
  },
  where: {
    ru: '<b>Где сдать:</b> приложение <b>e-Salyq Business</b> или кабинет налогоплательщика; оплата — Kaspi/банк.',
    kk: '<b>Қайда тапсыру:</b> <b>e-Salyq Business</b> қосымшасы немесе салық төлеуші кабинеті; төлем — Kaspi/банк.',
    en: '<b>Where to file:</b> the <b>e-Salyq Business</b> app or the taxpayer cabinet; payment via Kaspi/bank.',
  },
  footer: {
    ru: '<i>Ориентир, не бухучёт. Точные цифры — по декларации и/или с бухгалтером. Вопросы — КГД 1414.</i>',
    kk: '<i>Бағдар, бухгалтерия емес. Нақты цифрлар — декларация бойынша және/немесе бухгалтермен. Сұрақтар — МКК 1414.</i>',
    en: '<i>Guidance, not bookkeeping. Exact figures come from the declaration and/or an accountant. Questions — tax office 1414.</i>',
  },
} satisfies Record<string, unknown>;

// ── Ежемесячная сводка оборота (retention-пуш, 1-го числа по Алматы) ────────
export const MONTHLY_SUMMARY = {
  header: {
    ru: (m: string) => `📊 <b>Итог за ${m}</b>`,
    kk: (m: string) => `📊 <b>${m} қорытындысы</b>`,
    en: (m: string) => `📊 <b>${m} summary</b>`,
  },
  body: {
    ru: (mt: Amt, yt: Amt) => `Оборот за месяц: <b>${mt}</b>\nС начала года: <b>${yt}</b>`,
    kk: (mt: Amt, yt: Amt) => `Айлық айналым: <b>${mt}</b>\nЖыл басынан: <b>${yt}</b>`,
    en: (mt: Amt, yt: Amt) => `Turnover for the month: <b>${mt}</b>\nSince the start of the year: <b>${yt}</b>`,
  },
  optOut: {
    ru: '<i>Это ежемесячная сводка. Отключить проактивные сообщения: /napomni стоп</i>',
    kk: '<i>Бұл айлық қорытынды. Проактивті хабарламаларды өшіру: /napomni стоп</i>',
    en: '<i>This is a monthly summary. Turn off proactive messages: /napomni стоп</i>',
  },
} satisfies Record<string, Record<Lang, unknown>>;

// ── Калькулятор НДС (ставка 16% — Ст.503; живая витрина рва свежести) ───────
export const VAT_CALC = {
  title: {
    ru: (a: Amt) => `🧾 <b>НДС с суммы ${a}</b> (ставка 16%)`,
    kk: (a: Amt) => `🧾 <b>${a} сомасынан ҚҚС</b> (мөлшерлеме 16%)`,
    en: (a: Amt) => `🧾 <b>VAT on ${a}</b> (rate 16%)`,
  },
  onTop: {
    ru: (vat: Amt, gross: Amt) => `• Начислить сверху: +<b>${vat}</b> → итого <b>${gross}</b>`,
    kk: (vat: Amt, gross: Amt) => `• Үстіне қосу: +<b>${vat}</b> → барлығы <b>${gross}</b>`,
    en: (vat: Amt, gross: Amt) => `• Add on top: +<b>${vat}</b> → total <b>${gross}</b>`,
  },
  included: {
    ru: (vat: Amt, net: Amt) => `• Выделить из суммы: НДС <b>${vat}</b> (без НДС <b>${net}</b>)`,
    kk: (vat: Amt, net: Amt) => `• Сомадан бөлу: ҚҚС <b>${vat}</b> (ҚҚС-сыз <b>${net}</b>)`,
    en: (vat: Amt, net: Amt) => `• Extract from amount: VAT <b>${vat}</b> (net <b>${net}</b>)`,
  },
  rateNote: {
    ru: (art: string) => `16% — общая ставка (${art} п.1). Для отдельных случаев есть льготные 5% / 10% — проверь, попадаешь ли ты под них.`,
    kk: (art: string) => `16% — жалпы мөлшерлеме (${art} 1-т.). Жекелеген жағдайларда жеңілдікті 5% / 10% бар — оларға жататыныңды тексер.`,
    en: (art: string) => `16% is the general rate (${art} §1). Reduced 5% / 10% rates exist for specific cases — check whether you qualify.`,
  },
  gptNote: {
    ru: '<i>Обычный ИИ часто называет старые 12% — с 2026 общая ставка 16%.</i>',
    kk: '<i>Кәдімгі ЖИ жиі ескі 12% дейді — 2026 жылдан жалпы мөлшерлеме 16%.</i>',
    en: '<i>General AI often says the old 12% — since 2026 the general rate is 16%.</i>',
  },
} satisfies Record<string, Record<Lang, unknown>>;

// ── «Сколько отложить с дохода» (упрощёнка 4% Ст.726 / самозанятый 0% Ст.720) ─
export const SET_ASIDE = {
  title: {
    ru: (a: Amt) => `🐷 <b>Сколько отложить с ${a}</b>`,
    kk: (a: Amt) => `🐷 <b>${a} сомасынан қанша бөлу керек</b>`,
    en: (a: Amt) => `🐷 <b>How much to set aside from ${a}</b>`,
  },
  simplified: {
    ru: (t: Amt, art: string) => `• На упрощёнке (4%, ${art}): отложи <b>${t}</b>`,
    kk: (t: Amt, art: string) => `• Оңайлатылғанда (4%, ${art}): <b>${t}</b> бөл`,
    en: (t: Amt, art: string) => `• On the simplified regime (4%, ${art}): set aside <b>${t}</b>`,
  },
  selfEmployed: {
    ru: (art: string) => `• Самозанятый: ИПН <b>0%</b> (${art}). Соцплатежи считает приложение e-Salyq (их размер — в Соцкодексе, не в НК).`,
    kk: (art: string) => `• Өзін-өзі жұмыспен қамтыған: ЖТС <b>0%</b> (${art}). Әлеуметтік төлемдерді e-Salyq есептейді (олардың мөлшері — Әлеуметтік кодексте, НК-де емес).`,
    en: (art: string) => `• Self-employed: income tax <b>0%</b> (${art}). Social payments are computed by the e-Salyq app (their size is in the Social Code, not the Tax Code).`,
  },
  note: {
    ru: '<i>Не знаю твой режим — показал оба. Точную сумму бери за отчётный период. Не уверен в режиме — нажми «🧮 Какой режим мне».</i>',
    kk: '<i>Режиміңді білмеймін — екеуін де көрсеттім. Нақты соманы есепті кезеңге ал. Режимге сенімді болмасаң — «🧮 Қай режим маған».</i>',
    en: '<i>I don\'t know your regime — showed both. Take the exact amount for the reporting period. Unsure of your regime — tap «🧮 My tax regime».</i>',
  },
} satisfies Record<string, Record<Lang, unknown>>;

/** Приветствие пришедшего с лендинга за формой 910 (deep-link ?start=site910). */
export const DEEPLINK_910: Record<Lang, string> = {
  ru: 'Ты пришёл(ла) за формой 910 — вот всё по ней 👇',
  kk: '910-нысан үшін келдің — міне, бәрі осында 👇',
  en: 'You came for Form 910 — here it is 👇',
};

/** Пришёл по ссылке бухгалтера (deep-link ?start=acc_<handle>) — B3 партнёрка. */
export const PARTNER_WELCOME: Record<Lang, string> = {
  ru: '🤝 Тебя направил твой бухгалтер. Я — для быстрых вопросов и расчётов по кодексу (со ссылками на статьи). Сложное и спорное решай со своим бухгалтером — я его не заменяю.',
  kk: '🤝 Сені бухгалтерің жіберді. Мен — кодекс бойынша жылдам сұрақтар мен есептеулерге (бап сілтемелерімен). Күрделі мәселелерді бухгалтеріңмен шеш — мен оны алмастырмаймын.',
  en: '🤝 Your accountant sent you here. I\'m for quick questions and calculations from the code (with article links). Take complex or disputed matters to your accountant — I don\'t replace them.',
};

// ── Кнопки под результатом: поделиться (Q6, рост) и напомнить про 910 (F3) ──
export const SHARE_BTN: Record<Lang, string> = {
  ru: '📤 Переслать другу-ИП',
  kk: '📤 ЖК досыңа жіберу',
  en: '📤 Share with a fellow SP',
};
/** Текст, который подставится в диалог пересылки Telegram. */
export const SHARE_TEXT: Record<Lang, string> = {
  ru: 'Считаю налоги по Налоговому кодексу-2026 в этом боте — отвечает цитатами из закона, бесплатно 👇',
  kk: 'Осы ботпен 2026 Салық кодексі бойынша салық санаймын — заң дәйексөздерімен жауап береді, тегін 👇',
  en: "I do my taxes with this bot per the 2026 Tax Code — it answers with citations from the law, free 👇",
};
export const REMIND910_BTN: Record<Lang, string> = {
  ru: '🔔 Напомнить про сроки 910',
  kk: '🔔 910 мерзімін еске салу',
  en: '🔔 Remind me of the 910 dates',
};

// ── «Моя налоговая карточка» (B1) — режим+лимит+дедлайн+налог в одном экране ──
/** Короткие названия режимов (только имена, не юр-условия — их локализуем позже). */
export const REGIME_NAME: Record<string, Record<Lang, string>> = {
  self_employed: { ru: 'Самозанятый', kk: 'Өзін-өзі жұмыспен қамтыған', en: 'Self-employed' },
  simplified: { ru: 'Упрощёнка', kk: 'Оңайлатылған', en: 'Simplified' },
  general: { ru: 'Общеустановленный', kk: 'Жалпыға белгіленген', en: 'General regime' },
};

export const CARD = {
  title: { ru: '📇 <b>Твоя налоговая карточка</b>', kk: '📇 <b>Сенің салық картаң</b>', en: '📇 <b>Your tax card</b>' },
  regime: {
    ru: (n: string) => `<b>Режим:</b> ${n}`,
    kk: (n: string) => `<b>Режим:</b> ${n}`,
    en: (n: string) => `<b>Regime:</b> ${n}`,
  },
  noRegime: {
    ru: 'Сначала подбери режим — нажми «🧮 Какой режим мне», и карточка соберётся под тебя.',
    kk: 'Алдымен режим таңда — «🧮 Қай режим маған» бас, сонда карта саған жиналады.',
    en: 'Pick a regime first — tap «🧮 My tax regime», and the card will be tailored to you.',
  },
  limitLine: {
    ru: (label: string, pct: number, total: string, limit: string) =>
      `<b>${label}:</b> ${pct}% — ${total} из ${limit}`,
    kk: (label: string, pct: number, total: string, limit: string) =>
      `<b>${label}:</b> ${pct}% — ${total} / ${limit}`,
    en: (label: string, pct: number, total: string, limit: string) =>
      `<b>${label}:</b> ${pct}% — ${total} of ${limit}`,
  },
  limitLabelSE: { ru: 'Лимит месяца (самозанятый)', kk: 'Ай шегі', en: 'Monthly limit' },
  limitLabelVat: { ru: 'Порог НДС за год', kk: 'ҚҚС шегі (жыл)', en: 'VAT threshold (year)' },
  deadline: {
    ru: (title: string, when: string) => `<b>Ближайший срок:</b> ${title} — ${when}`,
    kk: (title: string, when: string) => `<b>Жақын мерзім:</b> ${title} — ${when}`,
    en: (title: string, when: string) => `<b>Next deadline:</b> ${title} — ${when}`,
  },
  taxSE: {
    ru: '<b>Налог:</b> ИПН 0% (Ст. 720) + соцплатежи через e-Salyq (вне НК)',
    kk: '<b>Салық:</b> ЖТС 0% (720-бап) + e-Salyq арқылы әлеуметтік төлемдер (НК-ден тыс)',
    en: '<b>Tax:</b> income tax 0% (Art. 720) + social payments via e-Salyq (outside the code)',
  },
  taxSimp: {
    ru: (tax: string) => `<b>Налог (прикидка):</b> 4% ≈ ${tax} за год (Ст. 726)`,
    kk: (tax: string) => `<b>Салық (болжам):</b> жылына 4% ≈ ${tax} (726-бап)`,
    en: (tax: string) => `<b>Tax (estimate):</b> 4% ≈ ${tax} per year (Art. 726)`,
  },
  taxGen: {
    ru: '<b>Налог:</b> ИПН/КПН по общим правилам с чистого дохода',
    kk: '<b>Салық:</b> таза табыстан ЖТС/КТС жалпы ережемен',
    en: '<b>Tax:</b> income/corporate tax under the general rules on net income',
  },
  footer: {
    ru: '<i>Собрано из твоих данных и статей НК РК-2026. Обнови оборот суммой в чате, режим — «🧮 Какой режим мне». Ориентир, не бухучёт.</i>',
    kk: '<i>Сенің деректерің мен ҚР СК-2026 баптарынан жиналды. Айналымды чатта сомамен жаңарт, режимді — «🧮 Қай режим маған». Бағдар, бухгалтерия емес.</i>',
    en: '<i>Assembled from your data and 2026 Tax Code articles. Update turnover by typing a sum, regime via «🧮 My tax regime». Guidance, not bookkeeping.</i>',
  },
  cardBtn: { ru: '📇 Моя карточка', kk: '📇 Менің картам', en: '📇 My card' },
} satisfies Record<string, unknown>;
