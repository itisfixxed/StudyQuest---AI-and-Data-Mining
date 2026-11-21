import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { hasBundledPapers, papers, packLoadFailed } from './content/index.ts';
import { downloadStudyPack, saveStudyPack, studyPackFilename } from './study-pack.ts';
import { Icon, SectionTitle } from './ui.tsx';

const nameKey = 'studyquest-study-pack-name';
function savedName() {
  try { return localStorage.getItem(nameKey) ?? ''; } catch { return ''; }
}

// Android pickers filter by the MIME type the storage provider reports,
// which is often application/octet-stream for ZIP and JSON files.
const ACCEPT = [
  '.zip', '.json',
  'application/zip', 'application/x-zip-compressed', 'application/x-zip',
  'application/json', 'text/plain', 'application/octet-stream',
].join(',');

export function StudyPackUpload() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipUrl, setZipUrl] = useState('');
  const [chosen, setChosen] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // The page reloads after a successful import, so remember the name of the pack in use.
  const current = papers.length && !packLoadFailed ? savedName() : '';
  const canDownload = !hasBundledPapers && papers.length > 0;
  useEffect(() => {
    if (!canDownload) return;
    let active = true;
    let url = '';
    downloadStudyPack().then(zip => {
      if (!active || !zip) return;
      url = URL.createObjectURL(zip);
      setZipUrl(url);
    }).catch(() => {
      if (active) setStatus('Could not prepare the saved study pack for download.');
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [canDownload]);
  if (hasBundledPapers) return null;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setChosen(file.name);

    setBusy(true);
    setStatus('Checking and saving your study pack…');
    try {
      await saveStudyPack(file);
      try { localStorage.setItem(nameKey, file.name); } catch { /* name display is optional */ }
      location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import the study pack.');
      setBusy(false);
    }
  }

  return <section className="panel panel-pad">
    <SectionTitle title="Private study pack" description={papers.length
      ? papers.length + ' past papers are available in this browser.'
      : 'Add the past papers and course exercises to this browser.'} />
    <p>Choose the study pack ZIP or JSON. The file stays on this device.</p>
    <div className="row wrap file-pick">
      <button type="button" className="button primary" disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="upload" size={18} /> {busy ? 'Importing…' : current ? 'Replace study pack' : 'Choose study pack'}
      </button>
      <span className="file-pick-name" aria-live="polite">{chosen ? 'Selected: ' + chosen : current ? 'Current pack: ' + current : papers.length ? 'Study pack loaded' : 'No file chosen'}</span>
      <input ref={input} className="sr-only" type="file" accept={ACCEPT} onChange={choose} disabled={busy} tabIndex={-1} aria-label="Choose study pack file" />
    </div>
    {zipUrl && <div><a className="button secondary" href={zipUrl} download={studyPackFilename}>Download study pack ZIP</a></div>}
    {(status || packLoadFailed) && <p role="status">{status || 'The saved pack could not be opened. Select the study pack again.'}</p>}
  </section>;
}