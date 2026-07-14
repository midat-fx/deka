/**
 * Переводы маркетинговой части лендинга (ru/kk/en).
 *
 * Юридические формулировки (ставки, статьи, 910) взяты из ПРОВЕРЕННЫХ строк
 * бота (src/i18n/i18n.ts FORM910/TURNOVER_ALERTS) — цифры и номера статей
 * везде одинаковые. Калькулятор режима остаётся на русском (как и в боте) —
 * прескриптивные правила локализуем только после проверки носителем.
 *
 * html:true — строка содержит нашу собственную разметку (<b>/<a>), вставляется
 * через innerHTML. Пользовательского ввода тут нет.
 */
export type LandingLang = 'ru' | 'kk' | 'en';

export const LANDING_LANGS: LandingLang[] = ['ru', 'kk', 'en'];

export function detectLandingLang(): LandingLang {
  const saved = localStorage.getItem('deka-lang');
  if (saved === 'ru' || saved === 'kk' || saved === 'en') return saved;
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('kk')) return 'kk';
  if (nav.startsWith('en')) return 'en';
  return 'ru';
}

type Entry = Record<LandingLang, string>;

export const T: Record<string, Entry> = {
  // — Шапка —
  'nav.open': { ru: 'Открыть бота', kk: 'Ботты ашу', en: 'Open the bot' },

  // — Hero —
  'hero.h1': {
    ru: 'Налоговый помощник, который отвечает статьями кодекса — а не догадками',
    kk: 'Кодекс баптарымен жауап беретін салық көмекшісі — болжаммен емес',
    en: 'A tax assistant that answers with the law itself — not guesses',
  },
  'hero.sub': {
    ru: 'Deka помогает ИП и самозанятым Казахстана разобраться в новом Налоговом кодексе-2026: подбор режима, форма 910, лимиты и ответы на вопросы — каждый ответ с цитатой и ссылкой на статью. Бесплатно, в Telegram.',
    kk: 'Deka Қазақстандағы ЖК мен өзін-өзі жұмыспен қамтығандарға жаңа 2026 Салық кодексін түсінуге көмектеседі: режим таңдау, 910-нысан, шектер және сұрақтарға жауап — әр жауап бап сілтемесімен. Тегін, Telegram-да.',
    en: "Deka helps Kazakhstan's sole proprietors and self-employed navigate the 2026 Tax Code: regime wizard, Form 910, limits and Q&A — every answer cites the article. Free, in Telegram.",
  },
  'hero.cta1': { ru: 'Открыть бота в Telegram', kk: 'Telegram-да ботты ашу', en: 'Open the bot in Telegram' },
  'hero.cta2': { ru: 'Посчитать режим здесь ↓', kk: 'Режимді осында есептеу ↓', en: 'Try the wizard here ↓' },
  'chip.1': { ru: '📖 Цитаты из первоисточника', kk: '📖 Дереккөзден дәйексөздер', en: '📖 Cites the primary source' },
  'chip.2': { ru: '🆓 Бесплатно навсегда', kk: '🆓 Мәңгі тегін', en: '🆓 Free forever' },
  'chip.3': { ru: '🌐 Русский · Қазақша · English', kk: '🌐 Қазақша · Русский · English', en: '🌐 English · Русский · Қазақша' },
  'chip.4': { ru: '🔓 Открытый код', kk: '🔓 Ашық код', en: '🔓 Open source' },

  // — Демо-чат в hero —
  'demo.status': { ru: 'бот · отвечает по НК РК-2026', kk: 'бот · ҚР СК-2026 бойынша', en: 'bot · answers per the 2026 Tax Code' },
  'demo.u1': {
    ru: 'Какой лимит дохода у самозанятого?',
    kk: 'Өзін-өзі жұмыспен қамтығанның табыс шегі қандай?',
    en: 'What is the self-employed income limit?',
  },
  'demo.b1': {
    ru: 'Лимит — <b>300 МРП в месяц</b>, в 2026 году это <b>1 297 500 ₸</b>. Выше лимита — упрощёнка или общий режим.',
    kk: 'Шек — <b>айына 300 АЕК</b>, 2026 жылы бұл <b>1 297 500 ₸</b>. Шектен асса — оңайлатылған немесе жалпы режим.',
    en: 'The limit is <b>300 MCI per month</b> — <b>₸1,297,500</b> in 2026. Above it — simplified or general regime.',
  },
  'demo.src1': { ru: '📖 Ст. 718 п. 6 НК РК-2026', kk: '📖 ҚР СК-2026, 718-бап 6-т.', en: '📖 Art. 718 §6, 2026 Tax Code' },
  'demo.u2': { ru: 'А если не найдёшь ответ?', kk: 'Ал жауап таппасаң ше?', en: "And if you can't find the answer?" },
  'demo.b2': {
    ru: 'Честно скажу «не нашёл» и подскажу, где проверить. Никаких выдуманных цифр.',
    kk: '«Таппадым» деп адал айтамын және қайдан тексеруге болатынын көрсетемін. Ойдан шығарылған цифрлар жоқ.',
    en: "I'll honestly say “not found” and point you where to check. No made-up numbers.",
  },

  // — Баннер 910 —
  'banner.txt': {
    ru: '<b>Форма 910</b> за 1-е полугодие — сдать до 15 августа, уплатить до 25 августа 2026.',
    kk: '<b>910-нысан</b>, 1-жартыжылдық — 15 тамызға дейін тапсыру, 25 тамызға дейін төлеу (2026).',
    en: '<b>Form 910</b> for H1 — file by 15 August, pay by 25 August 2026.',
  },
  'banner.link': { ru: 'Что делать →', kk: 'Не істеу керек →', en: 'What to do →' },

  // — Полоса цифр —
  'stats.title': { ru: 'Инженерная честность, а не обещания', kk: 'Уәде емес — инженерлік адалдық', en: 'Engineering honesty, not promises' },
  'stats.1l': { ru: 'точность поиска по кодексу (hit@3)', kk: 'кодекс бойынша іздеу дәлдігі (hit@3)', en: 'code search accuracy (hit@3)' },
  'stats.2l': { ru: 'фрагментов кодекса в базе', kk: 'базадағы кодекс үзінділері', en: 'code fragments indexed' },
  'stats.3l': { ru: 'автотестов на каждый релиз', kk: 'әр релизге автотест', en: 'automated tests per release' },
  'stats.4l': { ru: 'работает в облаке', kk: 'бұлтта жұмыс істейді', en: 'runs in the cloud' },
  'stats.fresh': {
    ru: '🔒 Ответы — по официальному тексту НК РК-2026 с <a href="https://adilet.zan.kz/rus/docs/K2500000214" target="_blank" rel="noopener">adilet.zan.kz</a>, сверено на 12 июля 2026. Обычный ИИ не знает, на какую дату актуальны его знания.',
    kk: '🔒 Жауаптар — <a href="https://adilet.zan.kz/rus/docs/K2500000214" target="_blank" rel="noopener">adilet.zan.kz</a> ресми ҚР СК-2026 мәтіні бойынша, 2026 жылғы 12 шілдеге тексерілген. Кәдімгі ЖИ өз білімі қай күнге өзекті екенін білмейді.',
    en: '🔒 Answers come from the official 2026 Tax Code text on <a href="https://adilet.zan.kz/rus/docs/K2500000214" target="_blank" rel="noopener">adilet.zan.kz</a>, verified as of 12 July 2026. A general AI can\'t tell you the date its knowledge is current.',
  },

  // — Как работает —
  'how.title': { ru: 'Как Deka отвечает', kk: 'Deka қалай жауап береді', en: 'How Deka answers' },
  'how.s1t': { ru: 'Ты спрашиваешь по-человечески', kk: 'Сен қарапайым тілмен сұрайсың', en: 'You ask in plain words' },
  'how.s1p': {
    ru: '«Какая ставка у упрощёнки?», «когда сдавать 910?» — без юридического языка и слэш-команд.',
    kk: '«Оңайлатылғанның мөлшерлемесі қандай?», «910-ды қашан тапсырамын?» — заң тілінсіз, командаларсыз.',
    en: '“What is the simplified rate?”, “when is Form 910 due?” — no legal jargon, no slash commands.',
  },
  'how.s2t': { ru: 'Deka ищет по тексту закона', kk: 'Deka заң мәтінінен іздейді', en: 'Deka searches the law itself' },
  'how.s2p': {
    ru: 'Не по пересказам из интернета, а по официальному тексту НК РК-2026 (998 фрагментов с adilet.zan.kz).',
    kk: 'Интернеттегі қайталаулардан емес, ҚР СК-2026 ресми мәтінінен (adilet.zan.kz, 998 үзінді).',
    en: 'Not internet retellings — the official 2026 Tax Code text (998 fragments from adilet.zan.kz).',
  },
  'how.s3t': { ru: 'Ответ с цитатой — или честное «не нашёл»', kk: 'Дәйексөзді жауап — немесе адал «таппадым»', en: 'An answer with a citation — or an honest “not found”' },
  'how.s3p': {
    ru: 'Каждый ответ ссылается на статью. Если уверенного ответа нет — Deka не выдумывает, а говорит прямо.',
    kk: 'Әр жауап бапқа сілтеме жасайды. Сенімді жауап болмаса — Deka ойдан шығармай, тура айтады.',
    en: "Every answer links to an article. If there's no confident answer, Deka says so instead of inventing one.",
  },

  // — Калькулятор —
  'calc.title': { ru: 'Какой налоговый режим мне подходит?', kk: 'Маған қай салық режимі келеді?', en: 'Which tax regime fits me?' },
  'calc.sub': {
    ru: 'Тот же алгоритм, что в боте: детерминированная логика по лимитам из кодекса, никакого ИИ-гадания.',
    kk: 'Боттағыдай алгоритм: кодекс шектері бойынша детерминирленген логика, ИИ-болжау жоқ.',
    en: 'The same algorithm as the bot: deterministic logic over the code’s limits, no AI guessing.',
  },
  'calc.note': {
    ru: '',
    kk: 'Калькулятор әзірге орыс тілінде — заң тұжырымдарын тексерілгеннен кейін аударамыз. Ботта негізгі функциялар қазақша істейді.',
    en: 'The wizard is in Russian for now — legal wording gets translated only after native review. The bot’s core features already work in English.',
  },

  // — Форма 910 —
  'f910.title': { ru: 'Форма 910 за 1-е полугодие 2026 — что нужно знать', kk: '2026 жылдың 1-жартыжылдығына 910-нысан — не білу керек', en: 'Form 910 for H1 2026 — what to know' },
  'f910.r1l': { ru: 'Кто сдаёт', kk: 'Кім тапсырады', en: 'Who files' },
  'f910.r1v': {
    ru: 'ИП и ТОО на упрощёнке (СНР на основе упрощённой декларации).',
    kk: 'Оңайлатылғандағы ЖК мен ЖШС (оңайлатылған декларация негізіндегі АСР).',
    en: 'Sole proprietors and LLPs on the simplified regime.',
  },
  'f910.r2l': { ru: 'Срок сдачи', kk: 'Тапсыру мерзімі', en: 'Filing deadline' },
  'f910.r2v': {
    ru: '<b>до 15 августа 2026</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11967" target="_blank" rel="noopener">Ст. 727</a>).',
    kk: '<b>2026 жылғы 15 тамызға дейін</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11967" target="_blank" rel="noopener">727-бап</a>).',
    en: '<b>by 15 August 2026</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11967" target="_blank" rel="noopener">Art. 727</a>).',
  },
  'f910.r3l': { ru: 'Срок уплаты', kk: 'Төлеу мерзімі', en: 'Payment deadline' },
  'f910.r3v': { ru: '<b>до 25 августа 2026</b>.', kk: '<b>2026 жылғы 25 тамызға дейін</b>.', en: '<b>by 25 August 2026</b>.' },
  'f910.r4l': { ru: 'Ставка', kk: 'Мөлшерлеме', en: 'Rate' },
  'f910.r4v': {
    ru: 'Упрощёнка — <b>4% от оборота</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11961" target="_blank" rel="noopener">Ст. 726</a>). Самозанятый — ИПН <b>0%</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11830" target="_blank" rel="noopener">Ст. 720</a>), только соцплатежи.',
    kk: 'Оңайлатылған — <b>айналымнан 4%</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11961" target="_blank" rel="noopener">726-бап</a>). Өзін-өзі жұмыспен қамтыған — ЖТС <b>0%</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11830" target="_blank" rel="noopener">720-бап</a>), тек әлеуметтік төлемдер.',
    en: 'Simplified — <b>4% of turnover</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11961" target="_blank" rel="noopener">Art. 726</a>). Self-employed — income tax <b>0%</b> (<a href="https://adilet.zan.kz/rus/docs/K2500000214#z11830" target="_blank" rel="noopener">Art. 720</a>), social payments only.',
  },
  'f910.r5l': { ru: 'Где сдать', kk: 'Қайда тапсыру', en: 'Where to file' },
  'f910.r5v': {
    ru: 'Приложение e-Salyq Business или кабинет налогоплательщика; оплата — Kaspi/банк.',
    kk: 'e-Salyq Business қосымшасы немесе салық төлеуші кабинеті; төлем — Kaspi/банк.',
    en: 'The e-Salyq Business app or the taxpayer cabinet; payment via Kaspi/bank.',
  },
  'f910.cta': {
    ru: 'Deka посчитает твой налог: запиши доход в боте — покажет 4% и близость к лимитам. <a href="https://t.me/deka_tax_bot?start=site910" target="_blank" rel="noopener">Открыть в Telegram →</a>',
    kk: 'Deka салығыңды есептейді: ботта табысты жаз — 4% пен шектерге жақындықты көрсетеді. <a href="https://t.me/deka_tax_bot?start=site910" target="_blank" rel="noopener">Telegram-да ашу →</a>',
    en: 'Deka calculates your tax: log income in the bot — it shows the 4% and how close you are to the limits. <a href="https://t.me/deka_tax_bot?start=site910" target="_blank" rel="noopener">Open in Telegram →</a>',
  },

  // — Возможности —
  'feat.title': { ru: 'Что умеет бот', kk: 'Бот не істей алады', en: 'What the bot can do' },
  'feat.1t': { ru: '💬 Ответы с цитатами', kk: '💬 Дәйексөзді жауаптар', en: '💬 Answers with citations' },
  'feat.1p': {
    ru: 'Любой вопрос по налогам — ответ по тексту НК РК-2026 со ссылкой на статью. Бесплатно навсегда.',
    kk: 'Салық туралы кез келген сұрақ — ҚР СК-2026 мәтіні бойынша, бап сілтемесімен. Мәңгі тегін.',
    en: 'Any tax question — answered from the 2026 Tax Code text with an article link. Free forever.',
  },
  'feat.2t': { ru: '🧮 Подбор режима', kk: '🧮 Режим таңдау', en: '🧮 Regime wizard' },
  'feat.2p': {
    ru: 'Самозанятый, упрощёнка или общий — за 3–4 вопроса, с объяснением почему.',
    kk: 'Өзін-өзі жұмыспен қамту, оңайлатылған немесе жалпы — 3–4 сұрақпен, себебін түсіндіріп.',
    en: 'Self-employed, simplified or general — in 3–4 questions, with the reasons why.',
  },
  'feat.3t': { ru: '📊 Трекер оборота', kk: '📊 Айналым трекері', en: '📊 Turnover tracker' },
  'feat.3p': {
    ru: 'Пиши «заработал 500 000» — бот предупредит до того, как ты пересечёшь лимит НДС или упрощёнки.',
    kk: '«500 000 таптым» деп жаз — бот ҚҚС не оңайлатылған шегінен асқанға ДЕЙІН ескертеді.',
    en: 'Type “earned 500000” — the bot warns you before you cross the VAT or simplified-regime limit.',
  },
  'feat.4t': { ru: '📋 Форма 910', kk: '📋 910-нысан', en: '📋 Form 910' },
  'feat.4p': {
    ru: 'Сроки, ставка 4%, где сдавать — и расчёт налога по твоему реальному обороту.',
    kk: 'Мерзімдер, 4% мөлшерлеме, қайда тапсыру — және нақты айналымың бойынша салық есебі.',
    en: 'Deadlines, the 4% rate, where to file — and tax calculated from your actual turnover.',
  },
  'feat.5t': { ru: '📅 Напоминания', kk: '📅 Еске салулар', en: '📅 Reminders' },
  'feat.5p': {
    ru: 'За 7 и за 1 день до дедлайна + ежемесячная сводка оборота. Отключается одной кнопкой.',
    kk: 'Мерзімге 7 және 1 күн қалғанда + айлық айналым қорытындысы. Бір батырмамен өшіріледі.',
    en: '7 days and 1 day before each deadline + a monthly turnover summary. One tap to turn off.',
  },
  'feat.6t': { ru: '🔒 Приватность', kk: '🔒 Құпиялылық', en: '🔒 Privacy' },
  'feat.6p': {
    ru: 'Вопросы не сохраняются, суммы — анонимно. Команда /privacy удаляет все твои данные.',
    kk: 'Сұрақтар сақталмайды, сомалар — анонимді. /privacy командасы барлық деректеріңді жояды.',
    en: 'Questions are never stored; amounts are anonymous. /privacy deletes all your data.',
  },

  // — FAQ —
  'faq.title': { ru: 'Частые вопросы', kk: 'Жиі қойылатын сұрақтар', en: 'FAQ' },
  'faq.q1': { ru: 'Когда крайний срок формы 910 за 1-е полугодие 2026?', kk: '2026 жылдың 1-жартыжылдығына 910-нысанның соңғы мерзімі қашан?', en: 'When is Form 910 due for H1 2026?' },
  'faq.a1': {
    ru: 'Сдать декларацию — до 15 августа, уплатить налог — до 25 августа 2026 (Ст. 727 НК РК-2026). Если день выпадает на выходной, срок переносится на ближайший рабочий день.',
    kk: 'Декларацияны тапсыру — 15 тамызға дейін, салықты төлеу — 25 тамызға дейін (ҚР СК-2026, 727-бап). Демалысқа сәйкес келсе, мерзім келесі жұмыс күніне ауысады.',
    en: 'File by 15 August, pay by 25 August 2026 (Art. 727). If the date falls on a weekend, it moves to the next business day.',
  },
  'faq.q2': { ru: 'Какая ставка налога на упрощёнке в 2026 году?', kk: '2026 жылы оңайлатылған режимнің мөлшерлемесі қандай?', en: 'What is the simplified-regime rate in 2026?' },
  'faq.a2': {
    ru: '4% от оборота (Ст. 726 НК РК-2026). Местный акимат вправе изменить ставку в пределах ±50%.',
    kk: 'Айналымнан 4% (ҚР СК-2026, 726-бап). Жергілікті әкімдік мөлшерлемені ±50% шегінде өзгерте алады.',
    en: '4% of turnover (Art. 726). The local authority may adjust the rate by ±50%.',
  },
  'faq.q3': { ru: 'Сколько платит самозанятый?', kk: 'Өзін-өзі жұмыспен қамтыған қанша төлейді?', en: 'How much does a self-employed person pay?' },
  'faq.a3': {
    ru: 'ИПН — 0% (Ст. 720). Платятся только социальные платежи, которые рассчитывает приложение e-Salyq.',
    kk: 'ЖТС — 0% (720-бап). Тек e-Salyq қосымшасы есептейтін әлеуметтік төлемдер төленеді.',
    en: 'Income tax — 0% (Art. 720). Only social payments apply, calculated by the e-Salyq app.',
  },
  'faq.q4': { ru: 'Какой лимит дохода у самозанятого?', kk: 'Өзін-өзі жұмыспен қамтығанның табыс шегі қандай?', en: 'What is the self-employed income limit?' },
  'faq.a4': {
    ru: '300 МРП в месяц — 1 297 500 ₸ в 2026 году. Выше лимита — упрощёнка или общий режим. Проверить свой случай можно калькулятором выше или в боте.',
    kk: 'Айына 300 АЕК — 2026 жылы 1 297 500 ₸. Шектен асса — оңайлатылған немесе жалпы режим. Өз жағдайыңды жоғарыдағы калькулятормен немесе ботта тексер.',
    en: '300 MCI per month — ₸1,297,500 in 2026. Above it — simplified or general regime. Check your case with the wizard above or in the bot.',
  },
  'faq.q5': { ru: 'Это бесплатно? В чём подвох?', kk: 'Бұл тегін бе? Қулығы неде?', en: 'Is it free? What’s the catch?' },
  'faq.a5': {
    ru: 'Ответы по кодексу бесплатны и останутся бесплатными — это принцип проекта. Позже могут появиться платные удобства (выгрузки, персональные напоминания), но базовая помощь — нет.',
    kk: 'Кодекс бойынша жауаптар тегін және тегін болып қалады — бұл жобаның қағидасы. Кейін ақылы ыңғайлылықтар шығуы мүмкін, бірақ негізгі көмек — ешқашан.',
    en: 'Code answers are free and will stay free — that’s the project’s principle. Paid conveniences may appear later, but the core help won’t be paywalled.',
  },
  'faq.q6': { ru: 'Deka — это официальный сервис налоговой?', kk: 'Deka — салық қызметінің ресми сервисі ме?', en: 'Is Deka an official tax-authority service?' },
  'faq.a6': {
    ru: 'Нет. Deka — независимый помощник-ориентир, не связан с КГД. Он показывает, что написано в законе, и даёт ссылки на официальный текст. Финальные решения — по декларации и/или с бухгалтером, вопросы — КГД 1414.',
    kk: 'Жоқ. Deka — тәуелсіз көмекші-бағдар, МКК-мен байланысты емес. Ол заңда не жазылғанын көрсетіп, ресми мәтінге сілтеме береді. Түпкі шешімдер — декларация бойынша және/немесе бухгалтермен, сұрақтар — МКК 1414.',
    en: 'No. Deka is an independent guide, not affiliated with the tax authority. It shows what the law says and links to the official text. Final decisions — via your declaration and/or an accountant; questions — call 1414.',
  },

  // — Финальный CTA —
  'cta.title': { ru: 'Попробуй прямо сейчас — это 10 секунд', kk: 'Дәл қазір байқап көр — бар болғаны 10 секунд', en: 'Try it now — it takes 10 seconds' },
  'cta.sub': {
    ru: 'Открой бота, нажми «Старт» и задай свой вопрос — или просто напиши «заработал 500 000».',
    kk: 'Ботты аш, «Старт» бас та, сұрағыңды қой — немесе жай ғана «500 000 таптым» деп жаз.',
    en: 'Open the bot, hit “Start” and ask your question — or just type “earned 500000”.',
  },
  'cta.btn': { ru: 'Открыть @deka_tax_bot', kk: '@deka_tax_bot ашу', en: 'Open @deka_tax_bot' },

  // — Футер —
  'foot.p1': {
    ru: 'Deka — неофициальный помощник. Не связан с КГД МФ РК. Это ориентир, а не налоговая консультация: итоговые решения принимай по тексту НК РК-2026 и/или с бухгалтером.',
    kk: 'Deka — бейресми көмекші. ҚР ҚМ МКК-мен байланысты емес. Бұл бағдар, салықтық кеңес емес: түпкі шешімдерді ҚР СК-2026 мәтіні бойынша және/немесе бухгалтермен қабылда.',
    en: 'Deka is an unofficial assistant, not affiliated with the tax authority. Guidance only, not tax advice: make final decisions per the 2026 Tax Code text and/or with an accountant.',
  },
};

/** Единицы обратного отсчёта до 15.08. */
export const CD = {
  days: { ru: 'дн.', kk: 'күн', en: 'days' } as Entry,
  today: { ru: 'сегодня!', kk: 'бүгін!', en: 'today!' } as Entry,
  prefix: { ru: 'до сдачи 910', kk: '910 тапсыруға', en: 'until 910 is due' } as Entry,
};
