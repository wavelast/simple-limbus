function templateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function splitParams(inner) {
  const parts = [];
  let depth = 0;
  let link = 0;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === '{{') { depth++; cur += two; i++; continue; }
    if (two === '}}') { depth--; cur += two; i++; continue; }
    if (two === '[[') { link++; cur += two; i++; continue; }
    if (two === ']]') { link--; cur += two; i++; continue; }
    if (inner[i] === '|' && depth === 0 && link === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += inner[i];
  }
  parts.push(cur);
  return parts;
}

export function parseTemplate(raw) {
  const inner = raw.slice(2, -2);
  const [name, ...params] = splitParams(inner);
  const positional = [];
  const named = {};
  for (const p of params) {
    const m = p.match(/^\s*([\w -]+?)\s*=([\s\S]*)$/);
    if (m && !/[{[]/.test(m[1])) named[m[1].trim()] = m[2].trim();
    else positional.push(p.trim());
  }
  return { name: name.trim(), positional, named };
}

export function findTemplates(text, name) {
  const out = [];
  const re = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[|}]`, 'g');
  for (const m of text.matchAll(re)) {
    const end = templateEnd(text, m.index);
    if (end !== -1) out.push(parseTemplate(text.slice(m.index, end)));
  }
  return out;
}

export const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const POWER_WORDS = { coin: 'Coin Power', clash: 'Clash Power', final: 'Final Power', base: 'Base Power' };
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&ndash;': '–', '&mdash;': '—' };

export function wikiToLines(raw, ctx, coin = null) {
  if (!raw) return [];
  let text = String(raw);
  for (const [k, v] of Object.entries(ENTITIES)) text = text.split(k).join(v);
  text = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .replace(/<[^>]{0,120}>/g, '')
    .replace(/'''|''/g, '');

  const lines = [];
  for (let line of text.split('\n')) {
    line = line.trim();
    if (!line) continue;
    const segs = lineSegs(line, ctx);
    const plain = segsPlain(segs, ctx);
    if (!plain || /^[-·•.,;:|]+$/.test(plain)) continue;
    lines.push({ coin, segs, plain });
  }
  return lines;
}

function lineSegs(line, ctx) {
  const segs = [];
  const pushText = (t) => {
    if (!t) return;
    let last = 0;
    for (const m of t.matchAll(/\b(Coin|Clash|Final|Base) Power ?([+-] ?\d+)/g)) {
      pushRaw(t.slice(last, m.index));
      segs.push(['p', `${m[2].replace(/\s+/g, '')} ${POWER_WORDS[m[1].toLowerCase()]}`]);
      last = m.index + m[0].length;
    }
    pushRaw(t.slice(last));
  };
  const pushRaw = (t) => {
    if (!t) return;
    if (typeof segs[segs.length - 1] === 'string') segs[segs.length - 1] += t;
    else segs.push(t);
  };

  let i = 0;
  while (i < line.length) {
    const tStart = line.indexOf('{{', i);
    const lStart = line.indexOf('[[', i);
    const next = [tStart, lStart].filter((x) => x !== -1).sort((a, b) => a - b)[0];
    if (next === undefined) {
      pushText(line.slice(i));
      break;
    }
    pushText(line.slice(i, next));
    if (next === tStart) {
      const end = templateEnd(line, tStart);
      if (end === -1) {
        pushText(line.slice(tStart));
        break;
      }
      const t = parseTemplate(line.slice(tStart, end));
      const name = t.name.toLowerCase();
      if (name === 'statuseffect') {
        const key = t.positional[0] ?? '';
        segs.push(['s', ctx.statusKey(key)]);
      } else if (name === 'skillcon') {
        segs.push(['t', t.positional[0] ?? '']);
      } else if (name === 'keyword') {
        segs.push(['r', t.positional[0] ?? '']);
      } else {
        pushText(t.positional[t.positional.length - 1] ?? t.positional[0] ?? '');
      }
      i = end;
    } else {
      const end = line.indexOf(']]', lStart);
      if (end === -1) {
        pushText(line.slice(lStart));
        break;
      }
      const [target, label] = line.slice(lStart + 2, end).split('|');
      const id = ctx.identityId?.(target.trim());
      if (id) segs.push(['i', id, (label ?? target).trim()]);
      else pushText((label ?? target.replace(/^[^:]*:/, '')).trim());
      i = end + 2;
    }
  }
  return segs
    .map((s, idx) => {
      if (typeof s !== 'string') return s;
      let t = s.replace(/[ \t]+/g, ' ');
      if (idx === 0) t = t.trimStart();
      if (idx === segs.length - 1) t = t.trimEnd();
      return t;
    })
    .filter((s) => s !== '');
}

function segsPlain(segs, ctx) {
  return segs
    .map((s) => {
      if (typeof s === 'string') return s;
      if (s[0] === 't') return `[${s[1]}]`;
      if (s[0] === 's') return ctx.statusName?.(s[1]) ?? s[1];
      if (s[0] === 'i') return s[2];
      return s[1];
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
