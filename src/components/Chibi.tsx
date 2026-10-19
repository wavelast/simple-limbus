import type { CSSProperties } from 'react';
import { artUrl } from '../data';
import type { Frame } from '../types';

export function frameStyle([cx, top, full, aspect, head = top]: Frame, ratio: number, body = 0.88, pad = 0.06, fromHead = false): CSSProperties {
  const h = (body * ratio) / full;
  const w = h * aspect;
  return {
    position: 'absolute',
    width: `${w * 100}%`,
    height: 'auto',
    maxWidth: 'none',
    left: `${(0.5 - cx * w) * 100}%`,
    top: `${((pad * ratio - (fromHead ? head : top) * h) / ratio) * 100}%`,
  };
}

export function FramedChibi({ e, ratio, body, pad, fromHead, className = '' }: { e: { id: string; chibi: boolean; sinner: string; frame: Frame | null }; ratio: number; body?: number; pad?: number; fromHead?: boolean; className?: string }) {
  return (
    <img
      className={`${className} ${e.frame ? 'framed' : ''}`}
      src={artUrl(e)}
      style={e.frame ? frameStyle(e.frame, ratio, body, pad, fromHead) : undefined}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

export function HeroChibi({ e }: { e: { id: string; chibi: boolean; sinner: string; frame: Frame | null } }) {
  if (!e.chibi || !e.frame) return <img className="hero-art" src={artUrl(e)} alt="" width={220} height={300} />;
  const [cx, top, full, aspect] = e.frame;
  const BODY = 0.88;
  const AIR = 0.04;
  const h = BODY / full;
  const w = h * aspect;
  const boxW = Math.max(w + 2 * AIR, 0.7);
  const hh = (x: number) => `calc(var(--h) * ${x.toFixed(4)})`;
  const left = w + 2 * AIR <= 0.7 ? `calc(50% - ${hh(w / 2)})` : `clamp(calc(100% - ${hh(w + AIR)}), calc(50% - ${hh(cx * w)}), ${hh(AIR)})`;
  return (
    <div className="hero-art framed" style={{ width: `calc(${hh(boxW)} + 2px)` }}>
      <img src={artUrl(e)} alt="" style={{ height: hh(h), left, top: hh(h <= 1 ? (1 - h) / 2 : 0.06 - top * h) }} />
    </div>
  );
}
