import { useEffect, useRef, useState } from 'react';
import { loadGuide, peekGuide, useAsync } from '../data';
import type { Guide as GuideData, IndexEntry, Passive, Statuses } from '../types';
import { Rich, RichProvider, StatusChip } from '../components/Rich';
import { Rarity, SinIcon, SIN_NAMES } from '../components/Icons';
import SkillList from '../components/SkillList';
import Teammates from '../components/Teammates';
import { HeroChibi } from '../components/Chibi';
import { HOME } from '../route';
import { countView } from '../analytics';

export default function Guide({ id, statuses, identities }: { id: string; statuses: Statuses; identities: IndexEntry[] }) {
  const { data: g, error, retry } = useAsync(() => loadGuide(id), [id], () => peekGuide(id));

  useEffect(() => {
    if (g) {
      document.title = `${g.name} ${g.sinnerName} - Simple Limbus`;
      countView();
    }
    return () => {
      document.title = 'Simple Limbus';
    };
  }, [g]);

  if (error) {
    return (
      <div className="state">
        <p>Couldn't load this identity.</p>
        <p>
          <button type="button" className="retry" onClick={retry}>
            Try again
          </button>
        </p>
        <a href={HOME}>Back to all identities</a>
      </div>
    );
  }
  if (!g) return <div className="state">Loading…</div>;

  return (
    <RichProvider statuses={statuses} skills={g.skills}>
      <GuideBody g={g} statuses={statuses} identities={identities} />
    </RichProvider>
  );
}

const SECTIONS = [
  ['skills', 'Skills'],
  ['passives', 'Passives'],
  ['team', 'Teammates'],
] as const;

function GuideBody({ g, statuses, identities }: { g: GuideData; statuses: Statuses; identities: IndexEntry[] }) {
  const attacks = g.skills.filter((s) => s.kind === 'attack');
  const defenses = g.skills.filter((s) => s.kind === 'defense');
  const jump = (sec: string) => document.getElementById(`sec-${sec}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const nav = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const check = () => setStuck((nav.current?.getBoundingClientRect().top ?? 1) <= 0);
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <div>
      <a className="back" href={HOME}>
        ← All identities
      </a>

      <section className="hero">
        <HeroChibi e={g} />
        <div className="hero-info">
          <Rarity n={g.rarity} />
          <h1>{g.name}</h1>
          <div className="hero-sinner">{g.sinnerName}</div>
          {g.keywords.length > 0 && (
            <div className="kw-row">
              {g.keywords.map((k) => (
                <StatusChip key={k} id={k} />
              ))}
            </div>
          )}
          <a className="hero-wiki" href={g.wiki} target="_blank" rel="noreferrer">
            Wiki ↗
          </a>
        </div>
      </section>

      <section className="block tldr">
        <h2>tl;dr</h2>
        <ul className="summary">
          {g.plan.summary.map((b, i) => (
            <li key={i}>
              <Rich segs={b} />
            </li>
          ))}
        </ul>
      </section>

      <nav ref={nav} className={`subnav ${stuck ? 'stuck' : ''}`} aria-label="Sections">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => jump(k)}>
            {label}
          </button>
        ))}
        <a className="subnav-back" href={HOME} aria-label="All identities">
          ← All<span className="subnav-back-more"> identities</span>
        </a>
      </nav>

      <section id="sec-skills" className="block">
        <h2>Skills</h2>
        <h3 className="sub-h">Attack</h3>
        <SkillList skills={attacks} />
        <h3 className="sub-h">Defense</h3>
        <SkillList skills={defenses} />
      </section>

      <section id="sec-passives" className="block">
        <h2>Passives</h2>
        <ul className="skill-list">
          {g.passives.map((p, i) => (
            <PassiveRow key={i} p={p} />
          ))}
        </ul>
      </section>

      {(g.teammates?.length ?? 0) > 0 && (
        <section id="sec-team" className="block">
          <h2>Teammates</h2>
          <Teammates groups={g.teammates ?? []} identities={identities} statuses={statuses} selfName={g.sinnerName} />
        </section>
      )}

    </div>
  );
}

function PassiveRow({ p }: { p: Passive }) {
  return (
    <li className="skill-row">
      <span className="passive-kind">{p.kind === 'battle' ? 'Battle' : 'Support'}</span>
      <div className="skill-main">
        <div className="skill-line">
          <span className="skill-name">{p.name}</span>
        </div>
        {p.simple && (
          <p className="skill-simple">
            <Rich segs={p.simple} />
          </p>
        )}
        {p.req && (
          <div className="skill-unlock">
            Needs <SinIcon sin={p.req.sin} size={15} /> {p.req.count} {SIN_NAMES[p.req.sin]} {p.req.type === 'res' ? 'Resonance' : 'Owned'}
          </div>
        )}
        {p.lines.length > 0 && (
          <details className="skill-more">
            <summary>Source text</summary>
            <div className="skill-text">
              {p.lines.map((l, i) => (
                <div key={i} className="tl">
                  <span>
                    <Rich segs={l.segs} />
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </li>
  );
}
