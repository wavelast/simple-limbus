import { iconUrl } from '../data';
import type { Sin } from '../types';

export const SIN_NAMES: Record<Sin, string> = {
  wrath: 'Wrath', lust: 'Lust', sloth: 'Sloth', gluttony: 'Gluttony', gloom: 'Gloom', pride: 'Pride', envy: 'Envy',
};

export const TYPE_NAMES: Record<string, string> = {
  slash: 'Slash', pierce: 'Pierce', blunt: 'Blunt', guard: 'Guard', evade: 'Evade', counter: 'Counter',
};

export function SinIcon({ sin, size = 18 }: { sin: Sin; size?: number }) {
  return <img className="icon" src={iconUrl(`sin-${sin}`)} width={size} height={size} alt={SIN_NAMES[sin]} title={SIN_NAMES[sin]} />;
}

export function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const name = ['slash', 'pierce', 'blunt'].includes(type) ? `atk-${type}` : `def-${type}`;
  return <img className="icon" src={iconUrl(name)} width={size} height={size} alt={TYPE_NAMES[type] ?? type} title={TYPE_NAMES[type] ?? type} />;
}

export function Rarity({ n }: { n: number }) {
  return (
    <span className={`rarity r${n}`} aria-label={`${n}-star`} title={`${'0'.repeat(n)} rarity`}>
      {'0'.repeat(n)}
    </span>
  );
}
