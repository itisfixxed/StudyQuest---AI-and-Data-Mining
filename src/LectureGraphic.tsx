type Node = [x:number, y:number, label:string];
type Edge = [from:number, to:number];

function Graph({ nodes, edges, active, label }: { nodes:Node[]; edges:Edge[]; active:number[]; label:string }) {
  return <svg className="lecture-graphic" viewBox="0 0 420 176" role="img" aria-label={label}>
    <defs><marker id="lecture-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
      <path d="M0 0 L6 3 L0 6" fill="none" stroke="var(--muted)" />
    </marker></defs>
    {edges.map(([a,b]) => {
      const [x1,y1] = nodes[a];
      const [x2,y2] = nodes[b];
      const scale = 1 / Math.max(Math.abs(x2-x1)/49, Math.abs(y2-y1)/16);
      return <line key={a+'-'+b} x1={x1+(x2-x1)*scale} y1={y1+(y2-y1)*scale}
        x2={x2-(x2-x1)*(scale+.025)} y2={y2-(y2-y1)*(scale+.025)} className="lecture-edge" markerEnd="url(#lecture-arrow)" />;
    })}
    {nodes.map(([x,y,text],i) => <g key={i}>
      <rect x={x-48} y={y-15} width="96" height="30" rx="8" className={active.includes(i) ? 'lecture-node active' : 'lecture-node'} />
      <text x={x} y={y+5} textAnchor="middle">{text}</text>
    </g>)}
  </svg>;
}

type Point = [x:number, y:number];
type Series = { points:Point[]; style:'ink'|'accent'|'teal'; line?:boolean; guides?:number };

function Plot({ series, label }: { series:Series[]; label:string }) {
  const x = (n:number) => 36+n*34;
  const y = (n:number) => 153-n*26;
  return <svg className="lecture-graphic" viewBox="0 0 420 178" role="img" aria-label={label}>
    {[1,2,3,4,5].map(n => <line className="lecture-gridline" key={n} x1={36} y1={y(n)} x2={380} y2={y(n)} />)}
    <path d="M36 14 V153 H380" className="lecture-edge" />
    {series.map(({points,style,line,guides},i) => <g key={i} className={'lecture-series '+style}>
      {line && <polyline points={points.map(([a,b]) => x(a)+','+y(b)).join(' ')} fill="none" stroke="currentColor" strokeWidth={3} />}
      {guides!==undefined && points.map(([a,b],j) => <line key={j} x1={x(a)} y1={y(guides)} x2={x(a)} y2={y(b)}
        stroke="currentColor" strokeDasharray="4 4" />)}
      {points.map(([a,b],j) => <circle key={j} cx={x(a)} cy={y(b)} r={line ? 3.5 : 5.5} fill="currentColor" />)}
    </g>)}
  </svg>;
}

const diagrams: Record<string,{nodes:Node[]; edges:Edge[]; focus:number[][]; captions:string[]}> = {
  foundations: {
    nodes:[[64,82,'Evidence'],[210,40,'Constraints'],[210,126,'Objective'],[356,82,'Action']],
    edges:[[0,1],[0,2],[1,3],[2,3]],focus:[[2],[1,2],[3]],
    captions:['A goal tells the system how to compare routes.','Feasibility and preference both inform the decision.','Judge the action against the original objective.']
  },
  state: {
    nodes:[[210,24,'A'],[111,84,'B'],[309,84,'C'],[57,144,'D'],[165,144,'E']],
    edges:[[0,1],[0,2],[1,3],[1,4]],focus:[[0],[2,3],[3,4]],
    captions:['A graph records legal state transitions.','After B, the next node is C for BFS or D for DFS.','A depth limit of two makes D and E eligible.']
  },
  heuristic: {
    nodes:[[61,85,'Start'],[210,36,'A: h = 1'],[210,134,'B: h = 4'],[355,85,'Goal']],
    edges:[[0,1],[0,2],[1,3],[2,3]],focus:[[1,2],[2],[1,2]],
    captions:['Two frontier routes can remain available at once.','A* chooses B on total estimated cost even though A has the smaller h.','Check each directed edge separately when testing consistency.']
  },
  games: {
    nodes:[[210,22,'MAX'],[108,81,'MIN: left'],[312,81,'MIN: right'],[57,142,'3'],[160,142,'5'],[260,142,'2'],[363,142,'9']],
    edges:[[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]],focus:[[1,2],[3,5],[0]],
    captions:['Move from leaves to root. MIN backs up 3 on the left and 2 on the right.','After seeing 2 on the right, MAX can skip 9 because the left guarantees 3.','An unfinished branch at the depth cutoff uses an estimated value.']
  },
  trees: {
    nodes:[[210,30,'Root: 4 / 4'],[96,122,'Left: 4 / 0'],[324,122,'Right: 0 / 4']],
    edges:[[0,1],[0,2]],focus:[[1,2],[0],[1,2]],
    captions:['Split A isolates a pure class in each leaf.','Compare candidate splits at the current node, weighting each child by its size.','Evaluate leaf predictions on the held-out examples in the table.']
  },
  neural: {
    nodes:[[61,82,'x = 2'],[210,38,'ReLU unit'],[355,82,'Prediction'],[210,129,'Loss']],
    edges:[[0,1],[1,2],[2,3]],focus:[[0,1,2],[3],[1,2]],
    captions:['The forward pass computes activations, then the prediction.','The loss provides the starting derivative for the backward pass.','After updating the weight, run another forward pass to inspect the new loss.']
  }
};

export function LectureGraphic({ topic, step }: { topic:string; step:number }) {
  const diagram = diagrams[topic];
  if (diagram) {
    const edges:Edge[] = topic==='neural' && step===1 ? diagram.edges.map(([a,b])=>[b,a]) : diagram.edges;
    const caption = diagram.captions[step];
    return <figure className="lecture-figure"><Graph nodes={diagram.nodes} edges={edges} active={diagram.focus[step]} label={caption} /><figcaption>{caption}</figcaption></figure>;
  }
  if (topic === 'cnn') {
    const size = step === 1 ? 5 : 2;
    const values = step === 0 ? [1,0,2,3] : step === 2 ? [2,7,1,3] : [];
    return <figure className="lecture-figure">
      <div className="lecture-tiles" style={{gridTemplateColumns:'repeat('+size+', 1fr)'}} aria-hidden="true">
        {Array.from({length:size*size},(_,i) => <span key={i}
          className={step===1 ? (Math.floor(i/size)<3 && i%size<3 ? 'selected' : '') : step===2 && i===1 ? 'selected' : ''}>{values[i] ?? ''}</span>)}
      </div>
      <figcaption>{['Input patch with rows [1, 0] and [2, 3].','The highlighted first 3×3 window fits inside the 5×5 input. Shift it to count the other valid windows.','Max pooling keeps 7 from this window.'][step]}</figcaption>
    </figure>;
  }
  if (topic === 'bayes' || topic === 'mining') {
    const groups = topic === 'bayes'
      ? step === 0 ? [{name:'Faulty', count:10},{name:'Good', count:90}]
        : step === 1 ? [{name:'True alerts',count:8},{name:'False alerts',count:9}]
        : [{name:'Fault score',count:40},{name:'Good score',count:18}]
      : step === 0 ? [{name:'A + B',count:2},{name:'A only',count:1},{name:'B only',count:2}]
        : step === 1 ? [{name:'Within A: B appears',count:2},{name:'Within A: B absent',count:1}]
        : [{name:'B → A',count:2},{name:'B only',count:2},{name:'A only',count:1}];
    const total = groups.reduce((n,g)=>n+g.count,0);
    const label = topic==='bayes'
      ? ['Faults start as a small fraction of the full population.','Within the alert group, the false alerts slightly outnumber the true alerts.','The two bars represent relative scores before normalization.'][step]
      : ['The five baskets partition into three nonoverlapping groups.','Within the three baskets containing A, two contain B.','The two AB baskets share one prefix when transactions are sorted.'][step];
    return <figure className="lecture-figure">
      <div className="lecture-stacked">{groups.map(group => <span aria-hidden="true" key={group.name} style={{flexGrow:group.count/total}} />)}</div>
      <ul className="lecture-legend">{groups.map(group => <li key={group.name}>{group.name}</li>)}</ul>
      <figcaption>{label}</figcaption>
    </figure>;
  }
  let series: Series[];
  let caption: string;
  if (topic === 'neighbors') {
    series = [{points:[[1,2],[3,2]],style:'accent'},{points:[[6,2],[8,2]],style:'teal'},{points:[[step===0?4:4.5,2]],style:'ink',guides:0}];
    caption = step===0 ? 'Positions from left to right: red 1, red 3, query 4, blue 6, blue 8.' : 'The separator at 4.5 bisects the gap between the closest opposing points, 3 and 6.';
  } else if (topic === 'clustering') {
    series = [{points:[[0,2],[2,2]],style:'accent'},{points:[[7,2],[9,2]],style:'teal'},
      ...(step===1 ? [{points:[[1,2],[8,2]],style:'ink',guides:0} as Series] : [])];
    caption = ['Distances determine which points appear close. This example uses a single feature.','The marks below the groups show the updated centres, 1 and 8.','Linkage evaluates all cross-group distances, from 0 or 2 to 7 or 9.'][step];
  } else if (topic === 'generalization') {
    series = [{points:[[1,3],[3,1.8],[5,1],[7,.6]],style:'accent',line:true},
      {points:[[1,3.3],[3,2.2],[5,1.7],[7,2.1]],style:'teal',line:true}];
    caption = 'Illustrative epoch curves. Training error keeps falling (purple), while validation error (teal) reaches a minimum at the third point.';
  } else if (topic === 'pca') {
    series = step===1
      ? [{points:[[1,1],[9,1]],style:'accent',line:true},{points:[[3,2]],style:'ink',guides:1},{points:[[3,1]],style:'teal'}]
      : [{points:[[1,1],[9,4]],style:'accent',line:true},{points:[[1.7,1.2],[3,1.4],[4,2.3],[5,2.6],[6.3,3.2],[7.6,3.4]],style:'ink'}];
    caption = step===1 ? 'The dot drops perpendicularly onto the horizontal axis. The first coordinate survives.' : 'The cloud spreads most along the slanted direction shown. That is the first principal direction.';
  } else if (topic === 'regression') {
    series = step===0 ? [{points:[[1,.8],[7,4]],style:'accent',line:true},
      {points:[[1,.8],[4,1.6],[7,4.8]],style:'ink'}]
      : [{points:[[0,.75],[7,4.25]],style:'accent',line:true},{points:[[0,.75],[3.5,1.5],[7,4.5]],style:'ink'}];
    caption = 'Illustrative fit. A residual measures the vertical difference between an observed point and the prediction at the same x.';
  } else {
    return null;
  }
  return <figure className="lecture-figure"><Plot series={series} label={caption} /><figcaption>{caption}</figcaption></figure>;
}
