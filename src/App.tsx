import { ModuleSelector } from './ModuleSwitcher.tsx';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BossBattles, ExamArena } from './Assessments.tsx';
import { bossQuestions, isBuiltinModule, moduleInfo, topicById } from './content/index.ts';
import { Dashboard } from './Dashboard.tsx';
import { Journey } from './Journey.tsx';
import type { LessonPath } from './Journey.tsx';
import { currentRoute, routes } from './navigation.ts';
import type { Route } from './navigation.ts';
import { Practice } from './Practice.tsx';
import type { PracticeSet, Update } from './Practice.tsx';
import { createExam, finishExam, localDate, mergeProgress, storageKey, totals } from './progress.ts';
import type { Recommendation } from './progress.ts';
import { availableProgress, loadPracticeSession, loadProgress, parseProgress, savePracticeSession } from './storage.ts';
import { Library, Notebook, Planner, SettingsPage } from './StudyTools.tsx';
import { StudySearch } from './StudySearch.tsx';
import type { ActiveExam, Progress } from './types.ts';
import { Icon, Modal, Pill, ProgressBar } from './ui.tsx';

const Statistics = lazy(async () => ({ default: (await import('./Statistics.tsx')).Statistics }));

const groups: [string, [Route,string][]][] = [
  ['Study', [['dashboard','home'],['journey','map'],['practice','target'],['boss','swords'],['exam','clipboard']]],
  ['Resources', [['notebook','notebook'],['library','book'],['planner','calendar'],['statistics','chart']]],
  ['Preferences', [['settings','settings']]]
];

export function App() {
  const [initial] = useState(loadProgress);
  const [fullProgress,setProgress] = useState(initial.progress);
  const progress = useMemo(() => availableProgress(fullProgress), [fullProgress]);
  const needsPack = progress.attempts.length !== fullProgress.attempts.length ||
    progress.results.length !== fullProgress.results.length || progress.activeExam !== fullProgress.activeExam ||
    Object.keys(progress.reviews).length !== Object.keys(fullProgress.reviews).length;
  const [storageError,setStorageError] = useState(initial.error);
  const [canSave,setCanSave] = useState(!initial.error);
  const [route,setRoute] = useState<Route>(currentRoute);
  const [mobile,setMobile] = useState(false);
  const [activeTopic,setActiveTopic] = useState<string|null>(null);
  const [lesson,setLesson] = useState<LessonPath|null>(null);
  const [session,setSessionState] = useState<PracticeSet|null>(() => loadPracticeSession(initial.progress.profileRevision));
  const setSession = (value: PracticeSet | null) => {
    setSessionState(value);
    try { savePracticeSession(value, fullProgress.profileRevision); }
    catch { setStorageError('The browser could not save this practice draft.'); }
  };
  const [sessionKey,setSessionKey] = useState(0);
  const [result,setResult] = useState<string|null>(null);
  const [assessmentConflict,setAssessmentConflict] = useState(false);
  const main = useRef<HTMLElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const lastObservedProfile = useRef<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMobile = () => { setMobile(false); requestAnimationFrame(() => menuButton.current?.focus()); };
  const update:Update = change => setProgress(change);
  const summary = totals(progress);
  const currentDate = new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'}).format(new Date(localDate()+'T12:00:00'));
  const navigate = (next:Route) => {
    if(location.hash.slice(1)!==next) location.hash=next;
    setRoute(next);setMobile(false);window.scrollTo(0,0);
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  };
  const go = (next:Route) => {
    if(next==='journey') {setActiveTopic(null);setLesson(null);}
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
    const panel = sidebar.current;
    panel?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMobile(); return; }
      if (event.key !== 'Tab') return;
      const controls = panel?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    const desktop = matchMedia('(min-width: 721px)');
    const onResize = () => { if (desktop.matches) setMobile(false); };
    desktop.addEventListener('change', onResize);
    window.addEventListener('keydown', handleKey);
    return () => {
      desktop.removeEventListener('change', onResize);
      window.removeEventListener('keydown', handleKey);
    };
  },[mobile]);
  useEffect(()=>{
    // Keep tabs in sync so one tab's save never overwrites work recorded in another.
    const sync=(event:StorageEvent)=>{
      if(event.key!==storageKey()||!event.newValue) return;
      try {
        const latest = localStorage.getItem(storageKey());
        if (!latest) return;
        const eventProfile = parseProgress(event.newValue, true);
        const incoming = latest === event.newValue ? eventProfile : mergeProgress(eventProfile, parseProgress(latest, true));
        lastObservedProfile.current = latest;
        setProgress(local => {
          const merged = mergeProgress(local, incoming);
          return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
        });
      }
      catch {
        // Preserve the last readable profile if another tab stores an invalid record.
        setCanSave(false);setStorageError('Progress was updated in another tab. Reload this page to continue saving.');
      }
    };
    window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=progress.settings.theme;
  },[progress.settings.theme]);
  useEffect(()=>{
    if (!canSave) return;
    try {
      const saved = localStorage.getItem(storageKey());
      const disk = saved ? parseProgress(saved, true) : null;
      if ((disk?.profileRevision ?? 0) > (fullProgress.profileRevision ?? 0)) {
        if (disk) setProgress(disk);
        return;
      }
      const concurrent = disk && saved !== lastObservedProfile.current;
      const merged = concurrent ? mergeProgress(disk, fullProgress) : fullProgress;
      const snapshot = JSON.stringify(merged);
      if (snapshot !== saved) localStorage.setItem(storageKey(), snapshot);
      lastObservedProfile.current = snapshot;
      if (concurrent && snapshot !== JSON.stringify(fullProgress)) setProgress(merged);
    } catch { setStorageError('The browser could not save progress. Export a backup in Settings.'); }
  },[fullProgress,canSave]);
  const revision = fullProgress.profileRevision;
  useEffect(() => {
    setSessionState(loadPracticeSession(revision));
  }, [revision]);
  const active = progress.activeExam;
  useEffect(()=>{
    if(!active || active.deadline===null) return;
    const remaining=active.deadline-Date.now();
    const timeout=setTimeout(()=>{
      setProgress(p=>p.activeExam?.id===active.id ? finishExam(p) : p);
      // Only bring a visible tab to the results; background tabs keep their current page.
      if(document.visibilityState==='visible') {
        setResult(active.id);
        setRoute('exam');
        if(location.hash!=='#exam') location.hash='exam';
      }
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
    if (fullProgress.activeExam) { setAssessmentConflict(true); return; }
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
    const diskRevision = loadProgress().progress.profileRevision ?? 0;
    const replaced = { ...value, profileRevision: Math.max(Date.now(), (fullProgress.profileRevision ?? 0) + 1, diskRevision + 1) };
    try {
      const snapshot = JSON.stringify(replaced);
      localStorage.setItem(storageKey(), snapshot);
      lastObservedProfile.current = snapshot;
    } catch {
      setStorageError('The browser could not save the replacement profile.');
      return false;
    }
    setStorageError('');setCanSave(true);setProgress(replaced);setResult(null);setSessionState(null);setActiveTopic(null);setLesson(null);
    return true;
  };
  const theme = progress.settings.theme;
  const currentQuestion = session && !session.complete ? session.ids[session.index ?? 0] : undefined;
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
    settings: <SettingsPage fullProgress={fullProgress} progress={progress} update={update} onImport={onImport} />
  }[route];

  return <div className="app">
    <a inert={mobile} className="skip-link" href="#content" onClick={event=>{event.preventDefault();main.current?.focus();}}>Skip to content</a>
    {mobile&&<button className="mobile-backdrop" aria-hidden="true" tabIndex={-1} onClick={closeMobile}/>}
    <aside ref={sidebar} id="study-navigation" className={'sidebar '+(mobile?'open':'')}
      role={mobile ? 'dialog' : undefined} aria-modal={mobile || undefined} aria-label={mobile ? 'Study navigation' : undefined}>
      {mobile && <button type="button" className="icon-button mobile-close" aria-label="Close navigation" onClick={closeMobile}><Icon name="close" /></button>}
      <button className="brand" onClick={()=>go('dashboard')} aria-label="StudyQuest dashboard">
        <span className="brand-mark"><Icon name="layers" size={25} /></span><span><strong>Study<span>Quest</span></strong><small>EXAM PREPARATION</small></span>
      </button>
      <div className="sidebar-module"><ModuleSelector /></div>
      <nav className="nav" aria-label="Main navigation">{groups.map(([name,links])=><div key={name} className="nav-group">
        <p>{name}</p>{links.map(([id,icon])=><button onClick={()=>go(id)} aria-current={route===id?'page':undefined} className={'nav-item '+(route===id?'active':'')} key={id}>
          <Icon name={icon} size={19}/><span>{routes[id]}</span>{route===id&&<i aria-hidden="true"/>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom">
        <div className="level-card"><BubbleLevel summary={summary} /></div>
        <small className="local-status"><i /> {storageError ? 'Check progress saving' : 'Progress saved on this device'}</small>
      </div>
    </aside>
    <div className="main-area" inert={mobile}>
      <header className="topbar">
        <div className="row"><button className="icon-button menu-button" aria-label="Open navigation" aria-expanded={mobile} aria-controls="study-navigation" ref={menuButton} onClick={()=>setMobile(true)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span className="course-id"><Icon name="grad" size={18} /> {moduleInfo.name}</span><Icon name="chevron" size={15}/><strong>{routes[route]}</strong></div></div>
        <div className="row header-actions">
          <StudySearch openTopic={openTopic} currentQuestion={currentQuestion} hasPracticeSession={currentQuestion !== undefined}
            openQuestion={question => {
              if (currentQuestion === question.id) navigate('practice');
              else practice({ ids: [question.id], title: question.title, mode: 'practice' });
            }} />
          {active&&route!=='exam'&&<button className="button secondary small resume-top" onClick={()=>go('exam')}><Icon name="clock" size={17} /> Resume assessment</button>}
          <span className="header-date"><Icon name="calendar" size={17}/> {currentDate}</span>
          <button className="icon-button theme" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>update(p=>({...p,settings:{...p.settings,theme:theme==='light'?'dark':'light'}}))}><Icon name={theme==='light'?'moon':'sun'} size={20}/></button>
          <button className="avatar" aria-label="Open study settings" onClick={()=>go('settings')}>SQ</button>
        </div>
      </header>
      <main id="content" ref={main} tabIndex={-1} className={'content '+(route==='dashboard'?'on-dashboard':'')}>
        {storageError&&<div className="feedback warning" role="status">{storageError}</div>}
        {isBuiltinModule() && needsPack && <div className="feedback warning" role="status">
          Some saved records need their study pack. Those records are still saved.
          <button className="text-button" onClick={()=>go('settings')}>Reimport study pack</button>
        </div>}
        {page}
        <footer className="footer"><span>StudyQuest · {moduleInfo.name}</span><span><Icon name="lock" size={14} /> Local study workspace</span></footer>
      </main>
    </div>
    {assessmentConflict && <Modal title="Assessment already in progress" onClose={()=>setAssessmentConflict(false)}>
      <p>{fullProgress.activeExam?.title}</p>
      <div className="row wrap">
        <button className="button primary" onClick={() => { setAssessmentConflict(false); go(progress.activeExam ? 'exam' : 'settings'); }}>
          {progress.activeExam ? 'Resume assessment' : 'Reimport study pack'}
        </button>
        <button className="button secondary" onClick={()=>setAssessmentConflict(false)}>Keep studying</button>
      </div>
    </Modal>}
  </div>;
}
function BubbleLevel({summary}:{summary:ReturnType<typeof totals>}) {
  const progress=summary.xp%200;
  return <><div className="row spread"><div className="row"><span className="level-glyph"><Icon name="bolt" size={18}/></span><div><strong>Level {summary.level}</strong><small>{summary.xp} total XP</small></div></div><Pill color="indigo">{summary.level}</Pill></div>
    <ProgressBar value={progress/2} label="Progress to next level"/><small>{200-progress} XP to level {summary.level+1}</small></>;
}

