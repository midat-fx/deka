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
    '💬 Отвечать на вопросы по кодексу — просто напиши вопрос\n\n' +
    '<i>Это ориентир, а не налоговая консультация.</i>',
  kk:
    '👋 Сәлем! Мен — <b>Deka</b>, Қазақстандағы ЖК мен өзін-өзі жұмыспен қамтығандарға <b>2026 салық кодексі</b> бойынша көмектесемін. Бастапқы дереккөзге сүйеніп, баптарға сілтемемен жауап беремін. Бейресми көмекші.\n\n' +
    '<b>Не істей аламын</b> — төмендегі мәзір батырмалары 👇\n' +
    '🧮 Салық режимін таңдау\n' +
    '📊 Айналым мен шектерді бақылау\n' +
    '📅 Мерзімдерді еске салу\n' +
    '💬 Кодекс бойынша сұрақтарға жауап — жай ғана жазыңыз\n\n' +
    '<i>Бұл бағдар, салықтық кеңес емес.</i>',
  en:
    "👋 Hi! I'm <b>Deka</b> — I help Kazakhstan's sole proprietors and self-employed navigate the <b>2026 Tax Code</b>. Answers come from the official text with article references. Unofficial assistant, not affiliated with the tax authority.\n\n" +
    '<b>What I can do</b> — use the menu buttons below 👇\n' +
    '🧮 Pick your tax regime\n' +
    '📊 Track turnover against limits\n' +
    '📅 Remind about deadlines\n' +
    '💬 Answer questions about the code — just type your question\n\n' +
    '<i>Guidance only, not tax advice.</i>',
};

export const HELP: Record<Lang, string> = {
  ru:
    'Пользуйся кнопками меню внизу экрана — или просто пиши по-человечески:\n' +
    '• «какой режим мне подходит» — подбор режима\n' +
    '• «заработал 500 тысяч» — запишу доход и сверю с лимитами\n' +
    '• «дедлайны» — сроки и напоминания\n' +
    '• «переключи на казахский / english» — сменю язык\n' +
    '• Любой вопрос по налогам — найду ответ в кодексе со ссылками на статьи.',
  kk:
    'Экранның астындағы мәзір батырмаларын қолданыңыз — немесе жай ғана жазыңыз:\n' +
    '• «маған қай режим келеді» — режим таңдау\n' +
    '• «500 мың таптым» — табысты жазып, шектермен салыстырамын\n' +
    '• «мерзімдер» — мерзімдер мен еске салулар\n' +
    '• «орысша сөйле / english» — тілді ауыстырамын\n' +
    '• Салық туралы кез келген сұрақ — кодекстен баптарға сілтемемен жауап табамын.',
  en:
    'Use the menu buttons at the bottom — or just type naturally:\n' +
    '• "which regime fits me" — regime wizard\n' +
    '• "earned 500000" — I will log income and check limits\n' +
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
