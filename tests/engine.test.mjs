import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import katex from 'katex';
import { automaticScore, arithmetic, checkStep } from '../src/answers.ts';
import { bossQuestions, historical, historicalParts, isManual, knowledgeQuestions, papers, questionById, questions, referenceById, references, topics } from '../src/content/index.ts';
import { createExam, daysUntil, finishExam, finalizeResult, markExam, mistakes, newProgress, profile, recordAttempt, recommend, reviewDate, totals } from '../src/progress.ts';
import { studyPlan } from '../src/planning.ts';
import { parseProgress } from '../src/storage.ts';

test('every lesson, question, marking rubric and prerequisite has valid content and sources', () => {
  assert.equal(questions.length, new Set(questions.map(q => q.id)).size);
  const seen = new Set();
  const sourceExists = source => assert.ok(typeof source?.file === "string" && source.file.length > 0);
  for (const topic of topics) {
    assert.ok(topic.prerequisites.every(id => seen.has(id)));
    seen.add(topic.id);
    assert.ok(bossQuestions(topic.id).every(q => q.topic === topic.id));
    for (const concept of topic.concepts) {
      sourceExists(concept.source);
      assert.ok(knowledgeQuestions.some(q => q.topic === topic.id && q.subtopic === concept.id));
      const scoped = questions.filter(q => q.topic === topic.id && q.subtopic === concept.id && q.origin === 'generated');
      assert.equal(scoped.filter(q => q.difficulty === 'easy').length, 3);
      assert.ok(scoped.some(q => q.difficulty === 'medium'));
      assert.equal(concept.check.length, 4);
      assert.equal(concept.apply.length, 4);
    }
  }
  for (const entry of references) {
    sourceExists(entry.source);
    assert.doesNotThrow(() => katex.renderToString(entry.expression, { throwOnError: true }), entry.id);
  }
  for (const q of questions) {
    sourceExists(q.source);
    assert.ok(topics.find(t => t.id === q.topic)?.concepts.some(c => c.id === q.subtopic), q.id);
    assert.ok(q.formulas.every(id => Object.hasOwn(referenceById, id)), q.id);
    assert.ok(q.guidance.walkthrough.length > 0 && q.guidance.scaffold.prompt, q.id);
    if (isManual(q)) assert.equal(q.rubric.reduce((total,c) => total + c.points,0),q.marks,q.id);
    else assert.equal(automaticScore(q, Array.isArray(q.answer) && q.kind !== 'multi' ? q.answer[0] : q.answer),q.marks,q.id);
    for (const step of [q.guidance.scaffold,...q.guidance.walkthrough]) assert.ok(checkStep(step,String(step.answer)),q.id);
  }
});

test('the public package contains generated questions only', () => {
  assert.deepEqual(papers, []);
  assert.deepEqual(historicalParts, []);
  assert.ok(historical.every(topic => topic.marks === 0));
  assert.equal(questions.length,208);
  assert.ok(questions.every(question => question.origin === 'generated' && !question.figures));
  assert.equal(existsSync(new URL('../public/papers', import.meta.url)), false);
});

test('arithmetic accepts equivalent fractions, roots and log expressions without evaluating code', () => {
  assert.equal(arithmetic('2^3^2'), 512);
  assert.equal(arithmetic('64,000,000'),64_000_000);
  assert.equal(arithmetic('-2^2'),-4);
  assert.equal(arithmetic('sqrt(9+16)'),5);
  assert.equal(arithmetic('√(16)+log2(8)'),7);
  assert.equal(arithmetic('sqrt(-1)'),null);
  assert.equal(arithmetic('1 / 0'),null);
  assert.equal(arithmetic('Math.pow(5,2)'),null);
  assert.equal(arithmetic('2^10000000'),null);
  assert.equal(automaticScore(questionById['bayes-d'],'7/25'),2);
  assert.equal(automaticScore(questionById['distance-root'],'sqrt(3^2+4^2)'),2);
  assert.equal(automaticScore(questionById['blank-state-bfs-dfs'],' FIFO queue '),1);
  const choose = questionById['multi-nb-evidence'];
  assert.equal(automaticScore(choose,choose.answer),2);
  assert.equal(automaticScore(choose,[...choose.answer,choose.options[2]]),1);
  assert.throws(()=>automaticScore(questionById['case-neural'],'a response'));
});

const when = new Date(2026,10,20,12,0).getTime();
const attempt = (q, extra={}) => ({answer:q.answer,score:q.marks,assistance:0,retries:0,confidence:4,seconds:40,mode:'practice',...extra});

test('repeating a solved question gives no additional XP or mastery', () => {
  const q = questionById['check-foundations-goals'];
  const independent = recordAttempt(newProgress(),q,attempt(q),when);
  const replay = recordAttempt(independent,q,attempt(q),when + 10_000);
  assert.equal(totals(replay).xp, totals(independent).xp);
  assert.equal(profile(replay)[0].score, profile(independent)[0].score);
  const assisted = recordAttempt(newProgress(),q,attempt(q,{assistance:4}),when);
  assert.ok(totals(assisted).xp < totals(independent).xp);
  assert.ok(profile(assisted)[0].score < profile(independent)[0].score);
  assert.equal(totals(assisted).accuracy, null);
});

test('repeated mistakes trigger a concept refresher and later independent success resolves the mistake', () => {
  const q = questionById['neural-relu'];
  const wrong = attempt(q,{score:0,answer:'9'});
  const first = recordAttempt(newProgress(),q,wrong,when);
  const second = recordAttempt(first,q,wrong,when + 100);
  assert.equal(mistakes(second)[0].count,2);
  const rec = recommend(second);
  assert.equal(rec.kind,'lesson');
  assert.equal(rec.topic,'neural');
  assert.equal(rec.ids.at(-1),q.id);
  assert.equal(questionById[rec.ids[0]].difficulty,'easy');
  assert.equal(questionById[rec.ids[1]].difficulty,'medium');
  const right = recordAttempt(second,q,attempt(q),when + 200);
  assert.equal(mistakes(right)[0].resolved,true);
});

test('review intervals adapt to an exam date and the fresh planner sequences prerequisites', () => {
  const p = newProgress();
  assert.equal(p.settings.examDate,'');
  assert.equal(daysUntil('2026-11-26',when),6);
  assert.ok(reviewDate(5,'2026-11-22',when) < reviewDate(5,'',when));
  const plan = studyPlan(p,25,false,when);
  assert.equal(plan[0].item.topic.id,'foundations');
  assert.equal(new Set(plan.map(s=>s.item.topic.id)).size,plan.length);
  assert.ok(plan.every(s=>s.study+s.practice+s.review===25));
  assert.equal(studyPlan(p,25,true,when).length,3);
});

test('timed submission keeps draft answers and requires explicit written marking', () => {
  const objective = questionById['bayes-d'];
  const manual = questionById['case-bayes'];
  const exam = createExam('Bayesian assessment','exam',[objective.id,manual.id],1,true,when);
  exam.answers[objective.id] = '7/25';
  exam.answers[manual.id] = 'My working';
  const draft = finishExam({...newProgress(),activeExam:exam},when+80_000);
  assert.equal(draft.activeExam,null);
  assert.equal(draft.results[0].seconds,60);
  assert.equal(draft.results[0].scores[objective.id],2);
  assert.equal(draft.results[0].finalized,false);
  assert.equal(finalizeResult(draft,exam.id),draft);
  const marked = markExam(draft,exam.id,manual.id,6);
  const complete = finalizeResult(marked,exam.id);
  assert.equal(complete.attempts.length,2);
  assert.equal(complete.results[0].scores[manual.id],6);
  assert.equal(complete.attempts[1].graded,'self');
  assert.equal(finalizeResult(complete,exam.id),complete);
  assert.deepEqual(parseProgress(JSON.stringify(complete)),complete);
});

test('backups are scoped to the module and reject bad dates, unknown questions and invalid exam positions', () => {
  const p = newProgress();
  assert.throws(()=>parseProgress(JSON.stringify({...p,module:'IE4758'})));
  assert.throws(()=>parseProgress(JSON.stringify({...p,settings:{...p.settings,examDate:'2026-02-30'}})));
  const exam = createExam('Mock','exam',['bayes-d'],5,true,when);
  assert.throws(()=>parseProgress(JSON.stringify({...p,activeExam:{...exam,index:1}})));
  assert.throws(()=>parseProgress(JSON.stringify({...p,activeExam:{...exam,questions:['missing']}})));
  assert.deepEqual(parseProgress(JSON.stringify({...p,activeExam:exam})).activeExam,exam);
});

