import { useEffect, useState } from 'react';
import type { Guide, IndexFile, Statuses } from './types';

export let ROOT = typeof document === 'undefined' ? '' : new URL(import.meta.env.BASE_URL, document.baseURI).pathname;

export function setRoot(root: string) {
  ROOT = root;
}

export const asset = (path: string) => `${ROOT}${path.replace(/^\//, '')}`;
export const iconUrl = (name: string) => asset(`img/icons/${name}.webp`);
export const sinnerIcon = (sinner: string) => iconUrl(`sinner-${sinner.replace(/\s+/g, '-')}`);
export const artUrl = (e: { id: string; chibi: boolean; sinner: string }) => (e.chibi ? asset(`img/chibi/${e.id}.webp`) : sinnerIcon(e.sinner));

const cache = new Map<string, Promise<unknown>>();
const loaded = new Map<string, unknown>();

async function fetchJson(path: string) {
  const r = await fetch(asset(path), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} loading ${path}`);
  return r.json();
}

function load<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetchJson(path)
      .catch(() => new Promise((resolve) => setTimeout(resolve, 800)).then(() => fetchJson(path)))
      .then((data) => {
        loaded.set(path, data);
        return data;
      });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export function prime(path: string, data: unknown) {
  loaded.set(path, data);
  cache.set(path, Promise.resolve(data));
}

const INDEX = 'data/index.json';
const STATUSES = 'data/statuses.json';
const guidePath = (id: string) => `data/guides/${id}.json`;

export const paths = { index: INDEX, statuses: STATUSES, guide: guidePath };

export const loadIndex = () => load<IndexFile>(INDEX);
export const loadStatuses = () => load<Statuses>(STATUSES);
export const loadGuide = (id: string) => load<Guide>(guidePath(id));

export const peekIndex = () => loaded.get(INDEX) as IndexFile | undefined;
export const peekStatuses = () => loaded.get(STATUSES) as Statuses | undefined;
export const peekGuide = (id: string) => loaded.get(guidePath(id)) as Guide | undefined;

export let hydrating = false;

export function setHydrating(on: boolean) {
  hydrating = on;
}

export type Async<T> = ({ data: T; error: null } | { data: null; error: Error | null }) & {
  retry: () => void;
};

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], peek?: () => T | undefined): Async<T> {
  const [state, setState] = useState<{ data: T; error: null } | { data: null; error: Error | null }>(() => {
    const ready = peek?.();
    return ready === undefined ? { data: null, error: null } : { data: ready, error: null };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ready = attempt === 0 ? peek?.() : undefined;
    if (ready !== undefined) {
      setState((s) => (s.data === ready ? s : { data: ready, error: null }));
      return;
    }
    let live = true;
    setState({ data: null, error: null });
    fn().then(
      (data) => live && setState({ data, error: null }),
      (error: Error) => live && setState({ data: null, error }),
    );
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
