import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { hasBundledPapers, papers, packLoadFailed, studyPackVersion } from './content/index.ts';
import { downloadStudyPack, installedStudyVersions, saveStudyPack, setStudyVersion, studyPackAccept, studyPackFilename } from './study-pack.ts';
import { Icon, SectionTitle } from './ui.tsx';

const nameKey = 'studyquest-study-pack-name';
function savedName(version: 1 | 2) {
  try {
    return localStorage.getItem(nameKey + ':' + version) ?? (version === 1 ? localStorage.getItem(nameKey) ?? '' : '');
  } catch {
    return '';
  }
}

export function StudyPackUpload() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipUrl, setZipUrl] = useState('');
  const [chosen, setChosen] = useState('');
  const [versions, setVersions] = useState<(1 | 2)[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // The page reloads after a successful import, so remember the name of the pack in use.
  const current = studyPackVersion && !packLoadFailed ? savedName(studyPackVersion) : '';
  const canDownload = !hasBundledPapers && studyPackVersion !== undefined;
  useEffect(() => {
    if (!canDownload || !studyPackVersion) return;
    let active = true;
    installedStudyVersions().then(list => { if (active) setVersions(list); }).catch(() => {});
    let url = '';
    downloadStudyPack(studyPackVersion).then(zip => {
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
      const version = await saveStudyPack(file);
      try { localStorage.setItem(nameKey + ':' + version, file.name); } catch { /* name display is optional */ }
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
        <Icon name="upload" size={18} /> {busy ? 'Importing…' : studyPackVersion ? 'Import study pack' : 'Choose study pack'}
      </button>
      <span className="file-pick-name" aria-live="polite">{chosen ? 'Selected: ' + chosen : studyPackVersion ? 'Version ' + studyPackVersion + (current ? ' · ' + current : '') : 'No file chosen'}</span>
      <input ref={input} className="sr-only" type="file" accept={studyPackAccept} onChange={choose} disabled={busy} tabIndex={-1} aria-label="Choose study pack file" />
    </div>
    {versions.length > 1 && <label className="narrow-field">Study pack version
      <select disabled={busy} value={studyPackVersion} onChange={async event => {
        setBusy(true);
        try {
          await setStudyVersion(event.target.value === '2' ? 2 : 1);
          location.reload();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Could not switch versions.');
          setBusy(false);
        }
      }}>
        {versions.map(version => <option key={version} value={version}>Version {version}</option>)}
      </select>
    </label>}
    {zipUrl && <div><a className="button secondary" href={zipUrl} download={studyPackVersion === 2 ? 'StudyQuest-Study-Pack-v2.zip' : studyPackFilename}>Download study pack ZIP</a></div>}
    {(status || packLoadFailed) && <p role="status">{status || 'The saved pack could not be opened. Select the study pack again.'}</p>}
  </section>;
}