import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { activateModule, bossQuestions, lectures, lectureScenes, moduleInfo, papers, questions, topicById, topicHistory } from '../src/content/index.ts';
import { builtinModule, validateModulePack } from '../src/module-pack.ts';
import { mergeProgress, newProgress, storageKey } from '../src/progress.ts';
import { loadProgress, parseProgress } from '../src/storage.ts';
import { modulePackEntryName, parseModulePayload, readModulePack, readPack, selectModule, selectedModuleId } from '../src/study-pack.ts';
import { previousModuleCode } from '../src/legacy-storage.ts';

function demoPack() {
  const source = { file: 'Example.pdf', page: 1 };
  const topic = {
    id: 'example-topic', name: 'Example topic', short: 'Example', icon: 'book', color: 'teal',
    summary: 'A worked example', prerequisites: [], sources: [source], difficulty: 1, revision: false,
    concepts: [{
      id: 'example-concept', name: 'Example concept', intuition: 'Intuition', formal: 'Formal statement',
      cue: 'Cue', pitfall: 'Pitfall', example: 'Example', source, formulas: ['example-formula'],
      check: ['Which is correct?', 'A', 'B', 'C'], apply: ['Explain the setup.', 'Solution', 'Criterion A', 'Criterion B']
    }]
  };
  const check = { prompt: 'Choose one.', options: ['A', 'B'], answer: 0, why: 'Justification', retry: 'Look at the setup.' };
  const practice = {
    id: 'case-example-topic', topic: topic.id, subtopic: topic.concepts[0].id, title: 'Example case',
    origin: 'generated', prompt: 'Work through the case.', difficulty: 'exam', kind: 'structured', answer: 'Answer',
    marks: 2, minutes: 3, objective: 'Work through the case', formulas: ['example-formula'], source,
    explanation: 'Explanation', misconception: 'Misconception',
    rubric: [{ text: 'Justify the result', points: 2 }], solution: ['Derive the result.', 'Answer'],
    guidance: { recall: 'Recall', direction: 'Direction', scaffold: check, walkthrough: [check],
      ladder: [
        { kind: 'formula', title: 'Formula', text: 'Start with this identity.', aid: 1, formulas: ['example-formula'], check },
        { kind: 'assemble', title: 'Put it together', text: 'Combine the intermediate results.', aid: 4 },
      ] }
  };
  const knowledge = {
    ...practice, id: 'check-example-topic-example-concept', kind: 'choice', difficulty: 'easy',
    options: ['A', 'B'], answer: 'A',
  };
  const original = {
    ...practice, id: 'past-example', origin: 'original', figures: [{ src: 'sample.webp', alt: 'Original question' }]
  };
  return {
    version: 2, module: { id: 'example-maths', name: 'Example Mathematics', examDate: '' },
    topics: [topic], references: [{
      id: 'example-formula', title: 'Formula', topic: topic.id, expression: 'x+1',
      purpose: 'Purpose', assumptions: 'Assumptions', example: 'Example', variation: 'Variation', mistake: 'Mistake', source,
    }],
    lectures: { [topic.id]: { goal: 'Goal', explain: 'Explain', model: 'Model', points: ['Point'],
      scenes: ['First', 'Second', 'Third'].map(title => ({
        concept: topic.concepts[0].id, title, content: 'Content', table: { columns: ['Value'], rows: [['1']] },
        check: { prompt: 'Choose one.', options: ['A', 'B'], right: 0, hint: 'Hint', feedback: 'Feedback' }
      }))
    } },
    practiceQuestions: [practice, knowledge], questions: [original], exercises: [],
    scans: { 'sample.webp': 'UklGRgQAAABXRUJQ' },
    papers: [{ id: 'example-paper', year: '2025-2026', semester: 1, file: 'Example.pdf', duration: 120,
      parts: [{ label: '1(a)', marks: 2, page: 1, topic: topic.id, pattern: 'Compute a value', questionId: original.id }]
    }],
  };
}

const encodedPack = pack => new TextEncoder().encode(JSON.stringify(pack));

function storedEntry(pack, name = modulePackEntryName) {
  const entry = new TextEncoder().encode(name);
  const payload = encodedPack(pack);
  const archive = new Uint8Array(30 + entry.length + payload.length);
  const header = new DataView(archive.buffer);
  header.setUint32(0, 0x04034b50, true);
  header.setUint32(18, payload.length, true);
  header.setUint32(22, payload.length, true);
  header.setUint16(26, entry.length, true);
  archive.set(entry, 30);
  archive.set(payload, 30 + entry.length);
  return archive;
}

function deflatedModuleEntry(payload, extractedSize = payload.length) {
  const name = Buffer.from(modulePackEntryName);
  const compressed = deflateRawSync(payload);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(extractedSize, 22);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(extractedSize, 24);
  directory.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return new Blob([local, name, compressed, directory, name, end]);
}

test('v2 parses JSON and the named stored ZIP entry, and import rejects unsigned files', async () => {
  const pack = demoPack();
  assert.deepEqual(parseModulePayload(encodedPack(pack).buffer), pack);
  assert.deepEqual(parseModulePayload(storedEntry(pack).buffer), pack);
  assert.throws(() => parseModulePayload(storedEntry(pack, 'StudyQuest-Study-Pack.json').buffer), /Private study pack/);
  assert.throws(() => parseModulePayload(storedEntry(pack).slice(0, -1).buffer), /does not contain/);
  await assert.rejects(readModulePack(new Blob([encodedPack(pack)])), /Choose the supplied/);
  await assert.rejects(readModulePack(new Blob([storedEntry(pack)])), /Choose the supplied/);
  await assert.rejects(readPack(new Blob([storedEntry(pack)])), /does not contain/);
  await assert.rejects(readModulePack(new Blob([storedEntry(pack, 'StudyQuest-Study-Pack-v2.json')])), /Private study pack/);
});

test('module packs above 8 MB reach verification and ZIP extraction stays bounded at 64 MB', async () => {
  const payload = Buffer.alloc(9 * 1024 * 1024, ' ');
  payload.set(encodedPack(demoPack()));
  await assert.rejects(readModulePack(new Blob([payload])), /could not verify its content/);
  await assert.rejects(readModulePack(deflatedModuleEntry(payload)), /could not verify its content/);
  await assert.rejects(readModulePack(deflatedModuleEntry(encodedPack(demoPack()), 64 * 1024 * 1024 + 1)), /64 MB or smaller/);
});

test('module pack validation rejects invalid metadata, references, scans, links and content', () => {
  for (const [change, message] of [
    [p => { p.module.id = builtinModule.id; }, /metadata/],
    [p => { p.module.id = previousModuleCode.toLowerCase(); }, /metadata/],
    [p => { p.practiceQuestions.pop(); }, /knowledge check/],
    [p => { p.topics[0].prerequisites = [p.topics[0].id]; }, /topic/],
    [p => { p.lectures['example-topic'].scenes[0].check.right = 2; }, /lecture scene/],
    [p => { p.practiceQuestions[0].guidance.ladder[0].formulas = ['missing']; }, /hint level/],
    [p => { p.scans['sample.webp'] = 'bad'; }, /WebP/],
    [p => { p.papers[0].parts[0].marks = 3; }, /paper part/],
    [p => { p.exercises = p.practiceQuestions; }, /duplicate question/],
    [p => { p.practiceQuestions[0].kind = 'short'; }, /boss case/],
  ]) {
    const pack = demoPack();
    change(pack);
    assert.throws(() => validateModulePack(pack), message);
  }
});

test('built-in content loads by default, and module startup isolates content and both progress formats', () => {
  const values = new Map();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  } });
  try {
    assert.equal(selectedModuleId(), builtinModule.id);
    assert.equal(moduleInfo.id, builtinModule.id);
    assert.ok(questions.length > 100);
    assert.ok(lectures.foundations);
    assert.ok(bossQuestions('foundations').length >= 2);

    const builtInKey = storageKey();
    const builtInProgress = newProgress();
    const legacyProgress = { ...builtInProgress, module: previousModuleCode,
      settings: { ...builtInProgress.settings, goal: 42 } };
    localStorage.setItem(storageKey(previousModuleCode), JSON.stringify(legacyProgress));
    assert.equal(loadProgress().progress.settings.goal, 42);
    localStorage.setItem(builtInKey, JSON.stringify(builtInProgress));

    const pack = demoPack();
    selectModule(pack.module.id);
    assert.equal(selectedModuleId(), pack.module.id);
    activateModule(validateModulePack(pack));
    assert.equal(moduleInfo.id, pack.module.id);
    assert.notEqual(storageKey(), builtInKey);
    assert.equal(topicById.foundations, undefined);
    assert.equal(lectureScenes['example-topic'], 3);
    assert.equal(questions.length, 3);
    assert.equal(papers.length, 1);
    assert.equal(topicHistory['example-topic'].marks, 2);
    assert.equal(bossQuestions('example-topic')[1].id, 'past-example');
    assert.match(bossQuestions('example-topic')[1].figures[0].src, /^blob:/);
    assert.equal(loadProgress().progress.settings.goal, 25);
    assert.equal(loadProgress().progress.module, pack.module.id);
    assert.throws(() => parseProgress(JSON.stringify(builtInProgress)), /progress format/);
    assert.throws(() => parseProgress(JSON.stringify(legacyProgress)), /progress format/);

    const progress = newProgress();
    progress.lessons.push({ id: 'example-topic/example-concept', at: 123, minutes: 3 });
    progress.lectures['example-topic'] = [0];
    localStorage.setItem(storageKey(), JSON.stringify(progress));
    assert.deepEqual(loadProgress().progress, progress);
    assert.equal(mergeProgress(progress, builtInProgress), progress);
    assert.deepEqual(JSON.parse(localStorage.getItem(builtInKey)), builtInProgress);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

