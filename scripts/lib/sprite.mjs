const WORK = 360;
const ALPHA = 64;

function erode(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run = mask[y * w + x] ? run + 1 : 0;
      if (x >= 2 * r && run >= 2 * r + 1) tmp[y * w + (x - r)] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y < h; y++) {
      run = tmp[y * w + x] ? run + 1 : 0;
      if (y >= 2 * r && run >= 2 * r + 1) out[(y - r) * w + x] = 1;
    }
  }
  return out;
}

function bodyBox(mask, w, h) {
  const r = Math.max(3, Math.round(Math.max(w, h) / 70));
  const core = erode(mask, w, h, r);

  const cols = new Float64Array(w);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) cols[x] += core[y * w + x];
  const win = Math.max(3, Math.round(w / 40));
  const smooth = cols.map((_, x) => {
    let sum = 0;
    let n = 0;
    for (let i = Math.max(0, x - win); i <= Math.min(w - 1, x + win); i++) {
      sum += cols[i];
      n++;
    }
    return sum / n;
  });
  let mass = 0;
  let cx = 0;
  for (let x = 0; x < w; x++) {
    mass += cols[x];
    cx += x * cols[x];
  }
  if (!mass) return null;
  cx /= mass;
  const sigma = 0.3 * w;
  let peak = 0;
  let peakScore = -1;
  for (let x = 0; x < w; x++) {
    const score = smooth[x] * Math.exp(-(((x - cx) / sigma) ** 2));
    if (score > peakScore) {
      peakScore = score;
      peak = x;
    }
  }
  if (!smooth[peak]) return null;

  const keep = smooth[peak] * 0.28;
  let x0 = peak;
  let x1 = peak;
  while (x0 > 0 && smooth[x0 - 1] >= keep) x0--;
  while (x1 < w - 1 && smooth[x1 + 1] >= keep) x1++;

  const rows = new Uint8Array(h);
  for (let y = 0; y < h; y++) for (let x = x0; x <= x1; x++) if (core[y * w + x]) { rows[y] = 1; break; }
  let best = [0, -1];
  let start = -1;
  const gap = Math.round(h / 30);
  let lastOn = -Infinity;
  for (let y = 0; y <= h; y++) {
    if (y < h && rows[y]) {
      if (start === -1 || y - lastOn > gap) start = y;
      lastOn = y;
      if (lastOn - start > best[1] - best[0]) best = [start, lastOn];
    }
  }
  if (best[1] < best[0]) return null;
  let fullTop = h;
  let fullBottom = -1;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = x0; x <= x1; x++) n += mask[y * w + x];
    if (n >= 2) {
      fullTop = Math.min(fullTop, y);
      fullBottom = y;
    }
  }
  return {
    left: Math.max(0, x0 - r),
    top: Math.max(0, best[0] - r),
    right: Math.min(w - 1, x1 + r),
    bottom: Math.min(h - 1, best[1] + r),
    fullHeight: Math.max(fullBottom - fullTop, best[1] - best[0] + 2 * r),
  };
}

export async function bodyFrame(input, sharp) {
  const trimmed = await sharp(input).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = trimmed.info;
  const scale = Math.min(1, WORK / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const { data } = await sharp(trimmed.data).resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] >= ALPHA ? 1 : 0;
  const box = bodyBox(mask, w, h);
  if (!box) return null;
  const round = (v) => Math.round(v * 1000) / 1000;
  return [round((box.left + box.right) / 2 / w), round(box.top / h), round(Math.min(1, box.fullHeight / h)), round(W / H)];
}
