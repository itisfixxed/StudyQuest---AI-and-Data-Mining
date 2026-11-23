import { builtinModule, validateModulePack } from './module-pack.ts';
import type { ModuleInfo } from './types.ts';
import { previousModuleCode, sourceLabel } from './legacy-storage.ts';
import type { Lecture, Paper, PaperDocument, Question } from './types.ts';

interface StudyPack {
  version: 1 | 2;
  module: string;
  papers: Paper[];
  questions: Question[];
  exercises: Question[];
  scans: Record<string, string>;
  lectures?: Record<string, Lecture>;
  documents?: Record<string, PaperDocument>;
}

const acceptedDigests = new Set([
  '1bf2e16027ee44f30177cf19c3881cb124829aa78e9bb2c97f92e8914aea9298',
  'ff08d589e1d3dcf837dddc06a3d884b6f43a181f323f991ca2039a534cbd5f6e',
  'db56abe9ab62ddb09ee58c42ba4ed6656152b77458539fd395ffc86d9040414d',
  'e8286d3c94b6d0fea47594eb0dfdec359e8c678448d015bcf8910e7d213c0ec9',
  // Regenerated pack with step-by-step hint ladders for every past-paper part and exercise.
  'b5dd1efc9ed686d1d0dc8edcef5ecd0db4b1d4ac85eca735ed8d3eb02e7242ef',
]);
// Keep already imported packs accessible in the existing IndexedDB database.
const databaseName = 'studyquest-' + previousModuleCode.toLowerCase() + '-study-packs';

export const modulePackEntryName = 'StudyQuest-Module-Pack.json';
const v2EntryName = 'StudyQuest-Study-Pack-v2.json';
const entryName = 'StudyQuest-Study-Pack.json';
export const studyPackFilename = 'StudyQuest-Study-Pack.zip';
const zipType = 'application/zip';
const zipSignature = 0x04034b50;

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc;
}

function zipPayload(payload: ArrayBuffer, filename = entryName): Blob {
  const name = new TextEncoder().encode(filename);
  const local = new DataView(new ArrayBuffer(30));
  const central = new DataView(new ArrayBuffer(46));
  const end = new DataView(new ArrayBuffer(22));
  const size = payload.byteLength;
  const crc = crc32(new Uint8Array(payload));

  // Write the stored entry, its central directory record, and the end record.
  local.setUint32(0, zipSignature, true);
  local.setUint16(4, 20, true);
  local.setUint16(12, 33, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, size, true);
  local.setUint32(22, size, true);
  local.setUint16(26, name.byteLength, true);

  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(14, 33, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, size, true);
  central.setUint32(24, size, true);
  central.setUint16(28, name.byteLength, true);

  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, central.byteLength + name.byteLength, true);
  end.setUint32(16, local.byteLength + name.byteLength + size, true);
  return new Blob([local.buffer, name, payload, central.buffer, name, end.buffer], { type: zipType });
}


// The supplied ZIP stores one JSON entry without compression. Verify the
// extracted bytes against the same digest used for standalone JSON packs.
function packPayload(bytes: ArrayBuffer, modulePack = false) {
  if (bytes.byteLength < 4) return bytes;
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== zipSignature) return bytes;
  if (bytes.byteLength < 30 || (header.getUint16(6, true) & 9) !== 0 ||
      header.getUint16(8, true) !== 0) {
    throw new Error('This archive is unsupported. Select the supplied study pack ZIP.');
  }
  const size = header.getUint32(18, true);
  const nameEnd = 30 + header.getUint16(26, true);
  const start = nameEnd + header.getUint16(28, true);
  const name = new TextDecoder().decode(bytes.slice(30, nameEnd));
  const previousEntry = 'StudyQuest-' + previousModuleCode + '-Study-Pack.json';
  if (size !== header.getUint32(22, true) || start + size > bytes.byteLength ||
      (modulePack ? name !== modulePackEntryName : name !== entryName && name !== v2EntryName && name !== previousEntry)) {
    throw new Error('This ZIP does not contain the supplied study pack.');
  }
  return bytes.slice(start, start + size);
}

async function sha256(bytes: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

const acceptedModuleZips = new Set(['cedbedd1c7318be4aee783fb5ccd78d7980155f824f0b9c83910f9231a72c428']);
const acceptedModuleJson = new Set(['83a243544e75aee1405d60ab6024680579e83940131e4a2511ff35c3f003ba58']);
const fileMismatch = 'Choose the supplied StudyQuest study pack ZIP or JSON. The project ZIP and progress backup use different formats.';

async function verifiedPayload(file: Blob, modulePack = false) {
  const limit = modulePack ? 8 : 64;
  if (file.size > limit * 1024 * 1024) throw new Error('Choose a pack under ' + limit + ' MB.');
  const archive = await file.arrayBuffer();
  const payload = packPayload(archive, modulePack);
  const isArchive = payload !== archive;
  const digests = modulePack ? (isArchive ? acceptedModuleZips : acceptedModuleJson) : acceptedDigests;
  if (!digests.has(await sha256(modulePack && isArchive ? archive : payload))) throw new Error(fileMismatch);
  return payload;
}

export function parseModulePayload(bytes: ArrayBuffer) {
  return validateModulePack(JSON.parse(new TextDecoder().decode(packPayload(bytes, true))));
}

export async function readModulePack(file: Blob) {
  return parseModulePayload(await verifiedPayload(file, true));
}

export async function readPack(file: Blob): Promise<StudyPack> {
  const bytes = await verifiedPayload(file);
  const pack = JSON.parse(new TextDecoder().decode(bytes)) as StudyPack;
  if ((pack.version !== 1 && pack.version !== 2) || (pack.module !== previousModuleCode && pack.module !== builtinModule.id)) {
    throw new Error(fileMismatch);
  }
  if (pack.module === previousModuleCode) {
    for (const paper of pack.papers) paper.file = sourceLabel(paper.file);
    for (const question of [...pack.questions, ...pack.exercises]) question.source.file = sourceLabel(question.source.file);
  }
  return pack;
}

export async function createStudyPackZip(file: Blob): Promise<Blob> {
  return zipPayload(await verifiedPayload(file));
}

export async function downloadStudyPack(version: 1 | 2): Promise<Blob | undefined> {
  const file = await packStore('readonly', store => store.get(studyKey(version))) as Blob | undefined;
  if (!file) return;
  const header = await file.slice(0, 4).arrayBuffer();
  if (header.byteLength === 4 && new DataView(header).getUint32(0, true) === zipSignature) return file.slice(0, file.size, zipType);
  return zipPayload(await verifiedPayload(file), version === 2 ? v2EntryName : entryName);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function packStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('packs', mode);
      const request = operation(transaction.objectStore('packs'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('Study pack storage failed.'));
    });
  } finally {
    db.close();
  }
}

const studyKey = (version: 1 | 2) => version === 2 ? 'study-pack:v2' : 'current';
const versionKey = 'active-study-version';

export async function installedStudyVersions(): Promise<(1 | 2)[]> {
  const keys = await packStore('readonly', store => store.getAllKeys());
  return ([1, 2] as const).filter(version => keys.includes(studyKey(version)));
}

export async function setStudyVersion(version: 1 | 2) {
  const key = await packStore('readonly', store => store.getKey(studyKey(version)));
  if (key === undefined) throw new Error('Import this study pack version first.');
  await packStore('readwrite', store => store.put(version, versionKey));
}

export async function loadStudyPack() {
  const version = await packStore('readonly', store => store.get(versionKey));
  const file = await packStore('readonly', store => store.get(studyKey(version === 2 ? 2 : 1))) as Blob | undefined;
  return file ? readPack(file) : undefined;
}

export async function saveStudyPack(file: File) {
  const { version } = await readPack(file);
  try {
    await packStore('readwrite', store => {
      store.put(file, studyKey(version));
      return store.put(version, versionKey);
    });
  } catch {
    throw new Error('The browser could not save the pack. Check available storage and try again in a regular browser tab.');
  }
  return version;
}

const activeModuleKey = 'studyquest-active-module';
const moduleKey = (id: string) => 'module:' + id;
const metadataKey = (id: string) => 'metadata:' + id;

export function selectedModuleId() {
  try { return localStorage.getItem(activeModuleKey) || builtinModule.id; }
  catch { return builtinModule.id; }
}

export function selectModule(id: string) {
  localStorage.setItem(activeModuleKey, id);
}

export async function installedModules(): Promise<ModuleInfo[]> {
  const entries = await packStore('readonly', store => store.getAll(IDBKeyRange.bound('metadata:', 'metadata:\uffff')));
  return [builtinModule, ...entries];
}

export async function loadModulePack(id: string) {
  const file = await packStore('readonly', store => store.get(moduleKey(id))) as Blob | undefined;
  if (!file) return;
  const pack = await readModulePack(file);
  if (pack.module.id !== id) throw new Error('The stored pack has a different module ID.');
  return pack;
}

export async function saveModulePack(file: File) {
  const pack = await readModulePack(file);
  await packStore('readwrite', store => {
    store.put(file, moduleKey(pack.module.id));
    return store.put(pack.module, metadataKey(pack.module.id));
  });
  return pack.module;
}

// Android storage providers sometimes report ZIP and JSON as generic binary files.
export const studyPackAccept = [
  '.zip', '.json', 'application/zip', 'application/x-zip-compressed', 'application/x-zip',
  'application/json', 'text/plain', 'application/octet-stream',
].join(',');
