import { app } from '../../app';
import { PHASE_ICONS, WEATHER_ICONS } from '../../art/icons';
import { BALANCE } from '../../config/balance';
import { formatNumber, t } from '../../core/i18n';
import { JOURNAL_PAGES } from '../../data/dialogues';
import { getItem } from '../../data/equipment';
import { speciesOfZone } from '../../data/species';
import type { Species, ZoneId } from '../../data/types';
import { DAY_PHASES, SEASONS, VARIANTS, WEATHERS } from '../../data/types';
import { getZone, ZONES } from '../../data/zones';
import { claimableMilestones, collectionCount, collectionPercent, collectionTotal, journalPagesUnlocked } from '../../systems/progression';
import { button, clear, h, icon, progress } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { coinTag, fishArt, formatSize, formatWeight, nameOf, rarityTag } from '../widgets';

function depthText(s: Species): string {
  const mid = (s.depth[0] + s.depth[1]) / 2;
  return mid < 0.4 ? t('dex.depth.shallow') : mid < 0.7 ? t('dex.depth.mid') : t('dex.depth.deep');
}

function listOr(all: readonly string[], values: readonly string[], prefix: string): string {
  if (values.length >= all.length) return t('dex.all');
  return values.map((v) => t(`${prefix}.${v}`)).join(', ');
}

function hintOf(s: Species): string {
  if (s.requires?.weather) return t('dex.only', { list: s.requires.weather.map((w) => t(`weather.${w}`)).join(', ') });
  if (s.requires?.phase) return t('dex.only', { list: s.requires.phase.map((p) => t(`phase.${p}`)).join(', ') });
  if (s.phases.length < 4) return listOr(DAY_PHASES, s.phases, 'phase');
  if (s.baits.length > 0) return `${t('dex.baits')} : ${nameOf(getItem(s.baits[0]!))}`;
  return depthText(s);
}

function speciesDetail(s: Species): void {
  const entry = app.game.state.dex[s.id];
  const known = Boolean(entry);
  const row = (label: string, value: HTMLElement | string): HTMLElement => h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value));
  const iconsFor = (values: readonly string[], map: Record<string, string>, prefix: string): HTMLElement =>
    h('span', { class: 'icon-list' }, ...values.map((v) => h('span', { class: 'icon-chip', title: t(`${prefix}.${v}`) }, iconOf(map[v]!), t(`${prefix}.${v}`))));
  const content = h(
    'div',
    { class: 'species-sheet', 'data-species': s.id },
    h('div', { class: `catch-art rarity-bg-${s.rarity}` }, fishArt(s, 'normal', known)),
    h('h2', null, known ? nameOf(s) : t('dex.unknownName')),
    rarityTag(s.rarity),
    known ? h('p', { class: 'catch-flavor' }, s.flavor) : h('p', { class: 'muted' }, t('dex.unknown')),
    h(
      'dl',
      { class: 'kv-list' },
      row(t('dex.zones'), s.zones.map((z) => nameOf(getZone(z))).join(', ')),
      row(t('dex.depth'), depthText(s)),
      known
        ? [
            row(t('dex.hours'), s.requires?.phase ? iconsFor(s.requires.phase, PHASE_ICONS, 'phase') : s.phases.length === 4 ? t('dex.all') : iconsFor(s.phases, PHASE_ICONS, 'phase')),
            row(t('dex.weather'), s.requires?.weather ? iconsFor(s.requires.weather, WEATHER_ICONS, 'weather') : listOr(WEATHERS, s.weathers, 'weather')),
            row(t('dex.seasons'), listOr(SEASONS, s.seasons, 'season')),
            row(t('dex.baits'), s.baits.length ? s.baits.map((b) => nameOf(getItem(b))).join(', ') : t('dex.none')),
            row(t('dex.behavior'), t(`behavior.${s.behavior}`)),
            row(t('dex.size'), `${formatSize(s.size[0])} – ${formatSize(s.size[1])}`),
            row(t('dex.value'), coinTag(s.baseValue)),
            row(t('dex.recordSize'), formatSize(entry!.maxSize)),
            row(t('dex.recordWeight'), formatWeight(entry!.maxWeight)),
            row(t('dex.count'), formatNumber(entry!.count)),
            row(t('dex.firstDay'), String(entry!.firstDay)),
          ]
        : row(t('dex.hint'), hintOf(s)),
    ),
    known
      ? h(
          'div',
          { class: 'variants' },
          h('h3', null, t('dex.variants'), ` (${entry!.variants.length}/4)`),
          h(
            'div',
            { class: 'variant-grid' },
            ...VARIANTS.map((v) => {
              const found = entry!.variants.includes(v);
              return h('div', { class: `variant${found ? ' is-found' : ''}` }, fishArt(s, found ? v : 'normal', found), h('span', null, found ? t(`variant.${v}`) : '?'));
            }),
          ),
        )
      : null,
    h('div', { class: 'dialog-actions' }, button(t('common.close'), () => close(), { kind: 'primary' })),
  );
  const close = app.ui.modal(content, { cls: 'modal-sheet' });
}

function iconOf(name: string): HTMLElement {
  return icon(name);
}

function zoneView(zone: ZoneId): HTMLElement {
  const state = app.game.state;
  const list = speciesOfZone(zone);
  const n = collectionCount(state, zone);
  const z = getZone(zone);
  return h(
    'div',
    null,
    h('div', { class: 'zone-summary' }, h('b', null, nameOf(z)), h('span', null, t('dex.zone', { n, max: list.length, p: Math.floor(collectionPercent(state, zone)) })), progress(n, list.length)),
    h(
      'div',
      { class: 'dex-grid' },
      ...list.map((s) => {
        const known = Boolean(state.dex[s.id]);
        return h(
          'button',
          { class: `dex-card rarity-border-${s.rarity}${known ? '' : ' is-unknown'}`, type: 'button', 'data-species': s.id, onclick: () => speciesDetail(s) },
          fishArt(s, 'normal', known),
          h('span', { class: 'dex-name' }, known ? nameOf(s) : t('dex.unknownName')),
          rarityTag(s.rarity),
          known && state.dex[s.id]!.variants.length > 0 ? h('span', { class: 'dex-variants' }, icon('sparkle'), String(state.dex[s.id]!.variants.length)) : null,
        );
      }),
    ),
  );
}

function journalView(render: () => void): HTMLElement {
  const game = app.game;
  const state = game.state;
  const pages = journalPagesUnlocked(state);
  if (pages > state.journalPagesRead) state.journalPagesRead = pages;
  const claimable = claimableMilestones(state);
  return h(
    'div',
    null,
    h('h3', { class: 'section-title' }, t('dex.milestones')),
    h(
      'div',
      { class: 'milestones' },
      ...BALANCE.milestones.map((m) => {
        const claimed = state.milestonesClaimed.includes(m.percent);
        const can = claimable.includes(m.percent);
        return h(
          'div',
          { class: `milestone${claimed ? ' is-claimed' : can ? ' is-ready' : ''}` },
          h('b', null, t('dex.milestone', { p: m.percent })),
          coinTag(m.coins),
          claimed
            ? h('span', { class: 'pill pill-good' }, icon('check'), t('dex.claimed'))
            : button(t('dex.claim'), () => {
                if (game.claimMilestone(m.percent)) {
                  app.audio.sfx('coins');
                  app.ui.toast(t('dex.claimedToast', { p: m.percent, n: formatNumber(m.coins) }), 'good', 'gift');
                  app.save();
                  render();
                }
              }, { small: true, kind: 'gold', disabled: !can }),
        );
      }),
    ),
    h('h3', { class: 'section-title' }, t('dex.pages', { n: pages })),
    h(
      'div',
      { class: 'journal' },
      ...JOURNAL_PAGES.map((page, i) =>
        i < pages
          ? h('article', { class: 'journal-page' }, h('h4', null, `${t('dex.page', { n: i + 1 })} — ${page.title}`), h('p', null, page.text))
          : h('article', { class: 'journal-page is-locked' }, h('h4', null, t('dex.page', { n: i + 1 })), h('p', null, t('dex.page.locked', { p: (i + 1) * 10 }))),
      ),
    ),
  );
}

export function dexScreen(params: Record<string, unknown>): Screen {
  const game = app.game;
  let tab = (params.tab as string) ?? 'journal';
  const shell = screenShell(t('dex.title'), 'book', {
    tabs: [{ id: 'journal', label: t('dex.tab.journal'), icon: 'scroll', badge: () => claimableMilestones(game.state).length > 0 }, ...ZONES.map((z) => ({ id: z.id, label: z.short }))],
    tab,
    onTab: (id) => {
      tab = id;
      render();
      shell.body.scrollTop = 0;
    },
  });
  const render = (): void => {
    const body = shell.body;
    clear(body);
    const total = collectionTotal();
    const count = collectionCount(game.state);
    body.append(
      h('div', { class: 'dex-total' }, h('span', null, t('dex.total', { n: count, max: total, p: Math.floor(collectionPercent(game.state)) })), progress(count, total)),
      tab === 'journal' ? journalView(render) : zoneView(tab as ZoneId),
    );
  };
  render();
  return { id: 'dex', el: shell.el, refresh: render };
}
