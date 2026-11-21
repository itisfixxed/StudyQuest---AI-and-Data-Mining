// Shared rules for authored hint ladders; used by the engine tests and by authors while writing ladders.
import { checkStep, arithmetic } from '../src/answers.ts';
const maxByDifficulty = { easy: 3, medium: 5, hard: 8, exam: 10 };
const kinds = ['concept', 'formula', 'calculation', 'reasoning', 'assemble'];

export function ladderErrors(question, entry, referenceIds) {
  const errors = [];
  const fail = message => errors.push(question.id + ': ' + message);
  const steps = entry?.steps;
  if (!Array.isArray(steps) || !steps.length) return [question.id + ": missing ladder"];
  if (steps.length > 10) fail('more than 10 levels');
  if (steps.length > maxByDifficulty[question.difficulty]) fail(steps.length + ' levels exceeds ' + maxByDifficulty[question.difficulty] + ' for ' + question.difficulty);
  if (steps.at(-1).kind !== 'assemble') fail('last level must be kind "assemble"');
  if (steps.slice(0, -1).some(s => s.kind === 'assemble')) fail('only the last level may be "assemble"');
  steps.forEach((step, i) => {
    const at = 'level ' + (i + 1) + ' ';
    if (!kinds.includes(step.kind)) fail(at + 'bad kind ' + step.kind);
    if (![1, 2, 3, 4].includes(step.aid)) fail(at + 'aid must be 1-4');
    if (step.workedAid !== undefined && ![1, 2, 3, 4].includes(step.workedAid)) fail(at + 'workedAid must be 1-4');
    if (typeof step.title !== 'string' || typeof step.text !== 'string' || step.text.trim().length < 15) fail(at + 'needs a title and substantive text');
    for (const id of step.formulas ?? []) if (!referenceIds.has(id)) fail(at + 'unknown formula id ' + id);
    const c = step.check;
    if (c) {
      if (!c.prompt || !c.why || !c.retry) fail(at + 'check needs prompt, why and retry');
      if (c.options) {
        if (c.options.length < 2 || new Set(c.options).size !== c.options.length) fail(at + 'check options must be 2+ and unique');
        if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length) fail(at + 'check answer must be an option index');
        else if (c.options.some((_, j) => j !== c.answer && checkStep(c, String(j)))) fail(at + 'a wrong option passes');
      } else if (typeof c.answer !== 'string' && typeof c.answer !== 'number') fail(at + 'typed check needs a string/number answer');
      if (c.answer !== undefined && !checkStep(c, String(c.answer))) fail(at + 'check rejects its own answer');
      if (!c.options && arithmetic(String(c.answer)) === null && String(c.answer).split(' ').length > 4) fail(at + 'typed text answers must be short terms (use options instead)');
    }
    if (!c && !step.worked && step.kind !== 'assemble' && step.kind !== 'concept' && step.kind !== 'formula') fail(at + 'calculation/reasoning levels need a check or worked result');
  });
  if (entry.solution !== undefined && (!Array.isArray(entry.solution) || entry.solution.some(line => typeof line !== 'string' || !line.trim()))) fail('solution must be non-empty strings');
  return errors;
}
