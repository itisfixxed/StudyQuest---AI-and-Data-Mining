import { previousModuleCode, sourceLabel } from './legacy-storage.ts';
import type { Paper, Question } from './types.ts';

interface StudyPack {
  version: 1;
  module: string;
  papers: Paper[];
  questions: Question[];
  exercises: Question[];
  scans: Record<string, string>;
}

const acceptedDigests = new Set([
  'ff08d589e1d3dcf837dddc06a3d884b6f43a181f323f991ca2039a534cbd5f6e',
  'db56abe9ab62ddb09ee58c42ba4ed6656152b77458539fd395ffc86d9040414d',
  'e8286d3c94b6d0fea47594eb0dfdec359e8c678448d015bcf8910e7d213c0ec9',
]);
// Keep already imported packs accessible in the existing IndexedDB database.
const databaseName = 'studyquest-' + previousModuleCode.toLowerCase() + '-study-packs';

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

function zipPayload(payload: ArrayBuffer): Blob {
  const name = new TextEncoder().encode(entryName);
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
function packPayload(bytes: ArrayBuffer) {
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
      (name !== entryName && name !== previousEntry)) {
    throw new Error('This ZIP does not contain the supplied study pack.');
  }
  return bytes.slice(start, start + size);
}

async function verifiedPayload(file: Blob): Promise<ArrayBuffer> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose the study pack, which is under 8 MB.');
  const bytes = packPayload(await file.arrayBuffer());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!acceptedDigests.has(digest)) {
    throw new Error('Choose the supplied StudyQuest study pack ZIP or JSON. The project ZIP and progress backup use different formats.');
  }
  return bytes;
}

export async function readPack(file: Blob): Promise<StudyPack> {
  const bytes = await verifiedPayload(file);
  const pack = JSON.parse(new TextDecoder().decode(bytes)) as StudyPack;
  if (pack.module === previousModuleCode) {
    for (const paper of pack.papers) paper.file = sourceLabel(paper.file);
    for (const question of [...pack.questions, ...pack.exercises]) question.source.file = sourceLabel(question.source.file);
  }
  return pack;
}

export async function createStudyPackZip(file: Blob): Promise<Blob> {
  return zipPayload(await verifiedPayload(file));
}

export async function downloadStudyPack(): Promise<Blob | undefined> {
  const file = await packFile();
  return file ? createStudyPackZip(file) : undefined;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function packFile(file?: Blob): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('packs', file ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('packs');
      const request = file ? store.put(file, 'current') : store.get('current');
      transaction.oncomplete = () => resolve(file ? undefined : request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('Study pack storage failed.'));
    });
  } finally {
    db.close();
  }
}

export async function loadStudyPack() {
  const file = await packFile();
  return file ? readPack(file) : undefined;
}

export async function saveStudyPack(file: File) {
  await readPack(file);
  try {
    await packFile(file);
  } catch {
    throw new Error('The browser could not save the pack. Check available storage and try again in a regular browser tab.');
  }
}

