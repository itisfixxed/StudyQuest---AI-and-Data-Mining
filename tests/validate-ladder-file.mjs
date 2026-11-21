// Usage: node --experimental-strip-types tests/validate-ladder-file.mjs <ladders.json> [topic]
import { readFileSync } from 'node:fs';
import { practiceQuestions, references } from '../src/content/index.ts';
import { ladderErrors } from './ladder-rules.mjs';
const [file, topic] = process.argv.slice(2);
const ladders = JSON.parse(readFileSync(file, 'utf8'));
const ids = new Set(references.map(r => r.id));
const scope = practiceQuestions.filter(q => !topic || q.topic === topic);
const errors = [...Object.keys(ladders).filter(id => !practiceQuestions.some(q => q.id === id)).map(id => id + ': unknown question id'),
  ...scope.flatMap(q => ladderErrors(q, ladders[q.id], ids))];
console.log(errors.length ? errors.join('\n') : 'OK ' + scope.length + ' questions');
process.exitCode = errors.length ? 1 : 0;
