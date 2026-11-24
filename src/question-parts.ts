import { hasAnswer } from './answers.ts';
import type { Answer, Question } from './types.ts';

export function questionParts(question: Question): string[] {
  if ((question.kind !== 'short' && question.kind !== 'structured') || question.options) return [];
  const printed = question.source.subparts;
  if (printed?.length && printed.length > 1) return printed;
  const labels = [...question.prompt.matchAll(/(?:^|\s)\(([a-h]|[ivx]{1,4})\)(?=\s)/gi)].map(match => match[1].toLowerCase());
  const unique = [...new Set(labels)];
  const lettered = 'abcdefgh'.slice(0, unique.length).split('');
  const numbered = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'].slice(0, unique.length);
  return unique.length > 1 && [lettered, numbered].some(sequence =>
    sequence.length === unique.length && sequence.every((part, i) => part === unique[i])) ? unique : [];
}

export function splitResponse(answer: Answer, count: number) {
  return {
    parts: Array.from({ length: count }, (_, i) => Array.isArray(answer) ? answer[i] ?? '' : ''),
    earlier: typeof answer === 'string' ? answer : answer[count] ?? '',
  };
}

export function responseStatus(question: Question, answer: Answer | undefined) {
  if (answer === undefined || !hasAnswer(answer)) return 'unanswered';
  const count = questionParts(question).length;
  if (!count || typeof answer === 'string') return 'answered';
  const { parts, earlier } = splitResponse(answer, count);
  return parts.every(part => part.trim()) || (earlier.trim() && !hasAnswer(parts)) ? 'answered' : 'partially answered';
}

export function groupWorkings(lines: readonly string[], labels: readonly string[]) {
  const sections = new Map<string, string[]>([['', []]]);
  let current = sections.get('')!;
  for (const line of lines) {
    if (sections.size > 1 && line.startsWith('Answer: ')) {
      current = [line.slice('Answer: '.length)];
      sections.set('summary', current);
      continue;
    }
    const mark = /^\s*\(([a-z]+)\)\s*/i.exec(line);
    const label = mark?.[1].toLowerCase();
    if (mark && label && labels.includes(label)) {
      current = sections.get(label) ?? [];
      sections.set(label, current);
      const step = line.slice(mark[0].length);
      if (step) current.push(step);
    } else {
      current.push(line);
    }
  }
  return [...sections].filter(([, steps]) => steps.length).map(([label, steps]) => ({ label, steps }));
}
