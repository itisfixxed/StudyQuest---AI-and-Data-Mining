import { StudyPackUpload } from './StudyPackUpload.tsx';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { arithmetic, normalizeText } from './answers.ts';
import { moduleInfo, papers, originLabel, practiceQuestions, references, topicById, topics } from './content/index.ts';
import { dailyMinutes, daysUntil, dueQuestions, localDate, mistakes, newProgress, recommend, reviewDate, weekStart } from './progress.ts';
import type { Recommendation } from './progress.ts';
import { personalQuests, studyPlan } from './planning.ts';
import { exportProgress, parseProgress } from './storage.ts';
import type { Progress, Reference } from './types.ts';
import { QuestionPrompt, Solution } from './Practice.tsx';
import type { PracticeSet, Update } from './Practice.tsx';
import { Bubble, Empty, Icon, MathBlock, Modal, PageTitle, Pill, ProgressBar, SectionTitle, SourceNote, formatDate } from './ui.tsx';

export function Notebook({ progress, practice, review }: { progress: Progress; practice: (set:PracticeSet) => void; review: (id:string) => void }) {
  const [filter, setFilter] = useState('open');
  const errors = mistakes(progress);
  const list = errors.filter(item => filter === 'all' || (filter === 'open' ? !item.resolved : item.resolved));
  return <>
    <PageTitle title="Mistake Notebook" description="Review repeated mistakes and revisit the concepts behind them."
      action={list.length ? <button className="button primary" onClick={() => practice({ ids:list.slice(0,10).map(item => item.q.id), title:'Mistake revision', mode:'review' })}><Icon name="reset" size={17} /> Start revision quiz</button> : undefined} />
    <div className="tabs" aria-label="Mistake filter">{[['open','Needs review'],['resolved','Resolved'],['all','All records']].map(([id,label]) =>
      <button className={filter===id ? 'active' : ''} aria-pressed={filter===id} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    {list.length ? <div className="panel exam-review">{list.map(({q,latest,count,attempts,resolved}) => <details className="review-part" key={q.id}>
      <summary><span><strong>{q.title}</strong><small>{topicById[q.topic].name} · {attempts} total {attempts===1 ? 'attempt' : 'attempts'}</small></span>
        <Pill color={resolved ? 'teal' : count > 1 ? 'rose' : 'amber'}>{resolved ? 'Resolved' : count > 1 ? count+' missed attempts' : 'Missed once'}</Pill></summary>
      <QuestionPrompt question={q} /><Pill>{originLabel[q.origin]}</Pill>
      <Solution question={q} answer={latest.answer} />
      <div className="row wrap"><button className="button primary" onClick={() => practice({ids:[q.id],title:q.title+' retry',mode:'review'})}>Try again</button>
        <button className="button secondary" onClick={() => review(q.topic)}>Revisit {topicById[q.topic].short}</button></div>
    </details>)}</div> : <Empty icon="notebook" title={filter === 'resolved' ? 'No resolved mistakes yet' : 'No mistakes to review'}>Missed and partially correct questions appear here after assessment.</Empty>}
  </>;
}

function FormulaRecall({ reference }: { reference: Reference }) {
  const [input,setInput] = useState('');
  const [status,setStatus] = useState<'hidden'|'incorrect'|'correct'|'shown'>('hidden');
  const recall = reference.recall!;
  const check = () => {
    const expected = arithmetic(recall[1]);
    const actual = arithmetic(input);
    const correct = expected !== null ? actual !== null && Math.abs(actual-expected) <= 1e-8 : normalizeText(input) === normalizeText(recall[1]);
    setStatus(correct ? 'correct' : 'incorrect');
  };
  return <div className="check-panel">
    <h3>Recall exercise</h3>
    <label className="response-field"><span>{recall[0]}</span><input value={input} onChange={e => {setInput(e.target.value);setStatus('hidden');}} /></label>
    <div className="row wrap"><button className="button primary small" disabled={!input.trim()} onClick={check}>Check recall</button>
      <button className="text-button" onClick={() => setStatus('shown')}>Show answer</button></div>
    {status !== 'hidden' && <p role="status" className={status === 'incorrect' ? 'bad-text' : 'good-text'}>{status === 'incorrect' ? 'Try again. Recall how the parameters are used.' : status === 'correct' ? 'Correct.' : 'Answer: ' + recall[1]}</p>}
  </div>;
}
export function Library({ progress, update }: { progress: Progress; update: Update }) {
  const [query, setQuery] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [tab, setTab] = useState<'reference'|'concept'>('reference');
  const [recall,setRecall] = useState('');
  const match = (id: string, text: string) => (!bookmarked || progress.bookmarks.includes(id)) && normalizeText(text).includes(normalizeText(query));
  const updateBookmark = (id: string) => update(p => ({
    ...p, bookmarks:p.bookmarks.includes(id) ? p.bookmarks.filter(bookmark=>bookmark!==id) : [...p.bookmarks,id]
  }));
  const bookmark = (id:string) => <button className={'icon-button bookmark-button '+(progress.bookmarks.includes(id) ? 'selected' : '')}
    aria-label={progress.bookmarks.includes(id) ? 'Remove bookmark' : 'Bookmark'} aria-pressed={progress.bookmarks.includes(id)} onClick={() => updateBookmark(id)}><Icon name="bookmark" /></button>;
  const formulas = references.filter(ref => match(ref.id,[ref.title,ref.purpose,ref.parameters,ref.expression,topicById[ref.topic].name].join(' ')));
  const concepts = topics.flatMap(topic => topic.concepts.map(concept => ({ concept,topic,id:'concept/'+topic.id+'/'+concept.id })))
    .filter(({concept,topic,id})=> match(id,[concept.name,concept.formal,concept.intuition,topic.name].join(' ')));
  return <>
    <PageTitle title="Formula Library" description="Search formulas, assumptions, worked examples and concept summaries." />
    <div className="panel library-toolbar row wrap">
      <label className="search-field"><Icon name="search" size={19} /><input aria-label="Search formulas and concepts" placeholder="Search formulas or concepts…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className={'button secondary ' + (bookmarked ? 'selected' : '')} aria-pressed={bookmarked} onClick={() => setBookmarked(!bookmarked)}><Icon name="bookmark" size={17} /> Bookmarked</button>
    </div>
    <div className="tabs"><button className={tab==='reference' ? 'active' : ''} aria-pressed={tab==='reference'} onClick={()=>setTab('reference')}>Formulas & reference</button>
      <button className={tab==='concept' ? 'active' : ''} aria-pressed={tab==='concept'} onClick={()=>setTab('concept')}>Concepts</button></div>
    {!(tab==='reference' ? formulas.length : concepts.length) && <Empty icon="search" title="No matching entries">Try another search or change the bookmark filter.</Empty>}
    {tab==='reference' ? <div className="reference-grid">{formulas.map(ref => <article className="panel reference-card" key={ref.id}>
      <div className="row spread"><Pill color={topicById[ref.topic].color}>{topicById[ref.topic].short}</Pill>{bookmark(ref.id)}</div>
      <h2>{ref.title}</h2><p>{ref.purpose}</p>
      {ref.expression && recall !== ref.id && <MathBlock expression={ref.expression} />}
      {recall === ref.id ? <FormulaRecall key={ref.id} reference={ref} /> : <div className="reference-details">
        {ref.parameters && <p><strong>Parameters</strong> {ref.parameters}</p>}<p><strong>Use when</strong> {ref.assumptions}</p>
        <p><strong>Worked example</strong> {ref.example}</p><p><strong>Variation</strong> {ref.variation}</p>
        <p><strong>Common mistake</strong> {ref.mistake}</p></div>}
      {ref.recall && <button className="button secondary small" onClick={() => setRecall(recall === ref.id ? '' : ref.id)}><Icon name="target" size={16} /> {recall === ref.id ? 'Back to reference' : 'Test recall'}</button>}
      <SourceNote source={ref.source} />
    </article>)}</div> : <div className="reference-grid">{concepts.map(({concept,topic,id})=><article className="panel reference-card" key={id}>
      <div className="row spread"><Pill color={topic.color}>{topic.short}</Pill>{bookmark(id)}</div>
      <h2>{concept.name}</h2><p>{concept.formal}</p><p><strong>Worked example</strong> {concept.example}</p><p><strong>Watch for</strong> {concept.pitfall}</p>
      <SourceNote source={concept.source} />
    </article>)}</div>}
  </>;
}

export function Planner({ progress, start, practice, openTopic }: { progress: Progress; start:(r:Recommendation)=>void; practice:(set:PracticeSet)=>void; openTopic:(id:string)=>void }) {
  const [crash, setCrash] = useState(false);
  const [budget, setBudget] = useState(progress.settings.goal);
  const days = daysUntil(progress.settings.examDate);
  const plan = studyPlan(progress,budget,crash);
  const quests = personalQuests(progress);
  const due = dueQuestions(progress);
  return <>
    <PageTitle title="Study Planner" description="Plan focused sessions around the exam date, your time and current mastery."
      action={<button className="button primary" onClick={() => start(recommend(progress))}><Icon name="play" size={17} /> Start recommended session</button>} />
    <div className="panel panel-pad">
      <div className="row spread wrap"><div className="tabs inline-tabs"><button className={!crash ? 'active' : ''} aria-pressed={!crash} onClick={()=>setCrash(false)}>Study plan</button>
        <button className={crash ? 'active' : ''} aria-pressed={crash} onClick={()=>setCrash(true)}><Icon name="flame" size={17} /> Crash Course</button></div>
        <Pill color={days !== null && days >= 0 && days <= 3 ? 'amber' : 'indigo'}><Icon name="calendar" size={16} /> {days === null ? 'Exam date unset' : days < 0 ? 'Exam date passed' : days===0 ? 'Exam today' : days+' days to exam'}</Pill></div>
      <label className="narrow-field">Available minutes per day<input type="number" min={5} max={240} value={budget} onChange={e=>{const n=Number(e.target.value); if (n>=0 && n<=240) setBudget(n);}} onBlur={()=>setBudget(Math.max(5,budget))} /></label>
      <p>{crash ? 'Prioritize prerequisites, frequent question patterns, common mistakes and short exam-style practice.' : (papers.length ? 'Sessions reflect your progress and the topic patterns in the supplied papers.' : 'Sessions reflect your progress and topic prerequisites.')}</p>
    </div>
    {due.length > 0 && <div className="panel resume-banner row spread"><div className="row"><Bubble icon="clock" color="amber" /><div><strong>{due.length} spaced reviews due</strong><small>Review a few before the next session.</small></div></div>
      <button className="button secondary" onClick={() => practice({ids:due.slice(0,8),title:'Spaced review',mode:'review'})}>Start review</button></div>}
    <div className="dashboard-grid">
      <section><SectionTitle title={crash ? 'Crash course sessions' : 'Upcoming sessions'} />
        <div className="plan-list">{plan.map((session,i)=><article className="panel plan-day" key={session.date}>
          <div className="row spread wrap"><div className="row"><Bubble icon={session.item.topic.icon} color={session.item.topic.color} /><div><small>{i===0 ? 'Today · ' : ''}{formatDate(session.date)}</small><h3>{session.item.topic.name}</h3></div></div>
            <Pill>{session.item.score}% mastery</Pill></div>
          <small>{session.reason}</small>
          {crash && session.prerequisites.length > 0 && <div className="row wrap"><small>Refresh first</small>{session.prerequisites.map(id=>
            <button className="text-button" onClick={()=>openTopic(id)} key={id}>{topicById[id].short}</button>)}</div>}
          <div className="row wrap"><Pill color="indigo">{session.study} min concepts</Pill><Pill color="teal">{session.practice} min {session.drill.toLowerCase()}</Pill>{session.review>0 && <Pill color="amber">{session.review} min review</Pill>}</div>
          <div className="row wrap"><button className="button secondary small" onClick={()=>openTopic(session.item.topic.id)}>Open topic</button>
            <button className="text-button" onClick={()=>{
              const pool=practiceQuestions.filter(q=>q.topic===session.item.topic.id);
              const chosen=crash ? pool.filter(q=>q.difficulty==='exam'||q.difficulty==='hard') : pool.filter(q=>q.difficulty==='easy'||q.difficulty==='medium');
              practice({ids:chosen.slice(0,4).map(q=>q.id),title:session.item.topic.short+' study plan',mode:'practice'});
            }}>Start practice <Icon name="chevron" size={17} /></button></div>
        </article>)}</div>
      </section>
      <div className="dashboard-side">
        {[['Today’s quests',quests.daily],['Weekly quests',quests.weekly]].map(([title,rows])=><section key={String(title)}><SectionTitle title={String(title)} />
          <div className="panel quest-card">{(rows as typeof quests.daily).map(q=><div className="quest" key={q.title}><Bubble icon={q.value>=q.target ? 'check':q.icon} />
            <div><div className="row spread"><strong>{q.title}</strong><small>{q.value}/{q.target}</small></div><ProgressBar label={q.title} value={100*q.value/q.target} /></div></div>)}</div>
        </section>)}
      </div>
    </div>
  </>;
}

export function SettingsPage({ progress, update, onImport }: { progress:Progress; update:Update; onImport:(value:Progress)=>void }) {
  const [message,setMessage] = useState('');
  const [reset,setReset] = useState(false);
  const [incoming,setIncoming] = useState<Progress|null>(null);
  const [goal,setGoal] = useState(String(progress.settings.goal));
  const file = useRef<HTMLInputElement>(null);
  const importFile = async (event:ChangeEvent<HTMLInputElement>) => {
    const chosen=event.target.files?.[0];
    event.target.value='';
    if (!chosen) return;
    try {
      if(chosen.size>10*1024*1024) throw new Error('Choose a StudyQuest backup smaller than 10 MB.');
      setIncoming(parseProgress(await chosen.text())); setMessage('');
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Unable to read this file.'); }
  };
  const saveGoal=()=>{
    const next=Number(goal);
    if (!Number.isInteger(next)||next<5||next>240) {setMessage('Enter a daily goal between 5 and 240 minutes.');return;}
    update(p=>({...p,settings:{...p.settings,goal:next}}));setMessage('Daily study goal saved.');
  };
  return <>
    <PageTitle title="Settings" description="Set your study targets and manage progress on this device." />
    <div className="settings-grid">
      <section className="panel panel-pad">
        <SectionTitle title="Study preferences" />
        <label className="narrow-field">Exam date<input type="date" value={progress.settings.examDate} onChange={e => {
          const examDate=e.target.value;
          update(p=>({...p,settings:{...p.settings,examDate}, reviews:Object.fromEntries(Object.entries(p.reviews).map(([id,r])=>[id,{...r,due:Math.min(r.due,reviewDate(r.box,examDate,Date.now()))}]))}));
        }} /></label>
        <p className="muted">Enter your scheduled IE4483 exam date to enable the countdown and deadline-aware review.</p>
        <form onSubmit={e=>{e.preventDefault();saveGoal();}} className="row wrap setting-goal">
          <label>Daily study goal (minutes)<input value={goal} type="number" min={5} max={240} onChange={e=>setGoal(e.target.value)} required /></label><button className="button primary" type="submit">Save target</button>
        </form>
        <small>{dailyMinutes(progress)} min studied today · Week of {formatDate(weekStart())}</small>
      </section>
      <section className="panel panel-pad">
        <SectionTitle title="Appearance" />
        <div className="row wrap">
          {(['light','dark'] as const).map(theme=><button className={'button secondary '+(progress.settings.theme===theme?'selected':'')} aria-pressed={progress.settings.theme===theme} key={theme}
            onClick={()=>update(p=>({...p,settings:{...p.settings,theme}}))}><Icon name={theme==='light'?'sun':'moon'} size={17} /> {theme==='light'?'Light':'Dark'}</button>)}
        </div>
      </section>
      <section className="panel panel-pad">
        <SectionTitle title="Profile and backups" description="Study progress is saved in this browser." />
        <div className="row wrap"><button className="button secondary" onClick={()=>exportProgress(progress,'studyquest-' + moduleInfo.code.toLowerCase() + '-progress-'+localDate()+'.json')}><Icon name="download" size={18} /> Export progress</button>
          <button className="button secondary" onClick={()=>file.current?.click()}><Icon name="upload" size={18} /> Import progress</button>
          <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Choose progress backup" onChange={importFile} tabIndex={-1} /></div>
        <button className="text-button danger" onClick={()=>setReset(true)}><Icon name="reset" size={17} /> Reset progress</button>
      </section>
    </div>
    <StudyPackUpload />
    {message&&<p className="feedback" role="status">{message}</p>}
    {incoming&&<Modal title="Import this study profile?" onClose={()=>setIncoming(null)}>
      <p>This backup contains {incoming.lessons.length} completed lessons and {incoming.attempts.length} attempts. Importing replaces the profile in this browser.</p>
      <button className="button primary" onClick={()=>{onImport(incoming);setGoal(String(incoming.settings.goal));setIncoming(null);setMessage('Progress imported.');}}>Import profile</button>
    </Modal>}
    {reset&&<Modal title="Reset study progress?" onClose={()=>setReset(false)}>
      <p>This clears attempts, settings, bookmarks and results in this browser. Export a backup if you want to keep this profile.</p>
      <div className="row wrap"><button className="button secondary" onClick={()=>setReset(false)}>Cancel</button><button className="button destructive" onClick={()=>{
        const next=newProgress();onImport(next);setGoal(String(next.settings.goal));setReset(false);setMessage('Study progress reset.');
      }}>Reset profile</button></div>
    </Modal>}
  </>;
}

