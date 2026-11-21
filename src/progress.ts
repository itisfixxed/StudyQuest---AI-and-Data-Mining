import type { ActiveExam, Answer, Attempt, ExamResult, Progress, Question, Topic } from './types.ts';
import { isManual, moduleInfo, questions, questionById, topicById, topicHistory, topics } from './content/index.ts';
import { automaticScore, hasAnswer } from './answers.ts';

export const storageKey = 'studyquest-' + moduleInfo.id.toLowerCase() + '-progress-v1';
// Mobile browsers restrict randomUUID on HTTP over a local network.
export function createRecordId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export const dayMs = 86_400_000;
const xpByDifficulty = { easy: 10, medium: 20, hard: 35, exam: 50 };
const masteryWeight = { easy: 15, medium: 23, hard: 32, exam: 39 };
export const newProgress = (): Progress => ({
  version: 1, module: moduleInfo.id, settings: { goal: 25, examDate: moduleInfo.examDate, theme: 'light' }, attempts: [], lessons: [],
  reviews: {}, bookmarks: [], overrides: [], results: [], activeExam: null
});

export function localDate(at = Date.now()) {
  const date = new Date(at);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function calendarNumber(date: string) {
  return Date.parse(date + 'T00:00:00Z') / dayMs;
}
export function daysUntil(date: string, now = Date.now()) {
  return date ? calendarNumber(date) - calendarNumber(localDate(now)) : null;
}
export function dayOffset(amount: number, at = Date.now()) {
  const date = new Date(at);
  date.setDate(date.getDate() + amount);
  return date.valueOf();
}
export function weekStart(at = Date.now()) {
  const date = new Date(at);
  const weekday = (date.getDay() + 6) % 7;
  return localDate(dayOffset(-weekday, at));
}

export function byTopic(progress: Progress) {
  const map = new Map<string, Attempt[]>();
  for (const attempt of progress.attempts) {
    const q = questionById[attempt.question];
    if (!q) continue;
    const set = map.get(q.topic) ?? [];
    set.push(attempt);
    map.set(q.topic, set);
  }
  return map;
}

export function profile(progress: Progress) {
  const attemptsByTopic = byTopic(progress);
  const lessons = new Set(progress.lessons.map(record => record.id));
  return topics.map(topic => {
    const attempts = attemptsByTopic.get(topic.id) ?? [];
    const completed = topic.concepts.filter(concept => lessons.has(topic.id + '/' + concept.id)).length;
    const best = new Map<string, number>();
    const independentlySolved = new Set<string>();
    const autoIndependent = attempts.filter(a => a.assistance === 0 && a.retries === 0 && a.graded === 'auto');
    for (const attempt of attempts) {
      const question = questionById[attempt.question];
      const score = attempt.score / attempt.max;
      // Self-scoring and assistance contribute evidence at a lower weight.
      const confidence = attempt.graded === 'self' ? 0.75 : 1;
      const independent = attempt.assistance === 0 && attempt.retries === 0;
      const weight = masteryWeight[question.difficulty] * score * confidence * (independent ? 1 : 0.35);
      if (independent && score >= 0.75) independentlySolved.add(question.id);
      best.set(question.id, Math.max(best.get(question.id) ?? 0, weight));
    }
    const boss = progress.results.some(result => result.finalized && result.mode === 'boss' &&
      result.questions.every(id => questionById[id]?.topic === topic.id && !result.assistance[id]) &&
      result.questions.reduce((sum, id) => sum + (result.scores[id] ?? 0), 0) >= result.questions.reduce((sum, id) => sum + questionById[id].marks, 0) * 0.75);
    const evidence = [...best.values()].reduce((sum, score) => sum + score, 0);
    const advancedEvidence = [...independentlySolved].some(id => ['hard','exam'].includes(questionById[id].difficulty));
    const retentionPenalty = [...independentlySolved].filter(id => (progress.reviews[id]?.due ?? Infinity) + dayMs * 3 < Date.now()).length * 2;
    const score = Math.max(0, Math.min(boss ? 100 : advancedEvidence ? 90 : independentlySolved.size >= 2 ? 75 : 45,
      Math.round(20 * completed / topic.concepts.length + evidence + (boss ? 20 : 0) - Math.min(retentionPenalty, 15))));
    const stage = boss && score >= 75 ? 4 : independentlySolved.size >= 2 ? 3 :
      attempts.some(a => a.score > 0 && (a.assistance > 0 || a.graded === 'self')) ? 2 : completed > 0 ? 1 : 0;
    const accuracy = autoIndependent.length ? Math.round(100 * autoIndependent.filter(a => a.score === a.max).length / autoIndependent.length) : null;
    return { topic, score, stage, attempts, completed, independent: independentlySolved.size, accuracy, boss };
  });
}

export function streak(progress: Progress, at = Date.now()) {
  const dates = new Set([...progress.attempts, ...progress.lessons].map(a => localDate(a.at)));
  let day = dates.has(localDate(at)) ? 0 : -1;
  let count = 0;
  while (dates.has(localDate(dayOffset(day, at)))) { count++; day--; }
  return count;
}
export function dailyMinutes(progress: Progress, date = localDate()) {
  const lessonTime = progress.lessons.filter(a => localDate(a.at) === date).reduce((sum, a) => sum + a.minutes, 0);
  const attemptSeconds = progress.attempts.filter(a => localDate(a.at) === date).reduce((sum, a) => sum + Math.min(a.seconds, 3600), 0);
  // Exam-question timings are registered via the assessment total instead of duplicating it on each record.
  const examSeconds = progress.results.filter(a => localDate(a.at) === date).reduce((sum, a) => sum + a.seconds, 0);
  return Math.floor(lessonTime + (attemptSeconds + examSeconds) / 60);
}

export function totals(progress: Progress) {
  const independent = progress.attempts.filter(a => a.assistance === 0 && a.retries === 0 && a.graded === 'auto');
  const xp = progress.lessons.length * 20 + progress.attempts.reduce((sum, a) => sum + a.xp, 0) +
    new Set(progress.results.filter(r => r.mode === 'boss' && r.finalized &&
      r.questions.reduce((sum,id) => sum + (r.scores[id] ?? 0),0) >= 0.75 * r.questions.reduce((sum,id) => sum + questionById[id].marks,0))
      .map(r => questionById[r.questions[0]].topic)).size * 100;
  const data = profile(progress);
  const completion = Math.round(100 * data.reduce((sum, t) => sum + t.completed, 0) / topics.reduce((sum, t) => sum + t.concepts.length, 0));
  const weighted = data.reduce((sum, t) => sum + t.score * (1 + topicHistory[t.topic.id].papers), 0);
  const readiness = Math.round(weighted / data.reduce((sum, t) => sum + 1 + topicHistory[t.topic.id].papers, 0));
  return { xp, level: 1 + Math.floor(xp / 200), completion, readiness, streak: streak(progress), minutes: dailyMinutes(progress),
    attempted: new Set(progress.attempts.map(a => a.question)).size, accuracy: independent.length ? Math.round(100 * independent.filter(a => a.score === a.max).length / independent.length) : null };
}

export function topicLocked(topic: Topic, progress: Progress, data = profile(progress)) {
  return !progress.overrides.includes(topic.id) && topic.prerequisites.some(id => (data.find(p => p.topic.id === id)?.score ?? 0) < 25);
}

export function addLesson(progress: Progress, id: string, seconds: number, at = Date.now()): Progress {
  if (progress.lessons.some(lesson => lesson.id === id)) return progress;
  return { ...progress, lessons: [...progress.lessons, { id, at, minutes: Math.max(1, Math.min(30, seconds / 60)) }] };
}
export function reviewDate(box: number, examDate: string, now: number) {
  const days = [1, 2, 4, 8, 15, 30][box];
  const scheduled = dayOffset(days, now);
  const until = daysUntil(examDate, now);
  return until !== null && until >= 0 && until <= days ? dayOffset(Math.max(0, until - 1), now) + (until <= 1 ? 3_600_000 : 0) : scheduled;
}
export function recordAttempt(progress: Progress, q: Question,
  data: Pick<Attempt,'answer'|'score'|'assistance'|'retries'|'confidence'|'seconds'|'mode'>,
  now = Date.now(), id = createRecordId()): Progress {
  const existing = progress.attempts.filter(a => a.question === q.id);
  const independent = data.assistance === 0 && data.retries === 0;
  const full = data.score === q.marks;
  const factor = independent ? 1 : [1, 0.82, 0.65, 0.52, 0.38, 0.15][Math.min(5, Math.max(data.assistance, 1))];
  const earned = full ? Math.round(xpByDifficulty[q.difficulty] * factor * (isManual(q) ? 0.75 : 1)) : 0;
  const previousXp = existing.reduce((sum, a) => sum + a.xp, 0);
  const xp = Math.max(0, earned - previousXp);
  const attempt: Attempt = { ...data, id, question: q.id, max: q.marks, graded: isManual(q) ? 'self' : 'auto', at: now, xp };
  const previous = progress.reviews[q.id];
  const strong = independent && full && data.confidence >= 3;
  const box = strong ? Math.min(5, (previous?.box ?? -1) + 1) : full ? Math.max(0, (previous?.box ?? 0) - 1) : 0;
  const due = data.score < q.marks * 0.75 ? now + 3_600_000 : reviewDate(box, progress.settings.examDate, now);
  return { ...progress, attempts: [...progress.attempts, attempt], reviews: { ...progress.reviews, [q.id]: { box, due, last: now } } };
}

export function dueQuestions(progress: Progress, at = Date.now()) {
  return Object.entries(progress.reviews).filter(([id, review]) => review.due <= at && id in questionById)
    .sort((a,b) => a[1].due - b[1].due).map(([id]) => id);
}

export function mistakes(progress: Progress) {
  const groups = new Map<string, Attempt[]>();
  for (const attempt of progress.attempts) {
    if (!(attempt.question in questionById)) continue;
    const records = groups.get(attempt.question) ?? [];
    records.push(attempt);
    groups.set(attempt.question, records);
  }
  return [...groups.entries()].flatMap(([id, records]) => {
    const incorrect = records.filter(a => a.score < a.max);
    const latest = incorrect.at(-1);
    if (!latest) return [];
    const resolved = records.at(-1)?.score === records.at(-1)?.max && records.at(-1)?.assistance === 0 && records.at(-1)?.retries === 0;
    return [{ q: questionById[id], latest, count: incorrect.length, attempts: records.length, resolved }];
  }).sort((a,b) => Number(a.resolved) - Number(b.resolved) || b.count - a.count || b.latest.at - a.latest.at);
}

export type Recommendation = { kind: 'lesson'|'practice'|'review'|'boss'; topic: string; ids: string[]; concept?: string; title: string; reason: string };
export function recommend(progress: Progress): Recommendation {
  const data = profile(progress);
  const repeated = mistakes(progress).find(item => !item.resolved && item.count >= 2);
  if (repeated) {
    const { q, latest } = repeated;
    const sameSkill = progress.attempts.filter(a => questionById[a.question]?.topic === q.topic && questionById[a.question]?.subtopic === q.subtopic);
    if (!sameSkill.some(a => a.at > latest.at && a.score === a.max && a.question !== q.id && a.assistance === 0)) {
      const topic = topicById[q.topic];
      const concept = topic.concepts.find(c => c.id === q.subtopic)!;
      const pool = questions.filter(item => item.topic === q.topic && item.origin === 'generated' && item.id !== q.id);
      const simpler = pool.find(item => item.subtopic === q.subtopic && item.difficulty === 'easy') ?? pool.find(item => item.difficulty === 'easy');
      const bridge = ['hard', 'exam'].includes(q.difficulty) ? pool.find(item => item.subtopic === q.subtopic && item.difficulty === 'medium') : undefined;
      return { kind: 'lesson', topic: q.topic, concept: concept.id, ids: [simpler?.id, bridge?.id, q.id].filter((id): id is string => Boolean(id)),
        title: 'Refresh ' + concept.name, reason: 'A recurring mistake needs a refresher and a simpler example before you retry.' };
    }
  }
  const due = dueQuestions(progress);
  if (due.length) return { kind: 'review', topic: questionById[due[0]].topic, ids: due.slice(0,4), title: 'Review due questions', reason: due.length + ' items are ready for spaced review.' };
  const started = data.find(p => p.completed > 0 && p.completed < p.topic.concepts.length && !topicLocked(p.topic, progress, data));
  const next = started ?? data.find(p => p.completed === 0 && !topicLocked(p.topic, progress, data));
  if (next) {
    const concept = next.topic.concepts.find(c => !progress.lessons.some(l => l.id === next.topic.id + '/' + c.id))!;
    return { kind: 'lesson', topic: next.topic.id, concept: concept.id, ids: [], title: 'Continue learning', reason: concept.name + ' builds your foundation for ' + next.topic.short + '.' };
  }
  const available = data.filter(item => !topicLocked(item.topic, progress, data));
  const chosen = (available.length ? available : data).sort((a,b) => a.score - b.score)[0];
  const difficulty = chosen.score < 30 ? 'easy' : chosen.score < 60 ? 'medium' : 'hard';
  const candidates = questions.filter(q => q.topic === chosen.topic.id && q.origin === 'generated');
  const unseen = candidates.filter(q => q.difficulty === difficulty && !progress.attempts.some(a => a.question === q.id && a.score === a.max && a.assistance === 0));
  if (!unseen.length && chosen.score >= 60 && !chosen.boss) return { kind: 'boss', topic: chosen.topic.id, ids: [], title: 'Start a Boss Battle', reason: 'Combine multiple skills in ' + chosen.topic.short + '.' };
  return { kind: 'practice', topic: chosen.topic.id, ids: (unseen.length ? unseen : candidates).slice(0,4).map(q => q.id), title: 'Practice ' + chosen.topic.short,
    reason: 'Target the lowest mastery score with questions at a suitable difficulty.' };
}

export function createExam(title: string, mode: ActiveExam['mode'], ids: string[], minutes: number | null, strict: boolean, now = Date.now()): ActiveExam {
  const unique = [...new Set(ids.filter(id => id in questionById))];
  if (!unique.length) throw new Error('An assessment needs at least one question');
  return { id: createRecordId(), title, mode, questions: unique, strict, started: now, deadline: minutes === null ? null : now + minutes * 60_000,
    index: 0, flags: [], answers: {}, assistance: {} };
}
export function finishExam(progress: Progress, now = Date.now()): Progress {
  const exam = progress.activeExam;
  if (!exam || progress.results.some(result => result.id === exam.id)) return progress;
  const result: ExamResult = {
    id: exam.id, title: exam.title, mode: exam.mode, at: now, questions: exam.questions, answers: exam.answers, assistance: exam.assistance,
    strict: exam.strict, seconds: Math.max(0, Math.round((Math.min(now, exam.deadline ?? now) - exam.started) / 1000)),
    scores: {}, marked: [], finalized: false
  };
  for (const id of exam.questions) {
    const question = questionById[id];
    if (isManual(question) && hasAnswer(exam.answers[id])) continue;
    result.scores[id] = isManual(question) ? 0 : automaticScore(question, exam.answers[id]);
    result.marked.push(id);
  }
  const draft = { ...progress, activeExam: null, results: [...progress.results, result] };
  return result.marked.length === result.questions.length ? finalizeResult(draft, result.id) : draft;
}

export function markExam(progress: Progress, resultId: string, questionId: string, score: number): Progress {
  const result = progress.results.find(r => r.id === resultId);
  const q = questionById[questionId];
  if (!result || result.finalized || !result.questions.includes(questionId) || !q || !isManual(q) || !Number.isFinite(score) || score < 0 || score > q.marks) return progress;
  return { ...progress, results: progress.results.map(r => r.id === resultId ? {
    ...r, scores: { ...r.scores, [questionId]: score }, marked: [...new Set([...r.marked, questionId])]
  } : r) };
}

export function finalizeResult(progress: Progress, id: string) {
  const result = progress.results.find(r => r.id === id);
  if (!result || result.finalized || result.marked.length !== result.questions.length) return progress;
  const updated = result.questions.reduce((state, question) => recordAttempt(state, questionById[question], {
    answer: result.answers[question] ?? '', score: result.scores[question] ?? 0, assistance: result.assistance[question] ?? 0,
    retries: 0, confidence: 3, seconds: 0, mode: result.mode
  }, result.at), progress);
  return { ...updated, results: updated.results.map(r => r.id === id ? { ...r, finalized: true } : r) };
}

