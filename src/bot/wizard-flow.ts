import { InlineKeyboard, type Bot } from 'grammy';
import {
  recommendRegime,
  type WizardAnswers,
  type EligStatus,
  type Recommendation,
} from '../domain/wizard';
import { REGIMES, SOURCES } from '../domain/regimes';
import { nextStep, applyAnswer, type FlowStep } from '../domain/flow';
import type { EventTracker } from '../telemetry/types';

/**
 * Состояние визарда в памяти процесса (ключ — id пользователя Telegram).
 * Для MVP этого хватает. TODO(этап БД): перенести в Postgres, чтобы ответы
 * переживали рестарт и работали при нескольких инстансах.
 */
const sessions = new Map<number, Partial<WizardAnswers>>();

const WELCOME =
  '👋 Привет! Я <b>Deka</b> — помогаю ИП и самозанятым Казахстана разобраться с налогами по <b>кодексу 2026</b>. Отвечаю по первоисточнику, со ссылками на статьи. Неофициальный помощник, не связан с КГД.\n\n' +
  '<b>Что я умею:</b>\n' +
  '🧮 Подобрать налоговый режим — кнопка ниже\n' +
  '📊 Оборот и близость к лимитам — /oborot\n' +
  '📅 Дедлайны и напоминания — /dedlayny\n' +
  '💬 Ответить на вопрос по кодексу — просто напиши его\n\n' +
  '<i>Это ориентир, а не налоговая консультация.</i>';

const STATUS_ICON: Record<EligStatus, string> = {
  recommended: '✅',
  eligible: '▫️',
  needs_check: '🔎',
  not_eligible: '✖️',
};

/** FlowStep (общее ядро) → текст сообщения и inline-клавиатура Telegram. */
function renderStep(s: FlowStep): { text: string; kb: InlineKeyboard } {
  const kb = new InlineKeyboard();
  const multiline = s.options.length > 2;
  for (const opt of s.options) {
    kb.text(opt.label, `w|${s.field}|${opt.code}`);
    if (multiline) kb.row();
  }
  if (s.linkOut) kb.row().url(s.linkOut.label, s.linkOut.url);
  const hint = s.hint ? `\n<i>${s.hint}</i>` : '';
  return { text: `<b>Шаг ${s.step}.</b> ${s.question}${hint}`, kb };
}

function resultKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Пройти заново', 'w|restart|go')
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

export function registerWizard(bot: Bot, telemetry?: EventTracker): void {
  bot.command('start', async (ctx) => {
    if (ctx.from) sessions.set(ctx.from.id, {});
    telemetry?.track(ctx.from?.id, 'start');
    const kb = new InlineKeyboard().text('🧮 Подобрать налоговый режим', 'w|restart|go');
    await ctx.reply(WELCOME, { parse_mode: 'HTML', reply_markup: kb, ...NO_PREVIEW });
  });

  bot.command('help', async (ctx) => {
    telemetry?.track(ctx.from?.id, 'help');
    await ctx.reply(
      'Что я умею:\n' +
        '• /start — подобрать налоговый режим (самозанятый / упрощёнка / общий)\n' +
        '• /oborot 500000 — записать доход и следить за близостью к лимитам (300 МРП/мес, НДС, упрощёнка)\n' +
        '• /dedlayny — налоговые дедлайны + напоминания за 7 и 1 день\n' +
        '• Просто напиши вопрос — найду ответ в тексте НК РК-2026 и покажу дословные фрагменты со ссылками на статьи\n\n' +
        'Например: «какой лимит у самозанятого», «когда вставать на учёт по НДС», «сроки сдачи упрощённой декларации».',
      NO_PREVIEW,
    );
  });

  bot.callbackQuery(/^w\|/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const parts = (ctx.callbackQuery.data ?? '').split('|');
    const field = parts[1] ?? '';
    const value = parts[2] ?? '';

    let answers = sessions.get(userId);
    if (!answers) {
      answers = {};
      sessions.set(userId, answers);
    }

    if (field === 'restart') {
      answers = {};
      sessions.set(userId, answers);
      telemetry?.track(userId, 'wizard_restart');
    } else {
      applyAnswer(answers, field, value);
      telemetry?.track(userId, 'wizard_answer', `${field}=${value}`);
    }

    await ctx.answerCallbackQuery();

    const next = nextStep(answers);
    if (next) {
      const step = renderStep(next);
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

  // Свободный текст обрабатывает registerSearch (src/bot/search-flow.ts) —
  // он должен быть зарегистрирован ПОСЛЕ визарда.
}
