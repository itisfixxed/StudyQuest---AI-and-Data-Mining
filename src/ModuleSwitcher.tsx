import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { availableModules, moduleInfo, moduleLoadFailed } from './content/index.ts';
import { saveModulePack, selectModule, studyPackAccept } from './study-pack.ts';
import { Icon, SectionTitle } from './ui.tsx';

function switchModule(id: string) {
  selectModule(id);
  location.reload();
}

export function ModuleSelector() {
  const [error, setError] = useState('');
  return <label className="module-selector">
    <span className="sr-only">Active module</span>
    <select aria-label="Active module" value={moduleInfo.id} onChange={event => {
      try { switchModule(event.target.value); }
      catch { setError('The browser could not save the selected module.'); }
    }}>
      {availableModules.map(module => <option value={module.id} key={module.id}>{module.name}</option>)}
    </select>
    {error && <span role="status">{error}</span>}
  </label>;
}

export function ModuleSettings() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function importPack(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setStatus('Checking and saving the module pack…');
    try {
      const module = await saveModulePack(file);
      switchModule(module.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not add the module pack.');
      setBusy(false);
    }
  }

  return <section className="panel panel-pad">
    <SectionTitle title="Modules" description="Each module has its own progress and settings." />
    <div className="row wrap file-pick">
      <ModuleSelector />
      <button className="button primary" type="button" disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="upload" size={18} /> {busy ? 'Importing…' : 'Add module pack'}
      </button>
      <input ref={input} className="sr-only" type="file" accept={studyPackAccept} disabled={busy}
        onChange={importPack} tabIndex={-1} aria-label="Choose module pack file" />
    </div>
    {(status || moduleLoadFailed) && <p role="status">{status || 'The selected module could not be opened. Add its module pack again.'}</p>}
  </section>;
}
