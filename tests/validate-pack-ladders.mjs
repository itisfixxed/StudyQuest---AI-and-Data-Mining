// Usage: node --experimental-strip-types tests/validate-pack-ladders.mjs <ladders.json> <brief.json>
// Validates ladders written for private study-pack questions (which are not in the repo).
import { readFileSync } from 'node:fs';
import { references } from '../src/content/index.ts';
import { ladderErrors } from './ladder-rules.mjs';
const [file, briefFile] = process.argv.slice(2);
const ladders = JSON.parse(readFileSync(file, 'utf8'));
const brief = JSON.parse(readFileSync(briefFile, 'utf8'));
const ids = new Set(references.map(r => r.id));
const errors = [...Object.keys(ladders).filter(id => !brief.some(q => q.id === id)).map(id => id + ': not in brief'),
  ...brief.flatMap(q => ladderErrors(q, ladders[q.id], ids))];
console.log(errors.length ? errors.join('\n') : 'OK ' + brief.length + ' questions');
process.exitCode = errors.length ? 1 : 0;
