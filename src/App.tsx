import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BossBattles, ExamArena } from './Assessments.tsx';
import { bossQuestions, moduleInfo, topicById } from './content/index.ts';
import { Dashboard } from './Dashboard.tsx';
import { Journey } from './Journey.tsx';
import type { LessonPath } from './Journey.tsx';
import { currentRoute, routes } from './navigation.ts';
import type { Route } from './navigation.ts';
import { Practice } from './Practice.tsx';
import type { PracticeSet, Update } from './Practice.tsx';
import { createExam, finishExam, localDate, storageKey, totals } from './progress.ts';
import type { Recommendation } from './progress.ts';
import { loadProgress } from './storage.ts';
import { Library, Notebook, Planner, SettingsPage } from './StudyTools.tsx';
import type { ActiveExam, Progress } from './types.ts';
import { Icon, Pill, ProgressBar } from './ui.tsx';

const Statistics = lazy(async () => ({ default: (await import('./Statistics.tsx')).Statistics }));

const groups: [string, [Route,string][]][] = [
  ['Study', [['dashboard','home'],['journey','map'],['practice','target'],['boss','swords'],['exam','clipboard']]],
  ['Resources', [['notebook','notebook'],['library','book'],['planner','calendar'],['statistics','chart']]],
  ['Preferences', [['settings','settings']]]
];

export function App() {
  const [initial] = useState(loadProgress);
  const [progress,setProgress] = useState(initial.progress);
  const [storageError,setStorageError] = useState(initial.error);
  const [canSave,setCanSave] = useState(!initial.error);
  const [route,setRoute] = useState<Route>(currentRoute);
  const [mobile,setMobile] = useState(false);
  const [activeTopic,setActiveTopic] = useState<string|null>(null);
  const [lesson,setLesson] = useState<LessonPath|null>(null);
  const [session,setSession] = useState<PracticeSet|null>(null);
  const [sessionKey,setSessionKey] = useState(0);
  const [result,setResult] = useState<string|null>(null);
  const main = useRef<HTMLElement>(null);
  const update:Update = change => setProgress(change);
  const summary = totals(progress);
  const currentDate = new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'}).format(new Date(localDate()+'T12:00:00'));
  const navigate = (next:Route) => {
    if(location.hash.slice(1)!==next) location.hash=next;
    setRoute(next);setMobile(false);window.scrollTo(0,0);
  };
  const go = (next:Route) => {
    if(next==='journey') {setActiveTopic(null);setLesson(null);}
    if(next==='practice') {setSession(null);setSessionKey(n=>n+1);}
    if(next==='exam') setResult(null);
    navigate(next);
  };
  useEffect(()=>{
    const listener=()=>{setRoute(currentRoute());setMobile(false);window.scrollTo(0,0);};
    window.addEventListener('hashchange',listener);
    return ()=>window.removeEventListener('hashchange',listener);
  },[]);
  useEffect(()=>{
    if (!mobile) return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape') setMobile(false);};
    window.addEventListener('keydown',close);
    return ()=>window.removeEventListener('keydown',close);
  },[mobile]);
  useEffect(()=>{
    document.documentElement.dataset.theme=progress.settings.theme;
  },[progress.settings.theme]);
  useEffect(()=>{
    if(!canSave) return;
    try {localStorage.setItem(storageKey,JSON.stringify(progress));setStorageError('');}
    catch {setStorageError('The browser could not save progress. Export a backup in Settings.');}
  },[progress,canSave]);
  const active = progress.activeExam;
  useEffect(()=>{
    if(!active || active.deadline===null) return;
    const remaining=active.deadline-Date.now();
    const timeout=setTimeout(()=>{
      setProgress(p=>p.activeExam?.id===active.id ? finishExam(p) : p);
      setResult(active.id);
      setRoute('exam');
      if(location.hash!=='#exam') location.hash='exam';
    },Math.max(0,remaining));
    return ()=>clearTimeout(timeout);
  },[active?.id,active?.deadline]);
  const openTopic = (topic:string|null) => {setActiveTopic(topic);setLesson(null);navigate('journey');};
  const openLesson = (path:LessonPath|null) => {if(path) setActiveTopic(path.topic);setLesson(path);navigate('journey');};
  const practice = (set:PracticeSet) => {
    if(!set.ids.length) return;
    setSession(set);setSessionKey(key=>key+1);navigate('practice');
  };
  const launchExam = (exam:ActiveExam) => {
    setResult(null);update(p=>p.activeExam ? p : {...p,activeExam:exam});navigate('exam');
  };
  const launchBoss = (topic:string) => launchExam(createExam(topicById[topic].short+' Boss Battle','boss',bossQuestions(topic).map(q=>q.id),null,false));
  const viewResult = (id:string) => {setResult(id);navigate('exam');};
  const start = (r:Recommendation) => {
    if (r.kind==='lesson') {openLesson({topic:r.topic,concept:r.concept!,after:r.ids});return;}
    if (r.kind==='boss') {launchBoss(r.topic);return;}
    practice({ids:r.ids,title:r.title,mode:r.kind==='review'?'review':'practice'});
  };
  const onImport = (value:Progress) => {
    setCanSave(true);setProgress(value);setResult(null);setSession(null);setActiveTopic(null);setLesson(null);
  };
  const theme = progress.settings.theme;
  const page = {
    dashboard: <Dashboard progress={progress} navigate={go} start={start} openTopic={openTopic}/>,
    journey: <Journey progress={progress} update={update} activeTopic={activeTopic} openTopic={openTopic} lesson={lesson} openLesson={openLesson} practice={practice} launchBoss={launchBoss} />,
    practice: <Practice key={sessionKey} progress={progress} update={update} session={session} setSession={setSession} openJourney={()=>go('journey')} />,
    boss: <BossBattles progress={progress} launch={launchBoss} resume={()=>go('exam')} viewResult={viewResult} />,
    exam: <ExamArena progress={progress} update={update} resultId={result} selectResult={setResult} setActive={launchExam} openTopic={openTopic} practice={practice} />,
    notebook: <Notebook progress={progress} practice={practice} review={openTopic} />,
    library: <Library progress={progress} update={update} />,
    planner: <Planner progress={progress} start={start} practice={practice} openTopic={openTopic} />,
    statistics: <Suspense fallback={<p role="status">Loading statistics…</p>}><Statistics progress={progress} openTopic={openTopic}/></Suspense>,
    settings: <SettingsPage progress={progress} update={update} onImport={onImport} />
  }[route];

  return <div className="app">
    <a className="skip-link" href="#content" onClick={event=>{event.preventDefault();main.current?.focus();}}>Skip to content</a>
    {mobile&&<button className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside className={'sidebar '+(mobile?'open':'')}>
      <button className="brand" onClick={()=>go('dashboard')} aria-label="StudyQuest dashboard">
        <span className="brand-mark"><Icon name="layers" size={25} /></span><span><strong>Study<span>Quest</span></strong><small>EXAM PREPARATION</small></span>
      </button>
      <nav className="nav" aria-label="Main navigation">{groups.map(([name,links])=><div key={name} className="nav-group">
        <p>{name}</p>{links.map(([id,icon])=><button onClick={()=>go(id)} aria-current={route===id?'page':undefined} className={'nav-item '+(route===id?'active':'')} key={id}>
          <Icon name={icon} size={19}/><span>{routes[id]}</span>{route===id&&<i aria-hidden="true"/>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom">
        <div className="level-card"><BubbleLevel summary={summary} /></div>
        <small className="local-status"><i /> Progress saved on this device</small>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="row"><button className="icon-button menu-button" aria-label="Open navigation" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span className="course-id"><Icon name="grad" size={18} /> StudyQuest</span><Icon name="chevron" size={15}/><strong>{routes[route]}</strong></div></div>
        <div className="row header-actions">
          {active&&route!=='exam'&&<button className="button secondary small resume-top" onClick={()=>go('exam')}><Icon name="clock" size={17} /> Resume assessment</button>}
          <span className="header-date"><Icon name="calendar" size={17}/> {currentDate}</span>
          <button className="icon-button theme" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>update(p=>({...p,settings:{...p.settings,theme:theme==='light'?'dark':'light'}}))}><Icon name={theme==='light'?'moon':'sun'} size={20}/></button>
          <button className="avatar" aria-label="Open study settings" onClick={()=>go('settings')}>SQ</button>
        </div>
      </header>
      <main id="content" ref={main} tabIndex={-1} className={'content '+(route==='dashboard'?'on-dashboard':'')}>
        {storageError&&<div className="feedback warning" role="status">{storageError}</div>}
        {page}
        <footer className="footer"><span>StudyQuest · {moduleInfo.name}</span><span><Icon name="lock" size={14} /> Local study workspace</span></footer>
      </main>
    </div>
  </div>;
}
function BubbleLevel({summary}:{summary:ReturnType<typeof totals>}) {
  const progress=summary.xp%200;
  return <><div className="row spread"><div className="row"><span className="level-glyph"><Icon name="bolt" size={18}/></span><div><strong>Level {summary.level}</strong><small>{summary.xp} total XP</small></div></div><Pill color="indigo">{summary.level}</Pill></div>
    <ProgressBar value={progress/2} label="Progress to next level"/><small>{200-progress} XP to level {summary.level+1}</small></>;
}

