import { app } from '../../app';
import { t } from '../../core/i18n';
import { getSpecies } from '../../data/species';
import type { CaughtFish } from '../../data/types';
import { h, iconButton } from '../dom';
import { coinTag, fishArt, fishLabel, formatSize, formatWeight, rarityTag } from '../widgets';

/** One fish of the creel with its actions. */
export function fishRow(fish: CaughtFish, actions: HTMLElement[]): HTMLElement {
  const species = getSpecies(fish.speciesId);
  return h(
    'div',
    { class: `row fish-row${fish.locked ? ' is-locked' : ''}`, 'data-uid': fish.uid },
    fishArt(species, fish.variant, true, 'fish-thumb'),
    h(
      'div',
      { class: 'row-main' },
      h('b', null, fishLabel(fish, species)),
      h(
        'span',
        { class: 'row-sub' },
        rarityTag(species.rarity),
        ` ${formatSize(fish.size)} · ${formatWeight(fish.weight)}`,
      ),
      coinTag(app.game.priceOf(fish)),
    ),
    h('div', { class: 'row-actions' }, ...actions),
  );
}

export function lockButton(fish: CaughtFish, after: () => void): HTMLButtonElement {
  const btn = iconButton(
    fish.locked ? 'lock' : 'unlock',
    fish.locked ? t('creel.unlock') : t('creel.lock'),
    () => {
      app.game.toggleLock(fish.uid);
      after();
    },
    `lock-btn${fish.locked ? ' is-on' : ''}`,
  );
  btn.setAttribute('aria-pressed', String(fish.locked));
  return btn;
}
