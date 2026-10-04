import type { Skill, Unlock } from '../types';
import { CondLabel, Rich, SkillPill, StatusChip } from './Rich';
import { SinIcon, TypeIcon, TYPE_NAMES } from './Icons';

const isSkillLabel = (f: string) => /^[SD]\d?(\.\d)?$/.test(f);

function UnlockText({ u, self }: { u: Unlock; self: Skill }) {
  const conds = u.conds.length ? (
    <>
      {/^\d/.test(u.conds[0].label) ? ' at ' : ' when '}
      {u.conds.map((c, i) => (
        <span key={c.key}>
          {i > 0 && ' and '}
          <CondLabel label={c.label} ids={c.statuses} />
        </span>
      ))}
    </>
  ) : null;
  const from = u.from.filter(isSkillLabel).filter((f) => f !== self.label);

  switch (u.mode) {
    case 'transform':
      return (
        <>
          {from.length ? from.map((f, i) => <span key={f}>{i > 0 && ' or '}<SkillPill label={f} /></span>) : 'Another skill'} turns into this
          {conds}
        </>
      );
    case 'replace':
    case 'add':
      return <>Put on your dashboard{conds}</>;
    case 'exclusive':
      return u.status ? (
        <>
          Only usable in the <StatusChip id={u.status} /> state
        </>
      ) : (
        <>Only usable{conds ?? ' in a special state'}</>
      );
    case 'auto':
      return <>Used automatically{conds}</>;
    case 'custom':
      return <Rich segs={u.line} />;
    default:
      return <>Alternate version. The data doesn't say when it appears</>;
  }
}

function AoeTag({ aoe: { min, max } }: { aoe: NonNullable<Skill['aoe']> }) {
  const label = max === null ? 'AoE (varies)' : min === max ? `AoE ×${max}` : `AoE ×${min}–${max}`;
  const title =
    max === null
      ? 'Hits several targets (or parts); how many depends on its effects'
      : min === max
        ? `Hits up to ${max} targets (or parts)`
        : `Hits ${min === 1 ? '1 target' : `up to ${min} targets`}, or up to ${max} (or parts) when its conditions are met`;
  return (
    <span className="skill-aoe" title={title}>
      {label}
    </span>
  );
}

function SkillRow({ s, child = false }: { s: Skill; child?: boolean }) {
  const gate = s.unlock.find((u) => u.mode !== 'mention');
  const source = gate && gate.mode !== 'note' && gate.mode !== 'custom';
  const type = s.kind === 'defense' ? TYPE_NAMES[s.type] ?? s.type : null;
  return (
    <li id={`skill-${s.label}`} className={`skill-row sin-${s.sin} ${child ? 'child' : ''}`}>
      <span className={`skill-badge sin-text sin-${s.sin}`}>
        <SinIcon sin={s.sin} size={child ? 30 : 38} />
        <span>{s.label}</span>
      </span>
      <div className="skill-main">
        <div className="skill-line">
          <span className="skill-name">{s.name}</span>
          {s.aoe && <AoeTag aoe={s.aoe} />}
          <span className="skill-type" title={TYPE_NAMES[s.counterType ?? s.type] ?? s.type}>
            <TypeIcon type={s.type} size={16} />
            {type && <span>{type}</span>}
          </span>
        </div>
        {s.simple && (
          <p className="skill-simple">
            <Rich segs={s.simple} />
          </p>
        )}
        {gate && (
          <div className="skill-unlock">
            <span aria-hidden className="unlock-sym">⚿</span>
            <UnlockText u={gate} self={s} />
            {gate.mode !== 'custom' && '.'}
          </div>
        )}
        {(s.lines.length > 0 || source) && (
          <details className="skill-more">
            <summary>Source text</summary>
            {source && (
              <blockquote className="source">
                <Rich segs={gate.line} />
              </blockquote>
            )}
            <div className="skill-text">
              {s.lines.map((l, i) => (
                <div key={i} className="tl">
                  {l.coin ? <span className="coin-no" title={`Coin ${l.coin}`}>{l.coin}</span> : null}
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

const slotOf = (label: string) => label.replace(/\..*$/, '').replace(/^D\d$/, 'D');

export default function SkillList({ skills }: { skills: Skill[] }) {
  const groups: Skill[][] = [];
  for (const s of skills) {
    const g = groups.find((x) => slotOf(x[0].label) === slotOf(s.label));
    if (g) g.push(s);
    else groups.push([s]);
  }
  return (
    <ul className="skill-list">
      {groups.map((g) =>
        g.length === 1 ? (
          <SkillRow key={g[0].label} s={g[0]} />
        ) : (
          <li key={g[0].label} className="skill-group">
            <ul className="skill-sublist">
              {g.map((s, i) => (
                <SkillRow key={s.label} s={s} child={i > 0} />
              ))}
            </ul>
          </li>
        ),
      )}
    </ul>
  );
}
