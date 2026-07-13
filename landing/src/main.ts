/**
 * Лендинг: калькулятор режима + i18n маркетинговой части + мелкий UI.
 * Калькулятор использует ТО ЖЕ ядро, что и Telegram-бот: src/domain/flow.ts
 * (вопросы) и src/domain/wizard.ts (рекомендация). Ноль дублированной логики.
 */
import { nextStep, applyAnswer, type FlowStep } from '../../src/domain/flow';
import { recommendRegime, type WizardAnswers } from '../../src/domain/wizard';
import { REGIMES } from '../../src/domain/regimes';
import { T, CD, detectLandingLang, LANDING_LANGS, type LandingLang } from './i18n';

// ── i18n: переводим data-i18n/-html узлы, помним выбор, обновляем <html lang> ──
let lang: LandingLang = detectLandingLang();

function applyLang(next: LandingLang): void {
  lang = next;
  localStorage.setItem('deka-lang', next);
  document.documentElement.lang = next;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((n) => {
    const e = T[n.dataset.i18n!];
    if (e) n.textContent = e[next];
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((n) => {
    const e = T[n.dataset.i18nHtml!];
    if (e) n.innerHTML = e[next]; // строки — только наши литералы из i18n.ts
  });
  // Кнопки-переключатели: подсветка активного.
  document.querySelectorAll<HTMLButtonElement>('#langs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === next);
  });
  // Заметка «калькулятор пока на русском» для kk/en.
  const note = document.getElementById('calcNote');
  if (note) {
    const text = T['calc.note']![next];
    note.textContent = text;
    note.classList.toggle('show', text.length > 0);
  }
  renderCountdown();
}

document.querySelectorAll<HTMLButtonElement>('#langs button').forEach((b) => {
  b.addEventListener('click', () => {
    const next = b.dataset.lang as LandingLang;
    if (LANDING_LANGS.includes(next)) applyLang(next);
  });
});

// ── Обратный отсчёт до сдачи формы 910 (15.08.2026) ──
function renderCountdown(): void {
  const el = document.getElementById('cd910');
  if (!el) return;
  const days = Math.ceil((Date.UTC(2026, 7, 15) - Date.now()) / 86_400_000);
  if (days > 0) el.textContent = `⏳ ${days} ${CD.days[lang]} ${CD.prefix[lang]}`;
  else if (days === 0) el.textContent = `⏳ ${CD.today[lang]}`;
  else el.textContent = '📋 910';
}

// ── Мягкое появление секций: стаггер на загрузке, без IntersectionObserver.
// Детерминировано и не зависит от скролла: контент гарантированно виден
// (CSS прячет .reveal только при html.js, т.е. при работающем скрипте).
document.querySelectorAll('.reveal').forEach((n, i) => {
  setTimeout(() => n.classList.add('in'), 80 + i * 55);
});

const root = document.getElementById('calc');
if (!root) throw new Error('#calc not found');

let answers: Partial<WizardAnswers> = {};

const STATUS_LABEL: Record<string, string> = {
  recommended: '✅ Рекомендуем',
  eligible: '▫️ Доступен',
  needs_check: '🔎 Нужна проверка',
  not_eligible: '✖️ Не подходит',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderStep(step: FlowStep): void {
  root!.replaceChildren();
  root!.append(el('p', 'step-label', `Шаг ${step.step} из 4`));
  root!.append(el('p', 'question', step.question));
  if (step.hint) root!.append(el('p', 'hint', step.hint));

  const box = el('div', 'options');
  for (const opt of step.options) {
    const b = el('button', 'opt', opt.label);
    b.addEventListener('click', () => {
      applyAnswer(answers, step.field, opt.code);
      render();
    });
    box.append(b);
  }
  root!.append(box);

  if (step.linkOut) {
    const a = el('a', 'linkout', step.linkOut.label);
    a.href = step.linkOut.url;
    a.target = '_blank';
    a.rel = 'noopener';
    root!.append(a);
  }

  if (step.step > 1) root!.append(restartButton());
}

function renderResult(): void {
  const rec = recommendRegime(answers as WizardAnswers);
  root!.replaceChildren();
  root!.append(el('p', 'headline', rec.headline));

  for (const e of rec.eligibility) {
    const r = REGIMES[e.regime];
    const card = el('div', `regime st-${e.status}`);
    card.append(el('b', undefined, `${STATUS_LABEL[e.status] ?? ''} · ${r.name}`));
    if (e.status === 'recommended') card.append(el('p', undefined, r.rateSummary));
    const ul = el('ul');
    for (const reason of e.reasons) ul.append(el('li', undefined, reason));
    card.append(ul);
    root!.append(card);
  }

  if (rec.flags.length > 0) {
    const f = el('div', 'flags');
    f.append(el('b', undefined, '⚠️ Обрати внимание'));
    for (const flag of rec.flags) f.append(el('p', undefined, `• ${flag}`));
    root!.append(f);
  }

  const toBot = el('div', 'to-bot');
  toBot.append('Хочешь, чтобы про лимиты и дедлайны напоминал бот? Открой ');
  const tg = el('a', undefined, '@deka_tax_bot');
  tg.href = 'https://t.me/deka_tax_bot?start=sitecalc'; // funnel: пришёл после результата калькулятора
  tg.target = '_blank';
  tg.rel = 'noopener';
  toBot.append(tg, ' — это бесплатно.');
  root!.append(toBot);

  const src = el('div', 'sources');
  src.append(el('b', undefined, 'Источники:'));
  for (const s of rec.sources) {
    const a = el('a', undefined, `${s.label}${s.primary ? '' : ' (разъяснение)'}`);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    src.append(a);
  }
  root!.append(src);

  for (const d of rec.disclaimers) root!.append(el('p', 'disclaimer', d));
  root!.append(restartButton());
}

function restartButton(): HTMLButtonElement {
  const b = el('button', 'restart', '← Начать заново');
  b.addEventListener('click', () => {
    answers = {};
    render();
  });
  return b;
}

function render(): void {
  const step = nextStep(answers);
  if (step) renderStep(step);
  else renderResult();
}

render();
applyLang(lang); // первичный проход: переводы (если kk/en), актив-кнопка, отсчёт
