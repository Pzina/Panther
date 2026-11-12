import { app } from '../../app';
import { BALANCE } from '../../config/balance';
import type { CatchResult } from '../../core/game';
import { t } from '../../core/i18n';
import { button, h } from '../dom';
import { coinTag, fishArt, formatSize, formatWeight, nameOf, rarityTag } from '../widgets';

export type CatchChoice = 'keep' | 'later' | 'release';

/** Result card shown after a catch. Resolves with what the player decides to do with the fish. */
export function showCatchCard(result: CatchResult): Promise<CatchChoice> {
  return new Promise((resolve) => {
    const game = app.game;
    const { fish, species } = result;
    const full = game.creelFull();
    let choice: CatchChoice | null = null;
    const choose = (value: CatchChoice): void => {
      choice = value;
      close();
    };
    const tags = h(
      'div',
      { class: 'catch-tags' },
      result.isNew ? h('span', { class: 'tag tag-new' }, t('catch.new')) : null,
      !result.isNew && (result.recordSize || result.recordWeight) ? h('span', { class: 'tag tag-record' }, t('catch.record')) : null,
      fish.variant !== 'normal' ? h('span', { class: 'tag tag-variant' }, t('catch.variant', { name: t(`variant.${fish.variant}`) })) : null,
    );
    const content = h(
      'div',
      { class: `catch-card rarity-border-${species.rarity}`, id: 'catch-card', 'data-species': species.id },
      h('div', { class: 'catch-title' }, t('catch.title')),
      h('div', { class: `catch-art rarity-bg-${species.rarity}` }, fishArt(species, fish.variant)),
      tags,
      h('h2', { class: 'catch-name' }, nameOf(species)),
      rarityTag(species.rarity),
      h(
        'dl',
        { class: 'catch-stats' },
        h('div', null, h('dt', null, t('catch.size')), h('dd', null, formatSize(fish.size))),
        h('div', null, h('dt', null, t('catch.weight')), h('dd', null, formatWeight(fish.weight))),
        h('div', null, h('dt', null, t('catch.value')), h('dd', null, coinTag(game.priceOf(fish)))),
      ),
      h('div', { class: 'catch-xp' }, t('catch.xp', { n: result.xp })),
      h('p', { class: 'catch-flavor' }, species.flavor),
      full ? h('p', { class: 'catch-full' }, t('catch.full', { n: game.state.creel.length, max: game.stats().creelSize })) : null,
      h(
        'div',
        { class: 'catch-actions' },
        button(t('catch.later'), () => choose('later'), { kind: 'primary', icon: 'net', disabled: full, id: 'catch-later' }),
        h(
          'div',
          { class: 'catch-row' },
          button(t('catch.keep'), () => choose('keep'), { icon: 'lock', disabled: full, id: 'catch-keep', label: `${t('catch.keep')} — ${t('catch.keepHint')}` }),
          button(t('catch.release'), () => choose('release'), {
            icon: 'heart',
            id: 'catch-release',
            label: `${t('catch.release')} — ${t('catch.releaseHint', { n: BALANCE.reputation.release })}`,
          }),
        ),
        h('p', { class: 'catch-hint' }, `${t('catch.keep')} : ${t('catch.keepHint').toLowerCase()} · ${t('catch.release')} : ${t('catch.releaseHint', { n: BALANCE.reputation.release })}`),
      ),
    );
    // Closing with the back button keeps the fish when possible.
    const close = app.ui.modal(content, {
      cls: 'modal-catch',
      onClose: () => resolve(choice ?? (full ? 'release' : 'later')),
    });
  });
}
