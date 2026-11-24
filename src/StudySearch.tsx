import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { moduleInfo, questions, references, topicById, topics } from './content/index.ts';
import { examPart, paperFor, paperName } from './PaperSource.tsx';
import { QuestionPrompt } from './Practice.tsx';
import { createStudySearch } from './study-search.ts';
import type { Question } from './types.ts';
import { Icon, Modal, SourceNote } from './ui.tsx';

function ResultGroup<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const limit = 5;
  return <section className="study-search-group" aria-label={title}>
    <h3>{title} <span className="muted">({items.length})</span></h3>
    <ul>{(expanded ? items : items.slice(0, limit)).map(render)}</ul>
    {!expanded && items.length > limit && <button className="text-button" onClick={() => setExpanded(true)}>
      Show {items.length - limit} more <span className="sr-only">{title.toLowerCase()}</span>
    </button>}
  </section>;
}

type SearchProps = {
  openTopic: (id: string) => void;
  openQuestion: (question: Question) => void;
  currentQuestion?: string;
  hasPracticeSession: boolean;
};

function questionContext(question: Question) {
  const paper = paperFor(question.source);
  if (paper) return [paperName(paper), examPart(question.source)].filter(Boolean).join(' · ');
  if (question.origin === 'exercise') {
    return [question.source.file.split('/').at(-1)?.replace(/\.pdf$/i, ''), examPart(question.source)].filter(Boolean).join(' · ');
  }
  return topicById[question.topic]?.name;
}

function SearchDialog({ close, openTopic, openQuestion, currentQuestion, hasPracticeSession, query, changeQuery }: SearchProps & {
  close: () => void; query: string; changeQuery: (query: string) => void;
}) {
  const search = useMemo(() => createStudySearch(topics, questions, references), []);
  const results = useMemo(() => search(query), [search, query]);
  const [selected, setSelected] = useState<Question | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLHeadingElement>(null);
  const previous = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { if (selected) preview.current?.focus(); }, [selected]);
  const count = results.topics.length + results.tutorials.length + results.exams.length + results.practice.length;
  const searching = query.trim().length >= 2;
  const questionRow = (question: Question) => <li key={question.id}>
    <button type="button" className="study-search-result" onClick={event => {
      previous.current = event.currentTarget;
      setConfirmReplace(false);
      setSelected(question);
    }}>
      <span><strong>{question.title}</strong><small>{questionContext(question)}</small></span>
      <Icon name="chevron" size={16} />
    </button>
  </li>;
  const backToResults = () => {
    setSelected(null);
    requestAnimationFrame(() => previous.current?.focus());
  };
  return <Modal title="Search module" onClose={close} className="study-search-dialog">
    <div hidden={Boolean(selected)}>
      <label className="study-search-input">
        <Icon name="search" size={20} />
        <span className="sr-only">Search {moduleInfo.name}</span>
        <input ref={input} type="search" value={query} onChange={event => changeQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') resultList.current?.querySelector('button')?.focus();
            if (event.key === 'Escape') { event.preventDefault(); close(); }
          }}
          placeholder="Topic, keyword, or question number" maxLength={120} autoComplete="off" />
      </label>
      <p className="study-search-status" role="status">{searching
        ? count ? count + (count === 1 ? ' result' : ' results') : 'No matches in ' + moduleInfo.name
        : moduleInfo.name}</p>
      {searching && <div key={query} ref={resultList}>
        <ResultGroup title="Topics" items={results.topics} render={({ topic, concept }) => <li key={topic.id}>
          <button type="button" className="study-search-result" onClick={() => { close(); openTopic(topic.id); }}>
            <span><strong>{topic.name}</strong>{concept && <small>{concept}</small>}</span>
            <Icon name="chevron" size={16} />
          </button>
        </li>} />
        <ResultGroup title="Tutorial questions" items={results.tutorials} render={questionRow} />
        <ResultGroup title="Past-paper questions" items={results.exams} render={questionRow} />
        <ResultGroup title="Practice questions" items={results.practice} render={questionRow} />
      </div>}
    </div>
    {selected && <section className="study-search-preview">
      <div className="row wrap study-search-preview-actions">
        <button type="button" className="button secondary small" onClick={backToResults}><Icon name="back" size={16} /> Back to results</button>
        <button type="button" className="button primary small" onClick={() => {
          if (hasPracticeSession && currentQuestion !== selected.id && !confirmReplace) { setConfirmReplace(true); return; }
          close(); openQuestion(selected);
        }}>{currentQuestion === selected.id ? 'Resume this question' : confirmReplace ? 'Replace practice session' : 'Practice this question'}</button>
      </div>
      {confirmReplace && <p role="status">Starting this question replaces your current practice session and its draft.</p>}
      <h3 ref={preview} tabIndex={-1}>{selected.title}</h3>
      {!paperFor(selected.source) && <SourceNote source={selected.source} />}
      <QuestionPrompt question={selected} />
    </section>}
  </Modal>;
}

export function StudySearch(props: SearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  return <>
    <button type="button" ref={trigger} onClick={() => setOpen(true)} className="icon-button study-search-trigger"
      aria-label="Search module" aria-haspopup="dialog">
      <Icon name="search" size={18} /><span>Search module</span>
    </button>
    {open && <SearchDialog {...props} close={close} query={query} changeQuery={setQuery} />}
  </>;
}
