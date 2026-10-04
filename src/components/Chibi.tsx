import type { CSSProperties } from 'react';
import { artUrl } from '../data';
import type { Frame } from '../types';

export function frameStyle([cx, top, full, aspect]: Frame, ratio: number, body = 0.88, pad = 0.06): CSSProperties {
  const MAX_W = 1.9;
  const h = Math.min((body * ratio) / full, MAX_W / aspect);
  const w = h * aspect;
  return {
    position: 'absolute',
    width: `${w * 100}%`,
    height: 'auto',
    maxWidth: 'none',
    left: `${(0.5 - cx * w) * 100}%`,
    top: `${((pad * ratio - top * h) / ratio) * 100}%`,
  };
}

export function FramedChibi({ e, ratio, body, pad, className = '' }: { e: { id: string; chibi: boolean; sinner: string; frame: Frame | null }; ratio: number; body?: number; pad?: number; className?: string }) {
  return (
    <img
      className={`${className} ${e.frame ? 'framed' : ''}`}
      src={artUrl(e)}
      style={e.frame ? frameStyle(e.frame, ratio, body, pad) : undefined}
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
    <div className="hero-art framed" style={{ width: hh(boxW) }}>
      <img src={artUrl(e)} alt="" style={{ height: hh(h), left, top: hh(0.06 - top * h) }} />
    </div>
  );
}
