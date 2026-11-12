import { app } from '../../app';
import { portraitSvg } from '../../art/portraits';
import { formatNumber, t } from '../../core/i18n';
import { BAITS, getBait, getBoat, getHook, getItem, getLine, getReel, getRod, itemsOf } from '../../data/equipment';
import { getStoryMission } from '../../data/missions';
import type { Bait, CosmeticSlot, Item, ItemCategory } from '../../data/types';
import { craftIngredients, lockReason } from '../../systems/economy';
import { button, clear, h, icon } from '../dom';
import { endTutorial } from '../hud';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { coinTag, descOf, emptyState, nameOf } from '../widgets';
import { fishRow, lockButton } from './fishRow';

type Tab = 'sell' | Exclude<ItemCategory, never>;
const TABS: { id: Tab; icon: string }[] = [
  { id: 'sell', icon: 'coin' },
  { id: 'bait', icon: 'bait' },
  { id: 'rod', icon: 'rod' },
  { id: 'reel', icon: 'reel' },
  { id: 'line', icon: 'line' },
  { id: 'hook', icon: 'hook' },
  { id: 'boat', icon: 'boat' },
  { id: 'cosmetic', icon: 'shirt' },
];

interface Stat {
  label: string;
  value: number;
  current: number;
  format: (v: number) => string;
  /** Lower is better (bite delay, travel time). */
  inverse?: boolean;
}

const pct = (v: number): string => `${Math.round(v * 100)} %`;
const plusPct = (v: number): string => `+${Math.round(v * 100)} %`;

function statsOf(item: Item): Stat[] {
  const eq = app.game.state.equipment;
  switch (item.category) {
    case 'rod': {
      const cur = getRod(eq.rod);
      return [
        { label: t('stat.reach'), value: item.reach, current: cur.reach, format: pct },
        { label: t('stat.luck'), value: item.luck, current: cur.luck, format: plusPct },
        { label: t('stat.control'), value: item.control, current: cur.control, format: plusPct },
      ];
    }
    case 'reel': {
      const cur = getReel(eq.reel);
      return [
        { label: t('stat.speed'), value: item.speed, current: cur.speed, format: (v) => `×${v.toFixed(2)}` },
        { label: t('stat.smooth'), value: item.smooth, current: cur.smooth, format: plusPct },
      ];
    }
    case 'line': {
      const cur = getLine(eq.line);
      return [{ label: t('stat.strength'), value: item.strength, current: cur.strength, format: (v) => `×${v.toFixed(2)}` }];
    }
    case 'hook': {
      const cur = getHook(eq.hook);
      return [
        { label: t('stat.window'), value: item.window, current: cur.window, format: (v) => `+${v.toFixed(2)} s` },
        { label: t('stat.hold'), value: item.hold, current: cur.hold, format: (v) => `×${v.toFixed(2)}` },
      ];
    }
    case 'boat': {
      const cur = getBoat(eq.boat);
      return [
        { label: t('stat.creel'), value: item.creel, current: cur.creel, format: (v) => String(v) },
        { label: t('stat.travel'), value: item.travel, current: cur.travel, format: pct, inverse: true },
      ];
    }
    case 'bait':
      return [
        { label: t('stat.bite'), value: item.speed, current: 1, format: (v) => (v < 1 ? `-${Math.round((1 - v) * 100)} %` : '='), inverse: true },
        { label: t('stat.luck'), value: item.luck, current: 0, format: plusPct },
      ];
    default:
      return [];
  }
}

function statList(item: Item, compare: boolean): HTMLElement {
  return h(
    'ul',
    { class: 'stats' },
    ...statsOf(item).map((s) => {
      const diff = s.value - s.current;
      const better = s.inverse ? diff < -1e-9 : diff > 1e-9;
      const worse = s.inverse ? diff > 1e-9 : diff < -1e-9;
      return h(
        'li',
        { class: compare ? (better ? 'is-better' : worse ? 'is-worse' : '') : '' },
        h('span', null, s.label),
        h('b', null, s.format(s.value)),
        compare && (better || worse) ? h('i', { 'aria-label': better ? 'mieux' : 'moins bien' }, icon(better ? 'level' : 'minus')) : null,
      );
    }),
  );
}

export function lockText(item: Item): string | null {
  const reason = lockReason(app.game.state, item);
  if (!reason) return null;
  if (reason.kind === 'level') return t('shop.lock.level', { n: reason.value });
  if (reason.kind === 'reputation') return t('shop.lock.reputation', { n: reason.value });
  return t('shop.lock.mission', { title: getStoryMission(reason.value)?.title ?? reason.value });
}

function afterBuy(item: Item): void {
  const game = app.game;
  app.audio.sfx('coins');
  app.haptic(20);
  app.ui.toast(t('shop.bought', { name: nameOf(item) }), 'good', 'shop');
  if (item.category === 'bait' && !game.state.flags.tutorialDone && game.state.flags.tutorialStep >= 5) {
    game.equip(item.id);
    endTutorial(false);
  }
  app.save();
}

function buy(item: Item, after: () => void): void {
  const result = app.game.buy(item.id);
  if (result.ok) afterBuy(item);
  else {
    app.audio.sfx('error');
    app.ui.toast(result.reason === 'order' ? t('shop.order') : t('shop.noCoins'), 'warn', 'coin');
  }
  after();
}

function equipped(item: Item): boolean {
  const state = app.game.state;
  if (item.category === 'cosmetic') return state.cosmetics[item.slot] === item.id;
  if (item.category === 'bait') return app.game.baitId() === item.id;
  return state.equipment[item.category] === item.id;
}

function itemRow(item: Item, render: () => void): HTMLElement {
  const game = app.game;
  const owned = item.category !== 'bait' && game.state.owned.includes(item.id);
  const lock = lockText(item);
  let action: HTMLElement;
  if (owned) {
    action = equipped(item)
      ? h('span', { class: 'pill pill-good' }, icon('check'), t('shop.equipped'))
      : button(t('shop.equip'), () => {
          game.equip(item.id);
          app.save();
          render();
        }, { small: true });
  } else if (lock) {
    action = h('span', { class: 'pill' }, icon('lock'), lock);
  } else {
    const check = game.checkBuy(item.id);
    action = button('', () => buy(item, render), {
      kind: 'gold',
      small: true,
      disabled: !check.ok,
      label: `${t('shop.buy')} ${nameOf(item)}`,
      cls: 'btn-price',
    });
    action.append(coinTag(item.price));
  }
  const swatch =
    item.category === 'cosmetic'
      ? h('span', {
          class: 'swatch',
          style: { background: `linear-gradient(135deg, #${item.color.toString(16).padStart(6, '0')} 55%, #${item.color2.toString(16).padStart(6, '0')} 55%)` },
        })
      : null;
  return h(
    'div',
    { class: `row item-row${lock && !owned ? ' is-locked' : ''}`, 'data-item': item.id },
    swatch,
    h(
      'div',
      { class: 'row-main' },
      h('b', null, nameOf(item)),
      h('span', { class: 'row-sub' }, descOf(item)),
      item.category === 'bait' ? h('span', { class: 'row-sub' }, t('shop.pack', { n: (item as Bait).pack }), ' · ', t('shop.stock', { n: game.state.baits[item.id] ?? 0 })) : null,
      statList(item, !owned && item.category !== 'bait'),
    ),
    h('div', { class: 'row-actions' }, action),
  );
}

function craftRow(bait: Bait, render: () => void): HTMLElement | null {
  const game = app.game;
  const lock = lockText(bait);
  if (bait.mission && lock) return null;
  const ok = game.canCraft(bait.id);
  const ingredients = craftIngredients(game.state, bait);
  return h(
    'div',
    { class: 'row item-row', 'data-item': bait.id },
    h(
      'div',
      { class: 'row-main' },
      h('b', null, nameOf(bait)),
      h('span', { class: 'row-sub' }, descOf(bait)),
      h('span', { class: 'row-sub' }, t('shop.recipe', { n: bait.craft!.count, rarity: t(`rarity.${bait.craft!.rarity}`) }), ' → ', t('shop.pack', { n: bait.pack })),
      h('span', { class: 'row-sub' }, t('shop.stock', { n: game.state.baits[bait.id] ?? 0 })),
      !ingredients ? h('span', { class: 'row-sub muted' }, t('shop.recipe.missing')) : null,
      statList(bait, false),
    ),
    h(
      'div',
      { class: 'row-actions' },
      button(t('shop.craft'), () => {
        if (game.craft(bait.id)) {
          app.audio.sfx('coins');
          app.ui.toast(t('shop.crafted', { n: bait.pack, name: nameOf(bait) }), 'good', 'bait');
          app.save();
        }
        render();
      }, { small: true, disabled: !ok, kind: 'primary' }),
      (game.state.baits[bait.id] ?? 0) > 0 && !equipped(bait)
        ? button(t('shop.equip'), () => {
            game.equip(bait.id);
            render();
          }, { small: true })
        : null,
    ),
  );
}

function sellTab(body: HTMLElement, render: () => void): void {
  const game = app.game;
  const flags = game.state.flags;
  const creel = [...game.state.creel].sort((a, b) => Number(a.locked) - Number(b.locked) || b.value - a.value);
  if (!flags.tutorialDone && flags.tutorialStep === 5 && creel.length === 0) advanceTutorialToBait();
  if (creel.length === 0) {
    body.append(emptyState('net', t('shop.empty')));
    return;
  }
  const sellable = creel.filter((f) => !f.locked);
  const total = sellable.reduce((sum, f) => sum + game.priceOf(f), 0);
  const sold = (coins: number): void => {
    app.audio.sfx('coins');
    app.haptic(20);
    app.ui.toast(t('shop.sold', { n: formatNumber(coins) }), 'good', 'coin');
    if (!game.state.flags.tutorialDone && game.state.flags.tutorialStep === 5) advanceTutorialToBait();
    app.save();
    render();
  };
  const all = button(t('shop.sellAll', { n: sellable.length }), () => sold(game.sellAll()), {
    kind: 'gold',
    icon: 'coin',
    disabled: sellable.length === 0,
    id: 'sell-all',
  });
  all.append(coinTag(total));
  body.append(
    h('div', { class: 'sell-head' }, all, creel.some((f) => f.locked) ? h('p', { class: 'muted' }, t('shop.lockedHint')) : null),
    h(
      'div',
      { class: 'list' },
      ...creel.map((fish) =>
        fishRow(fish, [
          lockButton(fish, render),
          button(t('shop.sell'), () => sold(game.sellFish(fish.uid)), { small: true, disabled: fish.locked, cls: 'sell-one' }),
        ]),
      ),
    ),
  );
}

function advanceTutorialToBait(): void {
  const game = app.game;
  game.state.flags.tutorialStep = 6;
  const price = getBait('ver').price;
  if (game.state.coins < price) {
    game.debugCoins(price - game.state.coins);
    app.ui.toast(t('shop.tutorial.topup'), 'info', 'coin');
  }
  app.ui.refresh();
}

export function shopScreen(params: Record<string, unknown>): Screen {
  const game = app.game;
  let tab: Tab = (params.tab as Tab) ?? (game.state.creel.length > 0 ? 'sell' : 'bait');
  const shell = screenShell(t('shop.title'), 'shop', {
    tabs: TABS.map((x) => ({ id: x.id, icon: x.icon, label: x.id === 'sell' ? t('shop.tab.sell') : t(`category.${x.id}`) })),
    tab,
    onTab: (id) => {
      tab = id as Tab;
      render();
      shell.body.scrollTop = 0;
    },
  });
  const render = (): void => {
    clear(shell.right);
    shell.right.append(h('div', { class: 'chip chip-coins' }, coinTag(game.state.coins)));
    const body = shell.body;
    clear(body);
    body.append(
      h(
        'div',
        { class: 'npc-line' },
        h('div', { class: 'npc-portrait', html: portraitSvg('jo') }),
        h('p', null, tab === 'sell' ? t('shop.greet.sell') : t('shop.greet')),
      ),
    );
    if (tab === 'sell') {
      sellTab(body, render);
    } else if (tab === 'bait') {
      const list = h('div', { class: 'list' });
      for (const bait of BAITS.filter((b) => b.price > 0)) list.append(itemRow(bait, render));
      for (const bait of BAITS.filter((b) => b.craft)) {
        const row = craftRow(bait, render);
        if (row) list.append(row);
      }
      body.append(list);
    } else if (tab === 'cosmetic') {
      for (const slot of ['boatColor', 'bobber', 'outfit'] as CosmeticSlot[]) {
        body.append(h('h3', { class: 'section-title' }, t(`shop.slot.${slot}`)));
        body.append(
          h('div', { class: 'list' }, ...itemsOf('cosmetic').filter((c) => c.category === 'cosmetic' && c.slot === slot).map((c) => itemRow(c, render))),
        );
      }
    } else {
      body.append(h('div', { class: 'list' }, ...itemsOf(tab).map((item) => itemRow(item, render))));
    }
    shell.setTab(tab);
  };
  render();
  return {
    id: 'shop',
    el: shell.el,
    refresh: render,
    onClose: () => {
      const scene = app.phaser?.scene.getScene('Port') as { refreshBoat?: () => void } | null;
      if (app.ui.mode === 'port') scene?.refreshBoat?.();
    },
  };
}

export { getItem };
