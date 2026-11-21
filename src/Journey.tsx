import { useRef, useState } from 'react';
import { isBuiltinModule, knowledgeQuestions, practiceQuestions, references, stages, topicById } from './content/index.ts';
import { addLesson, profile, topicLocked } from './progress.ts';
import type { Progress, Topic } from './types.ts';
import { AnswerField } from './Practice.tsx';
import type { PracticeSet, Update } from './Practice.tsx';
import { Bubble, Icon, MathBlock, PageTitle, Pill, ProgressBar, SectionTitle, SourceNote } from './ui.tsx';

import { TopicLecture } from './TopicLecture.tsx';
import { Demonstration } from './Demonstration.tsx';

export interface LessonPath { topic: string; concept: string; after?: string[] }
function Lesson({ path, progress, update, openTopic, nextLesson, practice }: {
  path: LessonPath; progress: Progress; update: Update; openTopic: () => void;
  nextLesson: (path: LessonPath) => void; practice: (session: PracticeSet) => void;
}) {
  const topic = topicById[path.topic];
  const concept = topic.concepts.find(c => c.id === path.concept)!;
  const id = topic.id + '/' + concept.id;
  const check = knowledgeQuestions.find(q => q.topic === topic.id && q.subtopic === concept.id)!;
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const start = useRef(Date.now());
  const complete = progress.lessons.some(l => l.id === id);
  const next = topic.concepts[topic.concepts.indexOf(concept)+1];
  return <>
    <PageTitle title={concept.name} description={topic.name} action={<button className="button secondary" onClick={openTopic}><Icon name="back" size={17} /> Back to topic</button>} />
    <div className="session-cols">
      <article className="panel lesson-panel">
        <div className="row spread"><Pill color="indigo">Concept lesson</Pill>{complete && <Pill color="teal"><Icon name="check" size={15} /> Completed</Pill>}</div>
        <h2>Build the intuition</h2><p className="lesson-intro">{concept.intuition}</p>
        <h3>How it works</h3><p>{concept.formal}</p>
        {isBuiltinModule() && <Demonstration topic={topic.id} concept={concept.id} />}
        {references.filter(r => concept.formulas.includes(r.id) && r.expression)
          .map(r => <div className="lesson-formula" key={r.id}><h3>{r.title}</h3><MathBlock expression={r.expression!} /><p>{r.parameters}</p></div>)}
        <h3>Worked example</h3><p>{concept.example}</p>
        <div className="check-panel">
          <Pill color="indigo"><Icon name="target" size={15} /> Knowledge check</Pill>
          <h3>{check.prompt}</h3>
          <AnswerField question={check} answer={value} id="lesson-check" setAnswer={answer => { setValue(String(answer)); setResult(null); }} disabled={result === true} />
          <button className="button primary small" disabled={!value || result === true} onClick={() => {
            const correct = value === check.answer;
            setResult(correct);
            if (correct && !complete) {
              const seconds = (Date.now()-start.current)/1000;
              update(p => addLesson(p,id,seconds));
            }
          }}>Check understanding</button>
          {result !== null && <p role="status" className={result ? 'good-text' : 'bad-text'}>{result ? 'Correct. ' + concept.formal : check.optionFeedback?.[check.options!.indexOf(value)] ?? concept.pitfall}</p>}
        </div>
        <div className="row wrap">
          {complete && !!path.after?.length && <button className="button primary" onClick={() =>
            practice({ ids: path.after!, title:'Refresher practice', mode:'review' })
          }>Continue to refresher practice</button>}
          {complete && next && <button className="button secondary" onClick={() => nextLesson({ topic:topic.id, concept:next.id })}>Next lesson <Icon name="chevron" size={17} /></button>}
          {complete && !path.after?.length && <button className="button secondary" onClick={() => practice({ ids:practiceQuestions.filter(q => q.topic === topic.id && q.subtopic === concept.id && q.id !== check.id).slice(0,4).map(q => q.id),
            title:concept.name + ' practice', mode:'practice' })}>Apply this concept</button>}
        </div>
      </article>
      <aside className="panel tutor-panel">
        <div className="row"><Bubble icon="bulb" color="amber" /><h3>Exam cues</h3></div><p>{concept.cue}</p>
        <h3>Common mistake</h3><p>{concept.pitfall}</p>
        {topic.prerequisites.length > 0 && <><h3>Builds on</h3><p>{topic.prerequisites.map(t => topicById[t].name).join(', ')}</p></>}
        <h3>Course source</h3><SourceNote source={concept.source} />
      </aside>
    </div>
  </>;
}
export function Journey({ progress, update, activeTopic, openTopic, lesson, openLesson, practice, launchBoss }: {
  progress: Progress; update: Update; activeTopic: string | null; openTopic: (id: string | null) => void;
  lesson: LessonPath | null; openLesson: (path: LessonPath | null) => void; practice: (set: PracticeSet) => void; launchBoss: (topic: string) => void;
}) {
  const [lectureTopic,setLectureTopic] = useState<string|null>(null);
  const data = profile(progress);
  const active = data.find(p => p.topic.id === activeTopic);
  if (lesson) return <Lesson key={lesson.topic+'/'+lesson.concept} path={lesson} progress={progress} update={update} openTopic={() => openTopic(lesson.topic)}
    nextLesson={openLesson} practice={practice} />;
  if (active) {
    const {topic} = active;
    if(lectureTopic===topic.id) return <TopicLecture key={topic.id} topic={topic} progress={progress} update={update}
      close={()=>{setLectureTopic(null);window.scrollTo(0,0);}} openConcept={concept=>{
        setLectureTopic(null);
        openLesson({topic:topic.id,concept});
      }} />;
    const locked = topicLocked(topic,progress,data);
    const related = data.filter(p => p.topic.prerequisites.includes(topic.id));
    return <>
      <PageTitle title={topic.name} description={topic.summary} action={<button className="button secondary" onClick={() => openTopic(null)}><Icon name="back" size={17} /> All topics</button>} />
      <div className="panel panel-pad topic-overview">
        <div className="row spread"><div className="row"><Bubble icon={topic.icon} color={topic.color} large /><div><h2>Topic mastery</h2><p>{stages[active.stage]}</p></div></div><strong className="percent">{active.score}%</strong></div>
        <ProgressBar value={active.score} label={topic.name + ' mastery'} />
        <div className="stage-line" aria-label="Five progression stages">{stages.map((name,i) => <div key={name} className={i === active.stage ? 'current' : i < active.stage ? 'passed' : ''}><span>{i < active.stage ? <Icon name="check" size={15} /> : i+1}</span><strong>{name}</strong></div>)}</div>
      </div>
      <div className="session-cols"><div>
        {locked && <div className="feedback warning"><strong>Prerequisite topics recommended</strong><p>Build at least 25% mastery in {topic.prerequisites.map(id => topicById[id].short).join(' and ')} or choose to study this topic now.</p>
          <button className="button secondary" onClick={() => update(p => ({ ...p, overrides: [...new Set([...p.overrides,topic.id])] }))}>Study anyway</button></div>}
        <section className="panel panel-pad lecture-entry">
          <div><h2>Guided lecture</h2><p>Walk through a worked example, check each step, and explain the idea back.</p>
            {active.scenes > 0 && <small className="muted">{active.lecture} of {active.scenes} checks passed</small>}</div>
          <button className="button primary" onClick={()=>setLectureTopic(topic.id)}><Icon name="book" size={18} /> {
            active.lecture === 0 ? 'Start lecture' : active.lecture < active.scenes ? 'Resume lecture' : 'Review lecture'}</button>
        </section>
        <SectionTitle title="Concept lessons" description={active.completed + ' of ' + topic.concepts.length + ' complete'} />
        <div className="panel compact-list">{topic.concepts.map(c => <button className="question-list-item row spread" key={c.id} disabled={locked} onClick={() => openLesson({ topic:topic.id, concept:c.id })}>
          <Bubble icon={progress.lessons.some(l => l.id === topic.id + '/' + c.id) ? 'check' : 'book'} color={topic.color} /><span><strong>{c.name}</strong><small>{c.intuition}</small></span><Icon name="chevron" size={18} />
        </button>)}</div>
        <div className="row wrap topic-actions">
          <button className="button secondary" disabled={locked} onClick={() => {
            const pool = practiceQuestions.filter(q => q.topic === topic.id);
            const unseen = pool.filter(q => q.difficulty === (active.score < 30 ? 'easy' : active.score < 60 ? 'medium' : 'hard') &&
              !progress.attempts.some(a => a.question === q.id && a.score === a.max && !a.assistance && !a.retries));
            practice({ ids: (unseen.length ? unseen : pool).slice(0,5).map(q => q.id), title:topic.short + ' practice', mode:'practice' });
          }}>Practice topic</button>
          <button className="button primary" disabled={locked} onClick={() => launchBoss(topic.id)}><Icon name="swords" size={18} /> Boss Battle</button>
        </div>
      </div><aside className="panel tutor-panel">
        <h3>Prerequisites</h3>
        {topic.prerequisites.length ? topic.prerequisites.map(id => <button key={id} className="text-button" onClick={() => openTopic(id)}>{topicById[id].name} <Icon name="chevron" size={16} /></button>) : <p>This topic has no prerequisites.</p>}
        {related.length > 0 && <><h3>Leads to</h3>{related.map(r => <button key={r.topic.id} className="text-button" onClick={() => openTopic(r.topic.id)}>{r.topic.short} <Icon name="chevron" size={16} /></button>)}</>}
        <h3>Course sources</h3>{topic.sources.map(source => <SourceNote key={source.file} source={source} />)}
      </aside></div>
    </>;
  }
  return <>
    <PageTitle title="Learning Journey" description="Choose a topic to open its guided lecture, concept lessons, and practice." />
    <div className="roadmap">
      {data.map(({topic,score,stage,completed},i) => {
        const locked = topicLocked(topic,progress,data);
        return <article className="roadmap-item" key={topic.id}>
          <div className="roadmap-step"><Bubble icon={topic.icon} color={topic.color} large /></div>
          <button className="panel roadmap-card" onClick={() => openTopic(topic.id)}>
            <div className="row spread wrap"><div><h2>{topic.name}</h2><p>{topic.summary}</p></div><Pill color={locked ? '' : stage >= 3 ? 'teal' : 'indigo'}><Icon name={locked ? 'lock' : i===0 || completed ? 'book' : 'play'} size={15} /> {locked ? 'Prerequisite recommended' : stages[stage]}</Pill></div>
            <div className="row spread"><small>{topic.prerequisites.length ? 'Builds on ' + topic.prerequisites.map(id => topicById[id].short).join(', ') : 'Start here'}</small><strong>{score}% mastery</strong></div>
            <ProgressBar value={score} label={topic.name + ' mastery'} color={topic.color} />
          </button>
        </article>;
      })}
    </div>
  </>;
}

