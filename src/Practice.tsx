import { examPart, paperFor, PaperSource } from './PaperSource.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { automaticScore, checkStep, displayOrder, hasAnswer, normalizeText } from './answers.ts';
import { isManual, labels, moduleInfo, originLabel, papers, questionById, questions, referenceById, topicById, topics } from './content/index.ts';
import { createRecordId, dueQuestions, recordAttempt } from './progress.ts';
import { matchesQuestionNumber, questionNumber } from './study-search.ts';
import { groupWorkings, questionParts, splitResponse } from './question-parts.ts';
import type { Answer, HintStep, Progress, Question, Step } from './types.ts';
import { Bubble, Empty, Icon, MathBlock, MathText, PageTitle, Pill, ProgressBar, SectionTitle, SourceNote } from './ui.tsx';

export type Update = (fn: (progress: Progress) => Progress) => void;
export interface PracticeDraft {
  answer: Answer; hints: number; confidence: number; score: number | null; retries: number;
  show: boolean; manualOpen: boolean; locked: boolean; recentAttempt: string;
}
export interface PracticeSet {
  ids: string[]; title: string; mode: 'practice' | 'review'; index?: number; complete?: boolean; draft?: PracticeDraft;
}
export function ScreenMeta({ question }: { question: Question }) {
  return <div className="row wrap chips"><Pill color={question.origin === 'original' ? 'teal' : ['adapted', 'exercise'].includes(question.origin) ? 'amber' : 'indigo'}>{originLabel[question.origin]}</Pill>
    <Pill>{labels[question.difficulty]}</Pill><Pill><Icon name="clock" size={14} /> {question.minutes} min</Pill><Pill>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</Pill></div>;
}
export function QuestionDetails({ question }: { question: Question }) {
  const topic = topicById[question.topic];
  return <details className="question-details"><summary>Learning objective and source</summary>
    <p><MathText text={question.objective} /></p>
    {topic.prerequisites.length > 0 && <p><strong>Prerequisites</strong> {topic.prerequisites.map(id => topicById[id].short).join(', ')}</p>}
    <SourceNote source={question.source} />
  </details>;
}

export function QuestionPrompt({ question }: { question: Question }) {
  const paper = paperFor(question.source);
  return <>
    {paper && <PaperSource key={question.id} paper={paper} source={question.source} />}
    <div className="question-prompt"><MathText text={question.prompt} /></div>
    {question.origin==='original' && question.figures?.length ? <p className="muted">
      Tap a scan to enlarge it.
    </p> : null}
    {question.figures?.map(figure => {
      const src = figure.src.startsWith('blob:') ? figure.src : import.meta.env.BASE_URL + figure.src.slice(1);
      return <figure className="source-figure" key={figure.src}>
        <a href={src} target="_blank" rel="noreferrer" aria-label={'Open full-size scan. ' + figure.alt}>
          <img src={src} alt={figure.alt} />
          <span className="source-figure-link">Open full-size scan</span>
        </a>
      </figure>;
    })}
  </>;
}

export function AnswerField({ question, answer, setAnswer, disabled = false, id = 'response' }: {
  question: Question; answer: Answer; setAnswer: (answer: Answer) => void; disabled?: boolean; id?: string
}) {
  if (question.options) {
    const multi = question.kind === 'multi';
    const order = moduleInfo.id === 'information-security' && question.origin !== 'original'
      ? displayOrder({ prompt: question.id, options: question.options }) : question.options.map((_, i) => i);
    return <fieldset className="choices" disabled={disabled}><legend className="sr-only">{multi ? 'Select all that apply' : 'Select one answer'}</legend>
      {order.map((i,index) => {
        const option = question.options![i];
        const checked = multi ? Array.isArray(answer) && answer.includes(option) : answer === option;
        return <label className={'choice' + (checked ? ' selected' : '')} key={option}>
          <input type={multi ? 'checkbox' : 'radio'} name={id} value={option} checked={checked} onChange={() =>
            setAnswer(multi ? checked ? (answer as string[]).filter(x => x !== option) : [...(Array.isArray(answer) ? answer : []), option] : option)} />
          <span className="choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span><MathText text={option} /></span>
          {checked && <Icon name="check" size={18} />}
        </label>;
      })}
    </fieldset>;
  }
  const labels = questionParts(question);
  if (labels.length) {
    const {parts, earlier} = splitResponse(answer, labels.length);
    return <fieldset className="multipart-response" disabled={disabled}>
      <legend>Show your reasoning</legend>
      {earlier.trim() && <details className="answer-review"><summary>Earlier combined response</summary><p>{earlier}</p></details>}
      {labels.map((label, i) => <label key={label} className="response-field" htmlFor={id + '-' + label}>
        Part ({label})
        <textarea id={id + '-' + label} value={parts[i]} onChange={event => {
          const updated = parts.map((part, j) => i === j ? event.target.value : part);
          setAnswer(earlier.trim() ? [...updated, earlier] : updated);
        }} rows={4} maxLength={20000} />
      </label>)}
    </fieldset>;
  }
  return <div className="response-field">
    <label htmlFor={id}>{isManual(question) ? 'Show your reasoning' : 'Your answer'}</label>
    {isManual(question) ? <textarea id={id} value={String(answer)} onChange={e => setAnswer(e.target.value)} disabled={disabled} rows={5} maxLength={20000} placeholder="State assumptions and show each step…" /> :
      <input id={id} value={String(answer)} onChange={e => setAnswer(e.target.value)} disabled={disabled} autoComplete="off" maxLength={170} placeholder={question.kind === 'expression' ? 'Enter a number or expression' : 'Enter your answer'} />}
    {question.kind === 'expression' && <small>Use fractions, powers, percentages, or scientific notation such as 2.5e−4 or 2.5 × 10⁻⁴.</small>}
  </div>;
}

function StepCheck({ step, onPass }: { step: Step; onPass: () => void }) {
  const [entry, setEntry] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  return <div className="step-check">
    <p><MathText text={step.prompt} /></p>
    {step.options ? <div className="hint-options">{displayOrder(step).map(i => {
      const option = step.options![i];
      const selected = entry === String(i);
      return <button type="button" key={option} aria-pressed={selected}
        className={'button secondary ' + (selected ? 'selected' : '')} disabled={checked === true}
        onClick={() => { setEntry(String(i)); setChecked(null); }}>
        <span><MathText text={option} /></span>
      </button>;
    })}</div> :
      <label className="response-field"><span>Step answer</span><input value={entry} onChange={e => { setEntry(e.target.value); setChecked(null); }} disabled={checked === true} maxLength={170} /></label>}
    {checked !== null && <p className={checked ? 'good-text' : 'bad-text'} role="status"><MathText text={checked ? step.why : step.retry} /></p>}
    <button type="button" className="button secondary small" disabled={!entry.trim() || checked === true} onClick={() => {
      const passed = checkStep(step, entry);
      setChecked(passed);
      if (passed) onPass();
    }}>Check step</button>
  </div>;
}

const kindLabel: Record<HintStep['kind'], string> = { concept: 'Concept', formula: 'Formula', calculation: 'Calculation', reasoning: 'Reasoning', assemble: 'Put it together' };

function LadderStep({ step, index, count, raise }: { step: HintStep; index: number; count: number; raise: (aid: number) => void }) {
  const [shown, setShown] = useState(false);
  const workedRef = useRef<HTMLParagraphElement>(null);
  // Hand focus to the revealed working, since the button that revealed it disappears.
  useEffect(() => { if (shown) workedRef.current?.focus(); }, [shown]);
  const reveal = () => { setShown(true); raise(step.workedAid ?? 3); };
  return <div className={'ladder-step ' + step.kind}>
    <div className="row spread wrap ladder-head"><strong>Hint {index+1} of {count} · {kindLabel[step.kind]}</strong>{step.title && <span><MathText text={step.title} /></span>}</div>
    <p><MathText text={step.text} /></p>
    {step.formulas?.map(id => referenceById[id]?.expression ? <MathBlock key={id} expression={referenceById[id].expression!} /> : null)}
    {step.check && <StepCheck step={step.check} onPass={() => {}} />}
    {step.worked && (shown ? <p className="ladder-worked" role="status" tabIndex={-1} ref={workedRef}><strong>Worked step</strong> <MathText text={step.worked} /></p> :
      <button type="button" className="text-button small" onClick={reveal}>{step.check ? 'Skip check and show this step' : 'Show this step'}</button>)}
  </div>;
}

function LadderHints({ steps, level, change }: { steps: HintStep[]; level: number; change: (level: number) => void }) {
  // After navigating away and back, reopen the levels already paid for by the recorded assistance.
  const [opened, setOpened] = useState(() => { const i = steps.findIndex(step => step.aid > level); return level ? (i === -1 ? steps.length : i) : 0; });
  const raise = (aid: number) => change(Math.max(level, aid));
  const next = steps[opened];
  return <div className="hint-area ladder">
    {opened > 0 && <ProgressBar value={opened / steps.length * 100} label="Hints opened" />}
    {steps.slice(0, opened).map((step, i) => <LadderStep key={i} step={step} index={i} count={steps.length} raise={raise} />)}
    {next && <button type="button" className="button secondary" onClick={() => { setOpened(opened + 1); raise(next.aid); }}>
      <Icon name="bulb" size={17} /> {opened === 0 ? 'Get a hint' : 'Next hint'} ({opened + 1} of {steps.length} · {kindLabel[next.kind]})
    </button>}
  </div>;
}

export function Hints({ question, level, change }: { question: Question; level: number; change: (level: number) => void }) {
  if (question.guidance.ladder?.length) return <LadderHints steps={question.guidance.ladder} level={level} change={change} />;
  return <LegacyHints question={question} level={level} change={change} />;
}

function LegacyHints({ question, level, change }: { question: Question; level: number; change: (level: number) => void }) {
  const [scaffold, setScaffold] = useState(false);
  const [walkthrough, setWalkthrough] = useState(0);
  const [stepPassed, setStepPassed] = useState(false);
  const g = question.guidance;
  const titles = ['Concept recall','Directional guidance','Interactive scaffold','Assisted walkthrough'];
  const next = Math.min(4, level+1);
  const complete = walkthrough >= g.walkthrough.length;
  return <div className="hint-area">
    {level > 0 && <div className="hint-panel"><div className="row"><Bubble icon="bulb" color="amber" /><strong>Hint {Math.min(level,4)} · {titles[Math.min(level,4)-1]}</strong></div>
      <p><MathText text={g.recall} /></p>
      {level >= 2 && <p><MathText text={g.direction} /></p>}
      {level === 2 && question.formulas.length > 0 && question.formulas.map(id => referenceById[id]?.expression ? <MathBlock key={id} expression={referenceById[id].expression!} /> : null)}
      {level === 3 && <StepCheck step={g.scaffold} onPass={() => setScaffold(true)} />}
      {level >= 4 && (complete ? <p className="good-text">Walkthrough complete. Put the steps together in your answer.</p> :
        <div key={walkthrough}><Pill>Step {walkthrough+1} of {g.walkthrough.length}</Pill><StepCheck step={g.walkthrough[walkthrough]} onPass={() => setStepPassed(true)} />
          <button type="button" className="button text-secondary small" disabled={!stepPassed} onClick={() => { setWalkthrough(walkthrough+1); setStepPassed(false); }}>
            {walkthrough+1 === g.walkthrough.length ? 'Finish walkthrough' : 'Next step'} <Icon name="chevron" size={16} /></button></div>)}
    </div>}
    {level < 4 && <button type="button" className="button secondary" onClick={() => change(level+1)}>
      <Icon name="bulb" size={17} /> {level === 0 ? 'Get a hint' : (level === 3 && !scaffold ? 'Move to walkthrough' : titles[next-1])}
    </button>}
  </div>;
}

function WorkingSteps({ steps }: { steps: string[] }) {
  return steps.length > 1 ? <ol className="working-steps">{steps.map((line, i) =>
    <li key={i}><MathText text={line} /></li>)}</ol> : <p><MathText text={steps[0]} /></p>;
}

export function Solution({ question, answer }: { question: Question; answer?: Answer }) {
  const labels = questionParts(question);
  const sections = groupWorkings(question.solution?.length ? question.solution : [question.explanation], labels);
  const writtenParts = labels.length && Array.isArray(answer) ? splitResponse(answer, labels.length) : null;
  return <div className="solution">
    <h3>Worked solution</h3>
    {writtenParts ? <div className="answer-review"><strong>Your responses</strong>
      <dl>{labels.map((label, i) => <div key={label}><dt>Part ({label})</dt><dd>{writtenParts.parts[i].trim() ? writtenParts.parts[i] : 'No response'}</dd></div>)}</dl>
      {writtenParts.earlier.trim() && <details><summary>Earlier combined response</summary><p>{writtenParts.earlier}</p></details>}
    </div> : answer !== undefined && <p className="answer-review"><strong>Your response</strong><br />{hasAnswer(answer)
      ? (Array.isArray(answer) ? answer.join(', ') : answer) : 'No response'}</p>}
    {sections.map(({label, steps}) => <div key={label} className="worked-part">
      {label && <h4>{label === 'summary' ? 'Final results' : 'Part (' + label + ')'}</h4>}
      <WorkingSteps steps={steps} />
    </div>)}
    {!isManual(question) && <div><strong>Answer</strong><p><MathText text={Array.isArray(question.answer) ? question.answer.join(', ') : question.answer} /></p></div>}
    <div className="callout"><Icon name="bulb" size={18} /><span><MathText text={question.misconception} /></span></div>
    {question.optionFeedback && question.options && <details><summary>Why each option fits or fails</summary><ul>{question.options.map((option,i) => <li key={option}><strong><MathText text={option} /></strong> · <MathText text={question.optionFeedback![i]} /></li>)}</ul></details>}
    <SourceNote source={question.source} />
  </div>;
}

export function Rubric({ question, onSave, initial }: { question: Question; onSave: (score: number) => void; initial?: number }) {
  const [selected, setSelected] = useState<number[]>([]);
  const score = selected.reduce((sum,i) => sum + (question.rubric?.[i].points ?? 0), 0);
  return <div className="rubric">
    <div className="row spread"><strong>Estimated self-assessment rubric</strong><Pill>Estimated marks</Pill></div>
    <p>Tick a criterion when your original response meets it. Use the model answer as a guide.</p>
    {question.rubric?.map((criterion,i) => <label className="rubric-option" key={criterion.text}><input type="checkbox" checked={selected.includes(i)}
      onChange={() => setSelected(selected.includes(i) ? selected.filter(x => x !== i) : [...selected,i])} /><span><MathText text={criterion.text} /></span><Pill>{criterion.points} {criterion.points === 1 ? 'mark' : 'marks'}</Pill></label>)}
    <button className="button primary" type="button" onClick={() => onSave(score)}>Save {score}/{question.marks} marks</button>
    {initial !== undefined && <small> Saved estimate {initial}/{question.marks}</small>}
  </div>;
}

function QuestionDrill({ question, mode, update, onAdvance, isLast, index, count, draft, onDraft }: {
  question: Question; mode: PracticeSet['mode']; update: Update; onAdvance: () => void; isLast: boolean; index: number; count: number;
  draft?: PracticeDraft; onDraft: (draft: PracticeDraft) => void;
}) {
  const current: PracticeDraft = draft ?? {
    answer: question.kind === 'multi' ? [] : '', hints: 0, confidence: 3, score: null,
    retries: 0, show: false, manualOpen: false, locked: false, recentAttempt: ''
  };
  const { answer, hints, confidence, score, retries, show, manualOpen, locked, recentAttempt } = current;
  const patch = (changes: Partial<PracticeDraft>) => onDraft({ ...current, ...changes });
  const start = useRef(Date.now());
  const questionTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { questionTitle.current?.focus(); }, []);
  const manual = isManual(question);
  const save = (points: number, assistance = hints, changes: Partial<PracticeDraft> = {}) => {
    const data = { answer, score: points, assistance, retries, confidence, seconds: Math.max(1, Math.round((Date.now()-start.current)/1000)), mode };
    const id = createRecordId();
    update(progress => recordAttempt(progress, question, data, Date.now(), id));
    start.current = Date.now();
    patch({ ...changes, score: points, recentAttempt: id });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasAnswer(answer) || locked || score !== null || manualOpen) return;
    if (manual) { patch({ manualOpen: true, show: true }); return; }
    const points = automaticScore(question, answer);
    save(points, hints, points === question.marks ? { locked: true, show: true } : {});
  };
  const reveal = () => {
    const changes = { hints: 5, locked: true, show: true, manualOpen: false };
    if (!locked && score === null) { save(0, 5, changes); return; }
    if (!locked) update(progress => ({ ...progress, attempts: progress.attempts.map(attempt =>
      attempt.id === recentAttempt ? { ...attempt, reviewAssistance: 5 } : attempt) }));
    patch(changes);
  };
  const chosen = !Array.isArray(answer) ? question.options?.indexOf(answer) ?? -1 : -1;
  const incorrectFeedback = chosen >= 0 ? question.optionFeedback?.[chosen] ?? question.misconception : question.misconception;
  return <div className="session-cols">
    <article className="panel question-panel">
      <div className="row spread question-count"><strong>Question {index+1} of {count}</strong><span>{Math.round((index+(locked||score!==null?1:0))/count*100)}%</span></div>
      <ProgressBar value={(index+(locked||score!==null?1:0))/count*100} label="Practice session progress" />
      <ScreenMeta question={question} />
      <h2 ref={questionTitle} tabIndex={-1}>{question.title}</h2><QuestionPrompt question={question} />
      <form onSubmit={submit}>
        <AnswerField question={question} answer={answer} setAnswer={answer => patch({ answer })} disabled={locked || score !== null || manualOpen} />
        {!locked && score === null && !manualOpen && <div className="row wrap form-actions"><button className="button primary" disabled={!hasAnswer(answer)}>{manual ? 'Compare with model answer' : 'Check answer'}</button>
          <label className="row"><small>Confidence</small><select aria-label="Confidence rating" value={confidence} onChange={e => patch({ confidence: Number(e.target.value) })}>
            <option value={1}>1 · Guessing</option><option value={2}>2 · Unsure</option><option value={3}>3 · Somewhat sure</option><option value={4}>4 · Confident</option><option value={5}>5 · Very confident</option>
          </select></label></div>}
      </form>
      {score !== null && <div className={'feedback ' + (score === question.marks ? 'success' : 'warning')} role="status">
        <strong>{score === question.marks ? manual ? 'Self-assessment saved' : 'Correct' : score > 0 ? 'Partially correct' : 'Review this one'} · {score}/{question.marks}</strong>
        <p>{score === question.marks ? question.explanation : locked ? (manual ? 'Use the rubric to compare your reasoning.' : 'Review the worked explanation and try a related question.') : incorrectFeedback}</p>
        {!locked && <button type="button" className="button secondary small" onClick={() => { patch({ score: null, retries: retries+1 }); start.current = Date.now(); }}>Try again</button>}
      </div>}
      {show && <Solution question={question} answer={manual ? answer : undefined} />}
      {manualOpen && <Rubric question={question} onSave={points => { save(points, hints, { manualOpen: false, locked: true }); }} />}
      <div className="question-footer"><QuestionDetails question={question} />
        {locked && <button className="button primary" onClick={onAdvance}>{isLast ? 'Finish session' : 'Next question'} <Icon name="chevron" size={18} /></button>}</div>
    </article>
    <aside className="panel tutor-panel">
      <div className="row"><Bubble icon="bulb" color="indigo" /><div><h3>Guidance</h3><small>{hints ? 'Assisted attempt' : 'Independent attempt'}</small></div></div>
      {!locked && !manualOpen ? <>
        <p>Start with what you know. If you get stuck, work through a hint.</p>
        <Hints question={question} level={hints} change={hints => patch({ hints })} />
        <button className="text-button reveal" onClick={reveal}>Reveal full solution</button>
      </> : <p>{hints ? 'This attempt will count as assisted.' : manual ? 'Your marks come from the rubric you apply.' : 'This attempt was recorded without hints.'}</p>}
    </aside>
  </div>;
}

export function Practice({ progress, update, session, setSession, openJourney }: {
  progress: Progress; update: Update; session: PracticeSet | null; setSession: (value: PracticeSet | null) => void; openJourney: () => void;
}) {
  const [topic, setTopic] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [source, setSource] = useState('all');
  const [paper, setPaper] = useState('all');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [subtopic, setSubtopic] = useState('all');
  const index = session?.index ?? 0;
  const complete = session?.complete ?? false;
  const setIndex = (next: number) => session && setSession({ ...session, index: next, draft: undefined });
  const setComplete = () => session && setSession({ ...session, complete: true });
  const [length, setLength] = useState(5);
  const due = dueQuestions(progress);
  const inPaper = papers.find(item => item.id === paper);
  const inPaperIds = new Set(inPaper?.parts.map(part => part.questionId));
  const queryText = normalizeText(query);
  const queryPart = questionNumber(queryText);
  const pool = questions.filter(q => (topic === 'all' || q.topic === topic) && (subtopic === 'all' || q.subtopic === subtopic) &&
    (difficulty === 'all' || q.difficulty === difficulty) && (source === 'all' || q.origin === source) &&
    (!inPaper || inPaperIds.has(q.id)) &&
    (!queryText || (queryPart ? matchesQuestionNumber(q.source, queryPart) :
      normalizeText([q.title, q.prompt, q.source.question ? examPart(q.source) : '', q.source.file].join(' ')).includes(queryText))));
  const start = (value: PracticeSet) => setSession({ ...value, index: 0, complete: false });
  if (session && complete) return <><PageTitle title={session.title} description="Practice complete" />
    <Empty icon="trophy" title="Session complete" action={<div className="row wrap center"><button className="button primary" onClick={() => setSession(null)}>More practice</button>
      <button className="button secondary" onClick={openJourney}>Learning journey</button></div>}>You worked through {session.ids.length} questions. Results and review dates are saved.</Empty></>;
  if (session && session.ids.some(id => !Object.hasOwn(questionById, id))) return <>
    <PageTitle title={session.title} description="This saved practice session needs its study pack." />
    <Empty icon="book" title="Study pack needed" action={<button className="button secondary" onClick={() => setSession(null)}>Close saved session</button>}>
      Reimport the pack in Settings to resume this session and restore its draft.
    </Empty>
  </>;
  if (session && session.ids[index]) return <>
    <PageTitle title={session.title} description={session.mode === 'review' ? 'Revisit and check what you can recall.' : 'Work at your own pace and ask for a hint when you need one.'}
      action={<button className="button secondary" onClick={() => setSession(null)}><Icon name="back" size={17} /> Back to practice</button>} />
    <QuestionDrill key={session.ids[index] + ':' + index} question={questionById[session.ids[index]]} index={index} count={session.ids.length} mode={session.mode} update={update}
      draft={session.draft} onDraft={draft => setSession({ ...session, draft })}
      isLast={index === session.ids.length-1} onAdvance={() => index === session.ids.length-1 ? setComplete() : setIndex(index+1)} />
  </>;
  return <>
    <PageTitle title="Practice" description="Build a session around a topic, question source, or difficulty." action={due.length ? <button className="button primary" onClick={() => start({ ids: due.slice(0,8), title: 'Spaced review', mode: 'review' })}>Review {due.length} due <Icon name="clock" size={17} /></button> : undefined} />
    <div className="panel panel-pad">
      <SectionTitle title="Build a practice session" description={pool.length + (pool.length === 1 ? ' question matches your filters' : ' questions match your filters')} />
      <div className="filter-grid">
        <label>Topic<select aria-label="Topic" value={topic} onChange={e => { setTopic(e.target.value); setSubtopic('all'); setVisibleCount(15); }}><option value="all">All topics</option>{topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Subtopic<select aria-label="Subtopic" value={subtopic} disabled={topic === 'all'} onChange={e => { setSubtopic(e.target.value); setVisibleCount(15); }}><option value="all">All subtopics</option>{topicById[topic]?.concepts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Difficulty<select aria-label="Difficulty" value={difficulty} onChange={e => { setDifficulty(e.target.value); setVisibleCount(15); }}><option value="all">All difficulties</option>{Object.entries(labels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Source<select aria-label="Source" value={source} onChange={e => { setSource(e.target.value); setPaper('all'); setVisibleCount(15); }}><option value="all">All sources</option>{Object.entries(originLabel).filter(([id])=>questions.some(q=>q.origin===id)).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {source === 'original' && <label>Past paper<select value={paper} onChange={e => { setPaper(e.target.value); setVisibleCount(15); }}>
          <option value="all">All past papers</option>{[...papers].reverse().map(item => <option key={item.id} value={item.id}>{item.year} Semester {item.semester}</option>)}
        </select></label>}
        <label>Search questions<input type="search" value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(15); }} placeholder="Title, prompt or question number" /></label>
        <label>Questions per session<select aria-label="Questions per session" value={length} onChange={e => setLength(Number(e.target.value))}>{[3,5,8,12].map(n => <option key={n}>{n}</option>)}</select></label>
      </div>
      <button className="button primary" disabled={!pool.length} onClick={() => {
        const latest = new Map(progress.attempts.map(a => [a.question,a]));
        const prioritized = [...pool].sort((a,b) => Number(latest.has(a.id)) - Number(latest.has(b.id)) || (latest.get(a.id)?.at ?? 0) - (latest.get(b.id)?.at ?? 0));
        start({ ids: prioritized.slice(0,length).map(q => q.id), title: topicById[topic]?.short ?? 'Mixed practice', mode: 'practice' });
      }}><Icon name="play" size={17} /> Start session</button>
    </div>
    <SectionTitle title="Question library" description="Open a specific question for a focused attempt." />
    {!pool.length ? <Empty icon="search" title="No matching questions">Choose a different combination of filters.</Empty> : <div className="panel compact-list">
      {pool.slice(0,visibleCount).map(q => <button className="question-list-item row spread" key={q.id} onClick={() => start({ ids:[q.id], title: q.title, mode:'practice' })}>
        <span><strong><MathText text={q.prompt.split('\n')[0]} /></strong><small>{topicById[q.topic].short} · {originLabel[q.origin]}{q.source.year && " · " + q.source.year + " S" + q.source.semester + " · " + examPart(q.source)}</small></span><Pill>{labels[q.difficulty]}</Pill><Icon name="chevron" size={17} />
      </button>)}</div>}
    {pool.length > visibleCount && <button className="button secondary" onClick={() => setVisibleCount(n => n+15)}>Show more questions ({visibleCount} of {pool.length})</button>}
  </>;
}

