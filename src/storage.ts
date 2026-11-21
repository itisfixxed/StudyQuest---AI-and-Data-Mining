import { lectureScenes, moduleInfo, questionById, referenceById, topicById, topics } from './content/index.ts';
import { backfillLessons, newProgress, storageKey } from './progress.ts';
import { previousModuleCode } from './legacy-storage.ts';
import type { Progress } from './types.ts';

const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const validId = (value: unknown): value is string => typeof value === 'string';
const values = (value: unknown, key: (element: unknown) => boolean) => Array.isArray(value) && value.every(key);
const knownQ = (value: unknown): value is string => validId(value) && Object.hasOwn(questionById, value);
const knownTopic = (value: unknown) => validId(value) && Object.hasOwn(topicById, value);
const validAnswer = (value: unknown) => (validId(value) && value.length <= 30_000) || values(value, v => validId(v) && v.length < 1000);
const enumOf = (value: unknown, choices: string[]) => validId(value) && choices.includes(value);
const within = (value: unknown, min: number, max: number) => finite(value) && value >= min && value <= max;
const date = (value: unknown) => validId(value) && (!value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value));
const lessonIds = new Set(topics.flatMap(t => t.concepts.map(c => t.id + '/' + c.id)));
const unique = (values: string[]) => new Set(values).size === values.length;
const map = (value: unknown, fn: (value: unknown, id: string) => boolean) =>
  obj(value) && Object.entries(value).every(([key, entry]) => knownQ(key) && fn(entry, key));

function examBase(value: Record<string, unknown>) {
  return validId(value.id) && validId(value.title) && enumOf(value.mode, ['boss','exam']) && typeof value.strict === 'boolean' &&
    values(value.questions, knownQ) && (value.questions as string[]).length > 0 && unique(value.questions as string[]) &&
    map(value.answers, validAnswer) && map(value.assistance, n => within(n, 0, 5)) &&
    [value.answers, value.assistance].every(x => Object.keys(x as object).every(key => (value.questions as string[]).includes(key)));
}

export function parseProgress(text: string): Progress {
  const p: unknown = JSON.parse(text);
  if (!obj(p) || p.version !== 1 || (p.module !== moduleInfo.id && p.module !== previousModuleCode) || !obj(p.settings) ||
    !within(p.settings.goal, 5, 240) || !date(p.settings.examDate) || !enumOf(p.settings.theme, ['light','dark']) ||
    !values(p.attempts, a => obj(a) && validId(a.id) && knownQ(a.question) && a.max === questionById[a.question].marks &&
      within(a.score, 0, a.max) && within(a.assistance, 0, 5) && (a.reviewAssistance === undefined || within(a.reviewAssistance, 1, 5)) && within(a.confidence, 1, 5) &&
      within(a.retries, 0, 10000) && finite(a.at) && within(a.seconds, 0, 1e7) && within(a.xp, 0, 50) &&
      enumOf(a.mode, ['practice','review','boss','exam']) && enumOf(a.graded, ['auto','self']) && validAnswer(a.answer)) ||
    !values(p.lessons, a => obj(a) && validId(a.id) && lessonIds.has(a.id) && finite(a.at) && within(a.minutes, 0, 30)) ||
    !map(p.reviews, a => obj(a) && finite(a.last) && finite(a.due) && within(a.box, 0, 5) && Number.isInteger(a.box)) ||
    !values(p.bookmarks, a => validId(a) && (Object.hasOwn(referenceById,a) || a.startsWith('concept/') && lessonIds.has(a.slice(8)))) ||
    !values(p.overrides, knownTopic) ||
    !(p.lectures === undefined || obj(p.lectures) && Object.entries(p.lectures).every(([topic, scenes]) =>
      Object.hasOwn(lectureScenes, topic) && values(scenes, s => Number.isInteger(s) && within(s, 0, lectureScenes[topic] - 1)) && new Set(scenes as number[]).size === (scenes as number[]).length)) ||
    !values(p.results, a => obj(a) && examBase(a) && finite(a.at) && within(a.seconds, 0, 1e7) && typeof a.finalized === 'boolean' &&
      map(a.scores, (score, q) => within(score, 0, questionById[q].marks)) && values(a.marked, knownQ) &&
      unique(a.marked as string[]) && (a.marked as string[]).every(id => (a.questions as string[]).includes(id) && Object.hasOwn(a.scores as object,id)) &&
      (!a.finalized || (a.marked as string[]).length === (a.questions as string[]).length)) ||
    !(p.activeExam === null || obj(p.activeExam) && examBase(p.activeExam) && finite(p.activeExam.started) &&
      (p.activeExam.deadline === null || finite(p.activeExam.deadline) && p.activeExam.deadline >= p.activeExam.started) &&
      within(p.activeExam.index, 0, (p.activeExam.questions as string[]).length - 1) && Number.isInteger(p.activeExam.index) &&
      values(p.activeExam.flags, knownQ) && (p.activeExam.flags as string[]).every(id => {
        const active = p.activeExam as Record<string, unknown>;
        return (active.questions as string[]).includes(id);
      }))) {
    throw new Error('This file does not match the StudyQuest progress format.');
  }
  const parsed = p as unknown as Progress;
  if (!unique(parsed.lessons.map(a => a.id)) || !unique(parsed.attempts.map(a => a.id)) || !unique(parsed.results.map(a => a.id))) {
    throw new Error('The progress file contains duplicate records.');
  }
  return backfillLessons({ ...parsed, lectures: parsed.lectures ?? {}, module: moduleInfo.id });
}

export function loadProgress() {
  try {
    const data = localStorage.getItem(storageKey) ?? localStorage.getItem('studyquest-' + previousModuleCode.toLowerCase() + '-progress-v1');
    return { progress: data ? parseProgress(data) : newProgress(), error: '' };
  } catch {
    return { progress: newProgress(), error: 'Saved progress could not be read. Import a backup or reset to start a new record.' };
  }
}

export function exportProgress(progress: Progress, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

