import { useLayoutEffect, useRef, useState } from 'react';
import { loadGuide, peekGuide, useAsync } from '../data';
import type { Statuses } from '../types';
import { Rich, RichProvider } from './Rich';

const WIDTH = 340;
const GAP = 10;
const EDGE = 8;

export default function TldrPreview({ id, anchor, statuses }: { id: string; anchor: DOMRect; statuses: Statuses }) {
  const { data: g } = useAsync(() => loadGuide(id), [id], () => peekGuide(id));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top = anchor.top;
    if (anchor.right + GAP + WIDTH <= vw - EDGE) left = anchor.right + GAP;
    else if (anchor.left - GAP - WIDTH >= EDGE) left = anchor.left - GAP - WIDTH;
    else {
      left = Math.min(Math.max(anchor.left, EDGE), vw - WIDTH - EDGE);
      top = anchor.bottom + GAP;
    }
    setPos({ left, top: Math.max(EDGE, Math.min(top, vh - h - EDGE)) });
  }, [anchor, g]);

  return (
    <div ref={ref} className="tldr-pop" role="tooltip" style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? 0 }}>
      <div className="tldr-pop-head">tl;dr</div>
      {g ? (
        <RichProvider statuses={statuses} skills={g.skills}>
          <ul className="summary tldr">
            {g.plan.summary.map((b, i) => (
              <li key={i}>
                <Rich segs={b} />
              </li>
            ))}
          </ul>
        </RichProvider>
      ) : (
        <p className="tldr-pop-loading">Loading…</p>
      )}
    </div>
  );
}
