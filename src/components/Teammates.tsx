import type { IndexEntry, Statuses, TeamGroup } from '../types';
import { guideHref } from '../route';
import { SINNER_NAME } from '../pages/Browse';
import { FramedChibi } from './Chibi';
import { Rich } from './Rich';

const WHERE: Record<string, string> = { passive: 'passive', 'support passive': 'support passive' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function title(g: TeamGroup, statuses: Statuses) {
  if (g.kind === 'named') return 'Direct partners';
  if (g.kind === 'faction') return `${g.title} faction`;
  return `${statuses[g.title]?.n ?? g.title} team`;
}

export default function Teammates({
  groups,
  identities,
  statuses,
  selfName,
}: {
  groups: TeamGroup[];
  identities: IndexEntry[];
  statuses: Statuses;
  selfName: string;
}) {
  const byId = new Map(identities.map((e) => [e.id, e]));
  return (
    <>
      {groups.map((g) => {
        const items = g.items.filter((i) => byId.has(i.id));
        if (!items.length) return null;
        const detailed = items.some((i) => i.why?.length);
        return (
          <div key={`${g.kind}:${g.title}`}>
            <h3 className="sub-h">{title(g, statuses)}</h3>
            <ul className={`team-list ${detailed ? 'detailed' : ''}`}>
              {items.map((i) => {
                const e = byId.get(i.id)!;
                const mateName = SINNER_NAME[e.sinner] ?? e.sinner;
                const why = g.kind === 'named' ? [...(i.why ?? [])].sort((a, b) => Number(a.whose === 'its') - Number(b.whose === 'its')) : i.why;
                const label = (w: NonNullable<typeof why>[number]) => {
                  const where = WHERE[w.where] ?? w.where;
                  if (w.whose === 'its') return `${selfName}’s ${where}`;
                  return g.kind === 'named' ? `${mateName}’s ${where}` : capitalize(where);
                };
                return (
                  <li key={i.id} className="mate">
                    <a className="mate-link" href={guideHref(e.id)}>
                      <span className="mate-art">
                        <FramedChibi e={e} ratio={1} body={1.6} pad={0.04} className="mate-img" />
                      </span>
                      <span className="mate-text">
                        <span className="mate-sinner">{mateName}</span>
                        <span className="mate-name">{e.name}</span>
                      </span>
                    </a>
                    {why?.map((w, k) => (
                      <p key={k} className="mate-why">
                        <span className="mate-where">{label(w)}:</span>{' '}
                        <Rich segs={w.segs} />
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
