import { useState } from 'react';

export function Demonstration({ topic, concept }: { topic: string; concept: string }) {
  const [value, setValue] = useState(3);
  if (topic === 'heuristic' && concept === 'astar') {
    const a = value + 2;
    return <div className="demo">
      <h3>Change the cost already paid</h3>
      <p>A has estimated remaining cost 2. B has paid cost 2 and remaining estimate 5. Ties favor A.</p>
      <label className="row spread"><strong>Paid cost to A</strong><output>{value}</output></label>
      <input aria-label="Paid cost to A" type="range" min={0} max={10} value={value} onChange={e => setValue(Number(e.target.value))} />
      <div className="mapping"><div><small>A’s f score</small><strong>{a}</strong></div><div><small>B’s f score</small><strong>7</strong></div></div>
      <p aria-live="polite">A* selects {a <= 7 ? 'A' : 'B'} first. Greedy best-first selects A using only the estimate.</p>
    </div>;
  }
  if (topic === 'cnn' && concept === 'dimensions') {
    const length = 10;
    const width = Math.floor((length - 3) / value) + 1;
    const starts = Array.from({ length: width }, (_, i) => i * value);
    return <div className="demo">
      <h3>Slide a width-3 filter across 10 inputs</h3>
      <label className="row spread"><strong>Stride</strong><output>{value}</output></label>
      <input aria-label="Filter stride" type="range" min={1} max={5} value={value} onChange={e => setValue(Number(e.target.value))} />
      <div className="mapping"><div><small>Valid starts (zero-based)</small><strong>{starts.join(', ')}</strong></div>
        <div><small>Output width</small><strong>{width}</strong></div></div>
      <p>A window starting beyond index 7 would extend past the input.</p>
    </div>;
  }
  if (topic === 'pca' && concept === 'projection') {
    const angle = (value - 3) * Math.PI / 12;
    const u = [Math.cos(angle), Math.sin(angle)];
    const score = 3 * u[0] + u[1];
    const ox = 136, oy = 103, scale = 34;
    const px = ox + scale * score * u[0], py = oy - scale * score * u[1];
    return <div className="demo">
      <h3>Project a centered point onto a direction</h3>
      <label className="row spread"><strong>Direction angle</strong><output>{(value-3)*15}°</output></label>
      <input aria-label="Direction angle" type="range" min={0} max={6} value={value} onChange={e => setValue(Number(e.target.value))} />
      <svg viewBox="0 0 300 200" className="lesson-chart" role="img" aria-label="Projection of point (3, 1) onto the selected unit direction">
        <path d="M 12 103 H 287 M 136 10 V 189" stroke="var(--muted)" opacity=".65" />
        <line x1={ox-130*u[0]} x2={ox+150*u[0]} y1={oy+130*u[1]} y2={oy-150*u[1]} stroke="var(--accent)" strokeWidth="3" />
        <line x1={238} x2={px} y1={69} y2={py} stroke="var(--muted)" strokeDasharray="5 4" />
        <circle cx={238} cy={69} r={5} fill="var(--text)" /><text x="243" y="62">(3, 1)</text>
        <circle cx={px} cy={py} r={5} fill="var(--accent)" />
      </svg>
      <p>Score {score.toFixed(2)} · squared reconstruction error {Math.max(0, 10 - score * score).toFixed(2)}</p>
    </div>;
  }
  return null;
}

