import { questionById, topicHistory } from './content/index.ts';
import { dailyMinutes, dayOffset, daysUntil, dueQuestions, localDate, mistakes, profile, topicLocked, weekStart } from './progress.ts';
import type { Progress } from './types.ts';

export function personalQuests(p: Progress) {
  const now = localDate();
  const week = weekStart();
  const solved = (date: string) => new Set(p.attempts.filter(a => localDate(a.at) >= date && !a.assistance && !a.retries && a.score === a.max && a.graded === 'auto').map(a => a.question)).size;
  const newLessons = (date: string) => p.lessons.filter(l => localDate(l.at) >= date).length;
  return {
    daily: [
      { title: 'Study for ' + p.settings.goal + ' minutes', value: dailyMinutes(p), target: p.settings.goal, icon: 'timer' },
      { title: 'Complete a lesson', value: newLessons(now), target: 1, icon: 'book' },
      { title: 'Solve independently', value: solved(now), target: 3, icon: 'target' }
    ],
    weekly: [
      { title: 'Complete four lessons', value: newLessons(week), target: 4, icon: 'book' },
      { title: 'Solve ten questions independently', value: solved(week), target: 10, icon: 'target' },
      { title: 'Finish a Boss Battle', value: p.results.filter(r => r.finalized && r.mode === 'boss' && localDate(r.at) >= week).length, target: 1, icon: 'swords' }
    ]
  };
}

export function studyPlan(p: Progress, minutes: number, crash: boolean, at = Date.now()) {
  const errors = mistakes(p).filter(item => !item.resolved);
  const data = profile(p);
  const ranked = data.map(item => ({
    ...item,
    locked: topicLocked(item.topic, p, data),
    priority: 100 - item.score + 8 * topicHistory[item.topic.id].papers + 4 * item.topic.difficulty +
      (item.topic.revision ? 12 : 0) + errors.filter(error => error.q.topic === item.topic.id).reduce((sum,error) => sum + Math.min(error.count,3) * 4, 0)
  })).sort((a,b) => b.priority - a.priority);
  const days = daysUntil(p.settings.examDate, at);
  const horizon = days !== null && days >= 0 ? Math.max(days,1) : 7;
  const count = Math.min(horizon,crash ? 3 : 7);
  const due = dueQuestions(p, at);
  const scheduled = new Set<string>();
  return Array.from({length: count}, (_, index) => {
    const item = ranked.find(item => !scheduled.has(item.topic.id) && (crash && index > 0 || !item.locked || item.topic.prerequisites.every(id =>
      scheduled.has(id) || (data.find(topic => topic.topic.id === id)?.score ?? 0) >= 25))) ?? ranked[index % ranked.length];
    scheduled.add(item.topic.id);
    const prerequisites = item.topic.prerequisites.filter(id => (data.find(topic => topic.topic.id === id)?.score ?? 0) < 25);
    const review = index === 0 && due.length ? Math.min(10, Math.floor(minutes / 4)) : 0;
    const study = Math.max(2, Math.round((minutes - review) * (item.completed === item.topic.concepts.length ? 0.27 : 0.5)));
    const practice = Math.max(0, minutes - review - study);
    return {
      date: localDate(dayOffset(index, at)), item, study, practice, review, prerequisites,
      drill: crash || item.score > 55 ? 'Exam-style practice' : 'Guided practice',
      reason: topicHistory[item.topic.id].papers ? 'Seen in ' + topicHistory[item.topic.id].papers + ' supplied papers' : 'Supports the current syllabus'
    };
  });
}

export function subtopicRows(progress: Progress, id: string) {
  const target = profile(progress).find(p => p.topic.id === id);
  return (target?.topic.concepts ?? []).map(c => {
    const attempts = target?.attempts.filter(a => questionById[a.question]?.subtopic === c.id) ?? [];
    return { concept: c, attempts: attempts.length, full: attempts.filter(a => a.score === a.max && !a.assistance && !a.retries).length,
      confidence: attempts.length ? attempts.reduce((s,a) => s + a.confidence,0) / attempts.length : null,
      timing: attempts.length ? attempts.reduce((s,a) => s + a.seconds,0) / attempts.length : 0 };
  });
}

