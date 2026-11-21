import { useEffect, useRef, useState } from 'react';
import rawLectures from './content/lectures.json' with { type: 'json' };
import { LectureGraphic } from './LectureGraphic.tsx';
import type { Topic } from './types.ts';
import { Bubble, Icon, PageTitle, ProgressBar, SourceNote } from './ui.tsx';

type Scene = {
  concept:string;
  title:string;
  content:string;
  table:{ columns:string[]; rows:string[][] };
  check:{ prompt:string; options:string[]; right:number; hint:string; feedback:string };
};
type Lecture = { goal:string; explain:string; model:string; points:string[]; scenes:Scene[] };
const lectures:Record<string,Lecture> = rawLectures;

function SceneCheck({ check, onPass }: { check:Scene['check']; onPass:()=>void }) {
  const [choice,setChoice] = useState<number|null>(null);
  const [checked,setChecked] = useState(false);
  const [hint,setHint] = useState(false);
  const correct = checked && choice===check.right;

  return <section className="check-panel lecture-check">
    <h3>{check.prompt}</h3>
    <div className="lecture-options">
      {check.options.map((option,i) => <button type="button" className="button secondary lecture-option"
        aria-pressed={choice===i} key={option} onClick={() => {setChoice(i);setChecked(false);}}>{option}</button>)}
    </div>
    <div className="row wrap">
      <button type="button" className="button primary small" disabled={choice===null || checked} onClick={() => {
        setChecked(true);
        if(choice===check.right) onPass();
      }}>Check answer</button>
      <button type="button" className="text-button" aria-expanded={hint} onClick={() => setHint(value=>!value)}>
        {hint ? 'Hide hint' : 'Show hint'}
      </button>
    </div>
    {hint && (!checked || correct) && <p>{check.hint}</p>}
    {checked && <p role="status" className={correct?'good-text':'bad-text'}>
      {correct ? check.feedback : 'Try again. ' + check.hint}
    </p>}
  </section>;
}

function TeachBack({ lecture }: { lecture:Lecture }) {
  const [notes,setNotes] = useState('');
  const [visible,setVisible] = useState(false);
  return <div className="lecture-teach">
    <p>{lecture.explain}</p>
    <label>Draft your explanation
      <textarea rows={4} value={notes} onChange={event=>setNotes(event.target.value)}
        placeholder="You can also explain it aloud." />
    </label>
    <h3>Review your explanation</h3>
    <ul className="lecture-checklist">{lecture.points.map(point => <li key={point}><label>
      <input type="checkbox" /> {point}
    </label></li>)}</ul>
    <button type="button" className="button secondary" aria-expanded={visible} onClick={()=>setVisible(value=>!value)}>
      {visible ? 'Hide sample explanation' : 'Compare with a sample'}
    </button>
    {visible && <p className="lecture-model">{lecture.model}</p>}
  </div>;
}

export function TopicLecture({ topic, close, openConcept }: { topic:Topic; close:()=>void; openConcept:(id:string)=>void }) {
  const lecture = lectures[topic.id];
  const [step,setStep] = useState(0);
  const [passed,setPassed] = useState<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const scene = lecture.scenes[step];
  const concept = scene && topic.concepts.find(item => item.id===scene.concept);
  useEffect(() => {
    heading.current?.focus({preventScroll:true});
    if(step===0) window.scrollTo(0,0);
    else heading.current?.scrollIntoView({block:'start'});
  },[step]);

  return <>
    <PageTitle title={topic.name} description={lecture.goal} action={
      <button className="button secondary" onClick={close}><Icon name="back" size={17} /> Back to topic</button>
    } />
    <div className="lecture-layout">
      <nav aria-label="Lecture sections" className="panel panel-pad lecture-nav">
        <div className="row"><Bubble icon="book" color={topic.color}/><strong>Guided lecture</strong></div>
        <ProgressBar value={passed.length/lecture.scenes.length*100} label="Lecture checks passed" />
        <p className="muted">{passed.length} of {lecture.scenes.length} checks passed</p>
        {lecture.scenes.map((item,i) => <button type="button" key={item.title} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}>
          {passed.includes(i) && <Icon name="check" size={16} />}{item.title}
        </button>)}
        <button type="button" aria-current={!scene?'step':undefined} onClick={()=>setStep(lecture.scenes.length)}>Explain it back</button>
      </nav>
      <article className="panel lesson-panel lecture-main">
        <h2 tabIndex={-1} ref={heading}>{scene?.title ?? 'Explain it back'}</h2>
        {scene ? <>
          <p>{scene.content}</p>
          <LectureGraphic topic={topic.id} step={step} />
          <div className="table-scroll lecture-table">
            <table aria-label={scene.title+' worked example'}>
              <thead><tr>{scene.table.columns.map(name=><th key={name} scope="col">{name}</th>)}</tr></thead>
              <tbody>{scene.table.rows.map(row=><tr key={row[0]}><th scope="row">{row[0]}</th>
                {row.slice(1).map((cell,i)=><td key={i}>{cell}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <SceneCheck key={step} check={scene.check} onPass={()=>setPassed(old=>old.includes(step)?old:[...old,step])} />
          {concept && <div className="row wrap lecture-reference">
            <SourceNote source={concept.source} />
            <button type="button" className="text-button" onClick={()=>openConcept(concept.id)}>Study {concept.name}</button>
          </div>}
        </> : <TeachBack lecture={lecture} />}
        <div className="row spread wrap lecture-controls">
          {step>0 && <button type="button" className="button secondary" onClick={()=>setStep(step-1)}>Previous section</button>}
          {scene ? <button type="button" className="button primary" onClick={()=>setStep(step+1)}>
            {step+1===lecture.scenes.length ? 'Explain it back' : 'Next section'}
          </button> : <button type="button" className="button primary" onClick={close}>Back to topic</button>}
        </div>
      </article>
    </div>
  </>;
}
