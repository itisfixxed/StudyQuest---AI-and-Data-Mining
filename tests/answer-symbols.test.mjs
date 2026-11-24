import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingSymbols, symbolTrigger } from '../src/answer-symbols.ts';
import { arithmetic } from '../src/answers.ts';

test('symbol commands only replace the token immediately before the caret', () => {
  assert.deepEqual(symbolTrigger('Use #alp next', 8, 8), { start: 4, end: 8, query: 'alp' });
  assert.deepEqual(symbolTrigger('3#', 2, 2), { start: 1, end: 2, query: '' });
  assert.equal(symbolTrigger('Use #alpha later', 16, 16), null);
  assert.equal(symbolTrigger('Use #alpha', 4, 10), null);
});

test('symbol suggestions use the active module and match shortcuts', () => {
  assert.equal(matchingSymbols('ai-and-data-mining', false, 'learning-rate')[0].glyph, 'η');
  assert.equal(matchingSymbols('ie2106', false, 'chi')[0].glyph, 'χ²');
  assert.equal(matchingSymbols('information-security', false, 'xor')[0].glyph, '⊕');
  assert.equal(matchingSymbols('information-security', false, 'mod')[0].glyph, 'mod');
  assert.deepEqual(matchingSymbols('ai-and-data-mining', false, 'xor'), []);
  assert.equal(matchingSymbols('constructor', false, 'times')[0].glyph, '×');
});

test('numeric symbol shortcuts insert expressions the grader can evaluate', () => {
  const symbol = command => {
    const entry = matchingSymbols('ie2106', true, command)[0];
    return entry.insert ?? entry.glyph;
  };
  assert.equal(arithmetic('2' + symbol('times') + '3' + symbol('squared')), 18);
  assert.equal(arithmetic('2.5' + symbol('sci') + '−4'), 0.00025);
  assert.equal(arithmetic('2×' + symbol('pi')), 2 * Math.PI);
  assert.equal(arithmetic('11' + symbol('mod') + '4'), 3);
  assert.deepEqual(matchingSymbols('ie2106', true, 'integral'), []);
});
