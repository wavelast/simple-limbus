import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(DIST, 'data');
const SSR = path.join(ROOT, 'dist-ssr', 'entry-server.js');
const SITE = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, '/') : null;
const GOATCOUNTER = process.env.GOATCOUNTER?.trim() || null;
const NAME = 'Simple Limbus';

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function plain(segs, statuses) {
  return segs
    .map((s) => {
      if (typeof s === 'string') return s;
      if (s[0] === 's') return s[2] ?? statuses[s[1]]?.n ?? s[1];
      if (s[0] === 'g' || s[0] === 'i') return s[2];
      return s[1];
    })
    .join('');
}

function clip(text, max = 200) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function page(template, { base, title, description, url, image, noindex, body, guide }) {
  const tags = [
    base && `<base href="${esc(base)}" />`,
    noindex && '<meta name="robots" content="noindex" />',
    `<meta property="og:site_name" content="${NAME}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    url && `<meta property="og:url" content="${esc(url)}" />`,
    url && `<link rel="canonical" href="${esc(url)}" />`,
    image && `<meta property="og:image" content="${esc(image)}" />`,
    '<meta name="twitter:card" content="summary" />',
    GOATCOUNTER && `<script data-goatcounter="https://${esc(GOATCOUNTER)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`,
  ].filter(Boolean);
  return template
    .replace(/<meta charset="UTF-8" \/>/, (m) => `${m}\n    ${tags.join('\n    ')}`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title === NAME ? NAME : `${title} - ${NAME}`)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace('<div id="root"></div>', () => `<div id="root"${guide ? ` data-guide="${esc(guide)}"` : ''}>${body ?? ''}</div>`);
}

async function main() {
  const template = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');
  const index = await readJson(path.join(DATA, 'index.json'));
  const statuses = await readJson(path.join(DATA, 'statuses.json'));
  const siteDescription = template.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? NAME;
  const { render } = await import(pathToFileURL(SSR).href);
  const root = SITE ? new URL(SITE).pathname : '';

  const home = render({ root, path: root, index, statuses });
  await fs.writeFile(path.join(DIST, 'index.html'), page(template, { title: NAME, description: siteDescription, url: SITE, body: home }));

  let n = 0;
  for (const e of index.identities) {
    if (!e.num) continue;
    const g = await readJson(path.join(DATA, 'guides', `${e.id}.json`));
    const title = `${g.name} ${g.sinnerName}`;
    const tldr = g.plan.summary.map((b) => plain(b, statuses).replace(/\.?$/, '.')).join(' ');
    const dir = path.join(DIST, 'id', e.num);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'index.html'),
      page(template, {
        base: '../../',
        title,
        description: clip(`${g.sinnerName} identity guide. ${tldr}`),
        url: SITE && `${SITE}id/${e.num}/`,
        image: SITE && e.chibi ? `${SITE}img/chibi/${e.id}.webp` : null,
        body: render({ root, path: `${root}id/${e.num}/`, index, statuses, guide: g }),
        guide: e.id,
      }),
    );
    n++;
  }

  if (SITE) {
    await fs.writeFile(
      path.join(DIST, '404.html'),
      page(template, { base: new URL(SITE).pathname, title: NAME, description: siteDescription, noindex: true }),
    );
  }
  console.log(`Wrote ${n} identity pages${SITE ? ` and a 404 page for ${SITE}` : ' (set SITE_URL for link-preview images, canonical links and a 404 page)'}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
