import type { Paper, Question } from './types.ts';

interface StudyPack {
  version: 1;
  module: 'IE4483';
  papers: Paper[];
  questions: Question[];
  exercises: Question[];
  scans: Record<string, string>;
}

const acceptedDigests = new Set([
  'db56abe9ab62ddb09ee58c42ba4ed6656152b77458539fd395ffc86d9040414d',
  'e8286d3c94b6d0fea47594eb0dfdec359e8c678448d015bcf8910e7d213c0ec9',
]);
const databaseName = 'studyquest-ie4483-study-packs';

// The supplied ZIP stores one JSON entry without compression. Verify the
// extracted bytes against the same digest used for standalone JSON packs.
function packPayload(bytes: ArrayBuffer) {
  if (bytes.byteLength < 4) return bytes;
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== 0x04034b50) return bytes;
  if (bytes.byteLength < 30 || (header.getUint16(6, true) & 9) !== 0 ||
      header.getUint16(8, true) !== 0) {
    throw new Error('This archive is unsupported. Select the supplied IE4483 study pack ZIP.');
  }
  const size = header.getUint32(18, true);
  const nameEnd = 30 + header.getUint16(26, true);
  const start = nameEnd + header.getUint16(28, true);
  if (size !== header.getUint32(22, true) || start + size > bytes.byteLength ||
      new TextDecoder().decode(bytes.slice(30, nameEnd)) !== 'StudyQuest-IE4483-Study-Pack.json') {
    throw new Error('This ZIP does not contain the supplied IE4483 study pack.');
  }
  return bytes.slice(start, start + size);
}

export async function readPack(file: Blob): Promise<StudyPack> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose the IE4483 study pack, which is under 8 MB.');
  const bytes = packPayload(await file.arrayBuffer());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!acceptedDigests.has(digest)) {
    throw new Error('Choose the supplied StudyQuest IE4483 study pack ZIP or JSON. The project ZIP and progress backup use different formats.');
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as StudyPack;
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

