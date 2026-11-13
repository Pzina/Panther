import * as THREE from 'three';
import { app } from '../../app';
import { BALANCE } from '../../config/balance';
import type { BitePlan } from '../../core/game';
import { Rng } from '../../core/rng';
import { TUTORIAL_STEPS } from '../../data/dialogues';
import { getBoat, getCosmetic } from '../../data/equipment';
import type { Zone } from '../../data/types';
import { getZone } from '../../data/zones';
import { FightModel } from '../../systems/fight';
import { rarityRank } from '../../systems/fishing';
import type { FishingHud } from '../../ui/hud';
import { moveInput, resetMove } from '../../ui/joystick';
import { showCatchCard } from '../../ui/screens/catchCard';
import { buildFish } from '../fishMesh';
import { makeBoat, makeBobber } from '../props';
import { Environment } from '../sky';
import { Stage, View } from '../stage';
import { bangTexture, dotTexture, woodTexture } from '../textures';
import { Water } from '../water';
import { buildZoneLand } from '../zones3d';

export type FishingState =
  'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'fight' | 'landing' | 'result';

interface Shadow {
  mesh: THREE.Object3D;
  x: number;
  z: number;
  dir: number;
  speed: number;
  phase: number;
}
interface Ripple {
  mesh: THREE.Mesh;
  age: number;
  max: number;
  scale: number;
}

const NEAR_Z = -6;
const FAR_Z = -36;
const MAX_PARTICLES = 220;
const ROUGH: Record<string, number> = {
  beginner: 0.75,
  still: 0.3,
  current: 0.5,
  shoals: 0.65,
  swell: 1.7,
  darkness: 0.9,
};

/** The heart of the game in 3D: cast, wait, hook, fight, land. */
export class FishingView extends View {
  state: FishingState = 'idle';
  private zone: Zone;
  private env: Environment;
  private water: Water;
  private hud: FishingHud;
  private fx = new Rng((Date.now() & 0xfffff) + 7);
  private boat: THREE.Group;
  private rod: THREE.Mesh;
  private rodMat: THREE.Material;
  private line: THREE.Line;
  private bobber: THREE.Group;
  private bang: THREE.Sprite;
  private marker: THREE.Mesh;
  private warnRing: THREE.Mesh;
  private fightShadow: THREE.Mesh;
  private lantern: THREE.PointLight;
  private bobberGlow: THREE.Sprite;
  private landed: THREE.Group | null = null;
  private landedKey = '';
  private shadows: Shadow[] = [];
  private shoals: { group: THREE.Group; x: number; z: number; vx: number }[] = [];
  private ripples: Ripple[] = [];
  private points: THREE.Points;
  private pPos = new Float32Array(MAX_PARTICLES * 3);
  private pCol = new Float32Array(MAX_PARTICLES * 3);
  private pVel = new Float32Array(MAX_PARTICLES * 3);
  private pLife = new Float32Array(MAX_PARTICLES);
  private pNext = 0;

  private t = 0;
  private stateTime = 0;
  private holding = false;
  private pointerX = 0.5;
  private power = 0;
  private aim = 0;
  private depth = 0;
  private perfect = false;
  private bob = { x: 0, z: -10, dip: 0, visible: false };
  private castFrom = new THREE.Vector3();
  private castTo = { x: 0, z: -10 };
  private plan: BitePlan | null = null;
  private biteAt = 0;
  private nibbles: number[] = [];
  private nibbleUntil = 0;
  private model: FightModel | null = null;
  private fishPos = { x: 0, z: -10 };
  private reelTick = 0;
  private pulseTick = 0;
  private lastFlips = 0;
  private lastJerks = 0;
  private wasWarning = false;
  private jumpSplashed = false;
  private inShoal = false;
  private lastSoundKey = '';
  private rodTip = new THREE.Vector3();
  private landing: { from: THREE.Vector3; t: number; duration: number } | null = null;
  private timers: { at: number; fn: () => void }[] = [];
  /** Where the player stands on the deck (metres from the default spot). */
  private deck = { x: 0, z: 0, step: 0 };

  constructor(stage: Stage) {
    super(stage);
    const game = app.game;
    const state = game.state;
    this.zone = getZone(state.zone);
    this.hud = app.ui.hud as FishingHud;
    this.env = new Environment(this.scene, {
      zone: this.zone.id,
      hour: () => game.hour,
      weather: () => game.weather(),
      reducedMotion: () => game.state.settings.reducedMotion,
      onThunder: () => {
        app.audio.sfx('thunder');
        app.haptic(120);
      },
    });
    this.water = new Water(this.env.uniforms, {
      deep: this.zone.palette.waterBottom,
      shallow: this.zone.palette.waterTop,
      rough: ROUGH[this.zone.gimmick] ?? 0.8,
      flow: this.zone.gimmick === 'current' ? -0.9 : 0,
    });
    this.scene.add(this.water.mesh, buildZoneLand(this.zone.id));

    // Boat (bow towards the horizon), rod, line, bobber.
    this.boat = makeBoat(getCosmetic(state.cosmetics.boatColor), getBoat(state.equipment.boat).tier, true);
    this.scene.add(this.boat);
    this.lantern = new THREE.PointLight(0xffd9a0, 0, 12, 1.5);
    this.lantern.position.set(0, 1.6, 0.5);
    this.boat.add(this.lantern);
    this.rodMat = new THREE.MeshStandardMaterial({ map: woodTexture('#6a4526'), roughness: 0.5 });
    this.rod = new THREE.Mesh(new THREE.BufferGeometry(), this.rodMat);
    this.rod.castShadow = true;
    this.rod.frustumCulled = false;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(20 * 3), 3));
    this.line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xf4f4ee, transparent: true, opacity: 0.85 }),
    );
    this.line.frustumCulled = false;
    this.bobber = makeBobber(getCosmetic(state.cosmetics.bobber));
    this.bobberGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTexture(),
        color: 0xffe9a8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.bobberGlow.scale.setScalar(1.2);
    this.bobber.add(this.bobberGlow);
    this.bang = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bangTexture(),
        depthTest: false,
        transparent: true,
        sizeAttenuation: false,
      }),
    );
    this.bang.scale.set(0.055, 0.11, 1);
    this.bang.renderOrder = 50;
    this.bang.visible = false;
    const ring = (color: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.82, 1, 40),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 8;
      mesh.visible = false;
      return mesh;
    };
    this.marker = ring(0xffffff);
    this.warnRing = ring(0xffe36a);
    this.fightShadow = this.shadowMesh(1);
    this.fightShadow.visible = false;
    this.scene.add(this.rod, this.line, this.bobber, this.bang, this.marker, this.warnRing, this.fightShadow);

    // Fish under the surface, shoals, ripples, spray.
    const fosse = this.zone.gimmick === 'darkness';
    for (let i = 0; i < 7; i++) {
      const mesh: THREE.Object3D = fosse ? this.glowFish() : this.shadowMesh(this.fx.range(0.6, 1.3));
      this.scene.add(mesh);
      this.shadows.push({
        mesh,
        x: this.fx.range(-18, 18),
        z: this.fx.range(FAR_Z, NEAR_Z + 1),
        dir: this.fx.chance(0.5) ? 1 : -1,
        speed: this.fx.range(0.5, 1.4),
        phase: this.fx.range(0, 6),
      });
    }
    if (this.zone.gimmick === 'shoals') {
      for (const [x, z, vx] of [
        [-5, -15, 0.35],
        [6, -27, -0.3],
      ] as const) {
        const group = this.shoalGroup();
        this.scene.add(group);
        this.shoals.push({ group, x, z, vx });
      }
    }
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 36),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 7;
      this.scene.add(mesh);
      this.ripples.push({ mesh, age: 9, max: 1, scale: 1 });
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.pPos.fill(-999);
    this.points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        map: dotTexture(),
        size: 0.22,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    this.scene.add(this.points);

    this.camera.fov = 64;
    this.setState('idle');
  }

  private get side(): number {
    return app.game.state.settings.leftHanded ? -1 : 1;
  }
  private get tutorial(): boolean {
    return !app.game.state.flags.tutorialDone;
  }

  private shadowMesh(size: number): THREE.Mesh {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0);
    shape.bezierCurveTo(-0.3, 0.2, 0.15, 0.16, 0.32, 0.02);
    shape.lineTo(0.5, 0.16);
    shape.lineTo(0.5, -0.16);
    shape.lineTo(0.32, -0.02);
    shape.bezierCurveTo(0.15, -0.16, -0.3, -0.2, -0.5, 0);
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape, 6),
      new THREE.MeshBasicMaterial({
        color: 0x06141c,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(size * 1.3);
    mesh.renderOrder = 6;
    return mesh;
  }

  private glowFish(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const pts = new Float32Array(5 * 3);
    for (let i = 0; i < 5; i++) pts.set([i * 0.22, 0, 0], i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: dotTexture(),
        color: this.zone.palette.accent,
        size: 0.5,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    points.renderOrder = 7;
    return points;
  }

  private shoalGroup(): THREE.Group {
    const group = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const fish = this.shadowMesh(0.32);
      (fish.material as THREE.MeshBasicMaterial).color.setHex(i % 2 === 0 ? 0xfff2a8 : 0xffa8c8);
      (fish.material as THREE.MeshBasicMaterial).opacity = 0.8;
      fish.userData.a = (i / 12) * Math.PI * 2;
      fish.userData.r = 0.8 + (i % 3) * 0.5;
      group.add(fish);
    }
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.renderOrder = 6;
    group.add(halo);
    return group;
  }

  private after(seconds: number, fn: () => void): void {
    this.timers.push({ at: this.t + seconds, fn });
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
    this.bang.visible = state === 'bite';
    switch (state) {
      case 'idle':
        this.bob.visible = false;
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
      default:
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

  override pointer(type: 'down' | 'up' | 'move', x: number): void {
    this.pointerX = x;
    if (type === 'down') {
      this.holding = true;
      app.audio.unlock();
      if (this.state === 'idle') {
        this.power = 0;
        this.setState('charging');
      } else if (this.state === 'waiting') {
        if (this.stateTime > 0.45) this.reelIn();
      } else if (this.state === 'bite') this.hook();
    } else if (type === 'up') {
      const was = this.holding;
      this.holding = false;
      if (this.state === 'charging' && was) this.releaseCast();
    }
  }

  override paused(): void {
    resetMove();
    this.holding = false;
    app.audio.setTension(0);
  }

  private landingPoint(power: number, aim: number): { x: number; z: number; depth: number } {
    const depth = Math.min(1, Math.max(0, power)) * app.game.stats().reach;
    return { x: aim * (3 + 9 * depth), z: NEAR_Z + (FAR_Z - NEAR_Z) * depth, depth };
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
    this.castFrom.copy(this.rodTip);
    this.castTo = { x: target.x, z: target.z };
    this.bob.visible = true;
    app.audio.sfx('cast');
    app.haptic(15);
    this.tutorialStep(1);
    this.setState('casting');
    if (this.perfect) {
      this.hud.setPrompt('Lancer parfait !', 'good');
      this.burst(this.rodTip.x, this.rodTip.y, this.rodTip.z, 0xffe36a, 12);
    }
  }

  private land(): void {
    const game = app.game;
    this.bob.x = this.castTo.x;
    this.bob.z = this.castTo.z;
    app.audio.sfx('splash');
    this.ripple(this.bob.x, this.bob.z, 1);
    this.splash(this.bob.x, this.bob.z, 14, 1);
    let luck = 0;
    let delayMult = 1;
    this.inShoal = this.shoals.some((s) => Math.hypot(s.x - this.bob.x, s.z - this.bob.z) < 3.2);
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
    this.nibbles.sort((a, b) => a - b);
    this.nibbleUntil = 0;
    this.prepareFish(this.plan);
    this.setState('waiting');
    if (this.perfect) this.hud.setPrompt('Lancer parfait ! Attendez la touche…', 'good');
  }

  /** Models the fish that is about to bite, so that it can jump and be landed. */
  private prepareFish(plan: BitePlan): void {
    const key = `${plan.species.id}-${plan.fish.variant}`;
    if (this.landed && this.landedKey === key) return;
    if (this.landed) this.scene.remove(this.landed);
    this.landed = buildFish(plan.species.art, plan.fish.variant, plan.species.id);
    this.landedKey = key;
    this.landed.visible = false;
    this.scene.add(this.landed);
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
    this.bob.dip = 1;
    app.audio.sfx('bite');
    app.haptic([70, 40, 70]);
    this.ripple(this.bob.x, this.bob.z, 1.4);
    this.splash(this.bob.x, this.bob.z, 10, 0.8);
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
    this.fishPos = { x: this.bob.x, z: this.bob.z };
    this.bob.visible = false;
    app.audio.sfx('splash');
    app.haptic(40);
    this.splash(this.bob.x, this.bob.z, 16, 1);
    this.tutorialStep(3);
    this.setState('fight');
  }

  private missed(): void {
    if (this.tutorial && app.game.state.stats.catches === 0) {
      this.bob.dip = 0;
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
      this.landFish(plan);
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
    this.splash(this.fishPos.x, this.fishPos.z, 18, 1.2);
    if (this.landed) this.landed.visible = false;
    this.setState('idle');
  }

  private landFish(plan: BitePlan): void {
    const game = app.game;
    this.setState('landing');
    const rare = rarityRank(plan.species.rarity) >= rarityRank('rare') || plan.fish.variant !== 'normal';
    app.audio.sfx(rare ? 'rare' : 'catch');
    app.haptic(rare ? [60, 40, 60, 40, 120] : 60);
    this.splash(this.fishPos.x, this.fishPos.z, 30, 1.4);
    if (rare) this.burst(this.fishPos.x, 0.8, this.fishPos.z, 0xffd84a, 36);
    const duration = game.state.settings.reducedMotion ? 0.25 : 0.8;
    this.landing = { from: new THREE.Vector3(this.fishPos.x, 0, this.fishPos.z), t: 0, duration };
    this.after(duration + 0.1, () => {
      if (this.state !== 'landing') return;
      const result = game.completeCatch(plan.fish);
      this.tutorialStep(4);
      this.setState('result');
      app.ui.busy = true;
      void showCatchCard(result).then((choice) => {
        if (this.landed) this.landed.visible = false;
        this.landing = null;
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
      });
    });
  }

  // ───────────────────────── Effects ─────────────────────────

  private ripple(x: number, z: number, scale: number): void {
    const r = this.ripples.reduce((a, b) => (a.age / a.max > b.age / b.max ? a : b));
    r.age = 0;
    r.max = 1.4;
    r.scale = scale;
    r.mesh.position.set(x, 0, z);
  }

  private emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    color: THREE.Color,
  ): void {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % MAX_PARTICLES;
    this.pPos.set([x, y, z], i * 3);
    this.pVel.set([vx, vy, vz], i * 3);
    this.pCol.set([color.r, color.g, color.b], i * 3);
    this.pLife[i] = life;
  }

  private splash(x: number, z: number, count: number, power: number): void {
    if (app.game.state.settings.reducedMotion) count = Math.ceil(count / 3);
    const light = 0.35 + 0.65 * (1 - this.env.darkness);
    const color = new THREE.Color(0.85 * light, 0.93 * light, light);
    const y = this.water.height(x, z);
    for (let i = 0; i < count; i++) {
      const a = this.fx.range(0, Math.PI * 2);
      const v = this.fx.range(0.4, 2.2) * power;
      this.emit(
        x,
        y + 0.05,
        z,
        Math.cos(a) * v,
        this.fx.range(2, 5.5) * power,
        Math.sin(a) * v,
        this.fx.range(0.5, 1),
        color,
      );
    }
  }

  private burst(x: number, y: number, z: number, hex: number, count: number): void {
    if (app.game.state.settings.reducedMotion) count = Math.ceil(count / 3);
    const color = new THREE.Color(hex);
    for (let i = 0; i < count; i++) {
      const a = this.fx.range(0, Math.PI * 2);
      const v = this.fx.range(0.8, 3.2);
      this.emit(
        x,
        y,
        z,
        Math.cos(a) * v,
        this.fx.range(1, 4.5),
        Math.sin(a) * v * 0.4,
        this.fx.range(0.6, 1.1),
        color,
      );
    }
  }

  // ───────────────────────── Update ─────────────────────────

  update(dt: number): void {
    const game = app.game;
    this.t += dt;
    this.stateTime += dt;
    game.advance(dt);
    for (const timer of [...this.timers]) {
      if (this.t >= timer.at) {
        this.timers.splice(this.timers.indexOf(timer), 1);
        timer.fn();
      }
    }
    const weather = game.weather();
    const base = ROUGH[this.zone.gimmick] ?? 0.8;
    this.water.set(
      base * (weather === 'storm' ? 1.7 : weather === 'rain' ? 1.2 : 1),
      weather === 'glow' ? 1 : this.zone.gimmick === 'darkness' ? 0.55 : 0,
      weather === 'rain' || weather === 'storm' ? 1 : 0,
    );
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
    this.place(dt);
    this.env.update(dt, this.camera, this.stage.renderer);
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
    this.aim = THREE.MathUtils.clamp((this.pointerX - 0.5) / 0.36, -1, 1);
    this.hud.setPower(this.power);
  }

  private updateCasting(): void {
    if (this.stateTime >= 0.6) this.land();
  }

  private updateWaiting(dt: number): void {
    if (this.zone.gimmick === 'current') {
      this.bob.x += 0.9 * dt;
      if (this.bob.x > 3 + 9 * this.depth + 1.5) {
        app.ui.toast('Le courant a emporté la ligne. Visez en amont !', 'info', 'wave');
        this.setState('idle');
        return;
      }
    }
    this.bob.dip = 0;
    const nibble = this.nibbles[0];
    if (nibble !== undefined && this.stateTime >= nibble) {
      this.nibbles.shift();
      this.nibbleUntil = this.t + 0.5;
      app.audio.sfx('nibble');
      app.haptic(12);
      this.ripple(this.bob.x, this.bob.z, 0.7);
    }
    if (this.t < this.nibbleUntil) this.bob.dip = 0.3 + Math.sin(this.t * 30) * 0.12;
    if (this.stateTime >= this.biteAt) this.bite();
  }

  private updateFight(dt: number): void {
    const model = this.model;
    if (!model) return;
    const game = app.game;
    model.update(dt, this.holding);

    // The fish comes closer as the distance shrinks, zig-zagging.
    const k = 0.12 + 0.88 * model.distance;
    const sway =
      Math.sin(model.time * (2 + model.params.difficulty * 3)) * 3.2 * (0.4 + 0.6 * model.distance);
    this.fishPos.x = this.bob.x * model.distance + sway;
    this.fishPos.z = -3.4 + (this.bob.z + 3.4) * k;
    if (this.fx.chance(dt * 5)) this.ripple(this.fishPos.x, this.fishPos.z, 0.8);

    if (this.holding) {
      this.reelTick -= dt;
      if (this.reelTick <= 0) {
        this.reelTick = 0.075 / model.params.reelSpeed;
        app.audio.sfx('reel');
      }
    }
    const over = Math.max(0, model.tension - model.safeHigh);
    app.audio.setTension(model.strain > 0.05 ? 0.3 + model.strain * 0.7 : over > 0 ? 0.25 : 0);
    this.pulseTick -= dt;
    if (!model.inSafeZone && this.pulseTick <= 0) {
      this.pulseTick = 0.28;
      app.haptic(model.tension > model.safeHigh ? 28 : 14);
    }
    if (model.flips !== this.lastFlips) {
      this.lastFlips = model.flips;
      this.hud.setHint('Il change de cap !');
      app.haptic([20, 30, 20]);
      this.after(0.9, () => this.state === 'fight' && this.hud.setHint(null));
    }
    if (model.jerks !== this.lastJerks) {
      this.lastJerks = model.jerks;
      this.splash(this.fishPos.x, this.fishPos.z, 8, 0.8);
      app.haptic(22);
    }
    const warning = model.jumpWarning > 0;
    if (warning && !this.wasWarning) {
      app.haptic([15, 40, 15]);
      this.jumpSplashed = false;
    }
    this.wasWarning = warning;
    if (warning) this.hud.setHint('Il va sauter : relâchez !');
    else if (model.jumping > 0) {
      this.hud.setHint('Saut !');
      if (!this.jumpSplashed) {
        this.jumpSplashed = true;
        app.audio.sfx('jump');
        this.splash(this.fishPos.x, this.fishPos.z, 22, 1.2);
      }
    } else if (model.surge > 0) this.hud.setHint('Il plonge : laissez filer !');
    else if (this.stateTime > 1 && this.t > this.hintUntil) this.hud.setHint(null);
    if (model.flips !== this.hintFlips) {
      this.hintFlips = model.flips;
      this.hintUntil = this.t + 0.9;
    }

    const dim = this.zone.gimmick === 'darkness' && this.t % 1.7 > 0.6 && !game.state.settings.assist;
    this.hud.setFight(model, dim);
    if (model.status !== 'active') this.endFight();
  }

  private hintUntil = 0;
  private hintFlips = 0;

  private updateEffects(dt: number): void {
    for (const r of this.ripples) {
      r.age += dt;
      const k = Math.min(1, r.age / r.max);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = r.age < r.max ? 0.55 * (1 - k) * (1 - this.env.darkness * 0.6) : 0;
      r.mesh.scale.setScalar((0.25 + 1.9 * k) * r.scale);
      r.mesh.position.y = this.water.height(r.mesh.position.x, r.mesh.position.z) + 0.03;
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i]! <= 0) continue;
      this.pLife[i]! -= dt;
      this.pVel[i * 3 + 1]! -= 9.8 * dt;
      this.pPos[i * 3]! += this.pVel[i * 3]! * dt;
      this.pPos[i * 3 + 1]! += this.pVel[i * 3 + 1]! * dt;
      this.pPos[i * 3 + 2]! += this.pVel[i * 3 + 2]! * dt;
      if (this.pLife[i]! <= 0 || this.pPos[i * 3 + 1]! < -0.3) {
        this.pLife[i] = 0;
        this.pPos[i * 3 + 1] = -999;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    const approach =
      (this.state === 'waiting' && this.biteAt - this.stateTime < 1.6) || this.state === 'bite';
    this.shadows.forEach((s, index) => {
      if (index === 0 && approach) {
        s.x += (this.bob.x - s.x) * Math.min(1, dt * 2.4);
        s.z += (this.bob.z + 0.4 - s.z) * Math.min(1, dt * 2.4);
      } else {
        s.x += s.dir * s.speed * dt;
        if (Math.abs(s.x) > 22) {
          s.dir = -Math.sign(s.x);
          s.z = this.fx.range(FAR_Z, NEAR_Z + 1);
        }
      }
      const wig = Math.sin(this.t * 4 + s.phase) * 0.12;
      s.mesh.position.set(s.x, this.water.height(s.x, s.z) + 0.02, s.z);
      s.mesh.rotation.z = (s.dir > 0 ? Math.PI : 0) + wig;
      s.mesh.visible = this.state !== 'fight' || index !== 0;
    });
    for (const shoal of this.shoals) {
      shoal.x += shoal.vx * dt;
      if (Math.abs(shoal.x) > 9) shoal.vx *= -1;
      shoal.group.position.set(shoal.x, this.water.height(shoal.x, shoal.z) + 0.03, shoal.z);
      for (const child of shoal.group.children) {
        if (child.userData.a === undefined) continue;
        const a = (child.userData.a as number) + this.t * 0.8;
        child.position.set(Math.cos(a) * (child.userData.r as number), 0, Math.sin(a * 1.3) * 0.9);
        child.rotation.z = -a + Math.PI / 2;
      }
    }
  }

  /** Positions the boat, camera, rod, line, bobber and fish for this frame. */
  private place(dt: number): void {
    const game = app.game;
    const calm = game.state.settings.reducedMotion ? 0.25 : 1;
    const wy = this.water.height(0, 0);
    const pitch = (this.water.height(0, 1.5) - this.water.height(0, -1.5)) * 0.2 * calm;
    const roll = (this.water.height(1, 0) - this.water.height(-1, 0)) * 0.3 * calm;
    this.boat.position.set(0, wy * 0.7 - 0.2, 0);
    this.boat.rotation.set(pitch, 0, roll);
    // Walking on the deck (joystick or keyboard), while not casting or fighting.
    const moving =
      (this.state === 'idle' || this.state === 'waiting') && Math.hypot(moveInput.x, moveInput.y) > 0.08;
    if (moving) {
      this.deck.x = THREE.MathUtils.clamp(this.deck.x + moveInput.x * 1.3 * dt, -0.6, 0.6);
      this.deck.z = THREE.MathUtils.clamp(this.deck.z - moveInput.y * 1.3 * dt, -1.7, 0.4);
      this.deck.step += dt * 9;
    }
    const stepBob = moving ? Math.abs(Math.sin(this.deck.step)) * 0.035 * calm : 0;
    this.camera.position.set(this.deck.x, 2.25 + wy * 0.5 * calm + stepBob, 3.1 + this.deck.z);
    this.camera.lookAt(this.deck.x * 0.7, 0.7, -16);
    this.camera.rotation.z += roll * 0.25;
    const dark = this.env.darkness;
    this.lantern.intensity = dark > 0.3 ? (dark - 0.3) * 26 : 0;

    // Rod.
    const side = this.side;
    const hand = new THREE.Vector3(side * 0.5, 1.15 + wy * 0.5, 2.2);
    const tip = new THREE.Vector3(side * 0.28, 3.0 + wy * 0.5, -1.4);
    let bend = 0;
    if (this.state === 'charging') {
      tip.set(side * 0.5 - this.aim * 0.4, 3.3 + this.power * 0.5, 1.0 + this.power * 1.6);
    } else if (this.state === 'casting') {
      const k = Math.min(1, this.stateTime / 0.22);
      tip.set(side * 0.28 + this.castTo.x * 0.06 * k, 3.4 - 1.5 * k, 2.4 - 4.6 * k);
    } else if (this.state === 'fight' && this.model) {
      bend = this.model.tension;
      tip.x += (this.fishPos.x - tip.x) * 0.08 * (0.4 + bend);
      tip.y -= bend * 0.7;
      tip.z -= bend * 0.5;
      if (!this.model.inSafeZone) {
        tip.x += Math.sin(this.t * 60) * 0.03;
        tip.y += Math.cos(this.t * 53) * 0.03;
      }
    } else if (this.bob.visible) {
      tip.x += this.bob.x * 0.03;
    }
    hand.x += this.deck.x;
    hand.z += this.deck.z;
    tip.x += this.deck.x;
    tip.z += this.deck.z;
    this.rodTip.lerp(tip, this.state === 'idle' ? Math.min(1, dt * 8) : 1);
    const mid = hand
      .clone()
      .lerp(this.rodTip, 0.55)
      .add(new THREE.Vector3(0, 0.25 + bend * 0.55, bend * 0.4));
    const curve = new THREE.QuadraticBezierCurve3(hand, mid, this.rodTip);
    this.rod.geometry.dispose();
    this.rod.geometry = new THREE.TubeGeometry(curve, 14, 0.028, 6);

    // Bobber and line.
    const linePos = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const lineMat = this.line.material as THREE.LineBasicMaterial;
    let end: THREE.Vector3 | null = null;
    let sag = 0.6;
    if (this.state === 'casting') {
      const k = Math.min(1, this.stateTime / 0.6);
      const target = new THREE.Vector3(
        this.castTo.x,
        this.water.height(this.castTo.x, this.castTo.z),
        this.castTo.z,
      );
      end = this.castFrom.clone().lerp(target, k);
      end.y += Math.sin(Math.PI * k) * (3 + 5 * this.depth);
      this.bobber.position.copy(end);
      sag = 0.2;
    } else if (this.bob.visible) {
      const y = this.water.height(this.bob.x, this.bob.z);
      const swell = this.zone.gimmick === 'swell' ? 2 : 1;
      const dip = this.bob.dip + Math.sin(this.t * 2.2) * 0.05 * swell;
      this.bobber.position.set(this.bob.x, y + 0.02 - dip * 0.34, this.bob.z);
      end = this.bobber.position.clone().add(new THREE.Vector3(0, 0.3, 0));
    } else if (this.state === 'fight' && this.model) {
      end = new THREE.Vector3(
        this.fishPos.x,
        this.water.height(this.fishPos.x, this.fishPos.z),
        this.fishPos.z,
      );
      sag = 0.05 + (1 - this.model.tension) * 0.5;
      lineMat.color.setRGB(1, 1 - this.model.strain * 0.75, 1 - this.model.strain * 0.8);
    }
    if (this.state !== 'fight') lineMat.color.setHex(0xf4f4ee);
    this.line.visible = end !== null;
    if (end) {
      for (let i = 0; i < 20; i++) {
        const k = i / 19;
        linePos.setXYZ(
          i,
          this.rodTip.x + (end.x - this.rodTip.x) * k,
          this.rodTip.y + (end.y - this.rodTip.y) * k - Math.sin(Math.PI * k) * sag,
          this.rodTip.z + (end.z - this.rodTip.z) * k,
        );
      }
      linePos.needsUpdate = true;
    }
    const showBobber = this.state === 'casting' || (this.bob.visible && this.bob.dip < 0.9);
    this.bobber.visible = showBobber;
    if (showBobber) {
      const dist = this.camera.position.distanceTo(this.bobber.position);
      this.bobber.scale.setScalar(1.2 + dist * 0.085);
      this.bobber.rotation.z = Math.sin(this.t * 1.7) * 0.08;
      (this.bobberGlow.material as THREE.SpriteMaterial).opacity = dark > 0.3 ? 0.55 : 0;
    }
    if (this.state === 'bite') {
      const y = this.water.height(this.bob.x, this.bob.z);
      const dist = this.camera.position.distanceTo(new THREE.Vector3(this.bob.x, y, this.bob.z));
      this.bang.position.set(this.bob.x, y + 0.6 + dist * 0.045, this.bob.z);
      const pop = 1 + Math.sin(this.stateTime * 24) * 0.12;
      this.bang.scale.set(0.055 * pop, 0.11 * pop, 1);
    }

    // Aiming marker.
    this.marker.visible = this.state === 'charging';
    if (this.marker.visible) {
      const target = this.landingPoint(this.power, this.aim);
      const sweet = Math.abs(this.power - BALANCE.cast.sweetSpot) <= BALANCE.cast.perfectWindow;
      (this.marker.material as THREE.MeshBasicMaterial).color.setHex(sweet ? 0x7dffa8 : 0xffffff);
      this.marker.position.set(target.x, this.water.height(target.x, target.z) + 0.05, target.z);
      this.marker.scale.setScalar(0.5 + target.depth * 1.3);
    }

    // The fish during the fight, the jump and the landing.
    const model = this.model;
    const fighting = this.state === 'fight' && model !== null;
    this.fightShadow.visible = fighting && model!.jumping <= 0;
    this.warnRing.visible = fighting && model!.jumpWarning > 0;
    const fish = this.landed;
    if (fighting && model) {
      const y = this.water.height(this.fishPos.x, this.fishPos.z);
      const size = 0.9 + model.params.difficulty * 1.6;
      this.fightShadow.position.set(this.fishPos.x, y + 0.03, this.fishPos.z);
      this.fightShadow.scale.setScalar(size * 1.3);
      this.fightShadow.rotation.z =
        Math.cos(model.time * (2 + model.params.difficulty * 3)) * 0.5 + Math.PI / 2;
      if (this.warnRing.visible) {
        this.warnRing.position.set(this.fishPos.x, y + 0.05, this.fishPos.z);
        this.warnRing.scale.setScalar(0.8 + model.jumpWarning * 2.2);
      }
      if (fish) {
        fish.visible = model.jumping > 0;
        if (fish.visible) {
          const k = 1 - model.jumping / 0.45;
          fish.position.set(
            this.fishPos.x,
            y - 0.3 + Math.sin(Math.PI * k) * (1.4 + size * 0.5),
            this.fishPos.z,
          );
          fish.scale.setScalar(size * 1.1);
          fish.rotation.set(0, Math.PI / 2, Math.PI * (0.35 - k * 0.9));
        }
      }
    } else if (fish && this.landing) {
      this.landing.t += dt;
      const k = Math.min(1, this.landing.t / this.landing.duration);
      const e = 1 - Math.pow(1 - k, 3);
      const target = new THREE.Vector3(0, this.camera.position.y - 0.15, this.camera.position.z - 2.3);
      fish.visible = true;
      fish.position.lerpVectors(this.landing.from, target, e);
      fish.position.y += Math.sin(Math.PI * k) * 1.6;
      fish.scale.setScalar(0.5 + 0.75 * e);
      fish.rotation.set(
        Math.sin(this.t * 9) * 0.12 * (1 - e * 0.6),
        (1 - e) * 2.4 + Math.sin(this.t * 1.4) * 0.15,
        (1 - e) * -1.2 + Math.sin(this.t * 11) * 0.08,
      );
    }
  }

  override dispose(): void {
    resetMove();
    app.audio.setTension(0);
    app.ui.busy = false;
    this.env.dispose();
    this.water.dispose();
    super.dispose();
  }
}
