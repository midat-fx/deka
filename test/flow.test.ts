import { describe, it, expect } from 'vitest';
import { nextStep, applyAnswer } from '../src/domain/flow';
import { renderRecommendation } from '../src/bot/wizard-flow';
import { recommendRegime, type WizardAnswers } from '../src/domain/wizard';

describe('поток визарда (ветвление вопросов, общее ядро)', () => {
  it('физлицо → следующий вопрос про работников', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'entity', 'individual');
    expect(nextStep(a)?.question).toContain('работники');
  });

  it('ТОО → пропускает работников/деятельность, сразу оборот', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'entity', 'legal');
    expect(nextStep(a)?.question).toContain('оборот');
  });

  it('физлицо без работников → вопрос про вид деятельности', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'entity', 'individual');
    applyAnswer(a, 'emp', 'no');
    expect(nextStep(a)?.question).toContain('разрешительный список');
  });

  it('физлицо с работниками → пропускает деятельность, идёт к обороту', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'entity', 'individual');
    applyAnswer(a, 'emp', 'yes');
    expect(nextStep(a)?.question).toContain('оборот');
  });

  it('полный путь физлица завершается', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'entity', 'individual');
    applyAnswer(a, 'emp', 'no');
    applyAnswer(a, 'act', 'in');
    applyAnswer(a, 'turn', 't1');
    expect(nextStep(a)).toBeNull();
  });

  it('оборот из диапазона t4 = 3 млрд ₸', () => {
    const a: Partial<WizardAnswers> = {};
    applyAnswer(a, 'turn', 't4');
    expect(a.annualTurnoverTenge).toBe(3_000_000_000);
  });

  it('нумерация шагов для отображения', () => {
    expect(nextStep({})?.step).toBe(1);
    const a: Partial<WizardAnswers> = { entity: 'individual' };
    expect(nextStep(a)?.step).toBe(2);
  });
});

describe('рендер рекомендации (Telegram HTML)', () => {
  it('содержит режим, ссылки на первоисточник и дисклеймер', () => {
    const a: WizardAnswers = {
      entity: 'individual',
      hasEmployees: false,
      activity: 'in_list',
      annualTurnoverTenge: 4_800_000,
    };
    const html = renderRecommendation(recommendRegime(a));
    expect(html).toContain('Самозанятый');
    expect(html).toContain('adilet.zan.kz'); // источники — первоисточник, не пересказ
    expect(html).toContain('не налоговая консультация');
  });
});
