import { InlineKeyboard, type Bot } from 'grammy';
import {
  recommendRegime,
  type WizardAnswers,
  type EligStatus,
  type Recommendation,
} from '../domain/wizard';
import { REGIMES, SOURCES } from '../domain/regimes';
import { nextStep, applyAnswer, type FlowStep } from '../domain/flow';
import type { Telemetry } from '../telemetry/events';

/**
 * Состояние визарда в памяти процесса (ключ — id пользователя Telegram).
 * Для MVP этого хватает. TODO(этап БД): перенести в Postgres, чтобы ответы
 * переживали рестарт и работали при нескольких инстансах.
 */
const sessions = new Map<number, Partial<WizardAnswers>>();

const INTRO =
  '👋 Я <b>Deka</b> — помогу разобраться с налогами для ИП и самозанятых по <b>Налоговому кодексу РК-2026</b>.\n\n' +
  'Задам 3–4 вопроса и подскажу, какой режим тебе, скорее всего, подходит — со ссылками на источники и честными оговорками.\n\n' +
  '<i>Это ориентир, а не налоговая консультация. Я неофициальный помощник, не связан с КГД.</i>';

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

export function registerWizard(bot: Bot, telemetry?: Telemetry): void {
  bot.command('start', async (ctx) => {
    if (ctx.from) sessions.set(ctx.from.id, {});
    telemetry?.track(ctx.from?.id, 'start');
    const first = nextStep({});
    if (!first) return;
    const step = renderStep(first);
    await ctx.reply(`${INTRO}\n\n${step.text}`, {
      parse_mode: 'HTML',
      reply_markup: step.kb,
      ...NO_PREVIEW,
    });
  });

  bot.command('help', async (ctx) => {
    telemetry?.track(ctx.from?.id, 'help');
    await ctx.reply(
      'Сейчас я подбираю налоговый режим для ИП/самозанятых по НК РК-2026 — жми /start.\n\n' +
        'Скоро добавлю ответы на свободные вопросы с цитатами из первоисточника (adilet.zan.kz).',
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

  // Свободный текст — сюда позже приедет RAG. Пока мягко направляем в визард.
  // Сам текст НЕ логируем (приватность) — только факт и длину: это мера спроса на RAG.
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    telemetry?.track(ctx.from?.id, 'free_text', `len=${ctx.message.text.length}`);
    await ctx.reply(
      'Пока я умею подбирать налоговый режим — жми /start.\n\n' +
        'Ответы на свободные вопросы по НК РК-2026 (с цитатами из первоисточника) — следующий этап.',
      NO_PREVIEW,
    );
  });
}
