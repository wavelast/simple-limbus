import { renderToString } from 'react-dom/server';
import App from './App';
import { paths, prime, setRoot } from './data';
import { setServerPath } from './route';
import type { Guide, IndexFile, Statuses } from './types';

export function render({ root, path, index, statuses, guide }: { root: string; path: string; index: IndexFile; statuses: Statuses; guide?: Guide }) {
  setRoot(root);
  setServerPath(path);
  prime(paths.index, index);
  prime(paths.statuses, statuses);
  if (guide) prime(paths.guide(guide.id), guide);
  return renderToString(<App />);
}
