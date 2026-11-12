import { app } from '../../app';
import { PHASE_ICONS, WEATHER_ICONS } from '../../art/icons';
import { portraitSvg } from '../../art/portraits';
import { t } from '../../core/i18n';
import { getStoryMission } from '../../data/missions';
import type { Zone, ZoneId } from '../../data/types';
import { getZone, ZONES } from '../../data/zones';
import { collectionCount, collectionTotal } from '../../systems/progression';
import { button, clear, h, icon } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { descOf, nameOf } from '../widgets';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function islandPath(cx: number, cy: number, r: number, seed: number): string {
  let d = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const k = 0.75 + 0.25 * Math.sin(seed * 3.1 + i * 1.7);
    const x = cx + Math.cos(a) * r * k * 1.25;
    const y = cy + Math.sin(a) * r * k * 0.85;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

function mapSvg(selected: ZoneId): string {
  const game = app.game;
  const W = 100;
  const H = 100;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="map-svg" aria-hidden="true">`;
  out +=
    '<defs><pattern id="mw" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 3q2-2 4 0t4 0" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="0.4"/></pattern></defs>';
  out += `<rect width="${W}" height="${H}" fill="#5fb3c9"/><rect width="${W}" height="${H}" fill="url(#mw)"/>`;
  // Main island with the port.
  out += `<path d="${islandPath(36, 56, 13, 1)}" fill="#e8d9a8" stroke="#1d3344" stroke-width="0.6"/><path d="${islandPath(36, 56, 9, 1)}" fill="#8fae7a"/>`;
  out += '<rect x="40" y="62" width="4" height="3" fill="#c94a3a" stroke="#1d3344" stroke-width="0.3"/>';
  out += `<path d="${islandPath(72, 46, 7, 4)}" fill="#f0d9a0" stroke="#1d3344" stroke-width="0.5"/>`;
  out += `<path d="${islandPath(30, 24, 10, 2)}" fill="#e8d9a8" stroke="#1d3344" stroke-width="0.5"/><path d="${islandPath(30, 24, 7, 2)}" fill="#7a8a5a"/>`;
  out += '<path d="M24 30q6-6 10-2t8-4" fill="none" stroke="#6fa8b5" stroke-width="1.4"/>';
  // Deep areas.
  out +=
    '<ellipse cx="60" cy="86" rx="13" ry="7" fill="#14365f" opacity="0.85"/><ellipse cx="60" cy="86" rx="7" ry="3.5" fill="#05081a"/>';
  out += '<ellipse cx="84" cy="20" rx="13" ry="11" fill="#3a7ab5" opacity="0.5"/>';
  // Route from the port to the selected zone.
  const port = { x: 42, y: 64 };
  const z = getZone(selected);
  out += `<path d="M${port.x} ${port.y}Q${(port.x + z.map.x) / 2 + 8} ${(port.y + z.map.y) / 2} ${z.map.x} ${z.map.y}" fill="none" stroke="#fbf5e6" stroke-width="0.8" stroke-dasharray="2 1.5"/>`;
  for (const zone of ZONES) {
    const open = game.zoneAccess(zone.id).ok;
    const known = game.state.unlockedZones.includes(zone.id);
    out += `<circle cx="${zone.map.x}" cy="${zone.map.y}" r="${zone.id === selected ? 4.4 : 3.4}" fill="${open ? hex(zone.palette.accent) : known ? '#c9c9c9' : '#7a8691'}" stroke="#1d3344" stroke-width="${zone.id === selected ? 0.9 : 0.6}"/>`;
    if (!open)
      out += `<path d="M${zone.map.x - 1.2} ${zone.map.y - 0.2}h2.4v2h-2.4zM${zone.map.x - 0.8} ${zone.map.y - 0.2}v-0.8a0.8 0.8 0 011.6 0v0.8" fill="none" stroke="#1d3344" stroke-width="0.4"/>`;
  }
  out +=
    '<text x="50" y="97" text-anchor="middle" font-size="3" fill="#1d3344" font-family="serif" font-style="italic">Archipel de Ressac</text>';
  out +=
    '<g transform="translate(90 90)"><circle r="5" fill="#fbf5e6" stroke="#1d3344" stroke-width="0.4"/><path d="M0 -4l1.2 4h-2.4z" fill="#c94a3a"/><path d="M0 4l1.2 -4h-2.4z" fill="#1d3344"/></g>';
  return `${out}</svg>`;
}

export function mapScreen(): Screen {
  const game = app.game;
  let selected: ZoneId = game.state.zone;
  const shell = screenShell(t('map.title'), 'map');

  const detail = (zone: Zone): HTMLElement => {
    const access = game.zoneAccess(zone.id);
    const known = game.state.unlockedZones.includes(zone.id);
    const weather = game.weather(zone.id);
    const phase = game.phase(zone.id);
    let lockText = '';
    if (!access.ok) {
      lockText = access.reason === 'boat' ? t('map.boat', { n: zone.boatTier }) : zone.unlockText;
      const mission = zone.unlockMission ? getStoryMission(zone.unlockMission) : undefined;
      if (!known && mission) lockText = `${zone.unlockText} (« ${mission.title} »)`;
    }
    return h(
      'div',
      { class: `card zone-card${access.ok ? '' : ' is-locked'}`, 'data-zone': zone.id },
      h(
        'div',
        { class: 'card-title' },
        h('b', null, nameOf(zone)),
        zone.id === game.state.zone ? h('span', { class: 'pill' }, icon('pin'), t('map.here')) : null,
      ),
      h('p', null, descOf(zone)),
      h('p', { class: 'row-sub' }, icon('info'), zone.gimmickText),
      h(
        'div',
        { class: 'zone-facts' },
        h('span', { class: 'chip' }, icon(WEATHER_ICONS[weather]), t(`weather.${weather}`)),
        h('span', { class: 'chip' }, icon(PHASE_ICONS[phase]), t(`phase.${phase}`)),
        h('span', { class: 'chip' }, icon('clock'), t('map.travel', { n: game.travelMinutes(zone.id) })),
        h(
          'span',
          { class: 'chip' },
          icon('book'),
          t('map.species', { n: collectionCount(game.state, zone.id), max: collectionTotal(zone.id) }),
        ),
      ),
      access.ok
        ? button(
            t('map.go'),
            () => {
              if (game.travel(zone.id)) {
                app.save();
                void app.ui.setMode('fishing');
              }
            },
            { kind: 'primary', icon: 'hook', id: `go-${zone.id}`, cls: 'btn-big' },
          )
        : h('p', { class: 'lock-line' }, icon('lock'), h('span', null, `${t('map.locked')} — ${lockText}`)),
    );
  };

  const render = (): void => {
    const body = shell.body;
    clear(body);
    const map = h('div', { class: 'map' }, h('div', { class: 'map-art', html: mapSvg(selected) }));
    for (const zone of ZONES) {
      const open = game.zoneAccess(zone.id).ok;
      map.append(
        h(
          'button',
          {
            class: `map-node${zone.id === selected ? ' is-selected' : ''}${open ? '' : ' is-locked'}`,
            type: 'button',
            'data-zone': zone.id,
            style: { left: `${zone.map.x}%`, top: `${zone.map.y}%` },
            'aria-label': nameOf(zone),
            onclick: () => {
              selected = zone.id;
              render();
            },
          },
          h('span', { class: 'map-label' }, zone.short),
        ),
      );
    }
    body.append(
      h(
        'div',
        { class: 'npc-line' },
        h('div', { class: 'npc-portrait', html: portraitSvg('nell') }),
        h('p', null, t('map.nell')),
      ),
      map,
      detail(getZone(selected)),
    );
  };
  render();
  return { id: 'map', el: shell.el, refresh: render };
}
