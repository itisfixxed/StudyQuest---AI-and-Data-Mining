import type { Answer, Question, Step } from './types.ts';

type Quantity = number | bigint;
const bound = 1n << 1024n;
const numericFunctions: Record<string,(value:number)=>number> = {
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log2: Math.log2, exp: Math.exp
};

function combine(left: Quantity, operator: string, right: Quantity): Quantity {
  if (typeof left === 'bigint' && typeof right === 'bigint') {
    if (operator === '+') return left + right;
    if (operator === '-') return left - right;
    if (operator === '*') return left * right;
    if (operator === '^' && right >= 0n && right <= 512n) return left ** right;
    if (operator === '/' && right !== 0n && left % right === 0n) return left / right;
    if (operator === 'mod' || operator === '%') return right > 0n ? ((left % right) + right) % right : NaN;
  }
  const a = Number(left), b = Number(right);
  switch (operator) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '^': return Math.abs(b) <= 512 ? a ** b : NaN;
    default: return b > 0 ? ((a % b) + b) % b : NaN;
  }
}

// A bounded parser for constant arithmetic. No evaluation of JavaScript or access to identifiers.
export function arithmetic(input: string): number | null {
  if (input.length > 170) return null;
  const normalized = input.toLowerCase().replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/√\s*(?=\()/g, 'sqrt')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/gu, digits => '^' + [...digits].map(char => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(char)).join(''))
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '')
    .trim();
  const tokens = normalized.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|(?:sqrt|abs|ln|log2|exp|mod)\b|[()+*/^%\-]|\S/g) ?? [];
  let index = 0;
  const rank: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, mod: 2, '^': 4 };
  function read(minimum: number): Quantity {
    const token = tokens[index++];
    let value: Quantity;
    if (token === '(') {
      value = read(1);
      if (tokens[index++] !== ')') throw new Error('Unclosed parenthesis');
    } else if (Object.hasOwn(numericFunctions, token)) {
      if (tokens[index++] !== '(') throw new Error('Expected an opening parenthesis');
      value = numericFunctions[token](Number(read(1)));
      if (tokens[index++] !== ')' || !Number.isFinite(value)) throw new Error('Invalid function argument');
    } else if (token === '-' || token === '+') {
      value = read(3);
      if (token === '-') value = -value;
    } else {
      if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(token)) throw new Error('Expected a number');
      value = /^\d+$/.test(token) ? BigInt(token) : Number(token);
    }
    while (Object.hasOwn(rank, tokens[index]) && rank[tokens[index]] >= minimum) {
      const op = tokens[index++];
      const rhs = read(rank[op] + (op === '^' ? 0 : 1));
      value = combine(value, op, rhs);
      if (typeof value === 'bigint' ? value >= bound || value <= -bound : !Number.isFinite(value)) throw new Error('Arithmetic outside supported bounds');
    }
    return value;
  }
  try {
    const value = Number(read(1));
    return index === tokens.length && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hasAnswer(answer: Answer | undefined) {
  return typeof answer === 'string' ? answer.trim().length > 0 : Boolean(answer?.length);
}

export function automaticScore(q: Question, answer: Answer | undefined): number {
  if (!hasAnswer(answer)) return 0;
  if (q.kind === 'short' || q.kind === 'structured') throw new Error('Manual question requires explicit self-assessment');
  if (q.kind === 'multi' && Array.isArray(q.answer) && Array.isArray(answer)) {
    const selections = [...new Set(answer)];
    const correct = selections.filter(option => q.answer.includes(option)).length;
    const wrong = selections.length - correct;
    return Math.max(0, correct - wrong) * q.marks / q.answer.length;
  }
  if (typeof answer !== 'string') return 0;
  if (q.kind === 'number' || q.kind === 'expression') {
    const input = arithmetic(answer);
    const target = arithmetic(String(q.answer));
    if (input === null || target === null) return 0;
    const tolerance = Math.max(q.tolerance ?? 1e-8, Math.abs(target) * (q.relative ?? 0));
    return Math.abs(input - target) <= tolerance ? q.marks : 0;
  }
  const candidates = Array.isArray(q.answer) ? q.answer : [q.answer];
  return candidates.some(value => normalizeText(value) === normalizeText(answer)) ? q.marks : 0;
}

export function checkStep(step: Step, answer: string) {
  if (step.options) return answer !== '' && Number(answer) === step.answer;
  const expected = arithmetic(String(step.answer));
  const actual = arithmetic(answer);
  return expected === null ? normalizeText(answer) === normalizeText(String(step.answer)) :
    actual !== null && Math.abs(actual - expected) <= 1e-7;
}

