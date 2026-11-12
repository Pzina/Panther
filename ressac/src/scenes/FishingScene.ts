import Phaser from 'phaser';
import { app } from '../app';
import { Backdrop } from '../art/backdrop';
import { mixNum } from '../art/color';
import { drawBobber } from '../art/props';
import { BALANCE } from '../config/balance';
import type { BitePlan } from '../core/game';
import { Rng } from '../core/rng';
import { TUTORIAL_STEPS } from '../data/dialogues';
import { getCosmetic } from '../data/equipment';
import type { Zone } from '../data/types';
import { getZone } from '../data/zones';
import { FightModel } from '../systems/fight';
import { rarityRank } from '../systems/fishing';
import type { FishingHud } from '../ui/hud';
import { showCatchCard } from '../ui/screens/catchCard';
import { BaseScene } from './BaseScene';
import { ensureFishTexture } from './PreloadScene';

export type FishingState =
  'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'fight' | 'landing' | 'result';

interface Shadow {
  x: number;
  d: number;
  dir: number;
  speed: number;
  size: number;
  phase: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  max: number;
  scale: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  size: number;
}

interface Shoal {
  x: number;
  d: number;
  vx: number;
  phase: number;
}

const AIM_RANGE = 130;

/** The heart of the game: cast, wait, hook, fight, land. */
export class FishingScene extends BaseScene {
  state: FishingState = 'idle';
  private zone!: Zone;
  private backdrop!: Backdrop;
  private underG!: Phaser.GameObjects.Graphics;
  private bobberG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private boatG!: Phaser.GameObjects.Graphics;
  private rodG!: Phaser.GameObjects.Graphics;
  private glowG!: Phaser.GameObjects.Graphics;
  private bang!: Phaser.GameObjects.Text;
  private fishSprite!: Phaser.GameObjects.Image;
  private hud!: FishingHud;
  private fx = new Rng(1);

  private t = 0;
  private stateTime = 0;
  private holding = false;
  private pointerX = 195;
  private power = 0;
  private aim = 0;
  private depth = 0;
  private perfect = false;
  private bobber = { x: 195, y: 500, scale: 1, dip: 0, visible: false };
  private castFrom = { x: 0, y: 0 };
  private castTo = { x: 0, y: 0, scale: 1 };
  private plan: BitePlan | null = null;
  private biteAt = 0;
  private nibbles: number[] = [];
  private nibbleUntil = 0;
  private model: FightModel | null = null;
  private fishPos = { x: 195, y: 400 };
  private reelTick = 0;
  private pulseTick = 0;
  private lastFlips = 0;
  private lastJerks = 0;
  private wasWarning = false;
  private shadows: Shadow[] = [];
  private ripples: Ripple[] = [];
  private particles: Particle[] = [];
  private shoals: Shoal[] = [];
  private inShoal = false;
  private lastSoundKey = '';
  private rodTip = { x: 195, y: 600 };
  private bend = 0;

  constructor() {
    super('Fishing');
  }

  private get side(): number {
    return app.game.state.settings.leftHanded ? -1 : 1;
  }
  private get nearY(): number {
    return this.H - 196;
  }
  private get tutorial(): boolean {
    return !app.game.state.flags.tutorialDone;
  }

  protected build(): void {
    const game = app.game;
    this.zone = getZone(game.state.zone);
    this.hud = app.ui.hud as FishingHud;
    this.fx = new Rng((Date.now() & 0xfffff) + 7);
    this.t = 0;
    this.holding = false;
    this.model = null;
    this.plan = null;
    this.ripples = [];
    this.particles = [];
    this.lastSoundKey = '';
    this.backdrop = new Backdrop(this, {
      zone: this.zone.id,
      horizon: 0.25,
      hour: () => game.hour,
      weather: () => game.weather(),
      reducedMotion: () => game.state.settings.reducedMotion,
      onThunder: () => {
        app.audio.sfx('thunder');
        app.haptic(120);
      },
    });
    this.underG = this.add.graphics().setDepth(8);
    this.fxG = this.add.graphics().setDepth(24);
    this.bobberG = this.add.graphics().setDepth(25);
    this.boatG = this.add.graphics().setDepth(30);
    this.rodG = this.add.graphics().setDepth(32);
    this.fishSprite = this.add.image(0, 0, '__DEFAULT').setDepth(40).setVisible(false);
    this.glowG = this.add.graphics().setDepth(64);
    this.bang = this.add
      .text(0, 0, '!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '54px',
        fontStyle: '900',
        color: '#ffe36a',
        stroke: '#1d3344',
        strokeThickness: 8,
      })
      .setOrigin(0.5, 1)
      .setDepth(70)
      .setVisible(false)
      .setResolution(Math.min(3, Math.ceil(this.rs)));

    this.shadows = Array.from({ length: 7 }, () => this.newShadow());
    this.shoals =
      this.zone.gimmick === 'shoals'
        ? [
            { x: 110, d: 0.35, vx: 5, phase: 0 },
            { x: 280, d: 0.7, vx: -4, phase: 2 },
          ]
        : [];

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => (this.pointerX = p.worldX));
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.holding = false;
      app.audio.setTension(0);
    });
    // Keyboard bonus on desktop: space bar acts like a finger.
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.holding) this.onDown(undefined);
    });
    this.input.keyboard?.on('keyup-SPACE', () => this.onUp());

    this.setState('idle');
  }

  protected layout(): void {
    this.backdrop.layout(this.W, this.H);
    this.drawBoat();
  }

  protected override teardown(): void {
    this.backdrop.destroy();
    app.audio.setTension(0);
    app.ui.busy = false;
  }

  private newShadow(): Shadow {
    const dir = this.fx.chance(0.5) ? 1 : -1;
    return {
      x: this.fx.range(0, this.W),
      d: this.fx.range(0.05, 0.95),
      dir,
      speed: this.fx.range(10, 26),
      size: this.fx.range(0.6, 1.4),
      phase: this.fx.range(0, 6.28),
    };
  }

  // ───────────────────────── State machine ─────────────────────────

  private setState(state: FishingState): void {
    this.state = state;
    this.stateTime = 0;
    const game = app.game;
    this.hud.setState(state);
    this.hud.setHint(null);
    if (state !== 'charging') this.hud.setPower(null);
    if (state !== 'fight') {
      this.hud.setFight(null, false);
      app.audio.setTension(0);
    }
    this.bang.setVisible(state === 'bite');
    switch (state) {
      case 'idle':
        this.bobber.visible = false;
        this.plan = null;
        this.model = null;
        app.ui.busy = false;
        this.hud.setPrompt(
          game.creelFull() ? 'Vivier plein — vous pouvez encore relâcher' : 'Maintenez pour lancer',
        );
        app.ui.flush();
        break;
      case 'charging':
        this.hud.setPrompt('Glissez pour viser, relâchez pour lancer');
        break;
      case 'casting':
        this.hud.setPrompt('');
        break;
      case 'waiting':
        this.hud.setPrompt('Attendez la touche…');
        break;
      case 'bite':
        this.hud.setPrompt('FERREZ !', 'alert');
        break;
      case 'fight':
        app.ui.busy = true;
        this.hud.setPrompt('Maintenez pour mouliner, relâchez pour laisser filer');
        break;
      case 'landing':
      case 'result':
        this.hud.setPrompt('');
        break;
    }
    this.syncTutorial();
  }

  private syncTutorial(): void {
    if (!this.tutorial) {
      this.hud.setTutorial(null);
      return;
    }
    const step = app.game.state.flags.tutorialStep;
    this.hud.setTutorial(step <= 4 ? (TUTORIAL_STEPS[step]?.text ?? null) : null);
  }

  private tutorialStep(step: number): void {
    const flags = app.game.state.flags;
    if (!this.tutorial || flags.tutorialStep >= step || flags.tutorialStep > 4) return;
    flags.tutorialStep = step;
    this.syncTutorial();
  }

  private onDown(pointer: Phaser.Input.Pointer | undefined): void {
    if (pointer) this.pointerX = pointer.worldX;
    this.holding = true;
    app.audio.unlock();
    switch (this.state) {
      case 'idle':
        this.power = 0;
        this.setState('charging');
        break;
      case 'waiting':
        if (this.stateTime > 0.45) this.reelIn();
        break;
      case 'bite':
        this.hook();
        break;
      default:
        break;
    }
  }

  private onUp(): void {
    const wasHolding = this.holding;
    this.holding = false;
    if (this.state === 'charging' && wasHolding) this.releaseCast();
  }

  private landingPoint(power: number, aim: number): { x: number; y: number; scale: number; depth: number } {
    const depth = Math.min(1, Math.max(0, power)) * app.game.stats().reach;
    return {
      x: this.W / 2 + aim * AIM_RANGE * (1 - 0.45 * depth),
      y: this.backdrop.waterY(depth, this.nearY),
      scale: 1 - 0.55 * depth,
      depth,
    };
  }

  private releaseCast(): void {
    if (this.stateTime < 0.14) {
      this.setState('idle');
      this.hud.setPrompt('Maintenez le doigt pour charger le lancer');
      return;
    }
    const c = BALANCE.cast;
    this.perfect = Math.abs(this.power - c.sweetSpot) <= c.perfectWindow;
    this.depth = app.game.registerCast(this.power, this.perfect);
    const target = this.landingPoint(this.power, this.aim);
    this.castFrom = { x: this.rodTip.x, y: this.rodTip.y };
    this.castTo = { x: target.x, y: target.y, scale: target.scale };
    this.bobber.visible = true;
    app.audio.sfx('cast');
    app.haptic(15);
    this.tutorialStep(1);
    this.setState('casting');
    if (this.perfect) {
      this.hud.setPrompt('Lancer parfait !', 'good');
      this.burst(this.rodTip.x, this.rodTip.y, 0xffe36a, 10);
    }
  }

  private land(): void {
    const game = app.game;
    this.bobber.x = this.castTo.x;
    this.bobber.y = this.castTo.y;
    this.bobber.scale = this.castTo.scale;
    app.audio.sfx('splash');
    this.ripple(this.bobber.x, this.bobber.y, this.bobber.scale);
    this.splash(this.bobber.x, this.bobber.y, 8, this.bobber.scale);

    // Zone gimmicks that apply when the bobber lands.
    let luck = 0;
    let delayMult = 1;
    this.inShoal = false;
    for (const shoal of this.shoals) {
      const sy = this.backdrop.waterY(shoal.d, this.nearY);
      if (Math.hypot(shoal.x - this.bobber.x, (sy - this.bobber.y) * 1.6) < 52) this.inShoal = true;
    }
    if (this.inShoal) {
      luck += 0.35;
      delayMult *= 0.6;
      app.ui.toast('Dans le banc ! Chance et touches rapides.', 'good', 'sparkle');
    }
    if (this.zone.gimmick === 'still' && this.perfect) {
      delayMult *= 0.55;
      app.ui.toast('Eau dormante : les poissons accourent.', 'good', 'target');
    }
    const first = this.tutorial && game.state.stats.catches === 0;
    this.plan = game.planBite(this.depth, this.perfect, {
      luck,
      delayMult,
      force: first ? 'gobie' : undefined,
    });
    if (first) {
      this.plan.delay = 2.4;
      this.plan.window = 1;
      this.plan.fakeBites = 0;
    }
    if (this.zone.gimmick === 'swell') this.plan.fakeBites = Math.min(3, this.plan.fakeBites + 1);
    this.biteAt = this.plan.delay;
    this.nibbles = [];
    for (let i = 0; i < this.plan.fakeBites; i++) {
      if (this.plan.delay > 2.4) this.nibbles.push(this.fx.range(1, this.plan.delay - 1.2));
    }
    this.nibbleUntil = 0;
    void ensureFishTexture(this, this.plan.species.id, this.plan.fish.variant);
    this.setState('waiting');
    if (this.perfect) this.hud.setPrompt('Lancer parfait ! Attendez la touche…', 'good');
  }

  private reelIn(): void {
    const tooEarly = this.t < this.nibbleUntil || this.biteAt - this.stateTime < 0.35;
    app.ui.toast(
      tooEarly ? 'Trop tôt ! Le poisson a filé.' : 'Ligne remontée.',
      tooEarly ? 'warn' : 'info',
      'hook',
    );
    this.setState('idle');
  }

  private bite(): void {
    if (!this.plan) return;
    this.setState('bite');
    this.bobber.dip = 1;
    app.audio.sfx('bite');
    app.haptic([70, 40, 70]);
    this.ripple(this.bobber.x, this.bobber.y, this.bobber.scale * 1.4);
    this.splash(this.bobber.x, this.bobber.y, 6, this.bobber.scale);
    this.tutorialStep(2);
  }

  private hook(): void {
    if (!this.plan) return;
    const game = app.game;
    const forgiving = this.tutorial && game.state.stats.catches === 0;
    const params = game.startFight(this.plan, forgiving);
    this.model = new FightModel(params, new Rng(game.rng.int(1, 0x7fffffff)));
    this.lastFlips = 0;
    this.lastJerks = 0;
    this.wasWarning = false;
    this.fishPos = { x: this.bobber.x, y: this.bobber.y };
    this.bobber.visible = false;
    app.audio.sfx('splash');
    app.haptic(40);
    this.splash(this.bobber.x, this.bobber.y, 10, this.bobber.scale);
    this.tutorialStep(3);
    this.setState('fight');
  }

  private missed(): void {
    if (this.tutorial && app.game.state.stats.catches === 0) {
      // The very first fish gives as many chances as needed.
      this.bobber.dip = 0;
      this.biteAt = 1.6;
      this.setState('waiting');
      this.hud.setPrompt('Raté ! Il revient… touchez dès que le bouchon plonge');
      return;
    }
    app.game.failCatch('missed');
    app.audio.sfx('escape');
    app.ui.toast("Trop tard… il s'est échappé avec l'appât.", 'warn', 'hook');
    this.setState('idle');
  }

  private endFight(): void {
    const model = this.model;
    const plan = this.plan;
    if (!model || !plan) return;
    if (model.status === 'caught') {
      void this.landFish(plan);
      return;
    }
    if (model.status === 'snapped') {
      app.game.failCatch('snapped');
      app.audio.sfx('snap');
      app.haptic(220);
      app.ui.toast('Le fil a cassé ! Trop de tension.', 'warn', 'line');
    } else {
      app.game.failCatch('escaped');
      app.audio.sfx('escape');
      app.haptic(80);
      app.ui.toast('Décroché… le fil était trop mou.', 'warn', 'hook');
    }
    this.splash(this.fishPos.x, this.fishPos.y, 12, 1);
    this.setState('idle');
  }

  private async landFish(plan: BitePlan): Promise<void> {
    const game = app.game;
    this.setState('landing');
    const rare = rarityRank(plan.species.rarity) >= rarityRank('rare') || plan.fish.variant !== 'normal';
    app.audio.sfx(rare ? 'rare' : 'catch');
    app.haptic(rare ? [60, 40, 60, 40, 120] : 60);
    this.splash(this.fishPos.x, this.fishPos.y, 18, 1.2);
    if (rare) this.burst(this.fishPos.x, this.fishPos.y - 30, 0xffd84a, 26);

    const key = await ensureFishTexture(this, plan.species.id, plan.fish.variant);
    if (this.state !== 'landing') return;
    const sprite = this.fishSprite;
    if (this.textures.exists(key)) {
      sprite.setTexture(key).setVisible(true).setAlpha(1);
      sprite.setPosition(this.fishPos.x, this.fishPos.y).setScale(0.12).setRotation(-0.9);
      const reduced = game.state.settings.reducedMotion;
      this.tweens.add({
        targets: sprite,
        x: this.W / 2,
        y: this.H * 0.4,
        scale: 0.62,
        rotation: reduced ? 0 : 0.12,
        duration: reduced ? 200 : 620,
        ease: 'Back.easeOut',
      });
    }
    await new Promise<void>((resolve) =>
      this.time.delayedCall(game.state.settings.reducedMotion ? 220 : 720, resolve),
    );
    if (this.state !== 'landing') return;

    const result = game.completeCatch(plan.fish);
    this.tutorialStep(4);
    this.setState('result');
    app.ui.busy = true;
    const choice = await showCatchCard(result);
    sprite.setVisible(false);
    if (choice === 'release') {
      game.releaseFish(result.fish);
      app.audio.sfx('release');
      app.ui.toast('Relâché. Votre réputation grandit.', 'good', 'heart');
    } else {
      result.fish.locked = choice === 'keep';
      if (!game.keepFish(result.fish)) {
        game.releaseFish(result.fish);
        app.ui.toast('Vivier plein : le poisson a été relâché.', 'warn', 'net');
      }
    }
    app.save();
    this.setState('idle');
  }

  // ───────────────────────── Effects ─────────────────────────

  private ripple(x: number, y: number, scale: number): void {
    this.ripples.push({ x, y, age: 0, max: 1.3, scale });
  }

  private splash(x: number, y: number, count: number, scale: number): void {
    if (app.game.state.settings.reducedMotion) count = Math.ceil(count / 3);
    const color = mixNum(this.zone.palette.waterTop, 0xffffff, 0.7);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: this.fx.range(-70, 70) * scale,
        vy: this.fx.range(-190, -70) * scale,
        life: this.fx.range(0.4, 0.8),
        color,
        size: this.fx.range(1.5, 3.2) * scale,
      });
    }
  }

  private burst(x: number, y: number, color: number, count: number): void {
    if (app.game.state.settings.reducedMotion) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = this.fx.range(0, Math.PI * 2);
      const v = this.fx.range(40, 170);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: this.fx.range(0.5, 1),
        color,
        size: this.fx.range(2, 4),
      });
    }
  }

  // ───────────────────────── Update ─────────────────────────

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const game = app.game;
    this.t += dt;
    this.stateTime += dt;
    game.advance(dt);
    this.backdrop.update(dt);
    this.syncAmbience();

    switch (this.state) {
      case 'charging':
        this.updateCharging();
        break;
      case 'casting':
        this.updateCasting();
        break;
      case 'waiting':
        this.updateWaiting(dt);
        break;
      case 'bite':
        if (this.plan && this.stateTime > this.plan.window) this.missed();
        break;
      case 'fight':
        this.updateFight(dt);
        break;
      default:
        break;
    }

    this.updateEffects(dt);
    this.draw();
  }

  private syncAmbience(): void {
    const game = app.game;
    const key = `${game.phase()}-${game.weather()}`;
    if (key === this.lastSoundKey) return;
    this.lastSoundKey = key;
    app.audio.setScene({ zone: this.zone.id, phase: game.phase(), weather: game.weather() });
    app.ui.root.classList.toggle('night', game.phase() === 'night');
    this.hud.refresh();
  }

  private updateCharging(): void {
    const c = BALANCE.cast;
    const cycle = (this.stateTime / c.chargeSeconds) % 2;
    this.power = cycle <= 1 ? cycle : 2 - cycle;
    this.aim = Phaser.Math.Clamp((this.pointerX - this.W / 2) / AIM_RANGE, -1, 1);
    this.hud.setPower(this.power);
  }

  private updateCasting(): void {
    const duration = 0.55;
    const k = Math.min(1, this.stateTime / duration);
    const arc = Math.sin(Math.PI * k) * (90 + 120 * this.depth);
    this.bobber.x = this.castFrom.x + (this.castTo.x - this.castFrom.x) * k;
    this.bobber.y = this.castFrom.y + (this.castTo.y - this.castFrom.y) * k - arc;
    this.bobber.scale = 1 + (this.castTo.scale - 1) * k;
    this.bobber.dip = 0;
    if (k >= 1) this.land();
  }

  private updateWaiting(dt: number): void {
    // River current: the bobber drifts downstream until the line has to be recast.
    if (this.zone.gimmick === 'current') {
      this.bobber.x += 15 * this.bobber.scale * dt;
      if (this.bobber.x > this.W - 22) {
        app.ui.toast('Le courant a emporté la ligne. Visez en amont !', 'info', 'wave');
        this.setState('idle');
        return;
      }
    }
    const swell = this.zone.gimmick === 'swell' ? 2.4 : 1;
    this.bobber.dip = Math.sin(this.t * 2.2) * 0.08 * swell;
    const nibble = this.nibbles[0];
    if (nibble !== undefined && this.stateTime >= nibble) {
      this.nibbles.shift();
      this.nibbleUntil = this.t + 0.5;
      app.audio.sfx('nibble');
      app.haptic(12);
      this.ripple(this.bobber.x, this.bobber.y, this.bobber.scale * 0.7);
    }
    if (this.t < this.nibbleUntil) this.bobber.dip = 0.3 + Math.sin(this.t * 30) * 0.12;
    if (this.stateTime >= this.biteAt) this.bite();
  }

  private updateFight(dt: number): void {
    const model = this.model;
    if (!model) return;
    const game = app.game;
    model.update(dt, this.holding);

    // Fish position: it comes closer as the distance shrinks, zig-zagging.
    const d = this.depth * (0.15 + 0.85 * model.distance);
    const sway = Math.sin(model.time * (2 + model.params.difficulty * 3)) * 46 * (0.4 + 0.6 * model.distance);
    const baseX = this.W / 2 + (this.bobber.x - this.W / 2) * model.distance;
    this.fishPos.x = Phaser.Math.Clamp(baseX + sway, 24, this.W - 24);
    this.fishPos.y = this.backdrop.waterY(d, this.nearY);
    if (this.fx.chance(dt * 6)) this.ripple(this.fishPos.x, this.fishPos.y, 0.6 + 0.4 * (1 - d));

    // Feedback.
    if (this.holding) {
      this.reelTick -= dt;
      if (this.reelTick <= 0) {
        this.reelTick = 0.075 / model.params.reelSpeed;
        app.audio.sfx('reel');
      }
    }
    const over = Math.max(0, model.tension - model.safeHigh);
    app.audio.setTension(model.strain > 0.05 ? 0.3 + model.strain * 0.7 : over > 0 ? 0.25 : 0);
    const outside = !model.inSafeZone;
    this.pulseTick -= dt;
    if (outside && this.pulseTick <= 0) {
      this.pulseTick = 0.28;
      app.haptic(model.tension > model.safeHigh ? 28 : 14);
    }
    if (model.flips !== this.lastFlips) {
      this.lastFlips = model.flips;
      this.hud.setHint('Il change de cap !');
      app.haptic([20, 30, 20]);
      this.time.delayedCall(900, () => this.state === 'fight' && this.hud.setHint(null));
    }
    if (model.jerks !== this.lastJerks) {
      this.lastJerks = model.jerks;
      this.splash(this.fishPos.x, this.fishPos.y, 5, 0.8);
      app.haptic(22);
    }
    const warning = model.jumpWarning > 0;
    if (warning && !this.wasWarning) app.haptic([15, 40, 15]);
    this.wasWarning = warning;
    if (warning) this.hud.setHint('Il va sauter : relâchez !');
    else if (model.jumping > 0) {
      this.hud.setHint('Saut !');
      if (model.jumping > 0.4) {
        app.audio.sfx('jump');
        this.splash(this.fishPos.x, this.fishPos.y, 12, 1);
      }
    } else if (model.surge > 0) this.hud.setHint('Il plonge : laissez filer !');
    else if (model.flips === this.lastFlips && this.stateTime > 1 && !this.hud.hintLocked)
      this.hud.setHint(null);

    // Darkness: the gauge is only readable in flashes.
    const dim = this.zone.gimmick === 'darkness' && this.t % 1.7 > 0.6 && !game.state.settings.assist;
    this.hud.setFight(model, dim);

    if (model.status !== 'active') this.endFight();
  }

  private updateEffects(dt: number): void {
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < r.max);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);

    const approach = this.state === 'waiting' && this.biteAt - this.stateTime < 1.6;
    this.shadows.forEach((s, index) => {
      if (index === 0 && (approach || this.state === 'bite')) {
        // The fish that is about to bite swims to the bobber.
        const ty = this.bobber.y;
        const sy = this.backdrop.waterY(s.d, this.nearY);
        s.x += (this.bobber.x - s.x) * Math.min(1, dt * 2.4);
        const ny = sy + (ty - sy) * Math.min(1, dt * 2.4);
        s.d = Phaser.Math.Clamp(
          Math.pow((ny - this.nearY) / (this.backdrop.horizonY + 26 - this.nearY), 1 / 0.85),
          0,
          1,
        );
        return;
      }
      s.x += s.dir * s.speed * dt;
      if (s.x < -40 || s.x > this.W + 40) {
        Object.assign(s, this.newShadow());
        s.x = s.dir > 0 ? -30 : this.W + 30;
      }
    });
    for (const shoal of this.shoals) {
      shoal.x += shoal.vx * dt;
      if (shoal.x < 60 || shoal.x > this.W - 60) shoal.vx *= -1;
    }
  }

  // ───────────────────────── Drawing ─────────────────────────

  private drawBoat(): void {
    const g = this.boatG;
    const { W, H } = this;
    const state = app.game.state;
    const hull = getCosmetic(state.cosmetics.boatColor);
    const outfit = getCosmetic(state.cosmetics.outfit);
    const cx = W / 2;
    g.clear();
    // Bow seen from the stern.
    g.fillStyle(hull.color, 1);
    g.beginPath();
    g.moveTo(cx - 170, H + 4);
    g.lineTo(cx - 128, H - 66);
    g.lineTo(cx, H - 126);
    g.lineTo(cx + 128, H - 66);
    g.lineTo(cx + 170, H + 4);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xc79a66, 1);
    g.beginPath();
    g.moveTo(cx - 150, H + 4);
    g.lineTo(cx - 112, H - 58);
    g.lineTo(cx, H - 110);
    g.lineTo(cx + 112, H - 58);
    g.lineTo(cx + 150, H + 4);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0xa87a48, 1);
    for (let i = -3; i <= 3; i++) g.lineBetween(cx + i * 34, H - 108 + Math.abs(i) * 17, cx + i * 40, H + 4);
    g.fillStyle(hull.color2, 1);
    g.fillTriangle(cx - 12, H - 104, cx + 12, H - 104, cx, H - 122);
    g.lineStyle(2.5, 0x1d3344, 1);
    g.beginPath();
    g.moveTo(cx - 170, H + 4);
    g.lineTo(cx - 128, H - 66);
    g.lineTo(cx, H - 126);
    g.lineTo(cx + 128, H - 66);
    g.lineTo(cx + 170, H + 4);
    g.strokePath();
    // The angler, from behind.
    const ax = cx - this.side * 34;
    const ay = H - 34;
    g.fillStyle(outfit.color, 1);
    g.fillEllipse(ax, ay + 18, 78, 62);
    if (outfit.style === 'striped' || outfit.style === 'plaid') {
      g.lineStyle(4, outfit.color2, 1);
      for (let i = -2; i <= 2; i++)
        g.lineBetween(ax - 34 + Math.abs(i) * 4, ay + 14 + i * 9, ax + 34 - Math.abs(i) * 4, ay + 14 + i * 9);
      if (outfit.style === 'plaid')
        for (let i = -1; i <= 1; i++) g.lineBetween(ax + i * 18, ay - 8, ax + i * 18, ay + 44);
    }
    g.lineStyle(2.5, 0x1d3344, 1);
    g.strokeEllipse(ax, ay + 18, 78, 62);
    g.fillStyle(0xe0b090, 1);
    g.fillCircle(ax, ay - 26, 17);
    // Hat or hood.
    g.fillStyle(outfit.style === 'beanie' || outfit.style === 'striped' ? outfit.color2 : outfit.color, 1);
    if (outfit.style === 'hood') g.fillCircle(ax, ay - 26, 20);
    else {
      g.slice(ax, ay - 28, 18, Math.PI, 0, false);
      g.fillPath();
      if (outfit.style !== 'beanie') g.fillEllipse(ax, ay - 28, 50, 9);
    }
    g.lineStyle(2, 0x1d3344, 1);
    g.strokeCircle(ax, ay - 26, outfit.style === 'hood' ? 20 : 17);
  }

  private draw(): void {
    const { W, H } = this;
    const game = app.game;
    const night = this.backdrop.darkness > 0.35;
    const fosse = this.zone.gimmick === 'darkness';

    // Under the surface: fish shadows, shoals.
    const u = this.underG;
    u.clear();
    const glow = this.glowG;
    glow.clear();
    for (const s of this.shadows) {
      const y = this.backdrop.waterY(s.d, this.nearY);
      const scale = (1 - 0.55 * s.d) * s.size;
      const wiggle = Math.sin(this.t * 5 + s.phase) * 3 * scale;
      if (fosse) {
        // In the dark, fish are betrayed by their own lights.
        for (let i = 0; i < 4; i++) {
          glow.fillStyle(this.zone.palette.accent, 0.5 - i * 0.09);
          glow.fillCircle(
            s.x - s.dir * i * 7 * scale,
            y + (i % 2 === 0 ? wiggle : -wiggle) * 0.4,
            2.2 * scale,
          );
        }
        continue;
      }
      u.fillStyle(0x0a2030, 0.24);
      u.fillEllipse(s.x, y, 34 * scale, 11 * scale);
      u.fillTriangle(
        s.x - s.dir * 15 * scale,
        y,
        s.x - s.dir * 27 * scale,
        y - 7 * scale + wiggle,
        s.x - s.dir * 27 * scale,
        y + 7 * scale + wiggle,
      );
    }
    for (const shoal of this.shoals) {
      const y = this.backdrop.waterY(shoal.d, this.nearY);
      const scale = 1 - 0.55 * shoal.d;
      u.fillStyle(0xffffff, 0.1);
      u.fillEllipse(shoal.x, y, 104 * scale, 44 * scale);
      for (let i = 0; i < 9; i++) {
        const a = this.t * 0.9 + shoal.phase + (i * Math.PI * 2) / 9;
        const fx = shoal.x + Math.cos(a) * 34 * scale * (0.5 + (i % 3) * 0.25);
        const fy = y + Math.sin(a * 1.3) * 12 * scale;
        u.fillStyle(i % 2 === 0 ? 0xfff2a8 : 0xffa8c8, 0.8);
        u.fillEllipse(fx, fy, 9 * scale, 4 * scale);
        if ((i + Math.floor(this.t * 3)) % 5 === 0) {
          u.fillStyle(0xffffff, 0.9);
          u.fillCircle(fx, fy - 3, 1.4);
        }
      }
    }

    // Ripples and particles.
    const f = this.fxG;
    f.clear();
    for (const r of this.ripples) {
      const k = r.age / r.max;
      f.lineStyle(2 * r.scale, 0xffffff, 0.6 * (1 - k));
      f.strokeEllipse(r.x, r.y, (16 + 70 * k) * r.scale, (6 + 24 * k) * r.scale);
    }
    for (const p of this.particles) {
      f.fillStyle(p.color, Math.min(1, p.life * 2));
      f.fillCircle(p.x, p.y, p.size);
    }

    // Rod.
    const rod = this.rodG;
    rod.clear();
    const handX = W / 2 + this.side * 6;
    const handY = H - 62;
    let tipX = W / 2 + this.side * 30;
    let tipY = H - 250;
    if (this.state === 'charging') {
      tipX = handX + this.side * (30 + this.power * 50) - this.aim * 20;
      tipY = H - 250 + this.power * 90;
    } else if (this.state === 'casting') {
      const k = Math.min(1, this.stateTime / 0.25);
      tipX = handX + (this.castTo.x - handX) * 0.25 * k + this.side * 20 * (1 - k);
      tipY = H - 180 - 80 * k;
    } else if (this.state === 'fight' && this.model) {
      const pull = 0.25 + this.model.tension * 0.5;
      tipX = handX + (this.fishPos.x - handX) * pull;
      tipY = H - 250 + this.model.tension * 46;
      if (!this.model.inSafeZone) {
        tipX += Math.sin(this.t * 60) * 2.5;
        tipY += Math.cos(this.t * 53) * 2.5;
      }
    } else if (this.bobber.visible) {
      tipX = handX + (this.bobber.x - handX) * 0.2;
    }
    this.rodTip = { x: tipX, y: tipY };
    this.bend += ((this.state === 'fight' && this.model ? this.model.tension : 0) - this.bend) * 0.2;
    const midX = (handX + tipX) / 2 - this.side * 10 * (1 - this.bend);
    const midY = (handY + tipY) / 2 - 16 - this.bend * 20;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(handX, handY),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(tipX, tipY),
    );
    rod.lineStyle(6, 0x5a3a22, 1);
    curve.draw(rod, 12);
    rod.lineStyle(3, 0x8a5a32, 1);
    curve.draw(rod, 12);
    rod.fillStyle(0x1d3344, 1);
    rod.fillCircle(handX, handY, 7);

    // Line and bobber.
    const b = this.bobberG;
    b.clear();
    const lineColor = night ? 0xdfe8f0 : 0xf6f6f0;
    if (this.state === 'fight' && this.model) {
      const jitter = this.model.inSafeZone ? 0 : Math.sin(this.t * 70) * 1.5;
      const strain = this.model.strain;
      b.lineStyle(1.6, mixNum(lineColor, 0xff4a3a, strain), 0.95);
      b.lineBetween(tipX, tipY, this.fishPos.x + jitter, this.fishPos.y);
      // The fish under the surface, or in the air when it jumps.
      const jump = this.model.jumping > 0 ? Math.sin((1 - this.model.jumping / 0.45) * Math.PI) : 0;
      const size = 0.7 + this.model.params.difficulty * 0.9;
      const fy = this.fishPos.y - jump * 60;
      const target = jump > 0 ? b : u;
      target.fillStyle(
        jump > 0 ? mixNum(this.zone.palette.waterBottom, 0x000000, 0.2) : 0x0a2030,
        jump > 0 ? 0.95 : 0.42,
      );
      target.fillEllipse(this.fishPos.x, fy, 40 * size, 14 * size);
      target.fillTriangle(
        this.fishPos.x + 18 * size,
        fy,
        this.fishPos.x + 34 * size,
        fy - 9 * size,
        this.fishPos.x + 34 * size,
        fy + 9 * size,
      );
      if (fosse) {
        glow.fillStyle(this.zone.palette.accent, 0.8);
        for (let i = -2; i <= 2; i++) glow.fillCircle(this.fishPos.x + i * 7 * size, fy, 2.2);
      }
      if (this.model.jumpWarning > 0) {
        f.lineStyle(3, 0xffe36a, 0.9);
        f.strokeCircle(this.fishPos.x, this.fishPos.y, 16 + this.model.jumpWarning * 30);
      }
    } else if (this.bobber.visible) {
      const sag = this.state === 'casting' ? 0 : 14;
      const line = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(tipX, tipY),
        new Phaser.Math.Vector2((tipX + this.bobber.x) / 2, (tipY + this.bobber.y) / 2 + sag),
        new Phaser.Math.Vector2(this.bobber.x, this.bobber.y - 8 * this.bobber.scale),
      );
      b.lineStyle(1.4, lineColor, 0.9);
      line.draw(b, 14);
      const cosmetic = getCosmetic(game.state.cosmetics.bobber);
      const dip = Phaser.Math.Clamp(this.bobber.dip, -0.2, 1);
      if (dip < 0.9)
        drawBobber(b, this.bobber.x, this.bobber.y, cosmetic, Math.max(0, dip), this.bobber.scale);
      if (night || cosmetic.style === 'glow') {
        glow.fillStyle(cosmetic.style === 'glow' ? cosmetic.color : 0xffe9a8, 0.3);
        glow.fillCircle(this.bobber.x, this.bobber.y - 4, 16 * this.bobber.scale);
        glow.fillStyle(0xffffff, 0.9);
        glow.fillCircle(this.bobber.x, this.bobber.y - 4 * this.bobber.scale, 2.4 * this.bobber.scale);
      }
    }

    // Aiming marker while charging.
    if (this.state === 'charging') {
      const target = this.landingPoint(this.power, this.aim);
      const sweet = Math.abs(this.power - BALANCE.cast.sweetSpot) <= BALANCE.cast.perfectWindow;
      f.lineStyle(2.5, sweet ? 0x7dffa8 : 0xffffff, 0.9);
      f.strokeEllipse(target.x, target.y, 34 * target.scale, 13 * target.scale);
      f.lineStyle(1.5, 0xffffff, 0.35);
      f.lineBetween(this.rodTip.x, this.rodTip.y, target.x, target.y);
    }

    if (this.state === 'bite') {
      const pop = 1 + Math.sin(this.stateTime * 24) * 0.12;
      this.bang.setPosition(this.bobber.x, this.bobber.y - 26 * this.bobber.scale).setScale(pop);
    }
  }
}
