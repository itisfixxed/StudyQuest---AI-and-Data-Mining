import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudySearch } from '../src/study-search.ts';

const topics = [{
  id: 'public-key', name: 'Public-Key Cryptography, RSA and Diffie–Hellman', short: 'Public-key cryptography', summary: '',
  concepts: [
    { id: 'rsa', name: 'Textbook RSA', formulas: ['rsa'], intuition: '', formal: '' },
    { id: 'dh', name: 'Diffie–Hellman', formulas: [], intuition: '', formal: '' },
  ],
}];
const questions = [
  { id: 'tutorial', topic: 'public-key', subtopic: 'rsa', title: 'Private exponent', prompt: 'Find d.', origin: 'exercise',
    source: { file: 'Tutorial.pdf', question: '1' }, formulas: [] },
  { id: 'dh', topic: 'public-key', subtopic: 'dh', title: 'Diffie–Hellman arithmetic', prompt: 'Find the shared value.', origin: 'original',
    source: { file: 'Paper.pdf', year: '2023-2024', semester: 1, question: '1b' }, formulas: [] },
  { id: 'exam', topic: 'public-key', subtopic: 'rsa', title: 'RSA signing', prompt: 'Calculate the signature.', origin: 'original',
    source: { file: 'Paper.pdf', year: '2023-2024', semester: 1, question: '1a', subparts: ['i', 'ii'] }, formulas: ['rsa'] },
];
const search = createStudySearch(topics, questions, [{ id: 'rsa', title: 'Textbook RSA key conditions' }]);

test('module search groups direct matches and related subtopic questions without pulling in sibling questions', () => {
  const found = search(' RSA ');
  assert.equal(found.topics[0].topic.id, 'public-key');
  assert.equal(found.topics[0].concept, 'Textbook RSA');
  assert.deepEqual(found.tutorials.map(q => q.id), ['tutorial']);
  assert.deepEqual(found.exams.map(q => q.id), ['exam']);
  assert.deepEqual(search('rsa 2023-2024').exams.map(q => q.id), ['exam']);
  assert.equal(search('rsa 2023-2024').tutorials.length, 0);
});

test('printed question labels match exactly with or without punctuation', () => {
  for (const query of ['Q1a', 'Q1(a)', '1(a)(ii)']) assert.deepEqual(search(query).exams.map(q => q.id), ['exam']);
  assert.equal(search('Q1(a)(iii)').exams.length, 0);
});
