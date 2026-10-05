import { taggedText as rawTaggedText } from './markup.mjs';
import { wikiToLines } from './wikitext.mjs';

let statusFamily = (id) => id;
let currentStatusName = (id) => id;
let currentStatusKind = () => 'other';
let currentKeywordOf = () => null;
const SHE = new Set(['faust', 'don quixote', 'ryoshu', 'ishmael', 'rodion', 'outis']);
const HE = new Set(['yi sang', 'mersault', 'hong lu', 'heathcliff', 'sinclair', 'gregor']);
let pr = { he: 'it', him: 'it', his: 'its' };
const taggedText = (line) => rawTaggedText(line).replace(/⟦([^⟧]+)⟧/g, (_, id) => `⟦${statusFamily(id)}⟧`);

export const SINNERS = {
  'yi sang': 'Yi Sang', faust: 'Faust', 'don quixote': 'Don Quixote', ryoshu: 'Ryōshū',
  mersault: 'Meursault', 'hong lu': 'Hong Lu', heathcliff: 'Heathcliff', ishmael: 'Ishmael',
  rodion: 'Rodion', sinclair: 'Sinclair', outis: 'Outis', gregor: 'Gregor',
};

export const SIN_NAMES = { wrath: 'Wrath', lust: 'Lust', sloth: 'Sloth', gluttony: 'Gluttony', gloom: 'Gloom', pride: 'Pride', envy: 'Envy' };

export const KEYWORDS = ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'poise', 'charge'];

const GENERIC = new Set([
  'haste', 'bind', 'protection', 'fragile', 'paralysis', 'paralyze', 'damage-up', 'offense-level-up', 'defense-level-up',
  'offense-level-down', 'defense-level-down', 'power-up', 'power-down', 'attack-power-up', 'attack-power-down',
  'clash-power-up', 'clash-power-down', 'unbreakable-coin', 'clashable-guard', 'nervousness', 'slash-fragility',
  'pierce-fragility', 'blunt-fragility', 'slash-dmg-up', 'pierce-dmg-up', 'blunt-dmg-up', 'shield', 'aggro',
  'defense-power-up', 'defense-power-down', 'slash-power-up', 'pierce-power-up', 'blunt-power-up', 'crit-dmg-up',
]);

const MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const norm = (s) => String(s).normalize('NFD').replace(MARKS, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function extractConditions(t, statusName) {
  const out = [];
  const add = (c) => {
    if (out.some((o) => o.key === c.key || o.label === c.label)) return;
    if (c.status && !c.statuses) c.statuses = [c.status];
    out.push(c);
  };
  const name = (id) => statusName(id);
  const suffix = (s) => (s ? ` ${s.trim().replace(/^stacks?$/i, 'Stack')}` : '');

  for (const m of t.matchAll(/\bat (\d+)\s*[-–~]\s*(\d+)\s*⟦([^⟧]+)⟧( Count| Potency)?/gi)) {
    add({ key: `self:${m[3]}${m[4] ?? ''}:${m[1]}-${m[2]}`, label: `${m[1]}–${m[2]} ${name(m[3])}${suffix(m[4])}`, subject: 'self', status: m[3], value: Number(m[1]), kind: 'range' });
  }
  for (const m of t.matchAll(/target (?:has|with) (\d+)(\+?)\s*⟦([^⟧]+)⟧( Count| Potency)?/gi)) {
    add({ key: `target:${m[3]}${m[4] ?? ''}:${m[1]}`, label: `Target has ${m[1]}${m[2]} ${name(m[3])}${suffix(m[4])}`, subject: 'target', status: m[3], value: Number(m[1]), kind: m[2] ? 'min' : 'exact' });
  }
  for (const m of t.matchAll(/target has (\d+)\+ types of (negative effects|debuffs)/gi)) {
    add({ key: `target:types:${m[1]}`, label: `Target has ${m[1]}+ types of ${m[2]}`, subject: 'target', value: Number(m[1]), kind: 'min' });
  }
  for (const m of t.matchAll(/(\d+)\+\s*⟦([^⟧]+)⟧( Count| Potency)? on (?:the )?(?:main )?target/gi)) {
    add({ key: `target:${m[2]}${m[3] ?? ''}:${m[1]}`, label: `Target has ${m[1]}+ ${name(m[2])}${suffix(m[3])}`, subject: 'target', status: m[2], value: Number(m[1]), kind: 'min' });
  }
  for (const m of t.matchAll(/\b(?:at|this unit has|has) (\d+)(\+?)\s*⟦([^⟧]+)⟧( Count| Potency| Stacks?)?(?! on (?:the )?(?:main )?target)/gi)) {
    const before = t.slice(Math.max(0, m.index - 30), m.index);
    if (/target\s*$|target has\s*$/i.test(before)) continue;
    add({ key: `self:${m[3]}${m[4] ?? ''}:${m[1]}`, label: `${m[1]}${m[2]} ${name(m[3])}${suffix(m[4])}`, subject: 'self', status: m[3], value: Number(m[1]), kind: m[2] ? 'min' : 'exact' });
  }
  for (const m of t.matchAll(/\bconsumes? (\d+)\s*⟦([^⟧]+)⟧( Count| Potency)?/gi)) {
    add({ key: `self:${m[2]}${m[3] ?? ''}:${m[1]}`, label: `${m[1]}+ ${name(m[2])}${suffix(m[3])}`, subject: 'self', status: m[2], value: Number(m[1]), kind: 'min' });
  }
  for (const m of t.matchAll(/at (?:less than|below|under) (\d+)\s*⟦([^⟧]+)⟧( Count| Potency)?/gi)) {
    add({ key: `self:${m[2]}${m[3] ?? ''}:<${m[1]}`, label: `Under ${m[1]} ${name(m[2])}${suffix(m[3])}`, subject: 'self', status: m[2], value: -Number(m[1]), kind: 'under' });
  }
  for (const m of t.matchAll(/(?:this unit )?does not have ⟦([^⟧]+)⟧/gi)) {
    add({ key: `self:${m[1]}:none`, label: `No ${name(m[1])}`, subject: 'self', status: m[1] });
  }
  for (const m of t.matchAll(/if this unit (?:has|is in|is under) (?:the )?⟦([^⟧]+)⟧/gi)) {
    add({ key: `self:${m[1]}:has`, label: `Has ${name(m[1])}`, subject: 'self', status: m[1] });
  }
  for (const m of t.matchAll(/if (?:the )?target has ⟦([^⟧]+)⟧(?: or ⟦([^⟧]+)⟧)?/gi)) {
    const label = m[2] ? `Target has ${name(m[1])} or ${name(m[2])}` : `Target has ${name(m[1])}`;
    add({ key: `target:${m[1]}${m[2] ? `|${m[2]}` : ''}:has`, label, subject: 'target', status: m[1], statuses: m[2] ? [m[1], m[2]] : [m[1]] });
  }
  for (const m of t.matchAll(/\b(\d+)\+\s*\(sum of ⟦([^⟧]+)⟧( Count| Potency)?([^)]*)\)/gi)) {
    const where = /enem/i.test(m[4]) ? ' on enemies' : /all(y|ies)/i.test(m[4]) ? ' on allies' : '';
    add({ key: `sum:${m[2]}${m[3] ?? ''}:${m[1]}`, label: `${m[1]}+ total ${name(m[2])}${suffix(m[3])}${where}`, subject: /enem/i.test(m[4]) ? 'target' : 'self', status: m[2], value: Number(m[1]), kind: 'sum' });
  }
  for (const m of t.matchAll(/\bat\s+⟦([^⟧]+)⟧(\+)?/gi)) {
    add({ key: `self:${m[1]}:has`, label: `At ${name(m[1])}${m[2] ? '+' : ''}`, subject: 'self', status: m[1] });
  }
  for (const m of t.matchAll(/marked with ⟦([^⟧]+)⟧/gi)) {
    add({ key: `skill:${m[1]}`, label: `Skill marked with ${name(m[1])}`, subject: 'skill', status: m[1] });
  }
  for (const m of t.matchAll(/\b(?:at )?(\d+)\+ Speed/gi)) {
    add({ key: `speed:${m[1]}`, label: `Speed ${m[1]}+`, subject: 'speed', value: Number(m[1]) });
  }
  for (const m of t.matchAll(/speed is faster than (?:the )?target'?s?(?: by (\d+) or more)?/gi)) {
    add({ key: `faster:${m[1] ?? 1}`, label: m[1] ? `${m[1]}+ faster than target` : 'Faster than target', subject: 'speed' });
  }
  for (const m of t.matchAll(/(?:below|less than|under) (\d+)% (?:of )?(?:max |current )?HP/gi)) {
    const who = /target/i.test(t.slice(Math.max(0, m.index - 25), m.index)) ? 'Target' : 'This unit';
    add({ key: `hp:${who}:<${m[1]}`, label: `${who} below ${m[1]}% HP`, subject: who === 'Target' ? 'target' : 'self', value: Number(m[1]) });
  }
  return out;
}

function analyzeLines(lines) {
  const gains = new Map();
  const inflicts = new Map();
  const consumes = new Set();
  const props = new Set();
  for (const line of lines) {
    const t = taggedText(line);
    if (/\[Unclashable\]/i.test(t) || /^Unclashable/i.test(t)) props.add('Unclashable');
    if (/\[Clashable Counter\]/i.test(t)) props.add('Clashable Counter');
    if (/⟦clashable-guard⟧/.test(t)) props.add('Clashable Guard');
    if (/⟦unbreakable-coin⟧/.test(t)) props.add('Unbreakable Coins');
    for (const m of t.matchAll(/\b(?:gain|gains|obtain)s?\s+(?:additional\s+)?(\+?\d+)?\s*(?:additional\s+)?⟦([^⟧]+)⟧( Count)?/gi)) {
      const id = m[2];
      if (/\b(?:ally|allies|target)\b/i.test(t.slice(Math.max(0, m.index - 30), m.index))) continue;
      gains.set(id + (m[3] ? ' Count' : ''), (gains.get(id + (m[3] ? ' Count' : '')) ?? 0) + Number(m[1]?.replace('+', '') ?? 1));
    }
    for (const m of t.matchAll(/\b(?:inflict|inflicts|apply|applies)\s+(?:\+?\d+\s*)?(?:more\s+|additional\s+)?⟦([^⟧]+)⟧/gi)) {
      const rest = t.slice(m.index + m[0].length, m.index + m[0].length + 60);
      if (/^\s*(?:Count\s+)?(?:\(\d+\)\s*)?to\s+(?:self|this unit|\d*\s*(?:other\s+)?all(?:y|ies)|the ally)/i.test(rest)) {
        if (/^\s*(?:Count\s+)?to\s+(?:self|this unit)/i.test(rest)) gains.set(m[1], (gains.get(m[1]) ?? 0) + 1);
        continue;
      }
      inflicts.set(m[1], (inflicts.get(m[1]) ?? 0) + 1);
    }
    for (const m of t.matchAll(/\b(?:consume|consumes|spend|spends)\s+(?:all|up to \d+|\d+)?\s*(?:of\s+)?(?:the\s+)?⟦([^⟧]+)⟧/gi)) {
      consumes.add(m[1]);
    }
  }
  return { gains, inflicts, consumes, props };
}

const gainAmount = (a, status) => (a.gains.get(status) ?? 0) + (a.gains.get(`${status} Count`) ?? 0);

export function buildGuide(model, ctx) {
  const { statusName } = ctx;
  statusFamily = ctx.statusFamily ?? ((id) => id);
  currentStatusName = statusName;
  currentStatusKind = ctx.statusKind ?? (() => 'other');
  currentKeywordOf = ctx.keywordOf ?? (() => null);
  pr =SHE.has(model.sinner) ? { he: 'she', him: 'her', his: 'her' } : HE.has(model.sinner) ? { he: 'he', him: 'him', his: 'his' } : { he: 'it', him: 'it', his: 'its' };
  const id = model.id;
  const text = (raw, coin = null) => wikiToLines(raw, ctx, coin);

  const nDef = model.skills.filter((s) => s.kind === 'defense').length;
  const skills = model.skills.map((s) => {
    const lines = [...text(s.se), ...Object.keys(s.ce).map(Number).sort((a, b) => a - b).flatMap((c) => text(s.ce[c], c))];
    const common = {
      name: s.name,
      coins: s.coins,
      base: s.base,
      coinPower: s.coinPower,
      clash: [s.base + Math.min(0, s.coinPower) * s.coins, s.base + Math.max(0, s.coinPower) * s.coins],
      weight: s.weight,
      offense: s.offense,
      amt: s.amt,
      sin: s.sin,
      lines,
    };
    if (s.kind === 'attack') {
      return { label: s.variant > 1 ? `S${s.slot}.${s.variant}` : `S${s.slot}`, slot: s.slot, variant: s.variant, kind: 'attack', type: s.type, ...common };
    }
    return { label: nDef === 1 ? 'D' : `D${s.variant}`, slot: 0, variant: s.variant, kind: 'defense', type: s.type, counterType: s.counterType, ...common };
  });

  for (const s of skills) s.aoe = targetRange(s.weight, s.lines);
  const passives = model.passives.map((p) => ({ kind: p.kind, name: p.name || (p.kind === 'battle' ? 'Battle Passive' : 'Support Passive'), lines: text(p.text), req: p.req }));

  const analysis = skills.map((s) => analyzeLines(s.lines));
  const battleLines = passives.filter((p) => p.kind === 'battle').flatMap((p) => withParents(p.lines).map((x) => ({ ...x, from: p.name })));
  const allSources = [
    ...skills.flatMap((s, i) => withParents(s.lines).map((x) => ({ ...x, from: s.label, fromIdx: i }))),
    ...battleLines.map((x) => ({ ...x, fromIdx: -1 })),
  ];
  const exactNames = new Set(skills.map((s) => norm(s.name)));
  const nameCounts = new Map();
  for (const s of skills) nameCounts.set(norm(s.name), (nameCounts.get(norm(s.name)) ?? 0) + 1);

  const labels = new Set(skills.map((s) => s.label));
  const checkedSegs = (what, text) => {
    for (const m of text.matchAll(/\{(?!@)([^{}\s|]+)(?:\|[^{}]+)?\}/g)) if (!ctx.statusId(m[1])) console.warn(`  ${what}: ${id} has unknown status {${m[1]}}`);
    for (const m of text.matchAll(/\{@([^{}\s|]+)(?:\|[^{}]+)?\}/g)) if (!ctx.identityName?.(m[1])) console.warn(`  ${what}: ${id} has unknown identity {@${m[1]}}`);
    for (const m of text.matchAll(/\[([SD]\d?(?:\.\d)?)\]/g)) if (!labels.has(m[1])) console.warn(`  ${what}: ${id} has no skill [${m[1]}]`);
    return curatedSegs(text, ctx, labels);
  };

  const coinStates = new Map();
  for (const { line } of battleLines) {
    for (const [, sid] of taggedText(line).matchAll(/⟦([^⟧]+)⟧/g)) {
      const m = ctx.statusDesc?.(sid)?.match(/uses (Plus|Minus) Coin Attack Skills/i);
      const gains = new RegExp(`\\bgains?\\s+⟦${escapeRe(sid)}⟧`, 'i').test(taggedText(line));
      if (m && gains && !coinStates.has(m[1].toLowerCase())) coinStates.set(m[1].toLowerCase(), { sid, line });
    }
  }
  const exclusive = (sid, line, from) => ({ mode: 'exclusive', status: sid, conds: [{ key: `self:${sid}:has`, label: `In ${statusName(sid)} state`, subject: 'self', status: sid, statuses: [sid] }], line: line.segs, from: [from] });

  skills.forEach((s, i) => {
    const found = [];
    const isBase = s.kind === 'attack' ? (s.amt != null ? s.amt > 0 : s.variant === 1 && s.slot <= 3) : s.variant === 1;
    for (const l of s.lines) {
      const t = taggedText(l);
      const m = t.match(/⟦([^⟧]+)⟧\s*exclusive skill/i) || t.match(/exclusive skill (?:for|of)\s*⟦([^⟧]+)⟧/i);
      if (m) {
        found.push(exclusive(m[1], l, s.label));
        break;
      }
    }
    const coinState = s.kind === 'attack' && !isBase && !found.length && coinStates.get(s.coinPower < 0 ? 'minus' : 'plus');
    if (coinState) found.push(exclusive(coinState.sid, coinState.line, 'passive'));
    const n = norm(s.name);
    const genericName = n.length < 5 || ['guard', 'evade', 'counter', 'defend'].includes(n);
    {
      for (const src of allSources) {
        if (src.fromIdx === i) continue;
        const mentioned = src.line.segs.filter((x) => Array.isArray(x) && x[0] === 'k').map((x) => norm(x[1]));
        for (const q of src.line.plain.matchAll(/["“]([^"”]{3,90})["”]|(?<![A-Za-z])['‘]([^'’]{3,90})['’](?![A-Za-z])/g)) mentioned.push(norm(q[1] ?? q[2]));
        if (n.length >= 12 && norm(src.line.plain).includes(n)) mentioned.push(n);
        if (!mentioned.some((x) => x && (exactNames.has(x) ? x === n : closeName(x, n) || closeName(x, norm(bareName(s.name)))))) continue;
        const t = taggedText(src.line);
        const rel = mentionRelation(t, s.name, n);
        let mode = 'mention';
        if (rel === 'transform' || rel === 'replace' || rel === 'add') mode = rel;
        else if (rel && /\buse[^.]*unopposed attack|as an? \[?unopposed attack/i.test(t)) mode = 'auto';
        else if (rel === 'use') mode = 'auto';
        else if (rel === null && /\bunopposed attack\b[^.]*«|with\s+[«'"“‘]+[^.]*\binstead/i.test(t) && /\buse\b/i.test(t)) mode = 'auto';
        if (genericName && mode !== 'transform') continue;
        if (mode === 'mention' && (nameCounts.get(n) ?? 0) > 1) continue;
        const key = src.line.plain.replace(/\s+/g, ' ');
        const dup = found.find((u) => u._key === key);
        if (dup) {
          if (!dup.from.includes(src.from)) dup.from.push(src.from);
          continue;
        }
        let context = src.parent;
        let condText = context ? `${taggedText(context)} ${t}` : t;
        let conds = extractConditions(condText, statusName).filter((c) => c.kind !== 'under');
        if (!conds.length && !context && src.prev && mode === 'transform') {
          const withPrev = extractConditions(`${taggedText(src.prev)} ${t}`, statusName).filter((c) => c.kind !== 'under');
          if (withPrev.length) {
            context = src.prev;
            condText = `${taggedText(src.prev)} ${t}`;
            conds = withPrev;
          }
        }
        if (conds.length > 1 && /,?\s+or\s+(?:at|if|when)\b/i.test(condText)) {
          conds = [{
            key: conds.map((c) => c.key).join('|'),
            label: conds.map((c) => c.label).join(' or '),
            subject: conds[0].subject,
            statuses: [...new Set(conds.flatMap((c) => c.statuses ?? []))],
          }];
        }
        if (!conds.length && ['transform', 'replace', 'add'].includes(mode)) {
          const hit = [src.parent, src.line, mode === 'transform' ? src.prev : null]
            .filter(Boolean)
            .map((l) => ({ l, clause: conditionClause(l.plain) }))
            .find(({ clause }) => clause.length >= 12 && clause.length <= 140);
          if (hit) {
            const { l, clause } = hit;
            const named = l.segs.filter((x) => Array.isArray(x) && x[0] === 's' && clause.includes(x[2] ?? statusName(x[1]))).map((x) => x[1]);
            conds = [{ key: `gate:${norm(clause).slice(0, 40)}`, label: clause, subject: 'self', statuses: [...new Set(named)] }];
          }
        }
        if (conds.length && found.some((u) => u.mode === mode && u.conds.map((c) => c.key).join() === conds.map((c) => c.key).join())) continue;
        found.push({
          mode,
          conds,
          line: context ? [...context.segs, context === src.parent ? ' → ' : ' ', ...src.line.segs] : src.line.segs,
          from: [src.from],
          _key: key,
        });
      }
    }
    if (isBase) {
      const real = found.filter((u) => u.mode !== 'mention' && !(u.mode === 'transform' && u.from.includes(s.label)));
      s.unlock = real.filter((u) => !['auto', 'add', 'replace'].includes(u.mode));
    } else {
      const gates = found.filter((u) => ['transform', 'replace', 'add', 'exclusive'].includes(u.mode));
      const real = gates.length ? gates : found.filter((u) => u.mode !== 'mention');
      s.unlock = (real.length ? real : found).filter((u, k, arr) => arr.filter((x, j) => j < k && x.mode === u.mode).length < 2);
      if (!found.length) {
        s.unlock = [{ mode: 'note', conds: [], line: [s.kind === 'defense' ? "Alternate defense skill. The data doesn't say when it replaces the other one; check its text below." : `Alternate version of Skill ${s.slot}. The unlock isn't spelled out in the data; check the skill text below.`], from: [s.label] }];
      }
    }
    for (const u of s.unlock) {
      delete u._key;
      if (!u.conds.length && ['transform', 'replace', 'add'].includes(u.mode)) {
        u.conds = [{ key: `gate:${s.label}`, label: `${s.label} unlock condition met` }];
      }
    }
    const transforms = s.unlock.filter((u) => u.mode === 'transform');
    s.replaces = [...new Set(transforms.flatMap((u) => u.from).filter((f) => skills.some((x) => x.label === f)))];
    s.auto = !isBase && s.unlock.length > 0 && s.unlock.every((u) => u.mode === 'auto');
  });

  for (const s of skills) {
    const unlock = ctx.skillUnlock?.get(`${id}::${s.label.toLowerCase()}`)?.[0];
    if (!unlock) continue;
    s.unlock = [{ mode: 'custom', conds: [], line: checkedSegs('skills (unlock)', unlock), from: [s.label] }];
    s.auto = false;
  }

  const condsBySkill = skills.map((s) => uniqueBy(s.lines.flatMap((l) => extractConditions(taggedText(l), statusName)), (c) => c.label));

  skills.forEach((s, i) => {
    const note = ctx.skillNotes?.get(`${id}::${s.label.toLowerCase()}`)?.[0];
    s.simple = note ? checkedSegs('skills', note) : explain(s.lines, { kind: s.kind, type: s.type, props: analysis[i].props });
  });
  const nameCount = new Map();
  for (const p of passives) {
    const key = `${id}::${p.name.trim().toLowerCase()}`;
    const nth = nameCount.get(key) ?? 0;
    nameCount.set(key, nth + 1);
    const note = ctx.passiveNotes?.get(key)?.[nth];
    p.simple = note ? checkedSegs('passives', note) : explain(p.lines, { kind: 'passive' });
  }
  const passiveAnalysis = analyzeLines(battleLines.map((x) => x.line));
  const passiveConds = battleLines.flatMap(({ line }) => extractConditions(taggedText(line), statusName));
  const selfConds = [...condsBySkill.flat(), ...passiveConds].filter((c) => c.subject === 'self' && c.status && c.value > 0);
  const gainTotals = new Map();
  for (const a of [...analysis, passiveAnalysis]) {
    a.gains.forEach((v, k) => {
      const sid = k.replace(/ Count$/, '');
      gainTotals.set(sid, (gainTotals.get(sid) ?? 0) + v);
    });
  }

  const resourceScore = new Map();
  for (const c of selfConds) {
    if (GENERIC.has(c.status) || DIRECT.has(c.status)) continue;
    if (!gainTotals.has(c.status)) continue;
    if (ctx.statusKind?.(c.status) === 'debuff') continue;
    resourceScore.set(c.status, (resourceScore.get(c.status) ?? 0) + 2);
  }
  for (const [sid, v] of gainTotals) {
    if (resourceScore.has(sid)) resourceScore.set(sid, resourceScore.get(sid) + Math.min(v, 6));
  }
  const gateConds = skills.flatMap((s) => s.unlock.flatMap((u) => u.conds));
  const topIdx = strongestAttackIdx(skills);
  const resources = [...resourceScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([sid]) => {
      const usable = (c) => c.status === sid && (c.kind === 'min' || c.kind === 'exact');
      const pick = maxBy(gateConds.filter(usable), (c) => c.value)
        ?? (topIdx >= 0 ? maxBy(condsBySkill[topIdx].filter(usable), (c) => c.value) : undefined)
        ?? mostCommon(selfConds.filter(usable));
      const builders = skills
        .map((s, i) => ({ label: s.label, kind: s.kind, amount: gainAmount(analysis[i], sid), auto: s.auto }))
        .filter((x) => x.amount > 0 && !x.auto);
      const spenders = skills.filter((s, i) => analysis[i].consumes.has(sid) && !s.auto).map((s) => s.label);
      const gainRe = new RegExp(`\\b(?:gain|gains|obtain)s?\\s+(?:\\+?\\d+\\s*)?(?:additional\\s+)?⟦${escapeRe(sid)}⟧`, 'i');
      const passiveLine = battleLines.find(({ line }) => gainRe.test(taggedText(line)));
      return { status: sid, target: pick ? { key: pick.key, label: pick.label } : null, builders, spenders, passiveLine: passiveLine?.line.segs ?? null };
    });

  const inflictTotals = new Map();
  analysis.forEach((a) => a.inflicts.forEach((v, k) => inflictTotals.set(k, (inflictTotals.get(k) ?? 0) + v)));
  const inflicted = [...inflictTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const keywordOf = (sid) => (KEYWORDS.includes(sid) ? sid : ctx.keywordOf?.(sid) ?? null);
  const selfKeywords = [...gainTotals.keys()].filter((k) => k === 'poise' || k === 'charge');
  const isBaseAttack = (s) => s.kind === 'attack' && (s.amt != null ? s.amt > 0 : s.variant === 1 && s.slot <= 3);
  const usesCharge = skills.some(
    (s, i) =>
      isBaseAttack(s) &&
      [...analysis[i].gains.keys(), ...analysis[i].inflicts.keys(), ...analysis[i].consumes].some((k) => keywordOf(k.replace(/ Count$/, '')) === 'charge'),
  );
  if (usesCharge && !selfKeywords.includes('charge')) selfKeywords.push('charge');
  const inflictedKeywords = inflicted.map(keywordOf).filter((k) => k && k !== 'charge' && k !== 'poise');
  const keywords = [...new Set([...inflictedKeywords, ...selfKeywords])].slice(0, 4);

  const opener = ctx.openers?.get(id);
  const validOpener = opener && skills.some((s) => s.kind === 'defense' && s.label === opener.skill)
    ? { ...opener, plainSegs: opener.plain ? checkedSegs('openers', opener.plain) : null }
    : null;
  const defenseNote = ctx.defenseNotes?.get(id);
  const defense = defenseNote ? checkedSegs('defenses', defenseNote) : null;
  const plan = buildPlan({
    defense,
    skills,
    analysis,
    passiveAnalysis,
    passiveLines: battleLines.map((x) => x.line),
    condsBySkill,
    resources,
    inflicted,
    statusName,
    statusKind: ctx.statusKind,
    followUps: findFollowUps(skills, passives),
    opener: validOpener,
    howFor: (label) => {
      const how = ctx.skillHow?.get(`${id}::${label.toLowerCase()}`)?.[0];
      return how ? how.split('\n').map((line) => checkedSegs('skills (how)', line)) : null;
    },
  });

  return {
    id,
    title: model.title,
    name: model.name,
    sinner: model.sinner,
    sinnerName: SINNERS[model.sinner] ?? model.sinner,
    rarity: model.rarity,
    season: model.season,
    released: model.released,
    keywords,
    skills: skills.map(({ slot: _slot, ...s }) => s),
    passives,
    resources: resources.map((r) => ({ status: r.status, target: r.target?.label ?? null })),
    plan,
  };
}

const sameName = (a, b) => a === b || (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a)));

const OPEN_Q = `[«'"“‘\\s]*$`;
function targetRange(weight, lines) {
  let extra = 0;
  let last = 0;
  let set = null;
  let varies = false;
  for (const { plain: t } of lines) {
    if (/excess Atk Weight|for every Atk Weight gained|\(Atk Weight\s*-/i.test(t)) continue;
    let m;
    if ((m = t.match(/AoE skill with (\d+) Atk Weight/i))) {
      set = Math.max(set ?? 0, Number(m[1]));
      continue;
    }
    if (/Atk Weight (?:becomes )?equal to/i.test(t)) {
      varies = true;
      continue;
    }
    const gain = t.match(/Atk Weight \+(\d+)|\+(\d+)(?:\/\+(\d+))? Atk Weight|\+\([^)]*\) Atk Weight/i);
    if (!gain) continue;
    const cap = t.match(/\(max \+?(\d+)\)/i);
    const n = cap ? Number(cap[1]) : /for every|\+\(/i.test(t) ? NaN : Number(gain[3] ?? gain[2] ?? gain[1]);
    if (Number.isNaN(n)) {
      varies = true;
      continue;
    }
    extra += /\binstead\b/i.test(t) ? n - last : n;
    last = n;
  }
  if (varies) return { min: weight, max: null };
  const max = set ?? weight + extra;
  return max >= 2 ? { min: weight, max } : null;
}

const bareName = (s) => String(s).replace(/\s*[[【(（][^\]】)）]*[\]】)）]\s*$/, '').trim();

function closeName(a, b) {
  if (!a || !b) return false;
  if (sameName(a, b)) return true;
  if (Math.min(a.length, b.length) < 10 || Math.abs(a.length - b.length) > 2) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > 2) return false;
    prev = cur;
  }
  return prev[b.length] <= 2;
}

function mentionRelation(rawT, name, n) {
  const t = rawT.replace(/[’‘]/g, "'");
  const spots = [];
  for (const nm of new Set([name.trim(), bareName(name)].map((x) => x.replace(/[’‘]/g, "'")))) {
    if (nm.length < 3) continue;
    const direct = new RegExp(escapeRe(nm).replace(/\s+/g, '\\s*'), 'gi');
    for (const m of t.matchAll(direct)) spots.push([m.index, m.index + m[0].length]);
    if (spots.length) break;
  }
  if (!spots.length) {
    for (const m of t.matchAll(/«([^»]+)»/g)) if (sameName(norm(m[1]), n)) spots.push([m.index, m.index + m[0].length]);
    for (const m of t.matchAll(/["“]([^"”]{3,90})["”]/g)) if (closeName(norm(m[1]), n)) spots.push([m.index, m.index + m[0].length]);
  }
  let best = null;
  for (const [s, e] of spots) {
    const before = t.slice(Math.max(0, s - 40), s);
    const wide = t.slice(Math.max(0, s - 140), s);
    const after = t.slice(e, e + 40);
    let rel = null;
    if (new RegExp(`(?:about to|if [^,]{0,30}|when [^,]{0,30})\\b(?:use|uses|using|activates?)\\s+(?:the\\s+)?${OPEN_Q}`, 'i').test(before)) rel = null;
    else if (new RegExp(`\\bactivat(?:es?|ed)\\s+as\\s+(?:the\\s+)?${OPEN_Q}`, 'i').test(before)) rel = 'transform';
    else if (new RegExp(`\\b(?:activat(?:es?|ed)|use|uses)\\s+(?:the\\s+)?${OPEN_Q}`, 'i').test(before) && /^[»'"”’\s]*(?:skill\s*)?instead/i.test(after)) rel = 'transform';
    else if (new RegExp(`\\b(?:replace|convert)[^.]{0,100}\\b(?:with|to|into)\\s+${OPEN_Q}`, 'i').test(wide)) rel = 'replace';
    else if (new RegExp(`\\badd(?:s|ed)?\\s+(?:\\d+\\s+)?${OPEN_Q}`, 'i').test(before)) rel = 'add';
    else if (new RegExp(`\\b(?:activat(?:es?|ed)|use|uses|using)\\s+(?:the\\s+)?${OPEN_Q}`, 'i').test(before)) rel = 'use';
    const rank = { transform: 4, replace: 3, add: 3, use: 2 };
    if (rel && (!best || rank[rel] > rank[best])) best = rel;
  }
  return best;
}

function conditionClause(plain) {
  return plain
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/^[-·•]\s*/, '')
    .split(/,\s*(?:this skill activates|activates?|activated|use|uses|replace|add|convert)\b/i)[0]
    .replace(/[:,\s]+$/, '')
    .trim();
}

function withParents(lines) {
  let parent = null;
  let prev = null;
  return lines.map((line) => {
    const bullet = /^[-·•]/.test(line.plain);
    const out = { line, parent: bullet ? parent : null, prev };
    if (!bullet) {
      parent = prev && /^[a-z]/.test(line.plain) && !/^[-·•]/.test(prev.plain)
        ? { segs: [...prev.segs, ' ', ...line.segs], plain: `${prev.plain} ${line.plain}`, coin: line.coin }
        : line;
    }
    prev = line;
    return out;
  });
}

function uniqueBy(arr, f) {
  const seen = new Set();
  return arr.filter((x) => (seen.has(f(x)) ? false : (seen.add(f(x)), true)));
}

function strongestAttackIdx(skills) {
  let best = -1;
  skills.forEach((s, i) => {
    if (s.kind !== 'attack' || s.auto || s.unlock.some((u) => u.mode === 'exclusive')) return;
    if (best === -1 || s.slot > skills[best].slot || (s.slot === skills[best].slot && s.variant > skills[best].variant)) best = i;
  });
  return best;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const maxBy = (arr, f) => arr.reduce((best, x) => (best === undefined || f(x) > f(best) ? x : best), undefined);
function mostCommon(arr) {
  const m = new Map();
  for (const c of arr) m.set(c.key, [c, (m.get(c.key)?.[1] ?? 0) + 1]);
  return maxBy([...m.values()], (x) => x[1] * 100 + (x[0].value ?? 0))?.[0];
}

const PROP_STATUSES = new Set(['unbreakable-coin', 'clashable-guard', 'reload']);

function explain(lines, info) {
  const st = (id) => ['s', id];
  const and = (ids) => ids.flatMap((k, i) => (i === 0 ? [st(k)] : [i === ids.length - 1 ? ' and ' : ', ', st(k)]));
  const a = analyzeLines(lines);
  const text = lines.map((l) => taggedText(l)).join(' \n ');
  const inflicts = [...a.inflicts.keys()].filter((k) => !PROP_STATUSES.has(k)).slice(0, 3);
  const gains = [...new Set([...a.gains.keys()].map((k) => k.replace(/ Count$/, '')))].filter((k) => !PROP_STATUSES.has(k));
  const spends = [...a.consumes].filter((k) => !PROP_STATUSES.has(k));

  const out = [];
  const say = (...segs) => {
    const first = typeof segs[0] === 'string' ? segs[0].charAt(0).toUpperCase() + segs[0].slice(1) : segs[0];
    if (out.length) out.push(' ');
    out.push(first, ...segs.slice(1), '.');
  };

  if (info.kind === 'defense') {
    say({ guard: 'blocks damage', evade: 'dodges hits', counter: 'strikes back when attacked' }[info.type] ?? 'defends');
  }
  if (inflicts.length) say('inflicts ', ...and(inflicts));
  const both = gains.filter((k) => spends.includes(k));
  const onlyGains = gains.filter((k) => !both.includes(k)).slice(0, 3);
  const onlySpends = spends.filter((k) => !both.includes(k)).slice(0, 2);
  if (both.length) say('gains and spends ', ...and(both.slice(0, 2)));
  if (onlyGains.length) say(both.length ? 'also gains ' : 'gains ', ...and(onlyGains));
  if (onlySpends.length) say('spends ', ...and(onlySpends));
  const heal = text.match(/\bheals? (?:[\d~∼-]+%? )?(?:of (?:its |their )?(?:max(?:imum)? )?)?(SP|HP)\b/i);
  if (heal) say(`heals ${heal[1].toUpperCase()}`);
  if (/\bgains? (?:\d+ |\+\d+ )?Shield\b|\bShield equal to\b|\bas Shield\b/i.test(text)) say(gains.length ? 'also gets a Shield' : 'gains a Shield');
  if (/\btake(?:s)? -\d+% (?:less )?damage|\btake less damage\b/i.test(text)) say('takes less damage');
  let helpedAllies = false;
  if (info.kind === 'passive') {
    if (/\+\d+% (?:more |additional )?(?:\w+ )?damage|\bdeals? (?:even )?more damage|\+\([^)]*\)% (?:more )?damage/i.test(text)) {
      const allyLed = /^\s*(?:\d+ )?all(?:y|ies) with the\b|^\s*\d+ all(?:y|ies)\b|^\s*identity that has\b/i.test(lines[0]?.plain ?? '');
      const vs = text.match(/(?:targets?|enem(?:y|ies)) (?:with|that has|that have) ⟦([^⟧]+)⟧/i);
      const t = [allyLed ? "boosts an ally's damage" : 'deals more damage'];
      if (vs && !PROP_STATUSES.has(vs[1])) t.push(' against targets with ', st(vs[1]));
      say(...t);
      helpedAllies = allyLed;
    }
    if (lines.some((l) => l.segs.some((s) => Array.isArray(s) && s[0] === 'p' && /^\+/.test(s[1])))) say('adds clash power');
  }
  if (!helpedAllies && info.kind === 'passive' && /\b(?:all(?:y|ies))\b[^.\n]{0,60}\b(?:gain|gains|heal|heals)\b|\b(?:apply|applies|give|gives|grant|grants)\b[^.\n]{0,60}\ball(?:y|ies)\b/i.test(text)) {
    say('helps allies');
  }
  if (info.props?.has('Unclashable')) say("can't be clashed");
  if (info.props?.has('Unbreakable Coins')) say("coins can't break");
  if (/\breuse\b/i.test(text) && info.kind !== 'passive') say('can reuse coins');

  if (info.kind !== 'passive') {
    const powered = lines.filter((l) => l.segs.some((s) => Array.isArray(s) && s[0] === 'p') || /damage/i.test(l.plain));
    const conds = powered
      .flatMap((l) => extractConditions(taggedText(l), currentStatusName))
      .filter((c) => c.kind !== 'under' && c.kind !== 'range' && c.subject !== 'skill');
    const rank = (c) => (c.subject === 'self' && c.status ? 3 : c.subject === 'target' ? 2 : 1) * 100 + (c.value ?? 0);
    const best = conds.sort((x, y) => rank(y) - rank(x))[0];
    if (best) say('stronger ', ...condPhrase(best));
  }

  if (!out.length && info.kind === 'passive' && lines.length) {
    const first = lines[0].plain.replace(/\[[^\]]+\]:?\s*/g, '').replace(/^[-·•]\s*/, '').trim();
    const sentence = first.split(/(?<=\.)\s/)[0];
    const short = sentence.length > 130 ? `${sentence.slice(0, 127).replace(/\s+\S*$/, '')}…` : sentence;
    return short ? [short.replace(/\.?$/, () => (short.endsWith('…') ? '' : '.'))] : null;
  }
  if (!out.length) return info.kind === 'attack' ? ['A plain attack.'] : null;
  return out;
}

function curatedSegs(text, ctx, skillLabels = null) {
  const segs = [];
  let last = 0;
  for (const m of text.matchAll(/\{(@?)([^{}\s|]+)(?:\|([^{}]+))?\}|\[([SD]\d?(?:\.\d)?)\]/g)) {
    if (m.index > last) segs.push(text.slice(last, m.index));
    if (m[4]) {
      segs.push(!skillLabels || skillLabels.has(m[4]) ? ['sk', m[4]] : m[4]);
    } else if (m[1]) {
      const name = ctx.identityName?.(m[2]);
      segs.push(name ? ['i', m[2], m[3] ?? name] : m[3] ?? m[2]);
    } else {
      const sid = ctx.statusId(m[2]);
      if (m[3] === '~') {
        const noun = sid ? plainNoun(sid) : m[2];
        const start = /(^|[.!?:]\s+)$/.test(text.slice(0, m.index));
        segs.push(sid ? ['g', sid, start ? noun.charAt(0).toUpperCase() + noun.slice(1) : noun] : noun);
      } else if (m[3]) segs.push(sid ? ['g', sid, m[3]] : m[3]);
      else segs.push(sid ? ['s', sid] : m[2].replace(/([a-z])([A-Z])/g, '$1 $2'));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push(text.slice(last));
  return segs;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function chips(text, ids = []) {
  const names = ids.map((id) => [id, currentStatusName(id)]).filter(([, n]) => n && text.includes(n)).sort((a, b) => b[1].length - a[1].length);
  if (!names.length) return [text];
  const byName = new Map(names.map(([id, n]) => [n, id]));
  return text
    .split(new RegExp(`(${names.map(([, n]) => escapeRe(n)).join('|')})`))
    .filter(Boolean)
    .map((part) => (byName.has(part) ? ['s', byName.get(part)] : part));
}

function condPhrase(c) {
  const b = (label) => (c.statuses?.length ? ['b', label, c.statuses.join('|')] : ['b', label]);
  const L = c.label;
  let m;
  if (/^gate:/.test(c.key) && / unlock condition met$/.test(L)) return ['once its unlock condition is met (see Skills)'];
  if (/^gate:/.test(c.key)) return /^(if|when|while|upon|after|at|once) /i.test(L) ? chips(lowerFirst(L), c.statuses) : ['when ', ...chips(L, c.statuses)];
  if ((m = L.match(/^(\d+)\+ faster than target$/))) return [`when ${pr.he} is `, b(`${m[1]}+ Speed faster than the target`)];
  if (L === 'Faster than target') return [`when ${pr.he} is `, b('faster than the target')];
  if ((m = L.match(/^Speed (\d+)\+$/))) return ['at ', b(`${m[1]}+ Speed`)];
  if (/^\d/.test(L)) return c.subject === 'self' && c.statuses?.some((id) => DIRECT.has(id)) ? ['at ', b(L), ` on ${pr.him}self`] : ['at ', b(L)];
  if ((m = L.match(/^Has (.+)$/))) return [`while ${pr.he} has `, b(m[1])];
  if ((m = L.match(/^No (.+)$/))) return [`when ${pr.he} has no `, b(m[1])];
  if ((m = L.match(/^Target has (.+)$/))) return ['when the target has ', b(m[1])];
  if ((m = L.match(/^In (.+) state$/))) return [/^the /i.test(m[1]) ? 'in ' : 'in the ', b(m[1]), ' state'];
  if ((m = L.match(/^At (.+)$/))) return ['at ', b(m[1])];
  if ((m = L.match(/^Under (.+)$/))) return ['under ', b(m[1])];
  if ((m = L.match(/^(This unit|Target) below (\d+)% HP$/))) return [m[1] === 'Target' ? 'when the target is below ' : `when ${pr.he} is below `, b(`${m[2]}% HP`)];
  if ((m = L.match(/^Skill marked with (.+)$/))) return ['when the skill is marked with ', b(m[1])];
  if (/^(if|when|while|upon|after|at|once) /i.test(L)) return chips(lowerFirst(L), c.statuses);
  return ['when ', b(L)];
}

const PLAIN_OK = new Set(KEYWORDS);
const isPlainStatus = (id) => PLAIN_OK.has(id);
function stateNoun(id) {
  const name = bareName(currentStatusName(id) ?? '');
  return name && !/\s/.test(name) ? name : `${pr.his} special state`;
}

function plainNoun(id, kind) {
  const unique = currentKeywordOf(id);
  if (unique) return `${pr.his} Unique ${unique.charAt(0).toUpperCase()}${unique.slice(1)}`;
  const name = bareName(currentStatusName(id) ?? '');
  if (name && !/\s/.test(name)) return name;
  if (/\b(?:rounds?|ammo|bullets?|arrows?)\b/i.test(name)) return `${pr.his} special ammo`;
  if (/\b(?:stance|mode|state)\b/i.test(name)) return `${pr.his} special state`;
  return `${pr.his} ${(kind ?? currentStatusKind(id)) === 'debuff' ? 'debuff' : 'buff'}`;
}

function plainCond(c) {
  const ids = c.statuses ?? [];
  const k = c.key;
  if (/^gate:/.test(k)) return ['under a special condition (see Skills)'];
  const common = (id) => isPlainStatus(id) || GENERIC.has(id);
  if (ids.every(common)) {
    return condPhrase(c).flatMap((x) => (Array.isArray(x) && x[0] === 'b' ? chips(x[1], ids) : [x]));
  }
  const own = ids.find((id) => !common(id));
  const g = (text) => ['g', own, text ?? plainNoun(own)];
  const n = c.value > 0 ? c.value : null;
  const plus = c.kind === 'min' ? '+' : '';
  const onTarget = c.subject === 'target';
  if (k.includes('|') || /^sum:/.test(k)) return onTarget ? ['once enemies have enough of ', g(`${pr.his} debuffs`)] : ['once ', g(`${pr.his} buffs`), ' build up'];
  if (/:none$/.test(k)) return ['once ', g(), ' runs out'];
  if (onTarget) return n ? [`when the target has ${n}${plus} stacks of `, g(plainNoun(own, 'debuff'))] : ['when the target has ', g(plainNoun(own, 'debuff'))];
  if (/^In .+ state$/.test(c.label)) return ['in ', g(stateNoun(own))];
  if (/:has$/.test(k)) return ['while ', g(), ' is active'];
  if (n) return ['once ', g(), ` reaches ${n}${plus}`];
  if (/^skill:/.test(k)) return ['when the skill is marked for it'];
  return ['under a special condition (see Skills)'];
}

const DIRECT = new Set(['burn', 'bleed', 'tremor', 'rupture', 'sinking']);

const GAIN_VERB = '(?:gains?|obtains?|reloads?)';
const LOSE_VERB = '(?:consumes?|spends?|loses?|removes?)';
function lineSays(lines, verb, sid) {
  const re = new RegExp(
    `\\b${verb}\\s+(?:all\\s+|up to\\s+)?(?:\\+?\\d+\\s+)?(?:of each\\s+|stacks? of\\s+)?(?:⟦[^⟧]+⟧(?:\\s+(?:Count|Potency))?(?:,\\s*|\\s+and\\s+))*⟦${escapeRe(sid)}⟧`,
    'gi',
  );
  return lines.some((l) => {
    const t = taggedText(l);
    return [...t.matchAll(re)].some((m) => !/\b(?:target|ally|allies|enemy|enemies)\b[^.]{0,20}$/i.test(t.slice(Math.max(0, m.index - 30), m.index)));
  });
}

const ALLY_LINE = [
  /\bto (?:this unit,? (?:and )?)?(?:(?:\d+|all|an?) )?(?:other )?all(?:y|ies)\b/i,
  /\bif (?:the )?target is an ally\b/i,
  /\ball(?:y|ies)\s+(?:with [^.]{0,40}?\s+)?(?:gains?|heals?)\b/i,
  /\b(?:give|gives|grant|grants)\b[^.]{0,40}\ball(?:y|ies)\b/i,
];
const isAllyLine = (t) => ALLY_LINE.some((re) => re.test(t.replace(/⟦[^⟧]+⟧/g, '⟦⟧')));
const GIVE_VERB = /\b(?:apply|applies|give|gives|grant|grants|gain|gains)\b([^.:;]*)/gi;
function givenStatuses(t) {
  const out = [];
  for (const m of t.replace(/\([^()]*\)/g, '').matchAll(GIVE_VERB)) {
    const phrase = m[1].split(/\b(?:if|that have|that has|with the)\b/i)[0];
    for (const s of phrase.matchAll(/⟦([^⟧]+)⟧/g)) out.push(s[1]);
  }
  return out;
}

function allySupport(skills, statusKind) {
  const labels = [];
  const buffs = [];
  let shield = false;
  let heal = false;
  for (const s of skills) {
    if (s.auto) continue;
    let helps = false;
    for (const { line, parent } of withParents(s.lines)) {
      const t = taggedText(line);
      if (!isAllyLine(t) && !(parent && isAllyLine(taggedText(parent)))) continue;
      for (const id of givenStatuses(t)) {
        if (statusKind(id) !== 'buff' || PROP_STATUSES.has(id)) continue;
        helps = true;
        if (!buffs.includes(id)) buffs.push(id);
      }
      if (/\b(?:apply|applies|give|gives|grant|grants|gain|gains)\b[^.(]*\bShield\b/i.test(line.plain)) helps = shield = true;
      if (/\bheals? [^.]{0,20}\bSP\b/i.test(line.plain)) helps = heal = true;
    }
    if (helps) labels.push(s.label);
  }
  return labels.length ? { labels, buffs, shield, heal } : null;
}

const ALLY_TRIGGER = /\b(?:another|other|an?|any(?: of)?)\s+(?:[\w.'-]+[\s-]+){0,4}?all(?:y|ies)\b|\ball(?:y|ies)'s\b|\b(?:another|other)\s+(?:[\w.'-]+[\s-]+){0,4}?identit(?:y|ies)\b/i;
const FIRES = /\b(?:activates?|uses?|using|follows? up with)\s+(?:the\s+)?["“'«]+([^"”'»]{2,80})["”'»]+/gi;

function findFollowUps(skills, passives) {
  const label = (name) => {
    const n = norm(name);
    const s = skills.find((x) => norm(x.name) === n) ?? skills.find((x) => closeName(norm(x.name), n) || closeName(norm(bareName(x.name)), n));
    return s?.label ?? null;
  };
  const sources = [...skills.map((s) => s.lines), ...passives.filter((p) => p.kind === 'battle').map((p) => p.lines)];
  const out = new Map();
  for (const lines of sources) {
    for (const { line, parent } of withParents(lines)) {
      const segs = [...(parent?.segs ?? []), ' ', ...line.segs];
      const t = `${parent ? `${taggedText(parent)} ` : ''}${taggedText(line)}`;
      const blank = t.replace(/⟦[^⟧]+⟧/g, '⟦⟧');
      const named = segs.find((x) => Array.isArray(x) && x[0] === 'i');
      if (!ALLY_TRIGGER.test(blank) && !named) continue;
      for (const m of t.matchAll(FIRES)) {
        const l = label(m[1]);
        if (!l) continue;
        const cause = blank.slice(0, m.index).replace(/\([^()]*\)/g, '');
        const phrase = triggerPhrase(cause, t.slice(0, m.index).replace(/\([^()]*\)/g, ''), named);
        if (!out.has(l) || (out.get(l).at(-1) === ' acts' && phrase.at(-1) !== ' acts')) out.set(l, phrase);
      }
    }
  }
  return [...out].map(([l, trigger]) => ({ label: l, trigger }));
}

function triggerPhrase(blank, tagged, named) {
  let who;
  const has = tagged.match(/all(?:y|ies)(?: that (?:has|have)| with)\s+⟦([^⟧]+)⟧/i);
  const faction = blank.match(/(?:other\s+|of\s+)?((?:The\s+)?[A-Z][\w.']*(?:\s+[A-Z][\w.']*)*?)(?:-faction)?\s+(?:all(?:y|ies)|Identit(?:y|ies))\b/);
  if (named) who = [named];
  else if (has) who = ['an ally with ', isPlainStatus(has[1]) || GENERIC.has(has[1]) ? ['s', has[1]] : ['g', has[1], plainNoun(has[1])]];
  else if (faction && !/^(?:Other|Another|Any|The)$/.test(faction[1])) who = [`an ally from ${faction[1]}`];
  else who = ['an ally'];
  let what = ' acts';
  if (/\blos(?:es|ing) a Clash\b/i.test(blank)) what = ' loses a clash';
  else if (/\b(?:killed|defeated|dies)\b|less than \d+% (?:of (?:its )?max )?HP/i.test(blank)) what = ' is defeated or badly hurt';
  else if (/\benemy attack(?:ed|s)\b|\bis attacked\b|\battacked (?:any|an?)\b/i.test(blank)) what = ' is attacked';
  else if (/\bStagger(?:s|ed)?\b/i.test(blank)) what = ' Staggers an enemy';
  else if (/\bhits?\b|\bAttack End\b|\battacks?\b|\buses? (?:its |a )?Skill|\bSkill End\b/i.test(blank)) what = ' attacks';
  return [/\bbefore\b/i.test(blank) ? 'before ' : 'when ', ...who, what];
}

function buildPlan({ skills, analysis, passiveAnalysis, passiveLines, condsBySkill, resources, inflicted, statusName, statusKind, opener, defense, followUps, howFor }) {
  const sk = (label) => ['sk', label];
  const st = (id) => ['s', id];
  const list = (labels, sep = ' or ') => labels.flatMap((l, i) => (i === 0 ? [sk(l)] : [i === labels.length - 1 ? sep : ', ', sk(l)]));
  const statusList = (ids) => ids.flatMap((k, i) => (i === 0 ? [st(k)] : [i === ids.length - 1 ? ' and ' : ', ', st(k)]));

  const attacks = skills.filter((s) => s.kind === 'attack');
  const isExclusive = (s) => s.unlock.some((u) => u.mode === 'exclusive');
  const gated = attacks.filter((s) => !s.auto && s.unlock.some((u) => ['transform', 'replace', 'add', 'exclusive'].includes(u.mode)));
  const s3 = attacks.find((s) => s.slot === 3 && s.variant === 1 && !isExclusive(s));
  const s3Idx = skills.indexOf(s3);
  const mainRes = resources[0];
  const targetStatuses = inflicted.filter((k) => DIRECT.has(k)).slice(0, 2);

  const states = new Map();
  for (const s of skills) {
    for (const u of s.unlock) {
      if (u.mode !== 'exclusive') continue;
      if (!states.has(u.status)) {
        const granters = skills.filter((x, i) => !isExclusive(x) && gainAmount(analysis[i], u.status) > 0).map((x) => x.label);
        states.set(u.status, { skills: [], granters });
      }
      states.get(u.status).skills.push(s.label);
    }
  }

  const gateKeys = new Set(gated.flatMap((s) => s.unlock.flatMap((u) => u.conds.flatMap((c) => c.key.split('|')))));
  const rank = (c) => {
    if (mainRes && c.status === mainRes.status) return 100 + (c.value ?? 0);
    if (c.subject === 'self' && c.value) return 60 + c.value;
    if (c.subject === 'target' && c.value) return 40 + c.value;
    return 10;
  };
  const s3Conds = s3
    ? condsBySkill[s3Idx]
        .filter((c) => c.subject !== 'skill' && c.kind !== 'range' && c.kind !== 'under' && !gateKeys.has(c.key))
        .sort((x, y) => rank(y) - rank(x))
        .slice(0, 2)
    : [];

  function sourcesFor(c, self) {
    const ids = c.statuses ?? [];
    if (!ids.length || /^gate:/.test(c.key)) return [];
    const none = /:none$/.test(c.key);
    const onTarget = c.subject === 'target';
    const gives = (a, lines, sid) => {
      if (none) return a.consumes.has(sid) || lineSays(lines, LOSE_VERB, sid);
      if (onTarget) return a.inflicts.has(sid);
      return gainAmount(a, sid) > 0 || lineSays(lines, GAIN_VERB, sid) || (DIRECT.has(sid) && a.inflicts.has(sid));
    };
    const labels = skills
      .filter((x, i) => x.label !== self && (ids.some((sid) => gives(analysis[i], x.lines, sid)) || (!none && opener?.skill === x.label && ids.some((sid) => opener.gains.includes(sid)))))
      .map((x) => x.label);
    const passive = ids.some((sid) => gives(passiveAnalysis, passiveLines, sid));
    const who = [...labels.map(sk), ...(passive ? ['a passive'] : [])];
    if (!who.length) return [];
    return [none ? ' (used up by ' : onTarget ? ' (inflicted by ' : ' (from ', ...who.flatMap((x, i) => (i ? [i === who.length - 1 ? ' and ' : ', ', x] : [x])), ')'];
  }

  let openerText = null;
  if (opener) {
    openerText = ['defend with ', sk(opener.skill)];
    if (opener.plainSegs?.length) {
      openerText.push(' ', ...opener.plainSegs);
    } else {
      const known = opener.gains.filter(isPlainStatus);
      const own = opener.gains.find((x) => !isPlainStatus(x));
      const gets = [...(known.length ? statusList(known) : []), ...(own ? [known.length ? ' and ' : '', ['g', own, plainNoun(own)]] : [])];
      if (gets.length) openerText.push(' to get ', ...gets);
      openerText.push('.');
    }
  }

  const summary = [];
  const bullet = (segs) => {
    const first = typeof segs[0] === 'string' ? segs[0].charAt(0).toUpperCase() + segs[0].slice(1) : segs[0];
    summary.push([first, ...segs.slice(1)].filter((x) => x !== ''));
  };

  const goals = gated
    .filter((s) => !isExclusive(s))
    .sort((x, y) => y.slot - x.slot || y.variant - x.variant)
    .slice(0, 2)
    .map((g) => ({ g, u: g.unlock.find((x) => ['transform', 'replace', 'add'].includes(x.mode)) }));
  const covers = (how, label) => how.some((h) => h.some((x) => Array.isArray(x) && x[0] === 'sk' && x[1] === label));
  const vague = (c) => /^gate:/.test(c.key) || c.key.includes('|') || /^sum:/.test(c.key);
  const goalLine = ({ g, u }) => {
    const c = u?.conds[0];
    const how = howFor?.(g.label);
    const when = c && !(how && vague(c)) ? [' ', ...plainCond(c), ...(how ? [] : sourcesFor(c, g.label))] : [];
    const replaced = u?.mode === 'replace' && u.from.find((l) => /^S\d/.test(l) && l !== g.label);
    if (u?.mode === 'transform' || replaced) {
      const from = replaced || (g.replaces.find((l) => l.startsWith('S')) ?? g.replaces[0] ?? `S${g.slot}`);
      if (from.startsWith('D')) return ['defend with ', sk(from), ...when, ' and it turns into ', sk(g.label), '.'];
      return [sk(from), ' turns into ', sk(g.label), ...when, '.'];
    }
    return [sk(g.label), ' is added to your skills', ...when, '.'];
  };
  const explained = new Set(goals.flatMap(({ g, u }) => (u?.conds[0] && sourcesFor(u.conds[0], g.label).length ? u.conds[0].statuses : [])));

  if (openerText) bullet(['turn 1: ', ...openerText]);

  const howIds = new Set(
    skills.map((s) => howFor?.(s.label))
      .flatMap((h) => (h ?? []).flat())
      .filter((x) => Array.isArray(x) && (x[0] === 'g' || x[0] === 's'))
      .map((x) => x[1]),
  );
  const every = [];
  if (targetStatuses.length) every.push('stack ', ...statusList(targetStatuses), ' on enemies');
  if (mainRes && !explained.has(mainRes.status)) {
    const builders = mainRes.builders
      .filter((x) => x.kind === 'attack' && /^S\d$/.test(x.label))
      .sort((x, y) => x.label.localeCompare(y.label))
      .slice(0, 2)
      .map((x) => x.label);
    const res = [isPlainStatus(mainRes.status) ? st(mainRes.status) : ['g', mainRes.status, plainNoun(mainRes.status)]];
    const part = howIds.has(mainRes.status)
      ? []
      : builders.length
        ? ['build ', ...res, ' with ', ...list(builders, ' and ')]
        : mainRes.passiveLine
          ? [`let ${pr.his} passive build `, ...res]
          : ['build up ', ...res];
    if (part.length) every.push(...(every.length ? [', and '] : []), ...part);
  }
  if (every.length) bullet([...every, '.']);

  const support = statusKind ? allySupport(skills, statusKind) : null;
  if (support) {
    const common = support.buffs.filter((id) => isPlainStatus(id) || GENERIC.has(id)).slice(0, 3);
    const own = support.buffs.find((id) => !isPlainStatus(id) && !GENERIC.has(id));
    const gifts = [
      ...common.map(st),
      ...(support.shield ? ['a Shield'] : []),
      ...(support.heal ? ['SP healing'] : []),
      ...(own ? [['g', own, plainNoun(own)]] : []),
    ];
    if (gifts.length) {
      const joined = gifts.flatMap((x, i) => (i ? [i === gifts.length - 1 ? ' and ' : ', ', x] : [x]));
      bullet([`${pr.he} supports the team: `, ...list(support.labels, ' and '), support.labels.length > 1 ? ' give allies ' : ' gives allies ', ...joined, '.']);
    }
  }

  const shownFollowUps = (followUps ?? []).slice(0, 2);
  for (const f of shownFollowUps) {
    const how = howFor?.(f.label);
    if (how) for (const h of how) bullet(h);
    else bullet([...f.trigger, `, ${pr.he} follows up with `, sk(f.label), '.']);
  }

  const stances = [...states.entries()].filter(([, x]) => x.skills.some((l) => l.startsWith('S')));
  const stateSeg = (id) => ['g', id, stateNoun(id)];
  const howInto = (id, granters, ref = stateSeg(id)) => {
    const re = new RegExp(`\\bgains?\\s+(?:\\d+\\s+)?⟦${escapeRe(id)}⟧`, 'i');
    const pairs = withParents(passiveLines).filter(({ line: l }) => re.test(taggedText(l)));
    const lines = pairs.map((p) => p.line);
    if (lines.some((l) => /\b(?:entering the Encounter|Encounter Start)\b/i.test(l.plain))) return [`${pr.he} starts in `, ref, '.'];
    if (granters.length) return [...list(granters, ' and '), granters.length > 1 ? ' put ' : ' puts ', `${pr.him} in `, ref, '.'];
    const line = lines[0];
    if (!line) return [];
    const sp = line.plain.match(/\bat (?:(less than|below|under|more than|above) (-?\d+)|(-?\d+) or (higher|more|lower|less)) SP\b/i);
    if (sp) {
      const below = /less|below|under|lower/i.test(sp[1] ?? sp[4]);
      const turnStart = /\bTurn Start\b/i.test(`${pairs[0].parent?.plain ?? ''} ${line.plain}`);
      return [`${pr.he} switches to `, ref, ` when ${pr.he} ${turnStart ? 'starts a turn' : 'is'} ${below ? 'below' : 'at or above'} ${sp[2] ?? sp[3]} SP`, '.'];
    }
    const once = /once per Encounter/i.test(line.plain) ? ' (once per fight)' : '';
    const c = extractConditions(taggedText(line), statusName).find((x) => x.status && x.status !== id && !states.has(x.status));
    const noun = (sid) => (isPlainStatus(sid) ? st(sid) : ['g', sid, plainNoun(sid)]);
    if (c && /:has$/.test(c.key)) {
      const gives = new RegExp(`\\bgain\\s+⟦${escapeRe(c.status)}⟧`, 'i');
      for (const { line: l, parent } of withParents(passiveLines)) {
        const t = taggedText(l);
        const potency = t.match(/Potency to (\d+) or higher/i);
        const spend = parent && taggedText(parent).match(/consumes (\d+) cumulative ⟦([^⟧]+)⟧/i);
        if (gives.test(t) && potency && spend) {
          const total = Number(spend[1]) * Number(potency[1]);
          return [`spending ${total} stacks of `, noun(spend[2]), ' in total gets ', noun(c.status), ', which unlocks ', stateSeg(id), once, '.'];
        }
      }
    }
    const when = !c ? [] : /:has$/.test(c.key) ? [` once ${pr.he} gets `, noun(c.status)] : [' ', ...plainCond(c)];
    return [`${pr.he} switches to `, ref, ...when, once, '.'];
  };
  const stancesExplained = stances.length > 0 && stances.every(([id]) => howIds.has(id));
  if (stances.length > 1 && !stancesExplained) {
    const how = stances.map(([id, x]) => howInto(id, x.granters)).filter((t) => t.length);
    const sentences = how.flatMap((t, i) => (i ? [' ', t[0].charAt(0).toUpperCase() + t[0].slice(1), ...t.slice(1)] : t));
    bullet(how.length ? [...sentences, ' Each state has its own skills.'] : [`${pr.he} switches between ${stances.length === 2 ? 'two' : stances.length} states, each with its own skills.`]);
  } else if (stances.length === 1 && !stancesExplained) {
    const [id, x] = stances[0];
    const noun = stateNoun(id);
    const t = [['g', id, noun.charAt(0).toUpperCase() + noun.slice(1)], ' unlocks ', ...list(x.skills, ' and ')];
    if (x.granters.length) t.push(' (', ...list(x.granters), x.granters.length > 1 ? ` put ${pr.him} there` : ` puts ${pr.him} there`, ')');
    else {
      const how = howInto(id, [], 'it');
      if (how.length) t.push('; ', ...how.slice(0, -1));
    }
    bullet([...t, '.']);
  } else if (!stances.length && !every.length && !goals.length) {
    bullet(['clash with ', sk('S1'), ' and ', sk('S2'), '; you draw them most often.']);
  }
  const goalLabels = new Set(goals.map(({ g }) => g.label));
  for (const s of skills) {
    if (goalLabels.has(s.label) || s.auto || shownFollowUps.some((f) => f.label === s.label) || (s.label === 'S3' && !goals.length && s3)) continue;
    const how = howFor?.(s.label);
    if (how) for (const h of how) bullet(h);
  }
  if (goals.length) {
    for (const goal of goals) {
      const how = howFor?.(goal.g.label);
      if (how) for (const h of how) bullet(h);
      const c = goal.u?.conds[0];
      if (!(how && ((c && vague(c)) || covers(how, goal.g.label)))) bullet(goalLine(goal));
    }
  } else if (s3) {
    const how = howFor?.('S3');
    if (how) for (const h of how) bullet(h);
    const c = s3Conds[0];
    if (!(how && ((c && vague(c)) || covers(how, 'S3')))) bullet(c && !how ? ['use ', sk('S3'), ' ', ...plainCond(c), ...sourcesFor(c, 'S3'), '.'] : c ? ['use ', sk('S3'), ' ', ...plainCond(c), '.'] : ['use ', sk('S3'), ' whenever it shows up.']);
  }

  const named = (label) => summary.some((b) => b.some((x) => Array.isArray(x) && x[0] === 'sk' && x[1] === label));
  for (const s of skills.filter((x) => x.auto && !shownFollowUps.some((f) => f.label === x.label))) {
    const how = howFor?.(s.label);
    if (how) {
      for (const h of how) bullet(h);
      continue;
    }
    if (named(s.label)) continue;
    const c = s.unlock.find((u) => u.conds.length)?.conds[0];
    const when = c && !c.key.includes('|') ? plainCond(c) : [];
    if (!when.length || /special condition/.test(when.filter((x) => typeof x === 'string').join(''))) continue;
    const sources = [...new Set(s.unlock.flatMap((u) => u.from))].filter((l) => /^[SD]\d?(\.\d)?$/.test(l) && l !== s.label);
    const who = sources.length ? list(sources, ' and ') : [pr.he];
    bullet([...who, sources.length > 1 ? ' follow up with ' : ' follows up with ', sk(s.label), ' ', ...when, '.']);
  }

  const aoe = skills.filter((s) => s.aoe);
  if (aoe.length) {
    const targets = ({ min, max }) => (max === null ? ' (varies)' : min === max ? ` (${max} targets)` : ` (${min}–${max} targets)`);
    bullet(['AoE: ', ...aoe.flatMap((s, i) => [i === 0 ? '' : i === aoe.length - 1 ? ' and ' : ', ', sk(s.label), targets(s.aoe)]).filter(Boolean), '.']);
  }
  if (defense?.length) bullet(['defense: ', ...defense]);

  const seen = new Map();
  for (const b of summary) {
    for (const x of b) {
      if (!Array.isArray(x) || x[0] !== 'g' || !/^(?:his|her|its) /i.test(x[2])) continue;
      const key = x[2].toLowerCase();
      const ids = seen.get(key) ?? [];
      if (!ids.includes(x[1])) ids.push(x[1]);
      seen.set(key, ids);
    }
  }
  for (const b of summary) {
    b.forEach((x, i) => {
      if (!Array.isArray(x) || x[0] !== 'g' || !/^(?:his|her|its) /i.test(x[2])) return;
      const ids = seen.get(x[2].toLowerCase());
      if (ids.length > 1) b[i] = ['g', x[1], `${x[2]} #${ids.indexOf(x[1]) + 1}`];
    });
  }

  for (const [n, b] of summary.entries()) {
    summary[n] = b.flatMap((x) => {
      if (!Array.isArray(x) || x[0] !== 'g') return [x];
      const lead = x[2].match(/^((?:his|her|its|he|she)\s+)(.+)$/i);
      if (lead) return [lead[1], ['g', x[1], lead[2]]];
      const tail = x[2].match(/^(.+?)(\s+(?:him|her|it))$/i);
      if (tail) return [['g', x[1], tail[1]], tail[2]];
      return [x];
    });
  }

  return { summary };
}
