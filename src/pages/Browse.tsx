import { useEffect, useMemo, useRef, useState } from 'react';
import { hydrating, sinnerIcon } from '../data';
import { FramedChibi } from '../components/Chibi';
import TldrPreview from '../components/TldrPreview';
import { guideHref } from '../route';
import { countView } from '../analytics';
import type { IndexEntry, Statuses } from '../types';
import { Rarity } from '../components/Icons';

const SINNERS: [string, string][] = [
  ['yi sang', 'Yi Sang'], ['faust', 'Faust'], ['don quixote', 'Don Quixote'], ['ryoshu', 'Ryōshū'],
  ['mersault', 'Meursault'], ['hong lu', 'Hong Lu'], ['heathcliff', 'Heathcliff'], ['ishmael', 'Ishmael'],
  ['rodion', 'Rodion'], ['sinclair', 'Sinclair'], ['outis', 'Outis'], ['gregor', 'Gregor'],
];
export const SINNER_NAME = Object.fromEntries(SINNERS);

const KEYWORDS = ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'poise', 'charge'];

type Sort = 'new' | 'name';

interface Filters {
  q: string;
  sinner: string | null;
  rarity: number | null;
  keyword: string | null;
  sort: Sort;
}

const STORE_KEY = 'simple-limbus.filters';

const DEFAULT_FILTERS: Filters = { q: '', sinner: null, rarity: null, keyword: null, sort: 'new' };

function loadFilters(): Filters {
  const fallback = DEFAULT_FILTERS;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null');
    if (!saved) return fallback;
    const { q, sinner, rarity, keyword, sort } = { ...fallback, ...saved };
    return { q, sinner, rarity, keyword, sort: sort === 'name' ? 'name' : 'new' };
  } catch {
    return fallback;
  }
}

export default function Browse({ identities, statuses }: { identities: IndexEntry[]; statuses: Statuses }) {
  const [f, setF] = useState<Filters>(() => (hydrating ? DEFAULT_FILTERS : loadFilters()));
  useEffect(() => {
    if (hydrating) setF(loadFilters());
    countView();
  }, []);
  const [open, setOpen] = useState(false);

  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const canHover = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches, []);
  const startHover = (id: string, el: HTMLElement) => {
    if (!canHover) return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHover({ id, rect: el.getBoundingClientRect() }), 350);
  };
  const endHover = () => {
    window.clearTimeout(hoverTimer.current);
    setHover(null);
  };
  useEffect(() => {
    if (!hover) return;
    window.addEventListener('scroll', endHover, { passive: true });
    return () => window.removeEventListener('scroll', endHover);
  }, [hover]);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const active = [f.sinner, f.rarity, f.keyword].filter((v) => v !== null).length;
  const shown = open || active > 0;
  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
    }
  };

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = identities.filter((e) => {
      if (f.sinner && e.sinner !== f.sinner) return false;
      if (f.rarity && e.rarity !== f.rarity) return false;
      if (f.keyword && !e.keywords.includes(f.keyword)) return false;
      if (q) {
        const hay = `${e.name} ${SINNER_NAME[e.sinner] ?? e.sinner} ${e.keywords.map((k) => statuses[k]?.n ?? k).join(' ')}`.toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else out.sort((a, b) => Number(b.num ?? 0) - Number(a.num ?? 0));
    return out;
  }, [identities, statuses, f]);

  return (
    <div>
      <section className="intro">
        <h1>Identity guides simplified</h1>
      </section>

      <div className="filter-row">
        <input
          type="search"
          className="search"
          placeholder="Search name, sinner or keyword…"
          value={f.q}
          onChange={(e) => update({ q: e.target.value })}
          aria-label="Search identities"
        />
        <button
          type="button"
          className={`filter-toggle ${shown ? 'on' : ''}`}
          aria-expanded={shown}
          aria-controls="filters-panel"
          onClick={() => setOpen(!shown)}
        >
          Filters{active > 0 && ` (${active})`}
        </button>
      </div>

      <section id="filters-panel" className="filters" aria-label="Filters" hidden={!shown}>
        <div className="filter-row">
          <select value={f.sort} onChange={(e) => update({ sort: e.target.value as Sort })} aria-label="Sort">
            <option value="new">Newest First</option>
            <option value="name">A–Z</option>
          </select>
          <button type="button" className={`sinner-all ${f.sinner === null ? 'on' : ''}`} onClick={() => update({ sinner: null })} aria-pressed={f.sinner === null}>
            All Sinners
          </button>
          {active > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setOpen(true);
                update({ sinner: null, rarity: null, keyword: null });
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="sinner-row" role="group" aria-label="Sinner">
          <button type="button" className={`sinner-btn all ${f.sinner === null ? 'on' : ''}`} onClick={() => update({ sinner: null })}>
            All
          </button>
          {SINNERS.map(([key, name]) => (
            <button
              key={key}
              type="button"
              className={`sinner-btn ${f.sinner === key ? 'on' : ''}`}
              onClick={() => update({ sinner: f.sinner === key ? null : key })}
              title={name}
              aria-pressed={f.sinner === key}
            >
              <img src={sinnerIcon(key)} alt="" width={30} height={30} />
              <span>{name}</span>
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="seg" role="group" aria-label="Rarity">
            {[null, 1, 2, 3].map((r) => (
              <button key={r ?? 0} type="button" className={f.rarity === r ? 'on' : ''} onClick={() => update({ rarity: r })}>
                {r ? '0'.repeat(r) : 'Any Rarity'}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Keyword">
            {KEYWORDS.map((k) => (
              <button key={k} type="button" className={f.keyword === k ? 'on' : ''} onClick={() => update({ keyword: f.keyword === k ? null : k })}>
                {statuses[k]?.n ?? k}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="count">
        {list.length} {list.length === 1 ? 'identity' : 'identities'}
      </p>

      <ul className="grid">
        {list.map((e) => (
          <li key={e.id}>
            <a
              className={`card ${e.chibi ? 'chibi' : ''}`}
              href={guideHref(e.id)}
              onMouseEnter={(ev) => startHover(e.id, ev.currentTarget)}
              onMouseLeave={endHover}
            >
              <FramedChibi e={e} ratio={4 / 3} className="card-img" />
              <div className="card-tags">
                <Rarity n={e.rarity} />
                {e.keywords.map((k) => (
                  <span key={k} className="mini-kw">
                    {statuses[k]?.n ?? k}
                  </span>
                ))}
              </div>
              {e.unlocks > 0 && (
                <span className="unlock-badge" title={`${e.unlocks} skill${e.unlocks > 1 ? 's' : ''} with unlock conditions`}>
                  ⚿ {e.unlocks}
                </span>
              )}
              <div className="card-body">
                <div className="card-sinner">{SINNER_NAME[e.sinner] ?? e.sinner}</div>
                <div className="card-name">{e.name.replace(/::/g, '::​')}</div>
              </div>
            </a>
          </li>
        ))}
      </ul>
      {!list.length && <p className="empty">No identities match. Try clearing a filter.</p>}
      {hover && <TldrPreview key={hover.id} id={hover.id} anchor={hover.rect} statuses={statuses} />}
    </div>
  );
}
