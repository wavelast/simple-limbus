export type Seg = string | [string, string] | [string, string, string];

export interface Line {
  coin: number | null;
  segs: Seg[];
}

export interface Cond {
  key: string;
  label: string;
  statuses?: string[];
}

export type UnlockMode = 'transform' | 'replace' | 'add' | 'exclusive' | 'auto' | 'mention' | 'note' | 'custom';

export interface Unlock {
  mode: UnlockMode;
  conds: Cond[];
  line: Seg[];
  from: string[];
  status?: string;
}

export type Sin = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy';

export interface Skill {
  label: string;
  kind: 'attack' | 'defense';
  name: string;
  sin: Sin;
  type: string;
  counterType?: string;
  aoe?: { min: number; max: number | null };
  simple: Seg[] | null;
  unlock: Unlock[];
  lines: Line[];
}

export interface Passive {
  kind: 'battle' | 'support';
  name: string;
  lines: Line[];
  simple: Seg[] | null;
  req: { sin: Sin; count: number; type: 'owned' | 'res' } | null;
}

export interface Plan {
  summary: Seg[][];
}

export interface Guide {
  id: string;
  num: string | null;
  name: string;
  sinner: string;
  sinnerName: string;
  rarity: number;
  chibi: boolean;
  frame: Frame | null;
  wiki: string;
  keywords: string[];
  skills: Skill[];
  passives: Passive[];
  plan: Plan;
  teammates?: TeamGroup[];
}

export type Frame = [number, number, number, number];

export interface TeamGroup {
  kind: 'named' | 'faction' | 'keyword';
  title: string;
  items: { id: string; why?: { whose: 'its' | 'their'; where: string; segs: Seg[] }[] }[];
}

export interface IndexEntry {
  id: string;
  num: string | null;
  name: string;
  sinner: string;
  rarity: number;
  chibi: boolean;
  frame: Frame | null;
  keywords: string[];
  unlocks: number;
}

export interface IndexFile {
  updated: string;
  identities: IndexEntry[];
}

export type Statuses = Record<string, { n: string; d: string }>;
