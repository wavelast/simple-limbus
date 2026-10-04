import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { ROOT } from './data';

export { ROOT as HOME } from './data';

export type Route = { page: 'browse' } | { page: 'guide'; id: string };

const inBrowser = typeof window !== 'undefined';
let serverPath = '';

export function setServerPath(path: string) {
  serverPath = path;
}

function parse(): Route {
  const path = inBrowser ? window.location.pathname : serverPath;
  const rest = path.startsWith(ROOT) ? decodeURIComponent(path.slice(ROOT.length)) : '';
  const m = rest.match(/^id\/([\w-]+)\/?$/);
  return m ? { page: 'guide', id: m[1] } : { page: 'browse' };
}

const listeners = new Set<() => void>();

function fromHash() {
  const legacy = window.location.hash.match(/^#\/(?:id\/([\w-]+))?/);
  if (!legacy) return false;
  history.replaceState(null, '', legacy[1] ? `${ROOT}id/${legacy[1]}/` : ROOT);
  return true;
}

export function navigate(href: string) {
  history.pushState(null, '', href);
  flushSync(() => listeners.forEach((l) => l()));
  window.scrollTo(0, 0);
}

if (inBrowser) {
  fromHash();
  window.addEventListener('hashchange', () => {
    if (fromHash()) flushSync(() => listeners.forEach((l) => l()));
  });
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(ROOT) || url.hash) return;
    e.preventDefault();
    if (url.pathname === window.location.pathname) window.scrollTo(0, 0);
    else navigate(url.pathname);
  });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    const onPop = () => flushSync(on);
    listeners.add(on);
    window.addEventListener('popstate', onPop);
    return () => {
      listeners.delete(on);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  return route;
}

const numOf = new Map<string, string>();
const nameOf = new Map<string, string>();

export function registerIdentities(list: { id: string; num: string | null }[]) {
  for (const e of list) {
    if (!e.num) continue;
    numOf.set(e.id, e.num);
    nameOf.set(e.num, e.id);
  }
}

export const guideHref = (id: string) => `${ROOT}id/${numOf.get(id) ?? id}/`;

export const resolveIdentity = (key: string) => nameOf.get(key) ?? key;
