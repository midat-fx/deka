import { InlineKeyboard, type Bot, type Context } from 'grammy';
import {
  recommendRegime,
  type WizardAnswers,
  type EligStatus,
  type Recommendation,
} from '../domain/wizard';
import { REGIMES, SOURCES } from '../domain/regimes';
import { nextStep, applyAnswer, type FlowStep } from '../domain/flow';
import {
  WELCOME,
  WIZARD_BUTTON,
  HELP,
  TIL_SET,
  TIL_PROMPT,
  LANG_NAME,
  LANGS,
  type Lang,
} from '../i18n/i18n';
import { mainKeyboard } from './keyboard';
import type { PrefsStore } from '../store/prefs';
import type { EventTracker } from '../telemetry/types';

/**
 * Визард БЕЗ серверного состояния: накопленные ответы закодированы прямо в
 * callback_data кнопок (формат «w|<state>|<field>|<value>», умещается в лимит
 * 64 байта). Прод на Cloudflare перезапускает изоляты в любой момент — раньше
 * это молча выбрасывало юзера на шаг 1; теперь прогресс живёт в самой кнопке
 * и переживает любые рестарты и количество инстансов.
 */

/** Partial<WizardAnswers> → 3 символа: entity(i/l/-), emp(y/n/-), act(i/n/d/-). */
export function encodeState(a: Partial<WizardAnswers>): string {
  const e = a.entity === 'individual' ? 'i' : a.entity === 'legal' ? 'l' : '-';
  const w = a.hasEmployees === true ? 'y' : a.hasEmployees === false ? 'n' : '-';
  const act =
    a.activity === 'in_list' ? 'i' : a.activity === 'not_in_list' ? 'n' : a.activity === 'unknown' ? 'd' : '-';
  return `${e}${w}${act}`;
}

export function decodeState(s: string): Partial<WizardAnswers> {
  const a: Partial<WizardAnswers> = {};
  if (s[0] === 'i') a.entity = 'individual';
  if (s[0] === 'l') a.entity = 'legal';
  if (s[1] === 'y') a.hasEmployees = true;
  if (s[1] === 'n') a.hasEmployees = false;
  if (s[2] === 'i') a.activity = 'in_list';
  if (s[2] === 'n') a.activity = 'not_in_list';
  if (s[2] === 'd') a.activity = 'unknown';
  return a;
}

const STATUS_ICON: Record<EligStatus, string> = {
  recommended: '✅',
  eligible: '▫️',
  needs_check: '🔎',
  not_eligible: '✖️',
};

/** FlowStep + текущее состояние → сообщение и кнопки (состояние внутри callback). */
function renderStep(s: FlowStep, state: string): { text: string; kb: InlineKeyboard } {
  const kb = new InlineKeyboard();
  const multiline = s.options.length > 2;
  for (const opt of s.options) {
    kb.text(opt.label, `w|${state}|${s.field}|${opt.code}`);
    if (multiline) kb.row();
  }
  if (s.linkOut) kb.row().url(s.linkOut.label, s.linkOut.url);
  const hint = s.hint ? `\n<i>${s.hint}</i>` : '';
  return { text: `<b>Шаг ${s.step}.</b> ${s.question}${hint}`, kb };
}

function resultKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Пройти заново', 'w|---|restart|go')
    .row()
    .url('📋 Список видов деятельности (самозанятые)', SOURCES.selfEmployedList.url);
}

export function renderRecommendation(rec: Recommendation): string {
  const lines: string[] = [`<b>${rec.headline}</b>`, ''];

  if (rec.primary !== 'needs_human') {
    const r = REGIMES[rec.primary];
    const elig = rec.eligibility.find((e) => e.regime === rec.primary);
    lines.push(`${STATUS_ICON[elig?.status ?? 'eligible']} <b>${r.name}</b>`, r.rateSummary, '');
  }

  lines.push('<b>Как ты проходишь по режимам:</b>');
  for (const e of rec.eligibility) {
    lines.push(`${STATUS_ICON[e.status]} <b>${REGIMES[e.regime].name}</b>`);
    for (const reason of e.reasons) lines.push(`   • ${reason}`);
  }
  lines.push('');

  if (rec.flags.length > 0) {
    lines.push('<b>⚠️ Обрати внимание:</b>');
    for (const f of rec.flags) lines.push(`• ${f}`);
    lines.push('');
  }

  lines.push('<b>Источники:</b>');
  for (const s of rec.sources) {
    const tag = s.primary ? '' : ' <i>(разъяснение)</i>';
    lines.push(`• <a href="${s.url}">${s.label}</a>${tag}`);
  }
  lines.push('');
  for (const d of rec.disclaimers) lines.push(`<i>${d}</i>`);

  return lines.join('\n');
}

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const;

/** Отправить первый шаг визарда новым сообщением (используется и роутером). */
export async function sendWizardStart(ctx: Context): Promise<void> {
  const first = nextStep({});
  if (!first) return;
  const step = renderStep(first, '---');
  await ctx.reply(step.text, { parse_mode: 'HTML', reply_markup: step.kb, ...NO_PREVIEW });
}

/** Кнопки выбора языка (используется /til, меню и роутером). */
export function languageKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const l of LANGS) kb.text(LANG_NAME[l], `lang|${l}`);
  return kb;
}

export function registerWizard(bot: Bot, telemetry?: EventTracker, prefs?: PrefsStore): void {
  const langOf = async (uid: number | undefined): Promise<Lang> =>
    (prefs && uid !== undefined ? await prefs.getLang(uid) : undefined) ?? 'ru';

  bot.command('start', async (ctx) => {
    telemetry?.track(ctx.from?.id, 'start');
    const lang = await langOf(ctx.from?.id);
    // Постоянное меню внизу + приветствие. Кнопка визарда — inline.
    await ctx.reply(WELCOME[lang], {
      parse_mode: 'HTML',
      reply_markup: mainKeyboard(lang),
      ...NO_PREVIEW,
    });
    await ctx.reply(WIZARD_BUTTON[lang] + ' 👇', {
      reply_markup: new InlineKeyboard().text(WIZARD_BUTTON[lang], 'w|---|restart|go'),
    });
  });

  bot.command('help', async (ctx) => {
    telemetry?.track(ctx.from?.id, 'help');
    const lang = await langOf(ctx.from?.id);
    await ctx.reply(HELP[lang], { reply_markup: mainKeyboard(lang), ...NO_PREVIEW });
  });

  // Смена языка: кнопки вместо «набери /til qazaqsha» (тот самый инцидент «да»).
  bot.command('til', async (ctx) => {
    const lang = await langOf(ctx.from?.id);
    await ctx.reply(TIL_PROMPT[lang], { reply_markup: languageKeyboard() });
  });

  bot.callbackQuery(/^lang\|/, async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const next = (ctx.callbackQuery.data ?? '').split('|')[1] as Lang;
    if (!LANGS.includes(next)) return;
    if (prefs) await prefs.setLang(uid, next);
    telemetry?.track(uid, 'lang', next);
    await ctx.answerCallbackQuery(TIL_SET[next].replace(/✅ /, ''));
    // Новое сообщение с меню на новом языке (reply-клавиатура сама не обновится).
    await ctx.reply(TIL_SET[next], { reply_markup: mainKeyboard(next) });
  });

  bot.callbackQuery(/^w\|/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const parts = (ctx.callbackQuery.data ?? '').split('|');
    const state = parts[1] ?? '---';
    const field = parts[2] ?? '';
    const value = parts[3] ?? '';

    const answers = decodeState(state);

    if (field === 'restart') {
      telemetry?.track(userId, 'wizard_restart');
    } else {
      applyAnswer(answers, field, value);
      telemetry?.track(userId, 'wizard_answer', `${field}=${value}`);
    }

    await ctx.answerCallbackQuery();

    const next = field === 'restart' ? nextStep({}) : nextStep(answers);
    if (next) {
      const step = renderStep(next, field === 'restart' ? '---' : encodeState(answers));
      await ctx.editMessageText(step.text, {
        parse_mode: 'HTML',
        reply_markup: step.kb,
        ...NO_PREVIEW,
      });
    } else {
      const rec = recommendRegime(answers as WizardAnswers);
      telemetry?.track(userId, 'wizard_result', String(rec.primary));
      await ctx.editMessageText(renderRecommendation(rec), {
        parse_mode: 'HTML',
        reply_markup: resultKeyboard(),
        ...NO_PREVIEW,
      });
    }
  });

  // Свободный текст обрабатывает registerSearch (там же роутер намерений) —
  // он должен быть зарегистрирован ПОСЛЕ визарда.
}
