import { findTemplates, parseTemplate, slug } from './wikitext.mjs';

export const WIKI = 'https://limbuscompany.wiki.gg';
const API = `${WIKI}/api.php`;
const UA = 'simple-limbus-guide/1.0 (static fan guide; periodic data refresh)';

async function api(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`wiki API ${res.status}`);
  return res.json();
}

export const pageUrl = (title) => `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

export async function fetchIdentityPages() {
  const titles = [];
  let cont = {};
  do {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Identities', cmlimit: '500', cmnamespace: '0', ...cont });
    titles.push(...d.query.categorymembers.map((m) => m.title));
    cont = d.continue ?? null;
  } while (cont);
  const pages = {};
  for (let i = 0; i < titles.length; i += 50) {
    const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 50).join('|') });
    for (const p of Object.values(d.query.pages)) pages[p.title] = p.revisions?.[0]?.slots?.main?.['*'] ?? '';
  }
  return pages;
}

export async function fetchStatusModule() {
  const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: 'Module:StatusEffect/data' });
  return Object.values(d.query.pages)[0]?.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

function readLuaString(src, i) {
  const q = src[i];
  if (q === '[') {
    const m = src.slice(i).match(/^\[(=*)\[/);
    const close = `]${m[1]}]`;
    const end = src.indexOf(close, i + m[0].length);
    return [src.slice(i + m[0].length, end), end + close.length];
  }
  let out = '';
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') {
      const n = src[j + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      j += 2;
    } else out += src[j++];
  }
  return [out, j + 1];
}

const LORE = /''\s*<span style="color:[^"]*">[\s\S]*?<\/span>\s*''|<span style="color:[^"]*">\s*''[\s\S]*?''\s*<\/span>/g;
const EDGE_BREAKS = /^(?:\s*<br\s*\/?>)+|(?:<br\s*\/?>\s*)+$/gi;
const stripLore = (desc) => desc.replace(LORE, '').trim().replace(EDGE_BREAKS, '').trim();

export function parseStatusData(lua) {
  const out = new Map();
  const src = lua.replace(/--\[\[[\s\S]*?\]\]/g, '');
  const re = /\[\s*(["'])((?:\\.|(?!\1).)*)\1\s*\]\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[2].replace(/\\(.)/g, '$1');
    let i = re.lastIndex;
    const fields = {};
    while (i < src.length) {
      while (/[\s,;]/.test(src[i])) i++;
      if (src[i] === '}') { i++; break; }
      if (src.startsWith('--', i)) { i = src.indexOf('\n', i); continue; }
      const f = src.slice(i).match(/^([A-Za-z_]\w*)\s*=\s*/);
      if (!f) { i++; continue; }
      i += f[0].length;
      if (src[i] === '"' || src[i] === "'" || src[i] === '[') {
        const [val, next] = readLuaString(src, i);
        fields[f[1]] = val;
        i = next;
      } else {
        const v = src.slice(i).match(/^[^,}\n]+/)[0];
        fields[f[1]] = v.trim();
        i += v.length;
      }
    }
    re.lastIndex = i;
    out.set(key, {
      name: (fields.dupename || fields.keywordname || key).replace(/<[^>]*>/g, '').trim(),
      desc: stripLore(fields.desc ?? ''),
      kind: fields.stype === 'd' ? 'debuff' : fields.stype === 'b' ? 'buff' : 'other',
    });
  }
  return out;
}

const SINNER_KEYS = {
  'yi sang': 'yi sang', faust: 'faust', 'don quixote': 'don quixote', ryoshu: 'ryoshu', 'ryōshū': 'ryoshu',
  meursault: 'mersault', 'hong lu': 'hong lu', heathcliff: 'heathcliff', ishmael: 'ishmael', rodion: 'rodion',
  sinclair: 'sinclair', outis: 'outis', gregor: 'gregor',
};
const SINS = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']);
const ATTACK_TYPES = new Set(['slash', 'pierce', 'blunt']);

const cleanName = (v) =>
  String(v ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]{0,80}>/g, '')
    .replace(/'''|''/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function parseIdentity(title, rawWikitext) {
  const wikitext = String(rawWikitext).replace(/<!--[\s\S]*?-->/g, '');
  const page = findTemplates(wikitext, 'IDPage')[0];
  if (!page) return null;
  const p = page.named;
  const sinner = SINNER_KEYS[String(p.sinner ?? '').replace(/\{\{|\}\}/g, '').trim().toLowerCase()];
  if (!sinner) return null;

  const skills = [];
  for (const [param, value] of Object.entries(p)) {
    const atk = param.match(/^skill(\d)(?:-(\d))?$/);
    const def = param.match(/^defense(\d?)$/);
    if (!atk && !def) continue;
    const block = findTemplates(value, 'UptieSkills')[0] ?? (value.startsWith('{{') ? parseTemplate(value) : null);
    if (!block) continue;
    const s = block.named;
    const coins = Math.max(1, num(s.coin) || 1);
    const ce = {};
    for (const [k, v] of Object.entries(s)) {
      const c = k.match(/^ce(\d+)$/);
      if (c) ce[Number(c[1])] = v;
    }
    const rawType = String(s.type ?? '').trim().toLowerCase();
    const sin = String(s.sin ?? '').trim().toLowerCase();
    const common = {
      param,
      name: cleanName(s.name),
      sin: SINS.has(sin) ? sin : 'wrath',
      coins,
      base: num(s.spower),
      coinPower: num(s.cpower),
      weight: num(s.atkweight) || 1,
      offense: num(s.atkmod ?? s.defmod),
      amt: s.amt === undefined ? null : num(s.amt),
      se: s.se ?? '',
      ce,
    };
    if (atk) {
      skills.push({ ...common, kind: 'attack', slot: Number(atk[1]), variant: atk[2] ? Number(atk[2]) : 1, type: ATTACK_TYPES.has(rawType) ? rawType : 'slash' });
    } else {
      const isCounter = ATTACK_TYPES.has(rawType);
      skills.push({
        ...common,
        kind: 'defense',
        slot: 0,
        variant: def[1] ? Number(def[1]) : 1,
        type: isCounter ? 'counter' : rawType === 'evade' ? 'evade' : 'guard',
        counterType: isCounter ? rawType : undefined,
      });
    }
  }
  skills.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'attack' ? -1 : 1) || a.slot - b.slot || a.variant - b.variant);

  const passives = [];
  for (const [param, kind] of [['passive0', 'battle'], ['passive1', 'battle'], ['passive2', 'support']]) {
    for (const t of findTemplates(p[param] ?? '', 'Passive')) {
      const [name, ...rest] = t.positional;
      const req = String(t.named.req ?? '').match(/(\d+)\s*(Owned|Res)/i);
      const sin = String(t.named.sin ?? '').trim().toLowerCase();
      passives.push({
        kind,
        name: cleanName(name),
        text: rest.join('|'),
        req: req && SINS.has(sin) ? { sin, count: Number(req[1]), type: /res/i.test(req[2]) ? 'res' : 'owned' } : null,
      });
    }
  }

  const gallery = [...wikitext.matchAll(/^([^|\n]+ Idle Sprite\.(?:png|webp|gif))\s*\|/gim)].map((m) => m[1].trim());
  const idle = gallery.find((f) => f === `${title} Idle Sprite.png`) ?? gallery[0] ?? null;

  return {
    id: slug(title),
    wikiNum: wikitext.match(/\[\[Category:Identity ID\|(\d+)/)?.[1] ?? null,
    title,
    name: cleanName(p.prefix ?? title),
    sinner,
    rarity: Math.max(1, Math.min(3, num(p.rarity) || 1)),
    season: String(p.season ?? '').trim(),
    released: String(p.releasedate ?? '').trim().replace(/\./g, '-') || null,
    traits: findTemplates(p.keyword ?? '', 'Keyword').map((t) => cleanName(t.positional[0])).filter(Boolean),
    skills,
    passives,
    idleSprite: idle,
  };
}

export async function fileUrls(files) {
  const out = new Map();
  const list = [...new Set(files.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: list.slice(i, i + 50).map((f) => `File:${f}`).join('|') });
    const norm = new Map((d.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query.pages)) {
      const url = p.imageinfo?.[0]?.url;
      if (!url) continue;
      const asked = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
      out.set(asked, url);
      out.set(p.title.replace(/^File:/, ''), url);
    }
  }
  return out;
}
