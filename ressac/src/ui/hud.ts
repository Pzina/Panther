import { app } from '../app';
import { PHASE_ICONS, WEATHER_ICONS } from '../art/icons';
import { portraitSvg } from '../art/portraits';
import { BALANCE } from '../config/balance';
import { GAME_NAME, GAME_VERSION } from '../config/constants';
import { dayOfSeason, formatClock } from '../core/clock';
import { formatNumber, t } from '../core/i18n';
import { TUTORIAL_STEPS } from '../data/dialogues';
import { BAITS, getBait } from '../data/equipment';
import { getZone } from '../data/zones';
import type { FightModel } from '../systems/fight';
import { collectionPercent, xpToNext } from '../systems/progression';
import { button, clear, h, icon, iconButton, progress } from './dom';
import { joystick, lookPad } from './joystick';
import type { Hud } from './ui';
import { coinTag, nameOf } from './widgets';

const SEASON_ICONS: Record<string, string> = {
  spring: 'flower',
  summer: 'sun',
  autumn: 'leaf',
  winter: 'snow',
};

function statusChips(zone = app.game.state.zone, compact = false): HTMLElement[] {
  const game = app.game;
  const phase = game.phase(zone);
  const weather = game.weather(zone);
  const label = `${t(`phase.${phase}`)} · ${t(`weather.${weather}`)}`;
  if (compact) {
    return [
      h(
        'div',
        { class: 'chip', title: label, 'aria-label': `${formatClock(game.state.clockMinutes)} · ${label}` },
        icon(PHASE_ICONS[phase]),
        h('span', null, formatClock(game.state.clockMinutes)),
        icon(WEATHER_ICONS[weather]),
      ),
    ];
  }
  return [
    h(
      'div',
      { class: 'chip', title: t(`phase.${phase}`) },
      icon(PHASE_ICONS[phase]),
      h('span', null, formatClock(game.state.clockMinutes)),
    ),
    h(
      'div',
      { class: 'chip', title: t(`weather.${weather}`), 'aria-label': t(`weather.${weather}`) },
      icon(WEATHER_ICONS[weather]),
      h('span', { class: 'chip-text' }, t(`weather.${weather}`)),
    ),
  ];
}

function tutorialBubble(text: string): HTMLElement {
  return h(
    'div',
    { class: 'tutorial', id: 'tutorial' },
    h('div', { class: 'tutorial-portrait', html: portraitSvg('herve') }),
    h('div', { class: 'tutorial-body' }, h('p', null, text)),
    h(
      'button',
      { class: 'tutorial-skip', type: 'button', id: 'tutorial-skip', onclick: () => endTutorial(true) },
      t('hud.tutorial.skip'),
    ),
  );
}

/** Switches between the first and the third person camera. */
export function toggleView(): void {
  const settings = app.game.state.settings;
  settings.thirdPerson = !settings.thirdPerson;
  app.save();
  app.ui.refresh();
}

function viewButton(): HTMLButtonElement {
  const third = app.game.state.settings.thirdPerson;
  const btn = iconButton('eye', t(third ? 'hud.view.first' : 'hud.view.third'), toggleView, 'chip-btn');
  btn.id = 'btn-view';
  btn.dataset.view = third ? 'third' : 'first';
  return btn;
}

/** Marks the tutorial as finished (it can be replayed from the settings). */
export function endTutorial(skipped: boolean): void {
  const game = app.game;
  if (game.state.flags.tutorialDone) return;
  game.state.flags.tutorialDone = true;
  game.state.flags.tutorialStep = TUTORIAL_STEPS.length - 1;
  if (!skipped) app.ui.toast(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]!.text, 'good', 'anchor');
  app.save();
  app.ui.refresh();
  const hud = app.ui.hud as Partial<FishingHud> | null;
  hud?.setTutorial?.(null);
}

// ───────────────────────── Home ─────────────────────────

/** The "touch to start" gate is shown once per session (it unlocks audio on mobile browsers). */
let homeStarted = false;

export class HomeHud implements Hud {
  el = h('div', { class: 'hud home-hud', id: 'home-hud' });

  constructor(private actions: { play: () => void; newGame: () => void }) {
    this.refresh();
  }

  refresh(): void {
    const game = app.game;
    const hasSave = app.hasSave();
    clear(this.el);
    this.el.append(
      h(
        'div',
        { class: 'home-title' },
        h(
          'h1',
          { class: 'logo', 'aria-label': GAME_NAME },
          ...GAME_NAME.split('').map((c, i) => h('span', { style: { animationDelay: `${i * 0.12}s` } }, c)),
        ),
        h('p', { class: 'tagline' }, t('home.tagline')),
      ),
    );
    if (!homeStarted) {
      const tap = h(
        'button',
        { class: 'tap-start', type: 'button', id: 'tap-start' },
        h('span', null, t('home.tap')),
      );
      tap.addEventListener('click', () => {
        homeStarted = true;
        app.audio.unlock();
        app.applySettings();
        this.refresh();
      });
      this.el.append(tap);
      return;
    }
    const summary = hasSave
      ? t('home.save', {
          day: game.day,
          percent: Math.floor(collectionPercent(game.state)),
          coins: formatNumber(game.state.coins),
        })
      : t('home.nosave');
    this.el.append(
      h(
        'div',
        { class: 'home-menu' },
        h('p', { class: 'home-save', id: 'home-save' }, summary),
        button(hasSave ? t('home.continue') : t('home.play'), this.actions.play, {
          kind: 'primary',
          icon: 'play',
          id: 'btn-play',
          cls: 'btn-big',
        }),
        hasSave ? button(t('home.new'), this.actions.newGame, { icon: 'refresh', id: 'btn-new' }) : null,
        h(
          'div',
          { class: 'home-grid' },
          button(t('home.dex'), () => app.ui.open('dex'), { icon: 'book', id: 'btn-dex' }),
          button(t('home.achievements'), () => app.ui.open('achievements'), {
            icon: 'trophy',
            id: 'btn-achievements',
          }),
          button(t('home.settings'), () => app.ui.open('settings'), { icon: 'gear', id: 'btn-settings' }),
          button(t('home.credits'), () => app.ui.open('credits'), { icon: 'info', id: 'btn-credits' }),
        ),
      ),
      h('div', { class: 'version' }, `v${GAME_VERSION}`),
    );
  }
}

// ───────────────────────── Port ─────────────────────────

export class PortHud implements Hud {
  el = h('div', { class: 'hud port-hud', id: 'port-hud' });
  private stick = joystick(t('hud.move'));
  private timer: ReturnType<typeof setInterval>;

  constructor() {
    this.refresh();
    this.timer = setInterval(() => !app.ui.covered && this.refresh(), 5000);
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  refresh(): void {
    const game = app.game;
    const state = game.state;
    const story = game.currentStory();
    const p = game.storyProgress();
    const zone = getZone(state.zone);
    const tutorialStep = state.flags.tutorialDone ? -1 : state.flags.tutorialStep;
    const claimable =
      state.daily.missions.some((m) => !m.claimed && m.progress >= m.target) ||
      Object.keys(state.challenges).some((id) => {
        const c = game.challengeProgress(id);
        return !c.claimed && c.value >= c.target;
      });
    const spot = (
      cls: string,
      iconName: string,
      label: string,
      onClick: () => void,
      badge = false,
      id?: string,
    ): HTMLElement =>
      h(
        'button',
        {
          class: `spot ${cls}${tutorialStep === 5 && cls === 'spot-shop' ? ' is-highlight' : ''}`,
          type: 'button',
          onclick: onClick,
          id,
        },
        icon(iconName),
        h('span', null, label),
        badge ? h('i', { class: 'badge-dot' }) : null,
      );
    // The joystick stays in place: removing it would interrupt a gesture in progress.
    for (const child of [...this.el.children]) if (child !== this.stick) child.remove();
    if (!this.stick.parentElement) this.el.append(this.stick);
    const content = document.createDocumentFragment();
    content.append(
      h(
        'div',
        { class: 'hud-top' },
        iconButton('home', t('port.home'), () => app.ui.back(), 'chip-btn'),
        h(
          'div',
          {
            class: 'chip',
            title: `${t(`season.${game.season}`)} ${dayOfSeason(state.clockMinutes)}/${BALANCE.clock.daysPerSeason}`,
            'aria-label': `${t('common.day', { n: game.day })} · ${t(`season.${game.season}`)} ${dayOfSeason(state.clockMinutes)}/${BALANCE.clock.daysPerSeason}`,
          },
          icon(SEASON_ICONS[game.season]!),
          h('span', null, t('common.day', { n: game.day })),
          h('span', { class: 'chip-text' }, `· ${t(`season.${game.season}`)}`),
        ),
        ...statusChips('anse', true),
        h('div', { class: 'spacer' }),
        viewButton(),
        iconButton('gear', t('port.settings'), () => app.ui.open('settings'), 'chip-btn'),
      ),
      h(
        'div',
        { class: 'hud-second' },
        h(
          'div',
          { class: 'chip chip-level' },
          h('b', null, t('common.level', { n: state.level })),
          progress(state.xp, xpToNext(state.level)),
        ),
        h(
          'div',
          {
            class: 'chip',
            title: t('port.reputation', { n: Math.floor(state.reputation) }),
            'aria-label': t('port.reputation', { n: Math.floor(state.reputation) }),
          },
          icon('heart'),
          h('span', null, String(Math.floor(state.reputation))),
        ),
        game.stats().rested
          ? h('div', { class: 'chip chip-good' }, icon('bed'), h('span', null, t('port.rested')))
          : null,
        h('div', { class: 'spacer' }),
        h('div', { class: 'chip chip-coins', id: 'coins' }, coinTag(state.coins)),
      ),
      ...(tutorialStep >= 5 && tutorialStep <= 6 ? [tutorialBubble(TUTORIAL_STEPS[tutorialStep]!.text)] : []),
      spot('spot-cabin', 'home', t('port.cabin'), () => app.ui.open('cabin'), false, 'spot-cabin'),
      spot(
        'spot-shop',
        'shop',
        t('port.shop'),
        () => app.ui.open('shop', { tab: tutorialStep === 5 ? 'sell' : undefined }),
        false,
        'spot-shop',
      ),
      spot(
        'spot-missions',
        'scroll',
        t('port.missions'),
        () => app.ui.open('missions'),
        claimable,
        'spot-missions',
      ),
      spot('spot-map', 'map', t('port.map'), () => app.ui.open('map'), false, 'spot-map'),
      h(
        'button',
        {
          class: 'mission-strip',
          type: 'button',
          id: 'mission-strip',
          onclick: () => app.ui.open('missions'),
        },
        icon('compass'),
        story
          ? h(
              'div',
              { class: 'mission-strip-body' },
              h('b', null, story.title),
              h('span', null, story.description),
              progress(p.value, p.target),
            )
          : h('div', { class: 'mission-strip-body' }, h('b', null, t('port.story.done'))),
        story ? h('span', { class: 'mission-count' }, `${p.value}/${p.target}`) : null,
      ),
      h(
        'div',
        { class: 'port-bottom' },
        h(
          'div',
          { class: 'port-row' },
          button(t('port.journal'), () => app.ui.open('dex'), { icon: 'book', id: 'btn-journal' }),
          button(
            `${t('port.creel')} ${state.creel.length}/${game.stats().creelSize}`,
            () => app.ui.open('creel'),
            { icon: 'net', id: 'btn-creel' },
          ),
          button(t('port.achievements'), () => app.ui.open('achievements'), {
            icon: 'trophy',
            id: 'btn-ach',
          }),
        ),
        button(`${t('port.fish')} · ${zone.short}`, () => void app.ui.setMode('fishing'), {
          kind: 'primary',
          icon: 'hook',
          id: 'btn-fish',
          cls: 'btn-big',
        }),
      ),
      ...(app.debug
        ? [
            h(
              'button',
              { class: 'debug-btn', type: 'button', id: 'btn-debug', onclick: () => app.ui.open('debug') },
              t('port.debug'),
            ),
          ]
        : []),
    );
    this.el.insertBefore(content, this.stick);
  }
}

// ───────────────────────── Fishing ─────────────────────────

export class FishingHud implements Hud {
  el = h('div', { class: 'hud fishing-hud', id: 'fishing-hud', 'data-state': 'idle' });
  /** True while a temporary hint ("Il change de cap !") must not be cleared. */
  hintLocked = false;
  private top = h('div', { class: 'hud-top' });
  private zoneLine = h('div', { class: 'zone-line' });
  private tutorialSlot = h('div', { class: 'tutorial-slot' });
  /** Mini-map drawn by the fishing view. */
  readonly map = h('canvas', {
    class: 'minimap',
    id: 'minimap',
    width: 192,
    height: 192,
    'aria-hidden': 'true',
  }) as HTMLCanvasElement;
  private tools = h('div', { class: 'side-tools', id: 'side-tools' });
  private navOn = false;
  private prompt = h('div', { class: 'prompt', id: 'prompt', role: 'status' });
  private hint = h('div', { class: 'fight-hint', id: 'fight-hint', role: 'status' });
  private bottom = h('div', { class: 'hud-bottom' });
  // Power gauge.
  private powerFill = h('div', { class: 'power-fill' });
  private powerBox: HTMLElement;
  // Fight gauge.
  private safe = h('div', { class: 'fight-safe' });
  private marker = h('div', { class: 'fight-marker' });
  private verdict = h('div', { class: 'fight-verdict' });
  private strain = h('div', { class: 'meter-fill meter-strain' });
  private slack = h('div', { class: 'meter-fill meter-slack' });
  private distance = h('div', { class: 'meter-fill meter-distance' });
  private fightBox: HTMLElement;
  private tutorialText: string | null = null;
  private timer: ReturnType<typeof setInterval>;

  constructor() {
    const c = BALANCE.cast;
    this.powerBox = h(
      'div',
      { class: 'power', id: 'power', 'aria-hidden': 'true' },
      h('div', { class: 'power-label' }, t('power.label')),
      h(
        'div',
        { class: 'power-track' },
        h('div', {
          class: 'power-sweet',
          style: { bottom: `${(c.sweetSpot - c.perfectWindow) * 100}%`, height: `${c.perfectWindow * 200}%` },
        }),
        this.powerFill,
      ),
      h('div', { class: 'power-perfect' }, t('power.perfect')),
    );
    this.fightBox = h(
      'div',
      { class: 'fight', id: 'fight' },
      h('div', { class: 'fight-head' }, h('span', null, t('fight.tension')), this.verdict),
      h('div', { class: 'fight-gauge' }, this.safe, this.marker),
      h(
        'div',
        { class: 'fight-meters' },
        h(
          'div',
          { class: 'meter' },
          h('span', null, t('fight.distance')),
          h('div', { class: 'meter-track' }, this.distance),
        ),
        h(
          'div',
          { class: 'meter' },
          h('span', null, t('fight.line')),
          h('div', { class: 'meter-track' }, this.strain),
        ),
        h(
          'div',
          { class: 'meter' },
          h('span', null, t('fight.hookHold')),
          h('div', { class: 'meter-track' }, this.slack),
        ),
      ),
      this.hint,
    );
    this.el.append(
      this.top,
      this.zoneLine,
      this.tutorialSlot,
      this.fightBox,
      this.powerBox,
      this.prompt,
      this.tools,
      joystick(t('hud.move')),
      lookPad(t('hud.look')),
      this.bottom,
    );
    this.refresh();
    this.timer = setInterval(() => !app.ui.covered && this.refresh(), 4000);
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  refresh(): void {
    const game = app.game;
    const state = game.state;
    const zone = getZone(state.zone);
    const bait = getBait(game.baitId());
    clear(this.top);
    this.top.append(
      h(
        'button',
        { class: 'chip chip-btn', type: 'button', id: 'btn-port', onclick: () => void this.toPort() },
        icon('anchor'),
        h('span', null, t('hud.port')),
      ),
      ...statusChips(),
      h('div', { class: 'spacer' }),
      h('div', { class: 'chip chip-coins' }, coinTag(state.coins)),
      iconButton('pause', t('hud.pause'), () => app.ui.open('pause'), 'chip-btn'),
    );
    this.zoneLine.textContent = `${nameOf(zone)} · ${zone.gimmickText}`;
    clear(this.bottom);
    this.bottom.append(
      h(
        'button',
        { class: 'chip chip-btn chip-bait', type: 'button', id: 'btn-bait', onclick: () => openBaitPicker() },
        icon('bait'),
        h(
          'span',
          null,
          `${nameOf(bait)} ${bait.infinite ? t('hud.infinite') : `×${state.baits[bait.id] ?? 0}`}`,
        ),
      ),
      h(
        'button',
        {
          class: `chip chip-btn${game.creelFull() ? ' chip-warn' : ''}`,
          type: 'button',
          id: 'btn-creel',
          onclick: () => app.ui.open('creel'),
        },
        icon('net'),
        h('span', null, `${state.creel.length}/${game.stats().creelSize}`),
      ),
    );
    this.renderTutorial();
    this.renderTools();
  }

  private async toPort(): Promise<void> {
    if (app.ui.busy) return;
    app.save();
    await app.ui.setMode('port');
  }

  setState(state: string): void {
    this.el.dataset.state = state;
    if (state === 'idle') this.refresh();
  }

  setPrompt(text: string, tone: 'normal' | 'alert' | 'good' = 'normal'): void {
    this.prompt.textContent = text;
    this.prompt.className = `prompt prompt-${tone}${text ? '' : ' is-empty'}`;
  }

  setHint(text: string | null): void {
    this.hint.textContent = text ?? '';
    this.hint.classList.toggle('is-visible', Boolean(text));
  }

  setPower(value: number | null): void {
    this.powerBox.classList.toggle('is-visible', value !== null);
    if (value === null) return;
    this.powerFill.style.height = `${(value * 100).toFixed(1)}%`;
    const c = BALANCE.cast;
    this.powerBox.classList.toggle('is-perfect', Math.abs(value - c.sweetSpot) <= c.perfectWindow);
    this.el.dataset.power = value.toFixed(3);
  }

  setFight(model: FightModel | null, dim: boolean): void {
    this.fightBox.classList.toggle('is-visible', model !== null);
    if (!model) return;
    const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
    this.safe.style.left = pct(model.safeLow);
    this.safe.style.width = pct(model.safeHigh - model.safeLow);
    this.marker.style.left = pct(model.tension);
    this.strain.style.width = pct(1 - model.strain);
    this.slack.style.width = pct(1 - model.slack);
    this.distance.style.width = pct(1 - model.distance);
    const verdict = model.tension > model.safeHigh ? 'high' : model.tension < model.safeLow ? 'low' : 'good';
    this.verdict.textContent = t(`fight.${verdict}`);
    this.fightBox.dataset.verdict = verdict;
    this.fightBox.classList.toggle('is-dim', dim);
    const d = this.el.dataset;
    d.tension = model.tension.toFixed(3);
    d.low = model.safeLow.toFixed(3);
    d.high = model.safeHigh.toFixed(3);
    d.distance = model.distance.toFixed(3);
    d.jump = model.jumpWarning > 0 || model.jumping > 0 ? '1' : '0';
  }

  /** Reflects the sailing mode on the HUD (button label, hidden fishing controls). */
  setNav(on: boolean): void {
    this.navOn = on;
    this.el.dataset.nav = on ? '1' : '0';
    this.renderTools();
  }

  private toolsKey = '';

  private renderTools(): void {
    // Rebuilt only when something changes, so that the buttons stay put between refreshes.
    const key = `${this.navOn}-${app.game.state.settings.thirdPerson}`;
    if (key === this.toolsKey) return;
    this.toolsKey = key;
    clear(this.tools);
    const nav = h(
      'button',
      {
        class: `chip chip-btn${this.navOn ? ' chip-good' : ''}`,
        type: 'button',
        id: 'btn-nav',
        onclick: () =>
          (app.stage?.scene.getScene('Fishing') as { toggleNav?: () => void } | null)?.toggleNav?.(),
      },
      icon(this.navOn ? 'hook' : 'compass'),
      h('span', null, t(this.navOn ? 'hud.nav.fish' : 'hud.nav.sail')),
    );
    this.tools.append(this.map, h('div', { class: 'side-row' }, viewButton(), nav));
  }

  setTutorial(text: string | null): void {
    this.tutorialText = text;
    this.renderTutorial();
  }

  private renderTutorial(): void {
    clear(this.tutorialSlot);
    if (this.tutorialText) this.tutorialSlot.append(tutorialBubble(this.tutorialText));
  }
}

/** Bait selection sheet, available while fishing and from the port. */
export function openBaitPicker(): void {
  const game = app.game;
  const list = h('div', { class: 'list' });
  const render = (): void => {
    clear(list);
    const usable = BAITS.filter((b) => b.infinite || (game.state.baits[b.id] ?? 0) > 0);
    for (const bait of usable) {
      const active = game.baitId() === bait.id;
      list.append(
        h(
          'button',
          {
            class: `row row-btn${active ? ' is-active' : ''}`,
            type: 'button',
            'data-bait': bait.id,
            onclick: () => {
              game.equip(bait.id);
              close();
            },
          },
          icon('bait'),
          h(
            'div',
            { class: 'row-main' },
            h('b', null, nameOf(bait)),
            h(
              'span',
              null,
              [
                bait.infinite ? t('hud.infinite') : t('bait.stock', { n: game.state.baits[bait.id] ?? 0 }),
                bait.speed < 1 ? t('bait.fast', { n: Math.round((1 - bait.speed) * 100) }) : '',
                bait.luck > 0 ? t('bait.luck', { n: Math.round(bait.luck * 100) }) : '',
              ]
                .filter(Boolean)
                .join(' · '),
            ),
          ),
          active ? h('span', { class: 'pill' }, t('bait.equipped')) : null,
        ),
      );
    }
    if (usable.length <= 1) list.append(h('p', { class: 'muted' }, t('bait.none')));
  };
  render();
  const close = app.ui.modal(
    h(
      'div',
      { class: 'dialog' },
      h('h2', null, t('bait.title')),
      list,
      h(
        'div',
        { class: 'dialog-actions' },
        button(t('common.close'), () => close(), { kind: 'ghost' }),
      ),
    ),
  );
}
