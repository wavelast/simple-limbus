import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKI, fetchIdentityPages, fetchStatusModule, fileUrls, pageUrl, parseIdentity, parseStatusData } from './lib/wiki.mjs';
import { slug, wikiToLines } from './lib/wikitext.mjs';
import { buildGuide } from './lib/guide.mjs';
import { bodyFrame } from './lib/sprite.mjs';
import { buildTeammates } from './lib/teammates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const CURATED = path.join(ROOT, 'data', 'curated');
const OUT = path.join(ROOT, 'public', 'data');
const IMG = path.join(ROOT, 'public', 'img');

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const NO_IMAGES = args.has('--no-images');
const UA = 'simple-limbus-guide/1.0 (static fan guide; periodic data refresh)';

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
let siteChanged = false;
async function writeJson(file, data, { compareWith } = {}) {
  const text = JSON.stringify(data);
  if (compareWith && (await fs.readFile(compareWith, 'utf8').catch(() => null)) !== text) siteChanged = true;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, file);
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function renameRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      if (attempt >= 6 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}
const humanize = (id) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function loadRaw() {
  const pagesFile = path.join(RAW, 'wiki-pages.json');
  const statusFile = path.join(RAW, 'status-data.lua');
  if (OFFLINE) return { pages: await readJson(pagesFile), lua: await fs.readFile(statusFile, 'utf8') };
  const pages = await fetchIdentityPages();
  const lua = await fetchStatusModule();
  console.log(`Fetched ${Object.keys(pages).length} identity pages and the status table from ${WIKI}`);
  await writeJson(pagesFile, pages);
  await fs.writeFile(statusFile, lua);
  return { pages, lua };
}

async function main() {
  const { pages, lua } = await loadRaw();

  const statuses = new Map();
  for (const [key, s] of parseStatusData(lua)) if (!statuses.has(slug(key))) statuses.set(slug(key), { ...s, key });
  const byName = new Map();
  for (const [id, s] of statuses) {
    byName.set(id, id);
    if (!byName.has(slug(s.name))) byName.set(slug(s.name), id);
  }

  const models = Object.entries(pages)
    .map(([title, text]) => parseIdentity(title, text))
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
  const titleToId = new Map(models.map((m) => [m.title, m.id]));
  const idToTitle = new Map(models.map((m) => [m.id, m.title]));

  const SINNER_ORDER = ['yi sang', 'faust', 'don quixote', 'ryoshu', 'mersault', 'hong lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor'];
  const isLcb = (m) => m.id.startsWith('lcb-sinner-');
  const numbers = new Map(
    [...models]
      .sort(
        (a, b) =>
          Number(isLcb(b)) - Number(isLcb(a)) ||
          (isLcb(a) && isLcb(b) ? SINNER_ORDER.indexOf(a.sinner) - SINNER_ORDER.indexOf(b.sinner) : 0) ||
          (a.released ?? '9999').localeCompare(b.released ?? '9999') ||
          (a.wikiNum ?? '').localeCompare(b.wikiNum ?? ''),
      )
      .map((m, i) => [m.id, String(i + 1)]),
  );

  const ctx = {
    statusKey: (key) => slug(key),
    statusName: (id) => statuses.get(id)?.name ?? humanize(id),
    statusKind: (id) => statuses.get(id)?.kind ?? 'other',
    statusDesc: (id) => statuses.get(id)?.desc ?? '',
    keywordOf: (id) => {
      const desc = statuses.get(id)?.desc ?? '';
      const m = desc.match(/(?:^|<br\s*\/?>|\n)\s*-\s*Unique (Bleed|Burn|Sinking|Tremor|Rupture|Poise|Charge)\b/i) ?? desc.match(/same way as (?:normal |the )?(Bleed|Burn|Sinking|Tremor|Rupture|Poise|Charge)\b/i);
      return m ? m[1].toLowerCase() : null;
    },
    statusId: (u) => byName.get(slug(u)) ?? null,
    identityId: (title) => titleToId.get(String(title).split('#')[0].trim()) ?? null,
    identityName: (id) => idToTitle.get(id) ?? null,
  };
  ctx.openers = await loadOpeners(ctx);
  ctx.passiveNotes = await loadNotes('passives.json', 'passives', (p) => p.name);
  ctx.skillNotes = await loadNotes('skills.json', 'skills', (s) => s.label);
  ctx.skillHow = await loadNotes('skills.json', 'skills', (s) => s.label, 'how');
  ctx.skillUnlock = await loadNotes('skills.json', 'skills', (s) => s.label, 'unlock');
  ctx.defenseNotes = await loadDefenseNotes();

  const guides = [];
  const failures = [];
  for (const m of models) {
    try {
      guides.push({ model: m, guide: buildGuide(m, ctx) });
    } catch (err) {
      failures.push(`${m.title}: ${err.stack}`);
    }
  }
  if (failures.length) {
    console.error(`Failed to build ${failures.length} guides:\n${failures.join('\n')}`);
    process.exitCode = 1;
  }

  if (!NO_IMAGES) await buildImages(models);
  const chibis = new Set();
  for (const m of models) if (await exists(path.join(IMG, 'chibi', `${m.id}.webp`))) chibis.add(m.id);
  const sharp = (await import('sharp')).default;
  const frames = new Map();
  for (const id of chibis) {
    const frame = await bodyFrame(await fs.readFile(path.join(IMG, 'chibi', `${id}.webp`)), sharp).catch(() => null);
    if (frame) frames.set(id, frame);
  }

  const teammates = buildTeammates(
    guides.map(({ model, guide: g }) => ({ id: g.id, sinner: g.sinner, sinnerName: g.sinnerName, released: g.released, keywords: g.keywords, traits: model.traits, skills: g.skills, passives: g.passives })),
    ctx.statusName,
  );
  for (const { guide } of guides) guide.teammates = teammates.get(guide.id) ?? [];

  const used = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) {
      if ((v[0] === 's' || v[0] === 'g') && typeof v[1] === 'string' && v.length <= 3) used.add(v[1]);
      v.forEach(walk);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const { guide } of guides) {
    walk(guide);
    guide.keywords.forEach((k) => used.add(k));
  }
  const statusOut = {};
  for (const id of [...used].sort()) {
    const s = statuses.get(id);
    statusOut[id] = {
      n: ctx.statusName(id),
      d: s ? wikiToLines(s.desc, ctx).map((l) => l.plain).join('\n') : '',
    };
  }

  const nextDir = path.join(OUT, 'guides.next');
  const liveDir = path.join(OUT, 'guides');
  await fs.rm(nextDir, { recursive: true, force: true });
  const strip = (lines) => lines.map(({ coin, segs }) => ({ coin, segs }));
  const unlinkSelf = (v, id) => {
    if (Array.isArray(v)) return v[0] === 'i' && v[1] === id && typeof v[2] === 'string' ? v[2] : v.map((x) => unlinkSelf(x, id));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unlinkSelf(x, id)]));
    return v;
  };
  for (const { model, guide: g } of guides) {
    const file = `${g.id}.json`;
    await writeJson(path.join(nextDir, file), unlinkSelf({
      id: g.id,
      num: numbers.get(g.id),
      name: g.name,
      sinner: g.sinner,
      sinnerName: g.sinnerName,
      rarity: g.rarity,
      chibi: chibis.has(g.id),
      frame: frames.get(g.id) ?? null,
      wiki: pageUrl(model.title),
      keywords: g.keywords,
      skills: g.skills.map((s) => ({
        label: s.label,
        kind: s.kind,
        name: s.name,
        sin: s.sin,
        type: s.type,
        counterType: s.counterType,
        aoe: s.aoe ?? undefined,
        simple: s.simple,
        unlock: s.unlock,
        lines: strip(s.lines),
      })),
      passives: g.passives.map((p) => ({ kind: p.kind, name: p.name, req: p.req, simple: p.simple, lines: strip(p.lines) })),
      plan: g.plan,
      teammates: g.teammates,
    }, g.id), { compareWith: path.join(liveDir, file) });
  }
  const kept = new Set(guides.map(({ guide: g }) => `${g.id}.json`));
  if ((await fs.readdir(liveDir).catch(() => [])).some((f) => !kept.has(f))) siteChanged = true;
  const oldDir = path.join(OUT, 'guides.old');
  await fs.rm(oldDir, { recursive: true, force: true });
  if (await exists(liveDir)) await renameRetry(liveDir, oldDir);
  await renameRetry(nextDir, liveDir);
  await fs.rm(oldDir, { recursive: true, force: true });

  const statusesFile = path.join(OUT, 'statuses.json');
  await writeJson(statusesFile, statusOut, { compareWith: statusesFile });

  const index = guides
    .map(({ guide: g }) => ({
      id: g.id,
      num: numbers.get(g.id),
      name: g.name,
      sinner: g.sinner,
      rarity: g.rarity,
      chibi: chibis.has(g.id),
      frame: frames.get(g.id) ?? null,
      keywords: g.keywords,
      unlocks: g.skills.filter((s) => s.unlock.some((u) => u.mode !== 'note')).length,
    }))
    .sort((a, b) => Number(b.num ?? 0) - Number(a.num ?? 0));
  const indexFile = path.join(OUT, 'index.json');
  const previous = await readJson(indexFile).catch(() => null);
  const same = !siteChanged && previous?.updated && JSON.stringify(previous.identities) === JSON.stringify(index);
  await writeJson(indexFile, { updated: same ? previous.updated : new Date().toISOString(), identities: index });
  if (same) console.log('No changes to the guide data.');
  console.log(`Wrote ${guides.length} guides (${chibis.size} with chibi art), ${Object.keys(statusOut).length} statuses.`);
}

async function buildImages(models) {
  const sharp = (await import('sharp')).default;
  const spriteDir = path.join(RAW, 'sprites');
  await fs.mkdir(spriteDir, { recursive: true });
  await fs.mkdir(path.join(IMG, 'chibi'), { recursive: true });

  if (!OFFLINE) {
    const missing = [];
    for (const m of models) if (m.idleSprite && !(await exists(path.join(spriteDir, `${m.id}.png`)))) missing.push(m);
    if (missing.length) {
      const urls = await fileUrls(missing.map((m) => m.idleSprite));
      for (const m of missing) {
        const url = urls.get(m.idleSprite);
        if (!url) continue;
        try {
          const res = await fetch(url, { headers: { 'User-Agent': UA } });
          if (!res.ok) throw new Error(`${res.status}`);
          await fs.writeFile(path.join(spriteDir, `${m.id}.png`), Buffer.from(await res.arrayBuffer()));
        } catch (err) {
          console.warn(`  sprite ${m.title}: ${err.message}`);
        }
      }
      console.log(`Downloaded ${missing.length} new sprites.`);
    }
  }

  let done = 0;
  for (const m of models) {
    const src = path.join(spriteDir, `${m.id}.png`);
    if (!(await exists(src))) continue;
    try {
      const img = await sharp(await fs.readFile(src))
        .trim({ threshold: 1 })
        .resize(520, 520, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 90 })
        .toBuffer();
      await fs.writeFile(path.join(IMG, 'chibi', `${m.id}.webp`), img);
      done++;
    } catch (err) {
      console.warn(`  sprite ${m.title}: ${err.message}`);
    }
  }
  const keep = new Set(models.map((m) => `${m.id}.webp`));
  for (const f of await fs.readdir(path.join(IMG, 'chibi'))) if (!keep.has(f)) await fs.rm(path.join(IMG, 'chibi', f));
  console.log(`Wrote ${done} chibis.`);

  if (!OFFLINE) await buildIcons(sharp);
}

const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];
const SINNER_FILES = {
  'yi-sang': 'Yi Sang', faust: 'Faust', 'don-quixote': 'Don Quixote', ryoshu: 'Ryoshu', mersault: 'Meursault',
  'hong-lu': 'Hong Lu', heathcliff: 'Heathcliff', ishmael: 'Ishmael', rodion: 'Rodion', sinclair: 'Sinclair',
  outis: 'Outis', gregor: 'Gregor',
};
const ICONS = {
  ...Object.fromEntries(SINS.map((s) => [`sin-${s}`, `LcbSin${s[0].toUpperCase()}${s.slice(1)}.png`])),
  'atk-slash': 'Slash.png',
  'atk-pierce': 'Pierce.png',
  'atk-blunt': 'Blunt.png',
  'def-guard': 'Guard.png',
  'def-evade': 'Evade.png',
  'def-counter': 'Counter.png',
  ...Object.fromEntries(Object.entries(SINNER_FILES).map(([key, name]) => [`sinner-${key}`, `${name} Icon.png`])),
};

async function buildIcons(sharp) {
  const dir = path.join(IMG, 'icons');
  await fs.mkdir(dir, { recursive: true });
  const urls = await fileUrls(Object.values(ICONS));
  let n = 0;
  for (const [out, file] of Object.entries(ICONS)) {
    const url = urls.get(file);
    if (!url) {
      console.warn(`  icon ${file}: not on the wiki`);
      continue;
    }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`${res.status}`);
      const img = await sharp(Buffer.from(await res.arrayBuffer()))
        .trim({ threshold: 1 })
        .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();
      await fs.writeFile(path.join(dir, `${out}.webp`), img);
      n++;
    } catch (err) {
      console.warn(`  icon ${file}: ${err.message}`);
    }
  }
  console.log(`Wrote ${n} icons.`);
}

async function loadOpeners(ctx) {
  const file = path.join(CURATED, 'openers.json');
  if (!(await exists(file))) return new Map();
  const out = new Map();
  for (const o of await readJson(file)) {
    if (!o?.opener || !o.id || !o.skill) continue;
    const gains = (o.gains ?? []).map((g) => ctx.statusId(g)).filter(Boolean);
    if (gains.length < (o.gains ?? []).length) console.warn(`  openers: ${o.id} has unknown status id(s)`);
    out.set(o.id, { skill: o.skill, gains, note: String(o.note ?? '').trim(), plain: String(o.plain ?? '').trim() });
  }
  return out;
}

async function loadDefenseNotes() {
  const file = path.join(CURATED, 'defenses.json');
  if (!(await exists(file))) return new Map();
  return new Map((await readJson(file)).filter((d) => d?.id && d.note).map((d) => [d.id, String(d.note).trim()]));
}

async function loadNotes(fileName, listKey, keyOf, field = 'text') {
  const file = path.join(CURATED, fileName);
  if (!(await exists(file))) return new Map();
  const out = new Map();
  for (const idn of await readJson(file)) {
    for (const item of idn[listKey] ?? []) {
      const key = keyOf(item);
      if (!idn.id || !key || !item[field]) continue;
      const k = `${idn.id}::${String(key).trim().toLowerCase()}`;
      const value = Array.isArray(item[field]) ? item[field].map((x) => String(x).trim()).join('\n') : String(item[field]).trim();
      out.set(k, [...(out.get(k) ?? []), value]);
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
