import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Seg, Skill, Statuses } from '../types';
import { guideHref } from '../route';

interface RichContext {
  statuses: Statuses;
  skills: Map<string, Skill>;
  openStatus: (id: string, label: string | undefined, anchor: HTMLElement, toggle?: boolean) => void;
  hoverStatus: (id: string, label: string | undefined, anchor: HTMLElement) => void;
  leaveStatus: () => void;
}

const Ctx = createContext<RichContext>({ statuses: {}, skills: new Map(), openStatus: () => {}, hoverStatus: () => {}, leaveStatus: () => {} });

const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 150;

export function scrollToSkill(label: string) {
  const el = document.getElementById(`skill-${label}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

export function RichProvider({ statuses, skills, children }: { statuses: Statuses; skills: Skill[]; children: ReactNode }) {
  const [pop, setPop] = useState<{ id: string; label?: string; x: number; y: number; below: boolean } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();

  const openStatus = useCallback((id: string, label: string | undefined, anchor: HTMLElement, toggle = true) => {
    window.clearTimeout(timer.current);
    const r = anchor.getBoundingClientRect();
    const below = r.bottom < window.innerHeight * 0.6;
    const next = { id, label, x: r.left + r.width / 2, y: below ? r.bottom : r.top, below };
    setPop((cur) => (toggle && cur?.id === id && cur.label === label ? null : next));
  }, []);

  const hoverStatus = useCallback(
    (id: string, label: string | undefined, anchor: HTMLElement) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => openStatus(id, label, anchor, false), HOVER_OPEN_MS);
    },
    [openStatus],
  );
  const leaveStatus = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPop(null), HOVER_CLOSE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!pop) return;
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'pointerdown' && popRef.current?.contains(e.target as Node)) return;
      if (e.type === 'pointerdown' && (e.target as HTMLElement).closest?.('.status')) return;
      setPop(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [pop]);

  const skillMap = new Map(skills.map((s) => [s.label, s]));
  const info = pop ? statuses[pop.id] : null;
  const width = pop ? Math.min(320, window.innerWidth - 24) : 0;
  const left = pop ? Math.max(12, Math.min(pop.x - width / 2, window.innerWidth - width - 12)) : 0;

  return (
    <Ctx.Provider value={{ statuses, skills: skillMap, openStatus, hoverStatus, leaveStatus }}>
      {children}
      {pop && (
        <div
          ref={popRef}
          className="popover"
          role="dialog"
          aria-label={info?.n ?? pop.id}
          onPointerEnter={(e) => e.pointerType === 'mouse' && window.clearTimeout(timer.current)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && leaveStatus()}
          style={{ left, width, ...(pop.below ? { top: pop.y + 8 } : { bottom: window.innerHeight - pop.y + 8 }) }}
        >
          <div className="popover-title">{pop.label ?? info?.n ?? pop.id}</div>
          {pop.label && info && pop.label !== info.n && <div className="popover-sub">{info.n}</div>}
          <div className="popover-body">{info?.d || 'No description in the data.'}</div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function StatusChip({ id, label, text }: { id: string; label?: string; text?: string }) {
  const { statuses, openStatus, hoverStatus, leaveStatus } = useContext(Ctx);
  const pointer = useRef('');
  const info = statuses[id];
  const name = text ?? label ?? info?.n ?? id;
  return (
    <button
      type="button"
      className="status"
      onPointerEnter={(e) => e.pointerType === 'mouse' && hoverStatus(id, label, e.currentTarget)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && leaveStatus()}
      onPointerDown={(e) => (pointer.current = e.pointerType)}
      onClick={(e) => {
        openStatus(id, label, e.currentTarget, pointer.current !== 'mouse');
        pointer.current = '';
      }}
    >
      {name}
    </button>
  );
}

export function SkillPill({ label }: { label: string }) {
  const { skills } = useContext(Ctx);
  const s = skills.get(label);
  return (
    <button
      type="button"
      className={`skpill ${s ? `sin-${s.sin}` : ''}`}
      title={s ? `${label}: ${s.name}` : label}
      onClick={() => scrollToSkill(label)}
    >
      {label}
    </button>
  );
}

export function CondLabel({ label, ids }: { label: string; ids?: string[] }) {
  const { statuses } = useContext(Ctx);
  const names = (ids ?? [])
    .map((id) => [id, statuses[id]?.n] as const)
    .filter((x): x is readonly [string, string] => !!x[1] && label.includes(x[1]))
    .sort((a, b) => b[1].length - a[1].length);
  if (!names.length) return <strong className="cond">{label}</strong>;
  const byName = new Map(names.map(([id, n]) => [n, id]));
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = label.split(new RegExp(`(${names.map(([, n]) => escape(n)).join('|')})`)).filter(Boolean);
  return (
    <strong className="cond">
      {parts.map((p, i) => {
        const id = byName.get(p);
        return id ? <StatusChip key={i} id={id} /> : p;
      })}
    </strong>
  );
}

function renderSeg(s: Seg, i: number): ReactNode {
  if (typeof s === 'string') return s;
  switch (s[0]) {
    case 't':
      return <span key={i} className="trig">[{s[1]}]</span>;
    case 's':
      return <StatusChip key={i} id={s[1]} label={s[2]} />;
    case 'g':
      return <StatusChip key={i} id={s[1]} text={s[2]} />;
    case 'p':
      return <span key={i} className="pow">{s[1]}</span>;
    case 'i':
      return <a key={i} className="ref" href={guideHref(s[1])}>{s[2]}</a>;
    case 'r':
      return <span key={i} className="trait">{s[1]}</span>;
    case 'sk':
      return <SkillPill key={i} label={s[1]} />;
    case 'b':
      return <CondLabel key={i} label={s[1]} ids={s[2]?.split('|')} />;
    default:
      return s[s.length - 1];
  }
}

export function Rich({ segs }: { segs: Seg[] }) {
  return <>{segs.map(renderSeg)}</>;
}
