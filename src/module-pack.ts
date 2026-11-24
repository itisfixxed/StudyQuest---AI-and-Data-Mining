import { previousModuleCode } from './legacy-storage.ts';
import builtinModule from './content/module.json' with { type: 'json' };
import type { Lecture, ModuleInfo, Paper, PaperDocument, Question, Reference, Topic } from './types.ts';

export { builtinModule };

export interface ModulePack {
  version: 2;
  module: ModuleInfo;
  topics: Topic[];
  references: Reference[];
  lectures: Record<string, Lecture>;
  practiceQuestions: Question[];
  papers: Paper[];
  questions: Question[];
  exercises: Question[];
  scans: Record<string, string>;
  documents?: Record<string, PaperDocument>;
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const id = (value: unknown): value is string => text(value) && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(value) &&
  !Object.hasOwn(Object.prototype, value) && value !== 'prototype';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => number(value) && value > 0;
const index = (value: unknown, length: number) => number(value) && Number.isInteger(value) && value >= 0 && value < length;
const list = <T,>(value: unknown, test: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(test);
const unique = <T,>(values: T[]) => new Set(values).size === values.length;
const oneOf = (value: unknown, options: readonly unknown[]) => options.includes(value);
const source = (value: unknown) => record(value) && text(value.file);
const fail = (section: string): never => { throw new Error('Invalid module pack: ' + section + '.'); };

function moduleInfo(value: unknown): value is ModuleInfo {
  return record(value) && id(value.id) && value.id !== builtinModule.id && value.id !== previousModuleCode.toLowerCase() && text(value.name) &&
    (value.examDate === '' || text(value.examDate) && /^\d{4}-\d{2}-\d{2}$/.test(value.examDate) &&
      Number.isFinite(Date.parse(value.examDate)) && new Date(value.examDate).toISOString().slice(0, 10) === value.examDate);
}

function check(value: unknown) {
  return record(value) && text(value.prompt) && text(value.why) && text(value.retry) &&
    (value.options === undefined ? text(value.answer) || number(value.answer) :
      list(value.options, text) && value.options.length >= 2 && unique(value.options) && index(value.answer, value.options.length)) &&
    (value.tolerance === undefined || positive(value.tolerance));
}

export function validateModulePack(value: unknown): ModulePack {
  if (!record(value) || value.version !== 2 || !moduleInfo(value.module)) return fail('module metadata');
  if (!list(value.topics, record) || !value.topics.length || !list(value.references, record) ||
      !record(value.lectures) || !list(value.practiceQuestions, record) || !list(value.papers, record) ||
      !list(value.questions, record) || !list(value.exercises, record) || !record(value.scans)) return fail('content collections');

  const topicIds = new Set(value.topics.map(t => t.id));
  const refIds = new Set(value.references.map(r => r.id));
  const concepts = new Map<unknown, Set<unknown>>();
  const formulas = (ids: unknown) => list(ids, id) && ids.every(formula => refIds.has(formula));
  if (topicIds.size !== value.topics.length || refIds.size !== value.references.length) return fail('duplicate topic or reference');
  for (const ref of value.references) {
    if (!id(ref.id) || !topicIds.has(ref.topic) || !source(ref.source) ||
        ![ref.title, ref.expression, ref.purpose, ref.assumptions, ref.example, ref.variation, ref.mistake].every(text)) return fail('reference ' + ref.id);
  }
  for (const topic of value.topics) {
    if (!id(topic.id) || ![topic.name, topic.short, topic.icon, topic.color, topic.summary].every(text) ||
        !positive(topic.difficulty) || typeof topic.revision !== 'boolean' || !list(topic.prerequisites, id) ||
        topic.prerequisites.some(required => required === topic.id || !concepts.has(required)) ||
        !Array.isArray(topic.sources) || !topic.sources.length || !topic.sources.every(source) ||
        !list(topic.concepts, record) || !topic.concepts.length) return fail('topic ' + topic.id);
    const conceptIds = topic.concepts.map(c => c.id);
    if (!unique(conceptIds)) return fail('duplicate concept in ' + topic.id);
    concepts.set(topic.id, new Set(conceptIds));
    for (const concept of topic.concepts) {
      if (!id(concept.id) || ![concept.name, concept.intuition, concept.formal, concept.cue, concept.pitfall, concept.example].every(text) ||
          !source(concept.source) || !formulas(concept.formulas) ||
          !list(concept.check, text) || concept.check.length !== 4 || !unique(concept.check.slice(1)) ||
          !list(concept.apply, text) || concept.apply.length !== 4) return fail('concept ' + concept.id);
    }
  }
  if (Object.keys(value.lectures).length !== topicIds.size) return fail('lecture coverage');
  for (const [topicId, lecture] of Object.entries(value.lectures)) {
    if (!topicIds.has(topicId) || !record(lecture) || ![lecture.goal, lecture.explain, lecture.model].every(text) ||
        !list(lecture.points, text) || !lecture.points.length || !list(lecture.scenes, record) ||
        lecture.scenes.length !== 3 || !unique(lecture.scenes.map(scene => scene.title))) return fail('lecture ' + topicId);
    for (const scene of lecture.scenes) {
      const { table, check: mcq } = scene;
      if (!concepts.get(topicId)?.has(scene.concept) || !text(scene.title) || !text(scene.content) ||
          !record(table) || !list(table.columns, text) || !table.columns.length || !unique(table.columns) ||
          !Array.isArray(table.rows) || !table.rows.length || !table.rows.every(row => list(row, text)) ||
          !table.rows.every(row => row.length === (table.columns as string[]).length) || !unique(table.rows.map(row => row[0])) ||
          !record(mcq) || ![mcq.prompt, mcq.hint, mcq.feedback].every(text) ||
          !list(mcq.options, text) || mcq.options.length < 2 || !unique(mcq.options) ||
          !index(mcq.right, mcq.options.length)) return fail('lecture scene in ' + topicId);
    }
  }

  for (const [path, scan] of Object.entries(value.scans)) {
    if (!text(path) || !text(scan) || !/^UklGR[A-Za-z0-9+/]+={0,2}$/.test(scan) || scan.length % 4 !== 0 ||
        atob(scan.slice(0, 16)).slice(8) !== 'WEBP') return fail('invalid WebP scan');
  }
  const scanPaths = new Set(Object.keys(value.scans));
  const all = [...value.practiceQuestions, ...value.questions, ...value.exercises];
  const questionIds = new Set(all.map(question => question.id));
  if (questionIds.size !== all.length) return fail('duplicate question');
  const limits = new Map([['easy', 3], ['medium', 5], ['hard', 8], ['exam', 10]]);
  for (const question of all) {
    const { guidance, rubric, figures, solutionFigures } = question;
    const limit = limits.get(String(question.difficulty));
    if (!id(question.id) || !concepts.get(question.topic)?.has(question.subtopic) ||
        ![question.title, question.prompt, question.objective, question.explanation, question.misconception].every(text) ||
        !source(question.source) || !positive(question.marks) || !positive(question.minutes) || !formulas(question.formulas) ||
        !limit || !oneOf(question.kind, ['choice', 'multi', 'truefalse', 'number', 'expression', 'blank', 'short', 'structured']) ||
        !(text(question.answer) || list(question.answer, text) && question.answer.length > 0) ||
        !list(question.solution, text) || !question.solution.length ||
        (figures !== undefined && (!list(figures, record) || !figures.every(f => text(f.src) && scanPaths.has(f.src) && text(f.alt)))) ||
        (solutionFigures !== undefined && (!list(solutionFigures, record) ||
          !solutionFigures.every(f => text(f.src) && scanPaths.has(f.src) && text(f.alt) && text(f.caption))))) return fail('question ' + question.id);
    if ((question.kind === 'choice' || question.kind === 'multi') &&
        (!list(question.options, text) || question.options.length < 2 || !unique(question.options) ||
          (question.kind === 'choice' ? !text(question.answer) || !question.options.includes(question.answer) :
            !Array.isArray(question.answer) || !unique(question.answer) || !question.answer.every(a => (question.options as string[]).includes(a))))) return fail('options for ' + question.id);
    if ((question.kind === 'short' || question.kind === 'structured') &&
        (!list(rubric, record) || !rubric.length || rubric.some(r => !text(r.text) || !positive(r.points)) ||
          Math.abs(rubric.reduce((sum, r) => sum + (r.points as number), 0) - question.marks) > 1e-8)) return fail('rubric for ' + question.id);
    if (!record(guidance) || !text(guidance.recall) || !text(guidance.direction) || !check(guidance.scaffold) ||
        !Array.isArray(guidance.walkthrough) || !guidance.walkthrough.length || !guidance.walkthrough.every(check) ||
        !list(guidance.ladder, record) || !guidance.ladder.length || guidance.ladder.length > limit) return fail('guidance for ' + question.id);
    for (const [i, step] of guidance.ladder.entries()) {
      const last = i === guidance.ladder.length - 1;
      if (!text(step.title) || !text(step.text) || !oneOf(step.kind, last ? ['assemble'] : ['concept', 'formula', 'reasoning', 'calculation']) ||
          !oneOf(step.aid, last ? [4] : [1, 2, 3, 4]) ||
          (step.formulas !== undefined && !formulas(step.formulas)) || (step.check !== undefined && !check(step.check)) ||
          (step.workedAid !== undefined && !oneOf(step.workedAid, [1, 2, 3, 4]))) return fail('hint level for ' + question.id);
    }
  }

  for (const question of value.practiceQuestions) if (question.origin !== 'generated') return fail('generated question origin');
  for (const question of value.questions) {
    if (question.origin !== 'original' || !Array.isArray(question.figures) || !question.figures.length) return fail('original question scan');
  }
  for (const question of value.exercises) if (question.origin !== 'exercise') return fail('exercise origin');
  const generated = new Map(value.practiceQuestions.map(q => [q.id, q]));
  for (const topic of value.topics) {
    const caseQuestion = generated.get('case-' + topic.id);
    if (!caseQuestion || caseQuestion.topic !== topic.id || caseQuestion.kind !== 'structured' || caseQuestion.difficulty !== 'exam') return fail('boss case for ' + topic.id);
    for (const concept of topic.concepts as { id: string }[]) {
      const checkQuestion = generated.get('check-' + topic.id + '-' + concept.id);
      if (!checkQuestion || checkQuestion.topic !== topic.id || checkQuestion.subtopic !== concept.id ||
          checkQuestion.kind !== 'choice') return fail('knowledge check for ' + concept.id);
    }
  }

  const originals = new Map(value.questions.map(q => [q.id, q]));
  const linked = new Set<unknown>();
  if (!unique(value.papers.map(p => p.id))) return fail('duplicate paper');
  for (const paper of value.papers) {
    if (!id(paper.id) || !text(paper.year) || !oneOf(paper.semester, [1, 2]) || !text(paper.file) ||
        !positive(paper.duration) || !list(paper.parts, record) || !paper.parts.length || !unique(paper.parts.map(p => p.label))) return fail('paper metadata');
    for (const part of paper.parts) {
      const question = originals.get(part.questionId);
      if (!question || linked.has(part.questionId) || question.marks !== part.marks || question.topic !== part.topic ||
          !text(part.label) || !text(part.pattern) || !positive(part.page) || !Number.isInteger(part.page) ||
          (part.related !== undefined && (!list(part.related, id) || !part.related.every(t => topicIds.has(t))))) return fail('paper part ' + part.label);
      linked.add(part.questionId);
    }
  }
  if (value.documents !== undefined) {
    if (!record(value.documents)) return fail('paper documents');
    const paperIds = new Set(value.papers.map(paper => paper.id));
    const base64 = (data: unknown, prefix: string) => text(data) && data.startsWith(prefix) &&
      data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(data);
    for (const [paperId, document] of Object.entries(value.documents)) {
      if (!paperIds.has(paperId) || !record(document) || !base64(document.pdf, 'JVBERi0') ||
          !Array.isArray(document.pages) || !document.pages.length || !document.pages.every(page => base64(page, 'UklGR')) ||
          (document.excerpts !== undefined && typeof document.excerpts !== 'boolean')) return fail('paper document ' + paperId);
    }
  }
  if (linked.size !== originals.size) return fail('unlinked paper question');
  return value as unknown as ModulePack;
}
