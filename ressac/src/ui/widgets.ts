import { fishSvg } from '../art/fish';
import { raritySvg } from '../art/icons';
import { formatNumber, loc, t } from '../core/i18n';
import { getItem } from '../data/equipment';
import type { CaughtFish, Rarity, Reward, Species, VariantId } from '../data/types';
import { getZone } from '../data/zones';
import { h, icon } from './dom';

/** Localised name / description of a piece of content (species, item, zone…). */
export function nameOf(obj: { id: string; name: string }): string {
  return loc(obj.id, 'name', obj.name);
}
export function descOf(obj: { id: string; description: string }): string {
  return loc(obj.id, 'description', obj.description);
}

export function coinTag(amount: number, cls = ''): HTMLSpanElement {
  return h('span', { class: `coin-tag ${cls}`.trim() }, icon('coin'), h('b', null, formatNumber(amount)));
}

/** Rarity label: coloured shape + text, never colour alone. */
export function rarityTag(rarity: Rarity): HTMLSpanElement {
  return h(
    'span',
    { class: `rarity-tag rarity-${rarity}` },
    h('span', { class: 'rarity-ico', html: raritySvg(rarity, 16) }),
    t(`rarity.${rarity}`),
  );
}

export function fishArt(species: Species, variant: VariantId = 'normal', known = true, cls = ''): HTMLDivElement {
  return h('div', {
    class: `fish-art ${known ? '' : 'is-unknown'} ${cls}`.trim(),
    html: fishSvg(species.art, { key: species.id, variant, silhouette: !known, still: document.body.classList.contains('reduced-motion') }),
  });
}

export function formatSize(cm: number): string {
  return t('common.cm', { n: cm >= 100 ? Math.round(cm) : cm.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) });
}

export function formatWeight(kg: number): string {
  if (kg < 1) return t('common.g', { n: Math.max(1, Math.round(kg * 1000)) });
  return t('common.kg', { n: kg.toLocaleString('fr-FR', { maximumFractionDigits: kg < 10 ? 2 : 1 }) });
}

export function fishLabel(fish: CaughtFish, species: Species): string {
  const variant = fish.variant === 'normal' ? '' : ` (${t(`variant.${fish.variant}`)})`;
  return `${nameOf(species)}${variant}`;
}

/** Human-readable list of what a reward contains. */
export function rewardParts(reward: Reward): string[] {
  const parts: string[] = [];
  if (reward.coins) parts.push(t('reward.coins', { n: formatNumber(reward.coins) }));
  if (reward.xp) parts.push(t('reward.xp', { n: reward.xp }));
  for (const [id, count] of Object.entries(reward.baits ?? {})) {
    parts.push(t('reward.bait', { n: count, name: nameOf(getItem(id)) }));
  }
  if (reward.unlockZone) parts.push(t('reward.zone', { name: nameOf(getZone(reward.unlockZone)) }));
  if (reward.reputation) parts.push(t('reward.reputation', { n: reward.reputation }));
  return parts;
}

export function rewardLine(reward: Reward): HTMLDivElement {
  return h('div', { class: 'reward-line' }, icon('gift'), h('span', null, rewardParts(reward).join(' · ')));
}

export function emptyState(iconName: string, text: string): HTMLDivElement {
  return h('div', { class: 'empty' }, icon(iconName), h('p', null, text));
}
