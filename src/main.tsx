import { createRoot } from 'react-dom/client';
import { prepareStudyContent } from './content/index.ts';
import 'katex/dist/katex.min.css';
import './styles.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('StudyQuest root missing');
const root = createRoot(mount);
root.render(<p role="status">Loading study content…</p>);

async function start() {
  await prepareStudyContent();
  const { App } = await import('./App.tsx');
  root.render(<App />);
}

void start().catch(() => root.render(<p role="alert">StudyQuest could not start. Refresh the page to try again.</p>));

