import type { Question, Reference, Source, Topic } from './types.ts';

type Field = { words: string[]; weight: number };

const words = (text: string) => (text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
  .match(/[\p{L}\p{N}]+/gu) ?? []);

function field(text: string, weight: number): Field {
  return { words: words(text), weight };
}

function relevance(fields: Field[], terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    const best = fields.reduce((max, field) => {
      if (field.words.includes(term)) return Math.max(max, field.weight);
      if (term.length >= 2 && field.words.some(word => word.startsWith(term))) return Math.max(max, field.weight * 0.6);
      return max;
    }, 0);
    if (!best) return 0;
    score += best;
  }
  return score;
}

function sourceTerms({ file, year, semester, question, subparts }: Question['source']) {
  const compact = (question ?? '').replace(/[^a-z0-9]/gi, '');
  const lettered = /^(\d+)([a-z])/i.exec(compact);
  return [file, year, semester && 'Semester ' + semester,
    question && 'Q' + question, compact && 'Q' + compact, compact,
    lettered && 'Q' + lettered[1] + '(' + lettered[2] + ')', subparts?.join(' ')].filter(Boolean).join(' ');
}

export function questionNumber(text: string) {
  return /^(?:q(?:uestion)?\s*)?(\d+)\s*\(?([a-z])\)?(?:\s*\(([ivx]+)\))?$/i.exec(text.trim().toLowerCase());
}

export function matchesQuestionNumber(source: Source, query: RegExpExecArray) {
  const label = /^(\d+)\s*\(?([a-z])\)?(?:\s*\(([ivx]+)\))?/i.exec(source.question?.toLowerCase() ?? '');
  return label?.[1] === query[1] && label[2] === query[2] &&
    (!query[3] || label[3] === query[3] || source.subparts?.includes(query[3]) === true);
}

function ranked<T>(entries: { item: T; score: number }[]): T[] {
  return entries.filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).map(entry => entry.item);
}

export function createStudySearch(topics: readonly Topic[], questions: readonly Question[], references: readonly Reference[]) {
  const referenceTitles = new Map(references.map(reference => [reference.id, reference.title]));
  const topicIndex = new Map(topics.map(topic => [topic.id, {
    topic,
    fields: [field(topic.name, 10), field(topic.short, 8), field(topic.summary, 3)],
    concepts: topic.concepts.map(concept => ({
      concept,
      fields: [field(concept.name, 9), field(concept.formulas.map(id => referenceTitles.get(id)).join(' '), 7),
        field([concept.intuition, concept.formal].join(' '), 2)],
    })),
  }]));
  const questionIndex = questions.map(question => {
    const topic = topicIndex.get(question.topic);
    const concept = topic?.concepts.find(entry => entry.concept.id === question.subtopic);
    return { question, fields: [
      field(question.title, 12), field(question.prompt, 8), field(sourceTerms(question.source), 5),
      field(question.formulas.map(id => referenceTitles.get(id)).join(' '), 6),
      field(concept?.concept.name ?? '', 5), field(topic?.topic.short ?? '', 2),
    ] };
  });

  return (query: string) => {
    const terms = [...new Set(words(query))];
    const results = {
      topics: [] as { topic: Topic; concept?: string }[],
      tutorials: [] as Question[],
      exams: [] as Question[],
      practice: [] as Question[],
    };
    if (terms.join('').length < 2) return results;

    const part = questionNumber(query);
    if (!part) results.topics = ranked([...topicIndex.values()].map(({ topic, fields, concepts }) => {
      const [match] = ranked(concepts.map(({ concept, fields: conceptFields }) => ({
        item: concept, score: relevance(conceptFields, terms),
      })));
      const score = Math.max(relevance(fields, terms), ...concepts.map(concept => relevance([...fields, ...concept.fields], terms)));
      return { item: { topic, concept: match?.name }, score };
    }));
    const matches = part ? questions.filter(question => matchesQuestionNumber(question.source, part)) :
      ranked(questionIndex.map(({ question, fields }) => ({ item: question, score: relevance(fields, terms) })));
    for (const question of matches) {
      if (question.origin === 'exercise') results.tutorials.push(question);
      else if (question.origin === 'original' || question.origin === 'adapted') results.exams.push(question);
      else results.practice.push(question);
    }
    return results;
  };
}
