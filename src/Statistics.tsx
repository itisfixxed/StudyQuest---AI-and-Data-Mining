import { examPart, PaperSource } from './PaperSource.tsx';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { historical, historicalParts, originLabel, papers, questionById, referenceById, topicById, topics } from './content/index.ts';
import { dayOffset, dueQuestions, localDate, mistakes, profile, totals } from './progress.ts';
import { subtopicRows } from './planning.ts';
import type { Progress } from './types.ts';
import { Bubble, Icon, PageTitle, Pill, ProgressBar, SectionTitle, formatDate, Empty } from './ui.tsx';

const originalCount = historicalParts.filter(part => questionById[part.questionId].origin === 'original').length;
const paperMarks = historicalParts.reduce((sum,part) => sum+part.marks,0);
const chartStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 12, fontSize: 14 };
const grid = { stroke: 'var(--border)', strokeDasharray: '4 4' };
const tick = { fill: 'var(--muted)', fontSize: 13 };

const groupSort = (labels: string[]) => [...labels.reduce((counts,name)=>counts.set(name,(counts.get(name) ?? 0)+1),new Map<string,number>())]
  .sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));

function Intelligence({ openTopic }: { openTopic:(id:string)=>void }) {
  if (!papers.length) return <Empty icon="clipboard" title="No past papers indexed">Import the study pack in Settings to see past-paper statistics.</Empty>;
  const order = [...historical].sort((a,b)=>b.papers-a.papers || b.marks-a.marks);
  const chart = order.map(x=>({ name:topicById[x.topic].short, papers:x.papers }));
  const structures = groupSort(historicalParts.map(part=>part.pattern));
  const formulas = groupSort(historicalParts.flatMap(part=>questionById[part.questionId].formulas)).slice(0,6);
  const combinations = groupSort(historicalParts.flatMap(part=>(part.related ?? []).map(id=>[topicById[part.topic].short,topicById[id].short].sort().join(' + ')))).slice(0,6);
  return <>
    <div className="summary-cards">
      {[['clipboard',papers.length,'Unique supplied papers'],['layers',historicalParts.length,'Marked parts indexed'],['target',paperMarks,'Total printed marks'],['check',originalCount,'Original parts available']].map(([icon,value,label])=><div key={label} className="panel mini-stat"><Bubble icon={String(icon)} /><div><strong>{value}</strong><small>{label}</small></div></div>)}
    </div>
    <div className="dashboard-grid">
      <section className="panel panel-pad chart-panel"><SectionTitle title="Historical topic frequency" description="Distinct papers where a topic appears as a primary or related tag." />
        <div className="chart-space" style={{height: chart.length * 30 + 38}}><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={chart} margin={{left:2,right:16}}>
          <CartesianGrid {...grid} horizontal={false} /><XAxis type="number" domain={[0,papers.length]} allowDecimals={false} tick={tick} /><YAxis width={128} type="category" dataKey="name" tick={tick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={chartStyle} cursor={{fill:'var(--surface-2)'}} /><Bar name="Papers" dataKey="papers" fill="var(--accent)" radius={[0,5,5,0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel panel-pad"><SectionTitle title="Revision priorities" description="Ranked by paper frequency, then primary marks." />
        {order.slice(0,5).map(item=><div className="row spread stats-list-row" key={item.topic}>
          <button className="text-button" onClick={()=>openTopic(item.topic)}>{topicById[item.topic].short}</button><Pill color="indigo">{item.papers}/{papers.length} papers</Pill></div>)}
        <p className="muted">Historical frequency helps prioritize revision. Future papers can have different coverage.</p>
      </section>
    </div>
    <div className="panel panel-pad">
      <SectionTitle title="Marks distribution" description="Printed marks are assigned once to the primary tag for each marked part. Related tags are counted only for paper frequency." />
      <div className="table-scroll"><table><thead><tr><th>Topic</th><th>Papers</th><th>Primary parts</th><th>Printed marks</th></tr></thead><tbody>
        {order.map(item=><tr key={item.topic}><th><button className="text-button" onClick={()=>openTopic(item.topic)}>{topicById[item.topic].name}</button></th><td>{item.papers}/{papers.length}</td><td>{item.primaryParts}</td><td>{item.marks}</td></tr>)}
      </tbody></table></div>
    </div>
    <div className="tile-grid">
      {([['Recurring structures',structures],['Formula references',formulas.map(([id,n])=>[referenceById[id]?.title ?? id,n])],['Concept combinations',combinations]] as [string,[string,number][]][]).map(([title,items])=>
        <section className="panel panel-pad" key={title}><SectionTitle title={title} />{items.slice(0,6).map(([name,n])=><div className="row spread stats-list-row" key={name}><span>{name}</span><Pill>{n} parts</Pill></div>)}</section>)}
    </div>
    <SectionTitle title="Source coverage" description={papers.length + " distinct supplied papers. Visually identical copies are counted once."} />
    <div className="panel exam-review">{[...papers].reverse().map(paper=><details className="review-part" key={paper.id}>
      <summary><span><strong>{paper.year} Semester {paper.semester}</strong><small>{paper.file.split('/').at(-1)}</small></span><Pill>{paper.parts.length} indexed parts</Pill></summary>
      <PaperSource paper={paper} /><div className="table-scroll"><table><thead><tr><th>Part</th><th>Topic</th><th>Marks</th><th>App coverage</th></tr></thead><tbody>
        {paper.parts.map(part=><tr key={part.label}><th>{examPart(questionById[part.questionId].source)} · p. {part.page}</th><td>{topicById[part.topic].short}</td><td>{part.marks}</td><td>{originLabel[questionById[part.questionId].origin]}</td></tr>)}
      </tbody></table></div>
    </details>)}</div>
  </>;
}

function LearningStats({ progress, openTopic }: { progress:Progress; openTopic:(id:string)=>void }) {
  const [selected,setSelected] = useState(topics[0].id);
  const summary = totals(progress);
  const data = profile(progress);
  const due = dueQuestions(progress);
  const errors = mistakes(progress);
  const itemization = subtopicRows(progress,selected);
  const history = Array.from({length:7},(_,i)=>{
    const date = localDate(dayOffset(i-6));
    const xp = progress.attempts.filter(a=>localDate(a.at)===date).reduce((s,a)=>s+a.xp,0)+progress.lessons.filter(a=>localDate(a.at)===date).length*20;
    return { name:formatDate(date).split(',')[0], xp };
  });
  const independent = progress.attempts.filter(a=>a.score===a.max && !a.assistance && !a.retries && a.graded==='auto');
  const days = [...new Set([...progress.attempts,...progress.lessons].map(a=>localDate(a.at)))].sort();
  let start = 0;
  let bestStreak = 0;
  for(let i=0;i<days.length;i++){
    if(i>0 && (Date.parse(days[i])-Date.parse(days[i-1]))!==86400000) start=i;
    bestStreak=Math.max(bestStreak,i-start+1);
  }
  const achievements = [
    ['book','First lesson','Complete your first concept lesson',progress.lessons.length>0],
    ['target','Independent thinker','Solve five different objective questions without help',new Set(independent.map(a=>a.question)).size>=5],
    ['flame','Consistent learner','Study three days in a row',bestStreak>=3],
    ['swords','Battle tested','Pass a Boss Battle without hints',data.some(row=>row.boss)],
    ['badge','Topic mastery','Reach 90% mastery in a topic',data.some(row=>row.score>=90)],
    ['reset','Retention check','Solve a spaced review independently',independent.some(a=>a.mode==='review')]
  ] as const;
  return <>
    <div className="summary-cards">
      {[['bolt',summary.xp,'Total XP'],['target',summary.attempted,'Questions attempted'],['check',summary.accuracy===null?'—':summary.accuracy+'%','Independent accuracy'],['clock',due.length,'Reviews due']].map(([icon,value,label])=>
        <div key={label} className="panel mini-stat"><Bubble icon={String(icon)} /><div><strong>{value}</strong><small>{label}</small></div></div>)}
    </div>
    <div className="dashboard-grid">
      <section className="panel panel-pad"><SectionTitle title="Study activity" description="Lesson and question XP over the past seven days." />
        <div className="chart-space activity-chart"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{left:-20,right:8}}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} allowDecimals={false} domain={[0, (max:number)=>Math.max(20,max)]} />
          <Tooltip contentStyle={chartStyle} cursor={{fill:'var(--surface-2)'}} /><Bar dataKey="xp" name="XP" fill="var(--accent)" radius={[5,5,0,0]} isAnimationActive={false} /></BarChart>
        </ResponsiveContainer></div>
      </section>
      <section className="panel panel-pad"><SectionTitle title="Personal records" />
        {[['Longest study streak',bestStreak+(bestStreak===1?' day':' days')],['Level',summary.level],['Independent solves',new Set(independent.map(a=>a.question)).size],['Assisted attempts',progress.attempts.filter(a=>a.assistance||a.retries).length],
          ['Solution reveals',progress.attempts.filter(a=>a.assistance===5||a.reviewAssistance===5).length],['Recurrent mistakes',errors.filter(e=>e.count>1&&!e.resolved).length]].map(([label,value])=><div key={label} className="row spread stats-list-row"><strong>{label}</strong><Pill>{value}</Pill></div>)}
      </section>
    </div>
    <section className="panel panel-pad"><SectionTitle title="Topic mastery" description="Lesson exposure, independent answers, difficulty, retention and Boss Battles inform these estimates." />
      <div className="mastery-grid">{data.map(row=><div key={row.topic.id}><div className="row spread"><button className="text-button" onClick={()=>openTopic(row.topic.id)}>{row.topic.short}</button><strong>{row.score}%</strong></div>
        <ProgressBar value={row.score} label={row.topic.name+' mastery'} color={row.topic.color} /></div>)}</div>
    </section>
    <section className="panel panel-pad"><SectionTitle title="Subtopic performance" action={<select aria-label="Topic for subtopic statistics" value={selected} onChange={e=>setSelected(e.target.value)}>{topics.map(t=><option key={t.id} value={t.id}>{t.short}</option>)}</select>} />
      <div className="table-scroll"><table><thead><tr><th>Concept</th><th>Attempts</th><th>Unassisted full marks</th><th>Avg. confidence</th><th>Avg. time*</th></tr></thead><tbody>
        {itemization.map(row=><tr key={row.concept.id}><th>{row.concept.name}</th><td>{row.attempts}</td><td>{row.full}</td><td>{row.confidence===null?'—':row.confidence.toFixed(1)+'/5'}</td><td>{row.timing>0?Math.round(row.timing)+'s':'—'}</td></tr>)}
      </tbody></table></div><small>*Recorded practice time. Assessments record total elapsed time.</small>
    </section>
    <SectionTitle title="Achievements" />
    <div className="tile-grid">{achievements.map(([icon,name,rule,earned])=><div className="panel achievement" key={name}><Bubble icon={icon} color={earned?'amber':'indigo'} large />
      <div><strong>{name}</strong><small>{rule}</small><Pill color={earned?'teal':''}>{earned?'Earned':'In progress'}</Pill></div></div>)}</div>
    {data.some(t=>t.boss)&&<section className="panel panel-pad"><SectionTitle title="Topic badges" /><div className="row wrap">{data.filter(t=>t.boss).map(t=><Pill key={t.topic.id} color="teal"><Icon name="badge" size={17} /> {t.topic.short}</Pill>)}</div></section>}
  </>;
}
export function Statistics({ progress, openTopic }: { progress:Progress; openTopic:(id:string)=>void }) {
  const [tab,setTab] = useState<'learning'|'intelligence'>('learning');
  return <>
    <PageTitle title="Statistics" description="Track your learning and see how topics have appeared in the supplied exams." />
    <div className="tabs"><button className={tab==='learning'?'active':''} aria-pressed={tab==='learning'} onClick={()=>setTab('learning')}>Learning progress</button>
      <button className={tab==='intelligence'?'active':''} aria-pressed={tab==='intelligence'} onClick={()=>setTab('intelligence')}>Exam intelligence</button></div>
    {tab==='learning'?<LearningStats progress={progress} openTopic={openTopic}/>:<Intelligence openTopic={openTopic}/>}
  </>;
}

