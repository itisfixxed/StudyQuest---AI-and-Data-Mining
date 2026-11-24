import { examPart, paperFor, paperName, PaperSource } from './PaperSource.tsx';
import { useEffect, useState } from 'react';
import { hasAnswer } from './answers.ts';
import { bossQuestions, isManual, papers, questionById, questions, topicById, topics } from './content/index.ts';
import { assessmentEdit, createExam, finalizeResult, finishExam, markExam, profile } from './progress.ts';
import { AnswerField, Hints, QuestionDetails, QuestionPrompt, Rubric, ScreenMeta, Solution } from './Practice.tsx';
import type { PracticeSet, Update } from './Practice.tsx';
import type { ActiveExam, ExamResult, Progress, Question } from './types.ts';
import { Bubble, Empty, Icon, Modal, PageTitle, Pill, ProgressBar, SectionTitle, elapsed } from './ui.tsx';

function shuffler<T,>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [copy[i], copy[j]] = [copy[j],copy[i]];
  }
  return copy;
}

export function BossBattles({ progress, launch, resume, viewResult }: { progress: Progress; launch: (id: string) => void; resume: () => void; viewResult: (id: string) => void }) {
  const data = profile(progress);
  return <>
    <PageTitle title="Boss Battles" description="Apply several concepts in a structured assessment. Hints stay available and are recorded." />
    {progress.activeExam?.mode === 'boss' && <div className="panel resume-banner row spread"><div><strong>{progress.activeExam.title} in progress</strong><small>Resume where you left off.</small></div><button className="button primary" onClick={resume}>Resume battle</button></div>}
    <div className="tile-grid">{data.map(({topic, boss, score}) => {
      const selected = bossQuestions(topic.id);
      return <article className="panel tile" key={topic.id}>
        <div className="row spread"><Bubble icon={topic.icon} color={topic.color} large />{boss && <Pill color="teal"><Icon name="badge" size={16} /> Independent pass</Pill>}</div>
        <h2>{topic.short}</h2>
        <p>{topic.summary}</p>
        <div className="row wrap"><Pill>{selected.length} questions</Pill><Pill>{selected.reduce((sum,q) => sum+q.marks,0)} marks</Pill></div>
        <div className="tile-bottom"><small>{score}% mastery</small><button className="button secondary" onClick={() => launch(topic.id)}><Icon name="swords" size={17} /> {boss ? 'Retake battle' : 'Start battle'}</button></div>
      </article>;
    })}</div>
    <ResultHistory results={progress.results.filter(r => r.mode === 'boss')} select={viewResult} />
  </>;
}

export function ResultHistory({ results, select }: { results: ExamResult[]; select: (id: string) => void }) {
  return <section>
    <SectionTitle title="Assessment history" />
    {results.length ? <div className="panel compact-list">{[...results].reverse().map(result => {
      const max = result.questions.reduce((sum,id) => sum + questionById[id].marks, 0);
      const score = Object.values(result.scores).reduce((sum,m) => sum + m,0);
      return <button className="question-list-item row spread" key={result.id} onClick={() => select(result.id)}>
        <Bubble icon={result.mode === 'boss' ? 'swords' : 'clipboard'} /><span><strong>{result.title}</strong><small>{new Date(result.at).toLocaleDateString()} · {result.strict ? 'Strict' : 'Guided'} · {elapsed(result.seconds)}</small></span>
        <Pill color={result.finalized ? 'teal' : 'amber'}>{result.finalized ? score + '/' + max : 'Marking pending'}</Pill><Icon name="chevron" size={18} />
      </button>;
    })}</div> : <Empty icon="history" title="No assessments yet">Results and worked solutions will appear here after submission.</Empty>}
  </section>;
}

function groupParts(items: Question[]) {
  const groups = new Map<string, { question: Question; index: number }[]>();
  items.forEach((question, index) => {
    const paper = paperFor(question.source);
    const number = /^\d+/.exec(question.source.question ?? '')?.[0];
    const label = paper && number ? paperName(paper) + ' · Question ' + number : 'Other questions';
    const parts = groups.get(label) ?? [];
    parts.push({ question, index });
    groups.set(label, parts);
  });
  return [...groups];
}

function AssessmentScreen({ active, update, submit }: { active: ActiveExam; update: Update; submit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());
  const q = questionById[active.questions[active.index]];
  const count = active.questions.filter(id => hasAnswer(active.answers[id])).length;
  const flag = active.flags.includes(q.id);
  const seconds = active.deadline === null ? null : Math.max(0, Math.ceil((active.deadline-now)/1000));
  useEffect(() => {
    if (active.deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active.deadline]);
  const patch = (create: (old: ActiveExam) => ActiveExam) => update(p => p.activeExam?.id === active.id ?
    { ...p, activeExam: create(p.activeExam) } : p);
  const move = (index: number) => patch(old => ({ ...old, index, navigationEdit: assessmentEdit() }));
  return <>
    <PageTitle title={active.title} description={active.strict ? 'Strict simulation · hints disabled' : 'Guided assessment · hints count as assistance'}
      action={seconds !== null ? <span className={'timer ' + (seconds <= 60 ? 'urgent' : '')} aria-label="Time remaining"><Icon name="timer" size={20} /> {elapsed(seconds)}</span> : <Pill>Untimed</Pill>} />
    <div className="session-cols">
      <article className="panel question-panel">
        <div className="row spread wrap"><strong>Question {active.index+1} of {active.questions.length}</strong><button className={'button secondary small ' + (flag ? 'selected' : '')} aria-pressed={flag} onClick={() => patch(old => ({
          ...old, flags: old.flags.includes(q.id) ? old.flags.filter(id => id !== q.id) : [...old.flags,q.id],
          flagEdits: { ...old.flagEdits, [q.id]: assessmentEdit() }
        }))}><Icon name="flag" size={16} /> {flag ? 'Flagged for review' : 'Flag for review'}</button></div>
        <ScreenMeta question={q} />
        <h2>{q.source.year ? examPart(q.source) + ' · ' : ''}{q.title}</h2><QuestionPrompt question={q} />
        <AnswerField question={q} id={'exam-response-' + q.id} answer={active.answers[q.id] ?? (q.kind === 'multi' ? [] : '')} setAnswer={answer =>
          patch(old => ({ ...old, answers: { ...old.answers,[q.id]:answer }, answerEdits: { ...old.answerEdits, [q.id]: assessmentEdit() } }))} />
        <div className="row spread question-footer"><button className="button secondary" disabled={active.index===0} onClick={() => move(active.index-1)}><Icon name="back" size={18} /> Previous</button>
          {active.index+1 < active.questions.length ? <button className="button primary" onClick={() => move(active.index+1)}>Next question <Icon name="chevron" size={18} /></button> :
            <button className="button primary" onClick={() => setConfirm(true)}>Submit assessment</button>}</div>
      </article>
      <aside className="panel tutor-panel"><h3>Questions</h3><p>{count} of {active.questions.length} answered</p>
        <nav className="exam-nav-groups" aria-label="Question navigation">{groupParts(active.questions.map(id => questionById[id])).map(([label, parts]) =>
          <div key={label} role="group" aria-label={label}>
            <strong>{label}</strong>
            <div className="exam-nav">{parts.map(({question, index}) => {
              const answered = hasAnswer(active.answers[question.id]);
              const flagged = active.flags.includes(question.id);
              const part = examPart(question.source) || 'Question ' + (index + 1);
              return <button key={question.id} onClick={() => move(index)} aria-current={active.index === index ? 'step' : undefined}
                className={[active.index===index ? 'current' : '', answered ? 'answered' : ''].join(' ')}
                aria-label={part + (answered ? ', answered' : ', unanswered') + (flagged ? ', flagged' : '')}>
                {part}{flagged && <Icon name="flag" size={11} />}
              </button>;
            })}</div>
          </div>
        )}</nav>
        <button className="button secondary" onClick={() => setConfirm(true)}><Icon name="clipboard" size={17} /> Submit assessment</button>
        {!active.strict && <div className="exam-hints"><h3>Guided hints</h3><Hints key={q.id} question={q} level={active.assistance[q.id] ?? 0}
          change={level => patch(old => ({ ...old, assistance:{ ...old.assistance,[q.id]:level } }))} /></div>}
      </aside>
    </div>
    {confirm && <Modal title="Submit assessment?" onClose={() => setConfirm(false)}>
      <p>{count} of {active.questions.length} questions have responses. {active.flags.length ? active.flags.length + ' are flagged for review.' : 'Your responses are saved.'}</p>
      <div className="row wrap"><button className="button secondary" onClick={() => setConfirm(false)}>Continue working</button><button className="button primary" onClick={submit}>Submit assessment</button></div>
    </Modal>}
  </>;
}
function ResultScreen({ result, update, close, review, practice }: { result: ExamResult; update: Update; close: () => void;
  review: (topic: string) => void; practice: (set: PracticeSet) => void }) {
  const max = result.questions.reduce((sum,id) => sum + questionById[id].marks, 0);
  const score = result.questions.reduce((sum,id) => sum + (result.scores[id] ?? 0), 0);
  const assisted = Object.values(result.assistance).filter(Boolean).length;
  const outstanding = result.questions.filter(id => !result.marked.includes(id)).length;
  const byTopic = new Map<string, {points:number; max:number; ids:string[]}>();
  for (const id of result.questions) {
    const q = questionById[id];
    const values = byTopic.get(q.topic) ?? {points:0,max:0,ids:[]};
    if (Object.hasOwn(result.scores,id)) {
      values.points += result.scores[id];
      values.max += q.marks;
      if (result.scores[id] < q.marks) values.ids.push(id);
    }
    byTopic.set(q.topic,values);
  }
  const missed = [...byTopic.entries()].filter(([,v]) => v.ids.length).sort((a,b) => (b[1].max-b[1].points)-(a[1].max-a[1].points));
  return <>
    <PageTitle title="Assessment results" description={result.title} action={<button className="button secondary" onClick={close}><Icon name="back" size={17} /> Back to arena</button>} />
    <div className="panel result-summary">
      <div className="row"><Bubble icon={result.mode === 'boss' ? 'trophy' : 'clipboard'} large /><div><strong>{score} / {max}</strong><p>{result.finalized ? 'Marks earned' : 'Marks recorded so far'}</p></div></div>
      <div><Pill color={assisted ? 'amber' : 'teal'}>{assisted ? assisted + (assisted === 1 ? ' assisted question' : ' assisted questions') : 'No hints used'}</Pill><small>{elapsed(result.seconds)} elapsed · {outstanding ? outstanding + (outstanding === 1 ? ' response needs self-assessment' : ' responses need self-assessment') : 'Marks for written responses are estimates'}</small></div>
    </div>
    {!result.finalized && <div className="feedback warning"><strong>{outstanding ? 'Apply the rubrics below' : 'Save your reviewed result'}</strong><p>Written responses use estimated marking criteria. Marks only count toward mastery and your dashboard once you finalize.</p>
      <button className="button primary" disabled={outstanding > 0} onClick={() => update(p => finalizeResult(p,result.id))}>Finalize and update progress</button></div>}
    <div className="session-cols">
      <div><SectionTitle title="Question review" description="Compare your submitted answers with the worked solutions." />
        <div className="panel exam-review">
          {result.questions.map(id => {
            const q = questionById[id];
            const points = result.scores[id];
            const marked = result.marked.includes(id);
            return <details className="review-part" key={id}>
              <summary><span><strong>{q.source.year ? examPart(q.source) + ' · ' : ''}{q.title}</strong><small>{topicById[q.topic].short}</small></span>
                <Pill color={!marked ? 'amber' : points === q.marks ? 'teal' : ''}>{marked ? points + '/' + q.marks : 'Mark response'}</Pill></summary>
              <ScreenMeta question={q} /><QuestionPrompt question={q} />
              <Solution question={q} answer={result.answers[id] ?? ''} />
              {marked && points < q.marks && <div className="callout"><Icon name="target" size={18} /><span>{q.marks-points} marks lost. Check {q.title.toLowerCase()} against the model reasoning. {q.misconception}</span></div>}
              {isManual(q) && !result.finalized && hasAnswer(result.answers[id]) && <Rubric question={q} initial={marked ? points : undefined} onSave={value => update(p => markExam(p,result.id,id,value))} />}
              <QuestionDetails question={q} />
            </details>;
          })}
        </div>
      </div>
      <aside className="panel tutor-panel"><h3>Marks by topic</h3>
        {[...byTopic.entries()].map(([id,item]) => <div key={id} className="mark-topic"><div className="row spread"><strong>{topicById[id].short}</strong><small>{item.max ? item.points + '/' + item.max : 'Pending'}</small></div><ProgressBar value={item.max ? item.points/item.max*100 : 0} label={topicById[id].short+' marks'} /></div>)}
        <h3>Revision priorities</h3>
        {missed.length ? missed.slice(0,4).map(([id,item]) => <div key={id} className="mark-topic"><button className="text-button" onClick={() => review(id)}>{topicById[id].name} <Icon name="chevron" size={16} /></button><small>{[...new Set(item.ids.map(q => questionById[q].title))].join(', ')}</small></div>) : <p>{outstanding ? 'Priorities appear after questions are marked.' : 'No gaps in the marked parts of this assessment.'}</p>}
        {missed.length > 0 && <button className="button secondary" onClick={() => practice({ ids: missed.flatMap(([,v]) => v.ids), title:'Assessment revision', mode:'review' })}>Review missed questions</button>}
      </aside>
    </div>
  </>;
}
export function ExamArena({ progress, update, resultId, selectResult, setActive, openTopic, practice }: {
  progress: Progress; update: Update; resultId: string | null; selectResult: (id:string|null) => void; setActive: (exam:ActiveExam) => void;
  openTopic: (id:string) => void; practice: (set:PracticeSet) => void;
}) {
  const [mode, setMode] = useState<'paper'|'mock'|'topic'>(papers.length ? 'paper' : 'mock');
  const [paperId, setPaperId] = useState(papers.at(-1)?.id ?? '');
  const [topic, setTopic] = useState(topics[0].id);
  const [strict, setStrict] = useState(true);
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(String(papers.at(-1)?.duration ?? 60));
  const [originalOnly, setOriginalOnly] = useState(true);
  const result = progress.results.find(r => r.id === resultId);
  const paper = papers.find(p => p.id === paperId);
  const paperQuestions = (paper?.parts ?? []).map(p => questionById[p.questionId]).filter(q => !originalOnly || q.origin === 'original');
  const paperMarks = paperQuestions.reduce((s,q) => s + q.marks,0);
  const originalCount = paperQuestions.filter(q => q.origin === 'original').length;
  if (result) return <ResultScreen key={result.id} result={result} update={update} close={() => selectResult(null)} review={openTopic} practice={practice} />;
  if (progress.activeExam) return <AssessmentScreen key={progress.activeExam.id} active={progress.activeExam} update={update} submit={() => {
    const id = progress.activeExam!.id;
    update(p => p.activeExam?.id === id ? finishExam(p) : p); selectResult(id);
  }} />;
  const launch = () => {
    const chosen = mode === 'paper' ? paperQuestions : mode === 'topic' ? [
      ...shuffler(questions.filter(q => q.topic === topic && q.difficulty === 'exam')).slice(0,3),
      ...shuffler(questions.filter(q => q.topic === topic && q.difficulty !== 'exam' && q.difficulty !== 'easy')).slice(0,3)
    ] : [
      ...shuffler(questions.filter(q => q.difficulty === 'exam' && q.origin === 'generated')).slice(0,4),
      ...shuffler(questions.filter(q => q.difficulty === 'hard' && !isManual(q))).slice(0,4)
    ];
    if (!chosen.length) return;
    const title = mode === 'paper' && paper ? paper.year + ' Semester ' + paper.semester + (originalOnly ? ' · ' + (paper.selection ? 'Selected original questions' : 'Original questions') : ' · Paper simulation') :
      mode === 'topic' ? topicById[topic].short + ' assessment' : 'Randomized mock examination';
    setActive(createExam(title,'exam',chosen.map(q => q.id),timed ? Number(duration) : null,strict));
  };
  const disabled = (timed && (Number(duration) < 1 || Number(duration) > 240 || !Number.isInteger(Number(duration)))) || (mode === 'paper' && !paperQuestions.length);
  return <>
    <PageTitle title="Exam Arena" description="Simulate an examination, then review the marks and the reasoning behind each answer." />
    <div className="mode-grid" role="group" aria-label="Exam mode">
      {[['paper','Past-year paper','Choose a supplied paper','clipboard'],['mock','Randomized mock','Mix exam cases and calculations','shuffle'],['topic','Topic assessment','Focus on one area','target']].filter(([id]) => id !== 'paper' || papers.length > 0).map(([id,title,description,icon]) =>
        <button key={id} className={'panel mode-card ' + (mode===id ? 'selected' : '')} aria-pressed={mode===id} onClick={() => { setMode(id as typeof mode); setDuration(id==='paper' ? String(paper?.duration ?? 120) : id==='mock' ? '60' : '35'); }}>
          <Bubble icon={icon} /><strong>{title}</strong><small>{description}</small></button>)}
    </div>
    <div className="panel panel-pad exam-setup">
      <SectionTitle title="Assessment settings" />
      <div className="filter-grid">
        {mode === 'paper' && <label>Academic year<select value={paperId} onChange={e => { setPaperId(e.target.value); setDuration(String(papers.find(p => p.id === e.target.value)!.duration)); }}>
          {[...papers].reverse().map(p => <option value={p.id} key={p.id}>{p.year} Semester {p.semester}</option>)}</select></label>}
        {mode === 'topic' && <label>Topic<select value={topic} onChange={e => setTopic(e.target.value)}>{topics.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>}
        <label>Timing<select value={timed ? 'timed' : 'untimed'} onChange={e => setTimed(e.target.value === 'timed')}><option value="timed">Timed</option><option value="untimed">Untimed</option></select></label>
        {timed && <label>Duration in minutes<input type="number" min={1} max={240} value={duration} onChange={e => setDuration(e.target.value)} /></label>}
      </div>
      <label className="toggle-row"><input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} /><span><strong>Strict simulation</strong><small>Disable all hints until submission.</small></span></label>
      {mode === 'paper' && paper && <>
        <label className="toggle-row"><input type="checkbox" checked={originalOnly} onChange={e => setOriginalOnly(e.target.checked)} /><span><strong>Original questions only</strong><small>Use the original source scans.</small></span></label>
        <div className="callout"><Icon name="help" size={20} /><div><strong>{paperQuestions.length} parts · {paperMarks} marks · {originalCount} original{!originalOnly && paperQuestions.length > originalCount && ' · ' + (paperQuestions.length-originalCount) + ' adapted'}</strong>
          {paper.selection && <p className="muted">This assessment covers selected questions from the paper.</p>}
          <PaperSource key={paper.id} paper={paper} />
          <button className="text-button paper-practice" onClick={() => practice({ids:paperQuestions.map(q=>q.id),title:paper.year + ' Semester ' + paper.semester + ' practice',mode:'practice'})}>Practice this paper with hints</button>
        </div></div>
      </>}
      <p className="muted">Written responses use estimated self-assessment rubrics. Objective questions are marked automatically.</p>
      <button className="button primary" disabled={disabled} onClick={launch}><Icon name="play" size={18} /> Start assessment</button>
    </div>
    <ResultHistory results={progress.results.filter(r => r.mode==='exam')} select={selectResult} />
  </>;
}

