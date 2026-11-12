import { app } from '../../app';
import { illustrationSvg, logoMarkSvg } from '../../art/illustrations';
import { portraitSvg } from '../../art/portraits';
import { BALANCE } from '../../config/balance';
import { GAME_NAME, GAME_VERSION } from '../../config/constants';
import { formatClock } from '../../core/clock';
import { formatNumber, t } from '../../core/i18n';
import { ENDING_TEXT, INTRO_PANELS, JOURNAL_PAGES } from '../../data/dialogues';
import { getSpecies } from '../../data/species';
import { DAY_PHASES } from '../../data/types';
import { button, clear, h, icon } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { fishArt, fishLabel, formatSize } from '../widgets';
import { fishRow } from './fishRow';

export function pauseScreen(): Screen {
  const el = h(
    'section',
    { class: 'screen-root pause' },
    h(
      'div',
      { class: 'pause-box' },
      h('h1', null, icon('pause'), t('pause.title')),
      button(t('pause.resume'), () => app.ui.closeScreen(), {
        kind: 'primary',
        icon: 'play',
        id: 'pause-resume',
        cls: 'btn-big',
      }),
      button(t('pause.settings'), () => app.ui.open('settings'), { icon: 'gear' }),
      app.ui.mode === 'fishing'
        ? button(
            t('pause.port'),
            () => {
              app.save();
              void app.ui.setMode('port');
            },
            { icon: 'anchor', id: 'pause-port' },
          )
        : null,
      button(
        t('pause.home'),
        () => {
          app.save();
          void app.ui.setMode('home');
        },
        { icon: 'home', kind: 'ghost' },
      ),
      h('p', { class: 'muted center' }, t('pause.saved')),
    ),
  );
  app.save();
  return { id: 'pause', el };
}

export function creditsScreen(): Screen {
  const shell = screenShell(t('credits.title'), 'info');
  shell.body.append(
    h(
      'div',
      { class: 'credits' },
      h('div', { class: 'credits-logo', html: logoMarkSvg(96) }),
      h('h2', null, `${GAME_NAME} — v${GAME_VERSION}`),
      h('p', null, "Un jeu de pêche, d'exploration et de collection, en solo et hors ligne."),
      h('h3', null, 'Équipe'),
      h(
        'p',
        null,
        'Conception, programmation, illustrations procédurales, musique générative et effets sonores : l’équipe RESSAC, avec l’assistance de Claude (Anthropic).',
      ),
      h('h3', null, 'Outils'),
      h(
        'ul',
        null,
        h('li', null, 'Phaser 3 (licence MIT)'),
        h('li', null, 'TypeScript, Vite, Vitest, Playwright'),
        h('li', null, 'Capacitor (licence MIT) pour iOS et Android'),
        h('li', null, 'Web Audio API : tous les sons sont synthétisés en direct'),
      ),
      h('h3', null, 'Graphismes et sons'),
      h(
        'p',
        null,
        'Aucune image, aucune piste audio et aucune police téléchargée : chaque poisson, décor, portrait et icône est dessiné par le code (SVG et Canvas), chaque son est synthétisé.',
      ),
      h('h3', null, 'Police'),
      h(
        'p',
        null,
        "Le jeu utilise la police système de l'appareil (aucun fichier de police embarqué, donc aucune licence tierce à citer).",
      ),
      h('h3', null, 'Univers'),
      h(
        'p',
        null,
        "L'archipel de Ressac, ses lieux et ses personnages (Jo, le Capitaine Hervé, Nell et Maëlle Corvec) sont des créations originales. Les espèces réelles portent leur nom commun ; les autres sont inventées.",
      ),
      h('p', { class: 'muted' }, 'Merci de jouer, et bon vent !'),
    ),
  );
  return { id: 'credits', el: shell.el };
}

/** Introduction comic. `params.onDone` is called when it ends (played or skipped). */
export function introScreen(params: Record<string, unknown>): Screen {
  const onDone = params.onDone as (() => void) | undefined;
  let index = 0;
  const art = h('div', { class: 'intro-art' });
  const text = h('p', { class: 'intro-text' });
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
  const next = button(t('intro.next'), () => advance(), { kind: 'primary', icon: 'next', id: 'intro-next' });
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    app.ui.closeScreen();
  };
  const show = (): void => {
    const panel = INTRO_PANELS[index]!;
    art.innerHTML = illustrationSvg(panel.art);
    text.textContent = panel.text;
    clear(dots);
    INTRO_PANELS.forEach((_, i) => dots.append(h('i', { class: i === index ? 'is-active' : '' })));
    (next.querySelector('.btn-label') as HTMLElement).textContent =
      index === INTRO_PANELS.length - 1 ? t('intro.start') : t('intro.next');
    app.audio.sfx('page');
  };
  const advance = (): void => {
    index += 1;
    if (index >= INTRO_PANELS.length) finish();
    else show();
  };
  const el = h(
    'section',
    { class: 'screen-root intro' },
    h('button', { class: 'intro-skip', type: 'button', id: 'intro-skip', onclick: finish }, t('intro.skip')),
    h('div', { class: 'intro-panel' }, art, text),
    dots,
    next,
  );
  show();
  return { id: 'intro', el, onClose: () => onDone?.() };
}

export function endingScreen(params: Record<string, unknown>): Screen {
  const game = app.game;
  game.state.flags.endingSeen = true;
  app.save();
  const legend = getSpecies('veilleuse');
  const el = h(
    'section',
    { class: 'screen-root ending' },
    h(
      'div',
      { class: 'ending-scroll' },
      h('div', { class: 'ending-art', html: illustrationSvg('fosse') }),
      h('h1', null, t('ending.title')),
      fishArt(legend, 'normal', true, 'ending-fish'),
      ...ENDING_TEXT.map((line, i) =>
        h('p', { class: 'ending-line', style: { animationDelay: `${0.6 + i * 1.1}s` } }, line),
      ),
      h(
        'blockquote',
        { class: 'journal-page' },
        h('h4', null, JOURNAL_PAGES[9]!.title),
        h('p', null, JOURNAL_PAGES[9]!.text),
      ),
      h(
        'div',
        { class: 'ending-portraits' },
        ...(['herve', 'jo', 'nell'] as const).map((who) =>
          h('div', { class: 'npc-portrait', html: portraitSvg(who) }),
        ),
      ),
      h('p', { class: 'muted center' }, t('ending.post')),
      button(t('ending.continue'), () => app.ui.closeScreen(), {
        kind: 'primary',
        icon: 'compass',
        id: 'ending-continue',
        cls: 'btn-big',
      }),
    ),
  );
  return { id: 'ending', el, onClose: () => (params.onDone as (() => void) | undefined)?.() };
}

export function cabinScreen(): Screen {
  const game = app.game;
  const shell = screenShell(t('cabin.title'), 'home');
  const pickFish = (render: () => void): void => {
    const list = h('div', { class: 'list' });
    if (game.state.creel.length === 0) list.append(h('p', { class: 'muted' }, t('cabin.noFish')));
    for (const fish of game.state.creel) {
      list.append(
        fishRow(fish, [
          button(
            '',
            () => {
              game.toAquarium(fish.uid);
              app.save();
              close();
              render();
            },
            { small: true, icon: 'plus', label: t('cabin.add') },
          ),
        ]),
      );
    }
    const close = app.ui.modal(
      h(
        'div',
        { class: 'dialog' },
        h('h2', null, t('cabin.pick')),
        list,
        h(
          'div',
          { class: 'dialog-actions' },
          button(t('common.close'), () => close(), { kind: 'ghost' }),
        ),
      ),
    );
  };
  const render = (): void => {
    const body = shell.body;
    const state = game.state;
    const s = state.stats;
    clear(body);
    const tank = h('div', { class: 'tank', id: 'aquarium' });
    state.aquarium.forEach((fish, i) => {
      const species = getSpecies(fish.speciesId);
      tank.append(
        h(
          'button',
          {
            class: 'tank-fish',
            type: 'button',
            title: `${fishLabel(fish, species)} — ${t('cabin.remove')}`,
            'aria-label': `${fishLabel(fish, species)} — ${t('cabin.remove')}`,
            style: {
              top: `${12 + ((i * 37) % 64)}%`,
              animationDuration: `${9 + (i % 3) * 3}s`,
              animationDelay: `${-i * 2.3}s`,
            },
            onclick: () => {
              if (game.fromAquarium(fish.uid)) {
                app.save();
                render();
              } else
                app.ui.toast(
                  t('catch.full', { n: state.creel.length, max: game.stats().creelSize }),
                  'warn',
                  'net',
                );
            },
          },
          fishArt(species, fish.variant),
        ),
      );
    });
    if (state.aquarium.length === 0) tank.append(h('p', { class: 'tank-empty' }, t('cabin.empty')));
    const stat = (label: string, value: string): HTMLElement =>
      h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value));
    const hours = Math.floor(s.playSeconds / 3600);
    const minutes = Math.floor((s.playSeconds % 3600) / 60);
    body.append(
      h('h3', { class: 'section-title' }, icon('bed'), t('cabin.rest')),
      h(
        'p',
        { class: 'muted' },
        t('cabin.rest.text', {
          luck: Math.round(BALANCE.rest.luck * 100),
          xp: Math.round((BALANCE.rest.xpMult - 1) * 100),
          h: BALANCE.rest.hours,
        }),
      ),
      h(
        'div',
        { class: 'rest-grid' },
        ...DAY_PHASES.map((phase) =>
          button(
            t('cabin.sleep', { phase: t(`phase.${phase}`) }),
            () => {
              game.rest(phase);
              app.audio.sfx('page');
              app.ui.toast(t('cabin.slept', { time: formatClock(game.state.clockMinutes) }), 'good', 'bed');
              app.save();
              render();
            },
            {
              small: true,
              icon: phase === 'night' ? 'moon' : phase === 'day' ? 'sun' : phase,
              cls: `rest-${phase}`,
            },
          ),
        ),
      ),
      h('h3', { class: 'section-title' }, icon('aquarium'), t('cabin.aquarium')),
      h(
        'p',
        { class: 'muted' },
        t('cabin.aquarium.text', { n: state.aquarium.length, max: BALANCE.aquariumSlots }),
      ),
      tank,
      button(t('cabin.add'), () => pickFish(render), {
        icon: 'plus',
        disabled: state.aquarium.length >= BALANCE.aquariumSlots,
      }),
      h('h3', { class: 'section-title' }, icon('book'), t('cabin.stats')),
      h(
        'dl',
        { class: 'kv-list' },
        stat(t('cabin.stat.casts'), formatNumber(s.casts)),
        stat(t('cabin.stat.catches'), formatNumber(s.catches)),
        stat(t('cabin.stat.perfect'), formatNumber(s.perfectCasts)),
        stat(t('cabin.stat.released'), formatNumber(s.released)),
        stat(t('cabin.stat.breaks'), formatNumber(s.lineBreaks)),
        stat(t('cabin.stat.earned'), formatNumber(s.coinsEarned)),
        stat(t('cabin.stat.biggest'), s.biggestCm > 0 ? formatSize(s.biggestCm) : '—'),
        stat(t('cabin.stat.time'), `${hours} h ${String(minutes).padStart(2, '0')}`),
      ),
    );
  };
  render();
  return { id: 'cabin', el: shell.el, refresh: render };
}
