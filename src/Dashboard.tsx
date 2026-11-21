import { moduleInfo, papers, questionById, stages, topicById } from './content/index.ts';
import { daysUntil, mistakes, profile, recommend, totals } from './progress.ts';
import type { Recommendation } from './progress.ts';
import { personalQuests } from './planning.ts';
import type { Progress } from './types.ts';
import { Bubble, Empty, Icon, Pill, ProgressBar, Ring, SectionTitle, formatDate } from './ui.tsx';
import type { Route } from './navigation.ts';

export function Dashboard({ progress, navigate, start, openTopic }: { progress: Progress; navigate: (route: Route) => void;
  start: (recommendation: Recommendation) => void; openTopic: (topic: string) => void }) {
  const summary = totals(progress);
  const recommended = recommend(progress);
  const recommendedTopic = topicById[recommended.topic];
  const data = profile(progress);
  const date = daysUntil(progress.settings.examDate);
  const daily = personalQuests(progress).daily;
  const lessons = [...progress.lessons.map(l => ({ at:l.at, name: topicById[l.id.split('/')[0]].concepts.find(c => c.id === l.id.split('/')[1])!.name, desc: 'Lesson completed', icon:'book', xp:20 })),
    ...progress.attempts.map(a => ({ at:a.at, name:questionById[a.question].title, desc:a.score === a.max ? (a.assistance || a.retries ? 'Assisted solution' : a.graded === 'self' ? 'Self-assessed solution' : 'Solved independently') : 'Practice attempt', icon:'target', xp:a.xp }))]
    .sort((a,b) => b.at - a.at).slice(0, 4);
  const weak = [...data].filter(row => row.attempts.length).sort((a,b) => a.score-b.score).slice(0,4);
  const first = data.find(p => p.topic.id === recommended.topic)!;
  const roadmap = [...new Set([first, ...data])].slice(0,4);
  const metrics = [
    { name:'Total XP', value:summary.xp.toLocaleString(), note:'Level ' + summary.level, icon:'bolt', color:'indigo' },
    { name:'Study streak', value:summary.streak + (summary.streak === 1 ? ' day' : ' days'), note:summary.streak ? 'Keep it going' : 'Start with a lesson', icon:'flame', color:'amber' },
    { name:'Syllabus completion', value:summary.completion + '%', note:progress.lessons.length + (progress.lessons.length === 1 ? ' lesson completed' : ' lessons completed'), icon:'book', color:'teal' },
    { name:'Exam countdown', value:date === null ? '—' : date < 0 ? 'Passed' : date === 0 ? 'Today' : date + (date === 1 ? ' day' : ' days'), note:formatDate(progress.settings.examDate), icon:'calendar', color:'blue' }
  ];
  return <>
    <div className="dashboard-heading"><div><h1>Study dashboard</h1><p>Pick up where you left off or start a new study session.</p></div>
      <button className="button secondary top-planner" onClick={() => navigate('planner')}><Icon name="calendar" size={17} /> Study Planner</button>
    </div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" />
        <div className="orbit-glow" /><div className="orbit-node node-a"><Icon name="map" size={23} /></div>
        <div className="orbit-node node-b"><Icon name="binary" size={23} /></div><div className="orbit-node node-c"><Icon name="chart" size={23} /></div>
        <div className="shield-core"><div><Icon name="cpu" size={86} /></div></div>
        <span className="star star-a">✦</span><span className="star star-b">✦</span><span className="star star-c">✦</span>
        <span className="orbit-dot dot-a" /><span className="orbit-dot dot-b" /><span className="orbit-dot dot-c" />
      </div>
      <div className="hero-content">
        <Pill color="hero-label"><Icon name="grad" size={15} /> {moduleInfo.code} · {moduleInfo.name.toUpperCase()}</Pill>
        <h2 id="hero-title">Prepare for your<br className="hero-break" /> IE4483 exam.</h2>
        <p>Learn the concepts, practise the reasoning, and work through past exam questions.</p>
        <div className="hero-actions"><button className="button hero-primary" onClick={() => start(recommended)}><Icon name="play" size={17} /> Quick start</button>
          <button className="button hero-secondary" onClick={() => navigate('journey')}>View learning journey</button></div>
      </div>
    </section>
    <div className="metric-grid">
      {metrics.map(metric => <button key={metric.name} className="panel metric" onClick={() => navigate(metric.icon === 'calendar' ? 'settings' : metric.icon === 'book' ? 'journey' : 'statistics')}>
        <Bubble icon={metric.icon} color={metric.color} /><span><span className="metric-label">{metric.name}</span><strong>{metric.value}</strong><small>{metric.note}</small></span>
      </button>)}
    </div>
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section>
          <SectionTitle title="Learning journey" description="Your next topics and current mastery" action={<button className="text-button" onClick={() => navigate('journey')}>View all topics <Icon name="chevron" size={17} /></button>} />
          <div className="panel dashboard-topics">
            {roadmap.map((row, index) => <button className="dashboard-topic" key={row.topic.id} onClick={() => openTopic(row.topic.id)}>
              <Bubble icon={row.topic.icon} color={row.topic.color} large />
              <span className="dash-topic-name"><strong>{row.topic.name}</strong><small>{stages[row.stage]}</small></span>
              {index === 0 && <Pill color="indigo">Up next</Pill>}
              <span className="dash-topic-progress"><ProgressBar value={row.score} label={row.topic.name + ' mastery'} /><small>{row.score}%</small></span><Icon name="chevron" size={18} />
            </button>)}
          </div>
        </section>
        <section>
          <SectionTitle title="Recent activity" action={<button className="text-button" onClick={() => navigate('statistics')}>View statistics <Icon name="chevron" size={17} /></button>} />
          {lessons.length ? <div className="panel compact-list">{lessons.map((item,i) => <div className="row spread" key={item.at + ':' + i}>
            <span className="row"><Bubble icon={item.icon} color="teal" /><span><strong>{item.name}</strong><small>{item.desc}</small></span></span>
            <Pill color={item.xp ? 'indigo' : ''}>{item.xp ? '+' : ''}{item.xp} XP</Pill>
          </div>)}</div> : <Empty icon="history" title="Your activity will appear here">Complete a lesson or attempt a question to begin.</Empty>}
        </section>
      </div>
      <div className="dashboard-side">
        <section>
          <SectionTitle title="Daily quests" action={<span className="soft-icon"><Icon name="target" size={19} /></span>} />
          <div className="panel quest-card">
            {daily.map((quest,i) => <div className="quest" key={quest.title}><Bubble icon={quest.value >= quest.target ? 'check' : quest.icon} color={['indigo','teal','amber'][i]} /><div><div className="row spread"><strong>{quest.title}</strong><small>{quest.value}/{quest.target}</small></div><ProgressBar value={quest.value / quest.target * 100} label={quest.title} color={['indigo','teal','amber'][i]} /></div></div>)}
            <button className="text-button quest-link" onClick={() => navigate('planner')}>View study plan <Icon name="chevron" size={16} /></button>
          </div>
        </section>
        <section>
          <SectionTitle title="Exam readiness" />
          <div className="panel readiness-card">
            <div className="readiness-overview"><Ring value={summary.readiness} caption="estimated" /><div><strong>{summary.attempted}</strong><small>Questions attempted</small><strong>{summary.accuracy === null ? '—' : summary.accuracy + '%'}</strong><small>Independent accuracy</small></div></div>
            <p>{summary.attempted ? (papers.length ? 'Based on your mastery and topic coverage in the supplied papers.' : 'Based on your current topic mastery.') : 'Answer practice questions to build your estimate.'}</p>
          </div>
        </section>
        <section className="panel focus-card"><Bubble icon={recommendedTopic.icon} color={recommendedTopic.color} /><div><h3>{recommended.title}</h3><p>{recommended.reason}</p><button className="text-button" onClick={() => start(recommended)}>Start activity <Icon name="chevron" size={16} /></button></div></section>
        {weak.length > 0 && <section className="panel panel-pad"><SectionTitle title="Weakest topics" />
          {weak.map(item => <div className="row spread gap-line" key={item.topic.id}><button className="text-button" onClick={() => openTopic(item.topic.id)}>{item.topic.short}</button><small>{item.score}%</small></div>)}
          {mistakes(progress).some(item => !item.resolved) && <button className="text-button" onClick={() => navigate('notebook')}>Review mistakes <Icon name="chevron" size={16} /></button>}
        </section>}
      </div>
    </div>
  </>;
}

