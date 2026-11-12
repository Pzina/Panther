import Phaser from 'phaser';
import { app } from './app';
import { AudioEngine } from './audio/engine';
import { AUTOSAVE_SECONDS, GAME_NAME } from './config/constants';
import { Game } from './core/game';
import { formatNumber, setLanguage, t } from './core/i18n';
import { randomSeed } from './core/rng';
import { createIndexedDbMirror, MemoryStorage, SaveManager, type StorageLike } from './core/save';
import { createNewState, type GameState } from './core/state';
import { getAchievement } from './data/achievements';
import { JOURNAL_PAGES, TIPS } from './data/dialogues';
import { getZone } from './data/zones';
import { BootScene } from './scenes/BootScene';
import { FishingScene } from './scenes/FishingScene';
import { PortScene } from './scenes/PortScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { claimableMilestones, collectionPercent } from './systems/progression';
import { button, h } from './ui/dom';
import { FishingHud, HomeHud, PortHud } from './ui/hud';
import { registerScreens } from './ui/screens';
import { Ui, wait } from './ui/ui';
import { rewardLine } from './ui/widgets';
import './ui/style.css';

const MAX_DPR = 2.5;

function pickStorage(): StorageLike {
  try {
    const probe = '__ressac_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

const debug = new URLSearchParams(window.location.search).get('debug') === '1';
const saves = new SaveManager(pickStorage(), createIndexedDbMirror());
const loaded = saves.load();
const root = document.getElementById('app')!;
document.title = GAME_NAME;

// ───────────────────────── Application context ─────────────────────────

app.debug = debug;
app.saves = saves;
app.audio = new AudioEngine();
app.ui = new Ui(root);
app.phaser = null;
app.hasSave = () => app.game.state.flags.introSeen || app.game.state.stats.catches > 0;
app.save = () => {
  if (app.hasSave()) saves.save(app.game.state);
};
app.haptic = (pattern) => {
  if (!app.game.state.settings.vibration || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
};
app.applySettings = () => {
  const s = app.game.state.settings;
  app.audio.setVolumes({ music: s.music, sfx: s.sfx, ambience: s.ambience });
  setLanguage(s.lang);
  document.documentElement.style.setProperty('--text-scale', String(s.textScale));
  const body = document.body.classList;
  body.toggle('left-handed', s.leftHanded);
  body.toggle('colorblind', s.colorblind);
  body.toggle('reduced-motion', s.reducedMotion);
};

let lastClaimable = 0;

function bindGame(game: Game): void {
  const ui = app.ui;
  const ev = game.events;
  ev.on('change', () => {
    ui.refresh();
    const claimable = claimableMilestones(game.state).length;
    if (claimable > lastClaimable) ui.toast(t('notify.milestone'), 'good', 'gift');
    lastClaimable = claimable;
  });
  ev.on('toast', ({ text, kind, icon }) => ui.toast(text, kind, icon));
  ev.on('levelUp', ({ level }) => {
    app.audio.sfx('levelup');
    ui.toast(t('notify.level', { n: level }), 'good', 'level');
  });
  ev.on('achievement', ({ id }) => {
    const a = getAchievement(id);
    if (a) ui.toast(t('notify.achievement', { name: a.name }), 'good', 'trophy');
  });
  ev.on('storyComplete', ({ mission }) => {
    ui.enqueue(async () => {
      await ui.dialogue(mission.outro);
      await ui.notice(t('notify.mission.done'), h('div', null, h('p', null, mission.title), rewardLine(mission.reward)), t('common.continue'), 'check');
      app.save();
    });
    ui.enqueue(async () => showStoryIntro());
  });
  ev.on('zoneUnlocked', ({ zone }) => {
    ui.enqueue(() => ui.notice(t('notify.zone.title'), t('notify.zone.text', { name: getZone(zone).name }), t('common.ok'), 'map'));
  });
  ev.on('journalPage', ({ page }) => {
    const p = JOURNAL_PAGES[page - 1];
    if (!p) return;
    ui.enqueue(() =>
      ui.notice(t('notify.journal.title', { n: page }), h('div', { class: 'journal-page' }, h('h4', null, p.title), h('p', null, p.text)), t('common.continue'), 'book'),
    );
  });
  ev.on('ending', () => {
    ui.enqueue(
      () =>
        new Promise<void>((resolve) => {
          ui.open('ending', { onDone: resolve });
        }),
    );
  });
  lastClaimable = claimableMilestones(game.state).length;
}

app.loadState = (state: GameState) => {
  if (debug) state.flags.debug = true;
  app.game = new Game(state);
  bindGame(app.game);
  app.applySettings();
  app.ui.refresh();
};

app.loadState(loaded.state ?? createNewState(randomSeed()));

// ───────────────────────── Flow ─────────────────────────

async function showStoryIntro(): Promise<void> {
  const game = app.game;
  const mission = game.currentStory();
  if (!mission || game.state.story.introSeen || !game.state.flags.tutorialDone) return;
  await app.ui.dialogue(mission.intro);
  game.markStoryIntroSeen();
  app.save();
}

let welcomedThisSession = false;

function welcome(): void {
  const game = app.game;
  const ui = app.ui;
  if (welcomedThisSession || !game.state.flags.tutorialDone) return;
  welcomedThisSession = true;
  const offline = game.offlineGains();
  if (offline) {
    const duration = offline.hours >= 1 ? t('offline.hours', { n: Math.floor(offline.hours) }) : t('offline.minutes', { n: Math.round(offline.hours * 60) });
    ui.enqueue(async () => {
      game.collectOffline();
      app.audio.sfx('coins');
      await ui.notice(t('offline.title'), h('div', null, h('p', null, t('offline.text', { hours: duration })), rewardLine({ coins: offline.coins })), t('common.ok'), 'net');
      app.save();
    });
  } else {
    game.state.lastSeen = Date.now();
  }
  const bonus = game.loginBonus();
  if (bonus) {
    ui.enqueue(async () => {
      game.claimLoginBonus();
      app.audio.sfx('coins');
      await ui.notice(t('login.title'), h('div', null, h('p', null, t('login.text', { day: bonus.day })), rewardLine(bonus.reward)), t('login.claim'), 'gift');
      app.save();
    });
  }
  ui.enqueue(async () => showStoryIntro());
}

async function enterGame(): Promise<void> {
  const game = app.game;
  game.ensureDaily();
  if (!game.state.flags.tutorialDone && game.state.stats.catches === 0) {
    game.state.zone = 'anse';
    await app.ui.setMode('fishing');
  } else {
    await app.ui.setMode('port');
  }
}

function startIntro(): void {
  app.ui.open('intro', {
    onDone: () => {
      app.game.state.flags.introSeen = true;
      app.save();
      void enterGame();
    },
  });
}

async function newGame(): Promise<void> {
  const ui = app.ui;
  if (app.hasSave()) {
    const game = app.game;
    const ok = await ui.confirm(
      t('home.new.title'),
      t('home.new.text', { day: game.day, percent: Math.floor(collectionPercent(game.state)) }),
      t('home.new.ok'),
      true,
    );
    if (!ok) return;
  }
  const settings = { ...app.game.state.settings };
  saves.clear();
  const fresh = createNewState(randomSeed());
  fresh.settings = settings;
  app.loadState(fresh);
  welcomedThisSession = true;
  startIntro();
}

function play(): void {
  if (!app.hasSave()) {
    welcomedThisSession = true;
    startIntro();
  } else void enterGame();
}

app.ui.registerHud('home', () => new HomeHud({ play, newGame: () => void newGame() }));
app.ui.registerHud('port', () => new PortHud());
app.ui.registerHud('fishing', () => new FishingHud());
registerScreens(app.ui);
app.ui.holdNotifications = () => app.ui.mode === 'home' || (app.ui.mode === 'fishing' && !app.game.state.flags.tutorialDone);
app.ui.onModeChange = (mode) => {
  document.body.dataset.mode = mode;
  if (mode !== 'home') {
    app.audio.unlock();
  } else {
    app.ui.root.classList.remove('night');
  }
  if (mode === 'port') {
    const flags = app.game.state.flags;
    // Tutorial: "go back to the port" is done as soon as the player is there.
    if (!flags.tutorialDone && flags.tutorialStep >= 3 && flags.tutorialStep < 5) {
      flags.tutorialStep = 5;
      app.ui.hud?.refresh();
    }
    welcome();
  }
};

/** Offers the backup when the main save could not be read. */
async function handleCorruptedSave(): Promise<void> {
  const ui = app.ui;
  if (!loaded.corrupted) return;
  const backup = loaded.backup;
  if (backup) {
    const content = h(
      'div',
      { class: 'dialog' },
      h('h2', null, t('home.corrupt.title')),
      h('p', null, t('home.corrupt.text', { day: Math.floor(backup.clockMinutes / 1440) + 1, coins: formatNumber(backup.coins) })),
      h(
        'div',
        { class: 'dialog-actions' },
        button(t('home.corrupt.fresh'), () => close(), { kind: 'ghost', id: 'corrupt-fresh' }),
        button(t('home.corrupt.restore'), () => {
          app.loadState(backup);
          saves.save(backup);
          close();
          ui.hud?.refresh();
        }, { kind: 'primary', id: 'corrupt-restore' }),
      ),
    );
    const close = ui.modal(content, { dismissible: false });
  } else {
    await ui.notice(t('home.corrupt.title'), t('home.corrupt.none'), t('common.ok'), 'info');
  }
}

// ───────────────────────── Splash & Phaser ─────────────────────────

const splash = document.getElementById('splash');
const splashBar = document.getElementById('splash-bar');
const splashTip = document.getElementById('splash-tip');
if (splashTip) splashTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]!;
const splashStart = performance.now();

function canvasSize(): { width: number; height: number; dpr: number } {
  const rect = root.getBoundingClientRect();
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  return { width: Math.max(1, Math.round(rect.width * dpr)), height: Math.max(1, Math.round(rect.height * dpr)), dpr };
}

const size = canvasSize();
const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0f2a3d',
  banner: false,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.NONE, width: size.width, height: size.height, zoom: 1 / size.dpr },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  fps: { target: 60, smoothStep: true },
  input: { activePointers: 2 },
  audio: { noAudio: true },
  scene: [BootScene, PreloadScene, TitleScene, PortScene, FishingScene],
});
app.phaser = phaser;

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const s = canvasSize();
    phaser.scale.setZoom(1 / s.dpr);
    phaser.scale.resize(s.width, s.height);
  }, 80);
});

phaser.events.on('ressac-progress', (p: number) => {
  if (splashBar) splashBar.style.width = `${Math.round(p * 100)}%`;
});
phaser.events.once('ressac-ready', () => {
  void (async () => {
    const elapsed = performance.now() - splashStart;
    if (elapsed < 900) await wait(900 - elapsed);
    phaser.scene.stop('Preload');
    await app.ui.setMode('home', true);
    splash?.classList.add('is-done');
    setTimeout(() => splash?.remove(), 700);
    document.body.dataset.ready = '1';
    if (!loaded.state && !loaded.corrupted) {
      const mirrored = await saves.loadFromMirror();
      if (mirrored) {
        app.loadState(mirrored);
        app.ui.hud?.refresh();
      }
    }
    await handleCorruptedSave();
  })();
});

// ───────────────────────── Platform glue ─────────────────────────

// Back button (Android, gesture, browser): every navigation pushes a history entry we consume.
history.replaceState({ ressac: 'root' }, '');
history.pushState({ ressac: 'guard' }, '');
window.addEventListener('popstate', () => {
  if (app.ui.back()) history.pushState({ ressac: 'guard' }, '');
  else history.back();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') app.ui.back();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    app.save();
    app.audio.setSuspended(true);
    if (app.ui.mode === 'fishing' && !app.ui.covered) app.ui.open('pause');
  } else {
    app.audio.setSuspended(false);
  }
});
window.addEventListener('pagehide', () => app.save());
setInterval(() => app.save(), AUTOSAVE_SECONDS * 1000);

if ('serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol !== 'capacitor:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

// Exposed for automated tests (read-only use).
(window as unknown as { ressac: typeof app }).ressac = app;
