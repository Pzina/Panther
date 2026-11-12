import { app } from '../../app';
import { formatNumber, t } from '../../core/i18n';
import { getSpecies } from '../../data/species';
import type { CaughtFish } from '../../data/types';
import { rarityRank } from '../../systems/fishing';
import { button, clear, h } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { emptyState } from '../widgets';
import { fishRow, lockButton } from './fishRow';

type Sort = 'value' | 'rarity' | 'size';
let lastSort: Sort = 'value';

function sorted(list: CaughtFish[], sort: Sort): CaughtFish[] {
  const copy = [...list];
  if (sort === 'value') copy.sort((a, b) => b.value - a.value);
  else if (sort === 'size') copy.sort((a, b) => b.size - a.size);
  else copy.sort((a, b) => rarityRank(getSpecies(b.speciesId).rarity) - rarityRank(getSpecies(a.speciesId).rarity) || b.value - a.value);
  return copy;
}

export function creelScreen(): Screen {
  const game = app.game;
  const shell = screenShell(t('creel.title'), 'net');
  const render = (): void => {
    const body = shell.body;
    clear(body);
    clear(shell.right);
    const creel = game.state.creel;
    shell.right.append(h('div', { class: 'chip' }, t('creel.capacity', { n: creel.length, max: game.stats().creelSize })));
    const atPort = app.ui.mode === 'port';
    const sortBar = h(
      'div',
      { class: 'segmented', role: 'group', 'aria-label': 'Tri' },
      ...(['value', 'rarity', 'size'] as Sort[]).map((s) =>
        h('button', { class: `seg${lastSort === s ? ' is-active' : ''}`, type: 'button', 'aria-pressed': String(lastSort === s), onclick: () => { lastSort = s; render(); } }, t(`creel.sort.${s}`)),
      ),
    );
    if (creel.length === 0) {
      body.append(emptyState('net', t('creel.empty')));
      return;
    }
    const sellable = creel.filter((f) => !f.locked);
    const total = sellable.reduce((sum, f) => sum + game.priceOf(f), 0);
    body.append(
      h('div', { class: 'toolbar' }, h('span', { class: 'sort-label' }, h('span', { class: 'ico-sort' }), t('creel.total', { n: formatNumber(total) })), sortBar),
      atPort
        ? button(t('shop.sellAll', { n: sellable.length }), () => {
            const coins = game.sellAll();
            if (coins > 0) {
              app.audio.sfx('coins');
              app.ui.toast(t('shop.sold', { n: formatNumber(coins) }), 'good', 'coin');
              app.save();
            }
            render();
          }, { kind: 'gold', icon: 'coin', disabled: sellable.length === 0, id: 'creel-sell-all' })
        : h('p', { class: 'muted' }, t('creel.sellAtPort')),
      h(
        'div',
        { class: 'list' },
        ...sorted(creel, lastSort).map((fish) =>
          fishRow(fish, [
            lockButton(fish, render),
            atPort
              ? button(t('shop.sell'), () => {
                  const coins = game.sellFish(fish.uid);
                  app.audio.sfx('coins');
                  app.ui.toast(t('shop.sold', { n: formatNumber(coins) }), 'good', 'coin');
                  app.save();
                  render();
                }, { small: true, disabled: fish.locked })
              : button(t('creel.release'), () => {
                  game.releaseFish(fish);
                  app.audio.sfx('release');
                  app.save();
                  render();
                }, { small: true, disabled: fish.locked }),
          ]),
        ),
      ),
    );
  };
  render();
  return { id: 'creel', el: shell.el, refresh: render };
}
