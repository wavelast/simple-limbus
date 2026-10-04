export function taggedText(line) {
  return line.segs
    .map((s) => {
      if (typeof s === 'string') return s;
      switch (s[0]) {
        case 's': return `⟦${s[1]}⟧`;
        case 't': return `[${s[1]}]`;
        case 'i': return s[2];
        default: return s[1];
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
