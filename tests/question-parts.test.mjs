import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { questions } from '../src/content/index.ts';
import { createExam, finishExam, newProgress } from '../src/progress.ts';
import { groupWorkings, questionParts, responseStatus, splitResponse } from '../src/question-parts.ts';
import { parseProgress } from '../src/storage.ts';

const written = {
  kind: 'structured',
  source: { file: 'Example' },
  prompt: '(a) Find the mean. (b) Compute the sample variance.',
};

test('written questions use printed or explicit subpart labels', () => {
  assert.deepEqual(questionParts(written), ['a', 'b']);
  assert.deepEqual(questionParts({ ...written, prompt: 'Compare the methods (i) and (iii).' }), []);
  assert.deepEqual(questionParts({ ...written, kind: 'choice', options: ['A', 'B'] }), []);
  assert.deepEqual(questionParts({ ...written, source: { file: 'Example', subparts: ['i', 'ii', 'iii'] } }), ['i', 'ii', 'iii']);
});

test('multipart answers preserve a saved combined response and distinguish partial work', () => {
  assert.deepEqual(splitResponse('Earlier working', 2), { parts: ['', ''], earlier: 'Earlier working' });
  assert.deepEqual(splitResponse(['first', 'second', 'Earlier working'], 2), {
    parts: ['first', 'second'], earlier: 'Earlier working',
  });
  assert.equal(responseStatus(written, ['', '  ']), 'unanswered');
  assert.equal(responseStatus(written, ['first', '', 'Earlier working']), 'partially answered');
  assert.equal(responseStatus(written, ['first', 'second']), 'answered');
  assert.equal(responseStatus(written, 'Earlier working'), 'answered');
});

test('working steps follow their labelled part and keep the final summary separate', () => {
  const steps = ['Use the supplied data.', '(a) Find the sum.', '(b) Square the differences.',
    'Divide by n − 1.', '(a) Divide by n.', 'Answer: (a) 5. (b) 4.'];
  assert.deepEqual(groupWorkings(steps, ['a', 'b']), [
    { label: '', steps: ['Use the supplied data.'] },
    { label: 'a', steps: ['Find the sum.', 'Divide by n.'] },
    { label: 'b', steps: ['Square the differences.', 'Divide by n − 1.'] },
    { label: 'summary', steps: ['(a) 5. (b) 4.'] },
  ]);
});

test('long written answers survive loading an active and a submitted assessment', () => {
  const question = questions.find(q => q.kind === 'structured' || q.kind === 'short');
  const answer = ['a'.repeat(2_000), 'second part', 'earlier combined response'];
  const exam = createExam('Multipart practice', 'exam', [question.id], null, true);
  exam.answers[question.id] = answer;
  const progress = parseProgress(JSON.stringify({ ...newProgress(), activeExam: exam }));
  assert.deepEqual(progress.activeExam.answers[question.id], answer);
  const submitted = parseProgress(JSON.stringify(finishExam(progress)));
  assert.deepEqual(submitted.results[0].answers[question.id], answer);
  assert.deepEqual(submitted.results[0].marked, []);
});

test('calculation drills have sequenced workings with valid math notation', () => {
  const calculations = questions.filter(q => q.kind === 'number' || q.kind === 'expression');
  assert.ok(calculations.length);
  for (const question of calculations) {
    assert.ok(question.solution?.length >= 3, question.id);
    const expressions = question.solution.flatMap(step => [...step.matchAll(/\\\((.+?)\\\)/g)].map(match => match[1]));
    assert.ok(expressions.length >= 2, question.id);
    for (const expression of expressions) {
      assert.doesNotThrow(() => katex.renderToString(expression, { throwOnError: true }), question.id);
    }
  }
});
