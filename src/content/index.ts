import { loadStudyPack } from '../study-pack.ts';
import rawTopics from './topics.json' with { type: 'json' };
import rawReferences from './references.json' with { type: 'json' };
import rawPapers from './papers.json' with { type: 'json' };
import rawExamQuestions from './exam-questions.json' with { type: 'json' };
import rawDrills from './drills.json' with { type: 'json' };
import moduleInfo from './module.json' with { type: 'json' };
import rawLectures from './lectures.json' with { type: 'json' };
import rawLadders from './ladders.json' with { type: 'json' };
import type { Concept, Difficulty, Guidance, HintStep, Paper, Question, Reference, Topic } from '../types.ts';

export const topics = rawTopics as Topic[];
export { moduleInfo };
export const references = rawReferences as Reference[];
export const lectureScenes: Record<string, number> = Object.fromEntries(
  Object.entries(rawLectures as Record<string, { scenes: unknown[] }>).map(([id, lecture]) => [id, lecture.scenes.length]));
export const papers = [...rawPapers] as Paper[];
export const hasBundledPapers = papers.length > 0;
export let packLoadFailed = false;
export const historicalQuestions = [...rawExamQuestions] as Question[];
export const topicById = Object.fromEntries(topics.map(topic => [topic.id, topic]));
export const referenceById = Object.fromEntries(references.map(reference => [reference.id, reference]));

const rotate = <T,>(array: T[], by: number) => [...array.slice(by), ...array.slice(0, by)];
const rotation = (key: string, length: number) => [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % length;

function methodCheck(concept: Concept, key: string) {
  const [prompt, correct, ...wrong] = concept.check;
  const options = rotate([correct, ...wrong], rotation(key, 3));
  return { prompt, options, answer: options.indexOf(correct), why: concept.formal, retry: concept.cue };
}

function guide(concept: Concept, key: string): Guidance {
  const scaffold = methodCheck(concept, key);
  return { recall: concept.intuition, direction: concept.cue, scaffold, walkthrough: [
    scaffold,
    { prompt: 'Which issue should you check for when applying this idea?',
      options: ['Keeping the quantities and assumptions explicit', concept.pitfall],
      answer: 1, why: concept.pitfall, retry: 'Choose the mistake that could change the result.' }
  ] };
}

function base(topic: Topic, concept: Concept) {
  return {
    topic: topic.id, subtopic: concept.id, title: concept.name,
    source: concept.source, origin: 'generated' as const,
    objective: 'Explain and apply ' + concept.name.toLowerCase() + ' in context.',
    formulas: concept.formulas, explanation: concept.formal, misconception: concept.pitfall,
    guidance: guide(concept, topic.id + concept.id)
  };
}

export const knowledgeQuestions: Question[] = topics.flatMap(topic => topic.concepts.map(concept => {
  const key = topic.id + '-' + concept.id;
  const item = base(topic, concept);
  const [prompt, correct] = concept.check;
  const { options } = methodCheck(concept, topic.id + concept.id);
  const check = item.guidance.walkthrough[1];
  return {
    ...item, id: 'check-' + key, kind: 'choice', difficulty: 'easy', prompt, answer: correct, options,
    optionFeedback: options.map(option => option === correct ? concept.formal : 'This does not match the requested quantity or procedure. ' + concept.cue),
    marks: 1, minutes: 2, guidance: { ...item.guidance, scaffold: check, walkthrough: [check] }
  };
}));

const applied: Question[] = topics.flatMap(topic => topic.concepts.map(concept => {
  const [prompt, answer, a, b] = concept.apply;
  return {
    ...base(topic, concept), id: 'apply-' + topic.id + '-' + concept.id, kind: 'short', difficulty: 'medium',
    prompt, answer, marks: 4, minutes: 5, solution: [answer],
    rubric: [{ text: a, points: 2 }, { text: b, points: 2 }]
  };
}));

const drills = [...rawDrills] as Question[];
export const practiceQuestions = [...knowledgeQuestions, ...applied, ...drills];
/** Authored step-by-step hint ladders (and fuller worked solutions) for generated questions, keyed by question id. */
export const ladders = rawLadders as Record<string, { steps: HintStep[]; solution?: string[] }>;
for (const question of practiceQuestions) {
  const entry = ladders[question.id];
  if (!entry) continue;
  question.guidance = { ...question.guidance, ladder: entry.steps };
  if (entry.solution?.length) question.solution = entry.solution;
}
export const questions = [...practiceQuestions, ...historicalQuestions];
export const questionById = Object.fromEntries(questions.map(question => [question.id, question]));
export const isManual = (question: Question) => question.kind === 'short' || question.kind === 'structured';

const calculateHistory = () => topics.map(topic => {
  const matching = papers.filter(paper => paper.parts.some(part => part.topic === topic.id || part.related?.includes(topic.id)));
  const primary = papers.flatMap(paper => paper.parts.filter(part => part.topic === topic.id));
  return { topic: topic.id, papers: matching.length, primaryParts: primary.length, marks: primary.reduce((sum, part) => sum + part.marks, 0) };
});
export const historical = calculateHistory();
export const topicHistory = Object.fromEntries(historical.map(item => [item.topic, item]));
export const historicalParts = papers.flatMap(paper => paper.parts);

export async function prepareStudyContent() {
  if (hasBundledPapers || papers.length) return;
  try {
    const pack = await loadStudyPack();
    if (!pack) return;
    const scans = Object.fromEntries(Object.entries(pack.scans).map(([path, content]) => [
      path, URL.createObjectURL(new Blob([
        Uint8Array.from(atob(content), char => char.charCodeAt(0))
      ], { type: 'image/webp' }))
    ]));
    for (const question of pack.questions) {
      for (const figure of question.figures ?? []) figure.src = scans[figure.src];
    }
    papers.push(...pack.papers);
    historicalParts.push(...pack.papers.flatMap(paper => paper.parts));
    historicalQuestions.push(...pack.questions);
    drills.push(...pack.exercises);
    practiceQuestions.push(...pack.exercises);
    questions.push(...pack.questions, ...pack.exercises);
    for (const question of [...pack.questions, ...pack.exercises]) questionById[question.id] = question;
    historical.splice(0, historical.length, ...calculateHistory());
    for (const item of historical) topicHistory[item.topic] = item;
  } catch {
    packLoadFailed = true;
  }
}

export const stages = ['Fundamentals', 'Conceptual understanding', 'Guided application', 'Independent problem-solving', 'Examination-level mastery'];
export const labels: Record<Difficulty, string> = { easy: 'Fundamental', medium: 'Intermediate', hard: 'Advanced', exam: 'Exam level' };
export const originLabel: Record<Question['origin'], string> = {
  generated: 'Generated practice', original: 'Original exam question',
  adapted: 'Adapted from past paper', exercise: 'Adapted course exercise'
};

export function bossQuestions(topicId: string) {
  const pool = drills.filter(q => q.topic === topicId);
  const caseQuestion = pool.find(q => q.id === 'case-' + topicId)!;
  const original = historicalQuestions.find(q => q.topic === topicId && q.origin === 'original');
  const advanced = pool.find(q => q.difficulty === 'hard');
  return [caseQuestion, original ?? advanced ?? applied.find(q => q.topic === topicId)!];
}

