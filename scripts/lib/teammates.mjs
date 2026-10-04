const SHOW = 8;
const MAX_FACTION = 14;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const foreign = (segs) => (segs ?? []).map((x) => (Array.isArray(x) && x[0] === 'sk' ? x[1] : x));

export function buildTeammates(kits, statusName) {
  const byId = new Map(kits.map((k) => [k.id, k]));
  const plain = (segs) => segs.map((x) => (typeof x === 'string' ? x : x[0] === 's' ? x[2] ?? statusName(x[1]) : x[0] === 'i' ? x[2] : x[x.length - 1])).join('');

  const sources = new Map();
  for (const k of kits) {
    const list = [
      ...k.skills.map((s) => ({ where: s.label, simple: s.simple, lines: s.lines })),
      ...k.passives.map((p) => ({ where: p.kind === 'support' ? 'support passive' : 'passive', support: p.kind === 'support', simple: p.simple, lines: p.lines })),
    ].map((s) => ({
      ...s,
      refs: new Set(s.lines.flatMap((l) => l.segs.filter((x) => Array.isArray(x) && x[0] === 'i' && x[1] !== k.id).map((x) => x[1]))),
      text: s.lines.map((l) => plain(l.segs)).join('\n'),
    }));
    sources.set(k.id, list);
  }

  const members = new Map();
  for (const k of kits) for (const t of k.traits) members.set(t, [...(members.get(t) ?? []), k.id]);
  const teamTraits = [...members.keys()].filter((t) => t.length >= 4 && members.get(t).length >= 2 && members.get(t).length <= MAX_FACTION);
  const traitRe = new Map(teamTraits.map((t) => [t, new RegExp(`(?<![\\w])${escapeRe(t)}(?![\\w])`)]));
  const active = new Set(teamTraits.filter((t) => members.get(t).some((id) => sources.get(id).some((s) => traitRe.get(t).test(s.text)))));

  const marks = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
  const fold = (x) => x.normalize('NFD').replace(marks, '').toLowerCase();
  const about = (segs, id) => {
    const t = fold(plain(segs ?? []));
    const p = byId.get(id);
    return t.includes(fold(p.sinnerName)) || p.traits.some((x) => x.length >= 4 && t.includes(fold(x)));
  };

  const newest = (a, b) => (byId.get(b).released ?? '').localeCompare(byId.get(a).released ?? '');
  const out = new Map();
  for (const k of kits) {
    const groups = [];
    const shown = new Set(kits.filter((o) => o.sinner === k.sinner).map((o) => o.id));

    const named = new Map();
    const addWhy = (id, why) => {
      if (!byId.has(id) || shown.has(id)) return;
      const list = named.get(id) ?? [];
      if (why.segs?.length && about(why.segs, why.whose === 'its' ? id : k.id) && list.length < 2 && !list.some((w) => w.whose === why.whose && w.where === why.where)) list.push(why);
      named.set(id, list);
    };
    for (const s of sources.get(k.id)) for (const id of s.refs) addWhy(id, { whose: 'its', where: s.where, segs: s.simple ?? [] });
    for (const other of kits) {
      if (other.id === k.id) continue;
      for (const s of sources.get(other.id)) if (s.refs.has(k.id)) addWhy(other.id, { whose: 'their', where: s.where, segs: foreign(s.simple) });
    }
    if (named.size) {
      const ids = [...named.keys()].sort(newest).slice(0, SHOW);
      ids.forEach((id) => shown.add(id));
      groups.push({ kind: 'named', title: 'Named in each other’s kits', items: ids.map((id) => ({ id, why: named.get(id) })) });
    }

    for (const t of k.traits.filter((x) => active.has(x)).sort((a, b) => members.get(a).length - members.get(b).length)) {
      const ids = members.get(t).filter((id) => !shown.has(id)).sort(newest).slice(0, SHOW);
      if (!ids.length) continue;
      ids.forEach((id) => shown.add(id));
      groups.push({ kind: 'faction', title: t, items: ids.map((id) => ({ id })) });
    }

    const key = k.keywords[0];
    if (key) {
      const scored = kits
        .filter((o) => !shown.has(o.id) && o.keywords.includes(key))
        .map((o) => {
          const boost = sources.get(o.id).find((s) => s.support && s.lines.some((l) => l.segs.some((x) => Array.isArray(x) && x[0] === 's' && x[1] === key)));
          const shared = o.keywords.filter((x) => k.keywords.includes(x)).length;
          return { o, boost, score: (boost ? 4 : 0) + (o.keywords[0] === key ? 2 : 0) + shared };
        })
        .sort((a, b) => b.score - a.score || newest(a.o.id, b.o.id))
        .slice(0, SHOW);
      if (scored.length) {
        groups.push({
          kind: 'keyword',
          title: key,
          items: scored.map(({ o, boost }) => (boost ? { id: o.id, why: [{ whose: 'their', where: 'support passive', segs: foreign(boost.simple) }] } : { id: o.id })),
        });
      }
    }

    out.set(k.id, groups);
  }
  return out;
}
