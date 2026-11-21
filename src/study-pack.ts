import type { Paper, Question } from './types.ts';

interface StudyPack {
  version: 1;
  module: 'IE4483';
  papers: Paper[];
  questions: Question[];
  exercises: Question[];
  scans: Record<string, string>;
}

const releaseDigest = 'db56abe9ab62ddb09ee58c42ba4ed6656152b77458539fd395ffc86d9040414d';
const databaseName = 'studyquest-ie4483-study-packs';

async function readPack(file: Blob): Promise<StudyPack> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose the IE4483 study pack, which is under 8 MB.');
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== releaseDigest) {
    throw new Error('Choose the supplied StudyQuest IE4483 study-pack JSON. ZIP files, PDFs, and progress backups use different formats.');
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

