import { useEffect, useState } from 'react';
import { paperDocuments, papers } from './content/index.ts';
import type { Paper, PaperDocument, Source } from './types.ts';
import { Icon, Modal } from './ui.tsx';

export function paperFor(source: Source) {
  return papers.find(paper => paper.file === source.file ||
    (source.year === paper.year && source.semester === paper.semester));
}

export function paperName(paper: Paper) {
  return paper.year + ' Semester ' + paper.semester;
}

export function examPart(source: Source) {
  const match = /^(\d+)\s*\(?([a-z])\)?(.*)$/i.exec(source.question ?? '');
  if (!match) return source.question ? 'Q' + source.question : '';
  const subparts = source.subparts ?? [];
  const nested = subparts.length
    ? '(' + subparts[0] + (subparts.length > 1 ? '–' + subparts.at(-1) : '') + ')'
    : match[3];
  return 'Q' + match[1] + '(' + match[2] + ')' + nested;
}

function PaperReader({ paper, document, initialPage, close }: {
  paper: Paper; document: PaperDocument; initialPage: number; close: () => void;
}) {
  const [page, setPage] = useState(Math.max(1, Math.min(initialPage, document.pages.length)));
  const [zoom, setZoom] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  useEffect(() => {
    const bytes = Uint8Array.from(atob(document.pdf), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [document]);
  const title = paperName(paper);
  return <Modal title={title} wide onClose={close}>
    {document.excerpts && <p>Selected question excerpts from this paper.</p>}
    <div className="row wrap paper-view-controls">
      <button type="button" className="button secondary small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</button>
      <label>Page <select aria-label="PDF page" value={page} onChange={event => setPage(Number(event.target.value))}>
        {document.pages.map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} of {document.pages.length}</option>)}
      </select></label>
      <button type="button" className="button secondary small" disabled={page === document.pages.length} onClick={() => setPage(page + 1)}>Next page</button>
      <button type="button" className="button secondary small" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? 'Fit to width' : 'Zoom in'}</button>
      {pdfUrl && <a className="button secondary small" href={pdfUrl + '#page=' + page} target="_blank" rel="noopener">{document.excerpts ? 'Open excerpt PDF' : 'Open original PDF'}</a>}
    </div>
    <figure key={page} className={'paper-page' + (zoom ? ' zoomed' : '')}>
      <img src={'data:image/webp;base64,' + document.pages[page - 1]} alt={title + ', PDF page ' + page} />
    </figure>
  </Modal>;
}

export function PaperSource({ paper, source }: { paper: Paper; source?: Source }) {
  const [open, setOpen] = useState(false);
  const document = paperDocuments[paper.id];
  const label = paperName(paper);
  const part = source && examPart(source);
  const page = source?.page;
  return <div className="paper-source row wrap">
    <span className="source-note"><Icon name="book" size={14} />{label}{part && ' · ' + part}{page && ' · PDF p. ' + page}</span>
    {document && <button type="button" className="text-button" onClick={() => setOpen(true)} aria-label={'View paper PDF · ' + label + (part ? ' · ' + part : '')}>
      View paper PDF
    </button>}
    {open && document && <PaperReader paper={paper} document={document} initialPage={source?.documentPage ?? (parseInt(String(page), 10) || 1)} close={() => setOpen(false)} />}
  </div>;
}
