import * as THREE from 'three';
import { app } from '../../app';
import { getBoat, getCosmetic } from '../../data/equipment';
import { getZone } from '../../data/zones';
import { fbm } from '../noise';
import { lookInput, moveInput, resetMove } from '../../ui/joystick';
import { cloneModel } from '../assets';
import { CameraRig, type RigLimits } from '../cameraRig';
import { makeHero, makePlayerBoat } from '../hero';
import { box, makeBoat, makeHouse, makeLighthouse, type Character } from '../props';
import { Environment } from '../sky';
import { Stage, View } from '../stage';
import { landMesh, scatterTrees, type HeightFn } from '../terrain';
import { paintTexture, woodTexture } from '../textures';
import { Water } from '../water';

/** Smoothstep that also works when the edges are given in decreasing order. */
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The port hub in 3D: quay, Jo's stall, mission board, Nell's map table, the cabin on the hill. */
export class PortView extends View {
  private env: Environment;
  private water: Water;
  private boat!: THREE.Group;
  private others: THREE.Group[] = [];
  private lamps: THREE.PointLight[] = [];
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private anchors: { id: string; pos: THREE.Vector3; near: THREE.Vector3 }[] = [];
  private hero!: Character;
  private heroPos = new THREE.Vector3(0, 1.2, 5);
  private heroYaw = 0;
  private landHeight!: HeightFn;
  private obstacles: { x: number; z: number; r: number }[] = [];
  private rig = new CameraRig();
  private dock: THREE.Object3D | null = null;
  private ray = new THREE.Raycaster();
  override dragLook = true;
  private t = 0;
  private lastKey = '';

  constructor(stage: Stage) {
    super(stage);
    const game = app.game;
    const zone = getZone('anse');
    this.env = new Environment(this.scene, {
      zone: 'anse',
      hour: () => game.hour,
      weather: () => game.weather('anse'),
      reducedMotion: () => game.state.settings.reducedMotion,
      onThunder: () => app.audio.sfx('thunder'),
    });
    this.water = new Water(this.env.uniforms, {
      deep: zone.palette.waterBottom,
      shallow: zone.palette.waterTop,
      rough: 0.45,
    });
    this.scene.add(this.water.mesh);

    const height: HeightFn = (x, z) => {
      const n = fbm(x * 0.06, z * 0.06, 4, 21);
      const inland = smooth(5 + Math.sin(x * 0.2) * 1.2, -3, z);
      const hill = Math.max(0, 1 - Math.hypot((x + 4) / 13, (z + 16) / 12)) ** 1.3 * 11;
      const cape = Math.max(0, 1 - Math.hypot((x - 10) / 9, (z + 46) / 12)) ** 1.2 * 9;
      const far = smooth(-30, -90, z) * (6 + n * 26);
      return -2.2 + inland * (3.1 + n * 1.2 + hill + far) + cape * (0.6 + n);
    };
    this.landHeight = height;
    this.scene.add(
      landMesh(-120, 120, -140, 12, 140, 90, height, { sand: 0xd8c79a, grass: 0x5d8a4c, rock: 0x7b756a }),
    );
    this.scene.add(
      scatterTrees('broadleaf', 140, { x0: -110, x1: 110, z0: -130, z1: -24 }, height, 12, [2.2, 30]),
    );

    const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#9a7448', 3), roughness: 0.85 });
    const darkWood = new THREE.MeshStandardMaterial({ map: woodTexture('#5f4226', 1), roughness: 0.9 });
    // Quay: the supplied wooden dock (turned so that it runs along the shore), or generated planks.
    const dock = cloneModel('dock');
    if (dock) {
      dock.rotation.y = Math.PI / 2;
      dock.scale.setScalar(0.72);
      dock.position.set(0, 0, 4.2);
      this.scene.add(dock);
      dock.updateMatrixWorld(true);
      // Find the deck height and bring it to the level of the stalls.
      this.ray.set(new THREE.Vector3(0.4, 30, 4.2), new THREE.Vector3(0, -1, 0));
      const hits = this.ray.intersectObject(dock, true).filter((hit) => (hit.face?.normal.y ?? 0) > 0.3);
      const deck = hits.length > 0 ? Math.min(...hits.slice(0, 2).map((hit) => hit.point.y)) : 0;
      dock.position.y = 1.2 - deck;
      dock.updateMatrixWorld(true);
      this.dock = dock;
    } else {
      this.scene.add(box(16, 0.3, 5, wood, 0, 1.05, 4.2));
      for (let x = -7.5; x <= 7.5; x += 3) {
        for (const z of [2.2, 6.3]) this.scene.add(box(0.36, 3.4, 0.36, darkWood, x, -0.3, z));
      }
      for (const x of [-5.5, 0, 5.5]) {
        const bollard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10),
          new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.5, metalness: 0.5 }),
        );
        bollard.position.set(x, 1.45, 6.2);
        bollard.castShadow = true;
        this.scene.add(bollard);
      }
    }

    // Gangway linking the quay to the island.
    this.scene.add(box(2.4, 0.25, 4.6, wood, 2.2, 1.07, -0.2));
    for (const z of [-2.2, 0.4])
      for (const x of [1.15, 3.25]) this.scene.add(box(0.26, 3, 0.26, darkWood, x, -0.2, z));

    // Jo's stall.
    const stall = new THREE.Group();
    stall.position.set(-4.3, 1.2, 3.4);
    stall.scale.setScalar(0.85);
    for (const [x, z] of [
      [-1.6, -0.9],
      [1.6, -0.9],
      [-1.6, 0.9],
      [1.6, 0.9],
    ] as const) {
      stall.add(box(0.12, 2.6, 0.12, darkWood, x, 1.3, z));
    }
    const awningCanvas = document.createElement('canvas');
    awningCanvas.width = 128;
    awningCanvas.height = 8;
    const ag = awningCanvas.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      ag.fillStyle = i % 2 === 0 ? '#b8402e' : '#f3ead6';
      ag.fillRect(i * 16, 0, 16, 8);
    }
    const awningTex = new THREE.CanvasTexture(awningCanvas);
    awningTex.colorSpace = THREE.SRGBColorSpace;
    const awning = box(
      3.8,
      0.08,
      2.6,
      new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.9 }),
      0,
      2.7,
      0.1,
    );
    awning.rotation.x = 0.16;
    stall.add(awning);
    stall.add(
      box(
        3.3,
        0.9,
        1,
        new THREE.MeshStandardMaterial({ map: paintTexture('#efe6cf'), roughness: 0.8 }),
        0,
        0.45,
        0.6,
      ),
    );
    const fishColors = [0x7fa9bd, 0xc9b98f, 0xe0a030, 0x8a9aa5];
    fishColors.forEach((c, i) => {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.8 }),
      );
      f.scale.set(1.6, 0.35, 0.6);
      f.position.set(-1.1 + i * 0.72, 0.96, 0.62);
      f.castShadow = true;
      stall.add(f);
    });
    stall.add(box(0.8, 0.6, 0.7, wood, 2.5, 0.3, 0.4), box(0.7, 0.5, 0.6, wood, 2.5, 0.85, 0.4));
    this.scene.add(stall);

    // Mission board.
    const board = new THREE.Group();
    board.position.set(0, 1.2, 2.9);
    board.add(
      box(0.14, 2.3, 0.14, darkWood, -1, 1.15, 0),
      box(0.14, 2.3, 0.14, darkWood, 1, 1.15, 0),
      box(2.4, 1.4, 0.1, wood, 0, 1.7, 0),
    );
    const paper = new THREE.MeshStandardMaterial({ color: 0xf6efd9, roughness: 0.95 });
    board.add(
      box(0.6, 0.75, 0.02, paper, -0.65, 1.75, 0.07),
      box(0.7, 0.5, 0.02, paper, 0.2, 1.95, 0.07),
      box(0.5, 0.4, 0.02, new THREE.MeshStandardMaterial({ color: 0xf0d07a }), 0.6, 1.4, 0.07),
    );
    this.scene.add(board);

    // Nell's map table with a pennant.
    const table = new THREE.Group();
    table.position.set(4.3, 1.2, 3.5);
    table.add(box(2.4, 0.1, 1.3, wood, 0, 0.95, 0));
    for (const [x, z] of [
      [-1, -0.5],
      [1, -0.5],
      [-1, 0.5],
      [1, 0.5],
    ] as const) {
      table.add(box(0.1, 0.95, 0.1, darkWood, x, 0.47, z));
    }
    const mapSheet = box(
      1.5,
      0.02,
      0.95,
      new THREE.MeshStandardMaterial({ color: 0xe9dcb4, roughness: 1 }),
      -0.2,
      1.02,
      0,
    );
    mapSheet.rotation.y = 0.15;
    table.add(
      mapSheet,
      box(0.45, 0.02, 0.3, new THREE.MeshStandardMaterial({ color: 0x4fa9c0 }), -0.4, 1.035, 0.1),
    );
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 6), darkWood);
    pole.position.set(1.4, 1.5, -0.4);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.1, -0.3);
    flagShape.lineTo(0, -0.6);
    const flag = new THREE.Mesh(
      new THREE.ShapeGeometry(flagShape),
      new THREE.MeshStandardMaterial({ color: 0xe8a82e, side: THREE.DoubleSide }),
    );
    flag.position.set(1.42, 2.95, -0.4);
    table.add(pole, flag);
    this.scene.add(table);

    // The cabin on the hill, a few houses, the lighthouse.
    const cabinPos = new THREE.Vector3(-3.5, height(-3.5, -15) - 0.1, -15);
    const cabin = makeHouse(4.6, 3.6, 2.8, '#f1e8d2', 0xb8402e);
    cabin.position.copy(cabinPos);
    cabin.rotation.y = 0.25;
    this.scene.add(cabin);
    for (const [x, z, color, rot] of [
      [4.5, -7, '#e9d9b8', -0.3],
      [8.5, -10, '#d9e2e6', -0.1],
    ] as const) {
      const house = makeHouse(3.6, 3, 2.4, color, 0x6a5a52);
      house.position.set(x, height(x, z) - 0.1, z);
      house.rotation.y = rot;
      this.scene.add(house);
    }
    const lighthouse = makeLighthouse();
    lighthouse.position.set(10, height(10, -46) - 0.3, -46);
    this.scene.add(lighthouse);
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && (m.name === 'window' || o.name === 'lamp') && !this.glowMats.includes(m))
        this.glowMats.push(m);
    });

    // Lamps on the quay (lit at night).
    for (const x of [-6.9, 2.2]) {
      this.scene.add(box(0.1, 3, 0.1, darkWood, x, 2.7, 2.3));
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffc868, emissiveIntensity: 0 }),
      );
      bulb.position.set(x, 4.25, 2.3);
      this.glowMats.push(bulb.material as THREE.MeshStandardMaterial);
      const light = new THREE.PointLight(0xffc878, 0, 22, 1.6);
      light.position.copy(bulb.position);
      this.lamps.push(light);
      this.scene.add(bulb, light);
    }

    // Boats.
    this.refreshBoat();
    for (const [x, z, color, rot] of [
      [-5.5, 10, 0x2f6f9f, 0.5],
      [6, 9.5, 0xe8b830, -0.7],
    ] as const) {
      const other = makeBoat({ ...getCosmetic('hull-bleu'), color, color2: 0xf0ede4 }, 1);
      other.position.set(x, 0, z);
      other.rotation.y = rot;
      this.others.push(other);
      this.scene.add(other);
    }

    this.anchors = [
      {
        id: 'spot-cabin',
        pos: cabinPos.clone().add(new THREE.Vector3(0, 5.2, 0)),
        near: cabinPos.clone().add(new THREE.Vector3(0.6, 0, 2.6)),
      },
      { id: 'spot-shop', pos: new THREE.Vector3(-4.3, 4.6, 3.4), near: new THREE.Vector3(-4.3, 1.2, 5.2) },
      { id: 'spot-missions', pos: new THREE.Vector3(0, 4.4, 2.9), near: new THREE.Vector3(0, 1.2, 4.2) },
      { id: 'spot-map', pos: new THREE.Vector3(4.3, 4.6, 3.5), near: new THREE.Vector3(4.3, 1.2, 5.2) },
    ];
    this.obstacles = [
      { x: -4.3, z: 3.3, r: 1.9 },
      { x: 0, z: 2.9, r: 1.1 },
      { x: 4.3, z: 3.5, r: 1.4 },
      { x: cabinPos.x, z: cabinPos.z, r: 3 },
      { x: 4.5, z: -7, r: 2.5 },
      { x: 8.5, z: -10, r: 2.5 },
    ];
    // The player, free to walk on the quay and on the island.
    this.hero = makeHero(getCosmetic(game.state.cosmetics.outfit));
    this.scene.add(this.hero.group);
    this.camera.fov = 58;
    this.rig.pitch = -0.4;
    this.syncSound();
  }

  /** Rebuilds the player's boat after a purchase (called when the shop closes). */
  refreshBoat(): void {
    const state = app.game.state;
    if (this.boat) this.scene.remove(this.boat);
    this.boat = makePlayerBoat(
      getCosmetic(state.cosmetics.boatColor),
      getBoat(state.equipment.boat).tier,
    ).group;
    this.boat.rotation.y = Math.PI / 2 + 0.15;
    this.scene.add(this.boat);
  }

  private syncSound(): void {
    const game = app.game;
    const key = `${game.phase('anse')}-${game.weather('anse')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    app.audio.setScene({ zone: 'anse', phase: game.phase('anse'), weather: game.weather('anse') });
    app.ui.root.classList.toggle('night', game.phase('anse') === 'night');
  }

  private static readonly LIMITS: RigLimits = { minPitch: -1.1, maxPitch: 0.5, distance: 17, lift: 0.8 };

  /** Ground height where the player can stand, or null when the spot is not walkable. */
  private ground(x: number, z: number): number | null {
    // The quay deck (the supplied dock is 18.5 m long and about 4 m wide once scaled).
    if (this.dock ? Math.abs(x) <= 9.1 && z >= 2.1 && z <= 6.3 : Math.abs(x) <= 7.8 && z >= 1.9 && z <= 6.5)
      return 1.2;
    // Gangway from the quay to the shore.
    if (x >= 1.1 && x <= 3.3 && z >= -2.2 && z < 2.4) return 1.2;
    if (Math.abs(x) > 17 || z < -26 || z > 2.4) return null;
    const h = this.landHeight(x, z);
    return h > 0.9 ? h : null;
  }

  private moveHero(dt: number): void {
    const third = app.game.state.settings.thirdPerson;
    this.rig.mode = third ? 'third' : 'first';
    this.rig.look(lookInput.dx, lookInput.dy, PortView.LIMITS);
    lookInput.dx = 0;
    lookInput.dy = 0;
    const speed = Math.min(1, Math.hypot(moveInput.x, moveInput.y));
    if (speed > 0.08) {
      // The stick is relative to where the camera looks.
      const yaw = this.rig.yaw;
      const mx = moveInput.x * Math.cos(yaw) - moveInput.y * Math.sin(yaw);
      const mz = -moveInput.x * Math.sin(yaw) - moveInput.y * Math.cos(yaw);
      const step = (speed > 0.9 ? 5.2 : 3.2) * dt;
      let nx = this.heroPos.x + mx * step;
      let nz = this.heroPos.z + mz * step;
      for (const o of this.obstacles) {
        const d = Math.hypot(nx - o.x, nz - o.z);
        if (d < o.r && d > 1e-4) {
          nx = o.x + ((nx - o.x) / d) * o.r;
          nz = o.z + ((nz - o.z) / d) * o.r;
        }
      }
      // Slide along the edges: try the full move, then each axis alone.
      for (const [tx, tz] of [
        [nx, nz],
        [nx, this.heroPos.z],
        [this.heroPos.x, nz],
      ] as const) {
        const g = this.ground(tx, tz);
        if (g !== null && g - this.heroPos.y < 0.9) {
          this.heroPos.x = tx;
          this.heroPos.z = tz;
          break;
        }
      }
      const target = Math.atan2(-mx, -mz);
      let diff = target - this.heroYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heroYaw += diff * Math.min(1, dt * 12);
    }
    const g = this.ground(this.heroPos.x, this.heroPos.z) ?? this.heroPos.y;
    this.heroPos.y += (g - this.heroPos.y) * Math.min(1, dt * 12);
    this.hero.group.position.copy(this.heroPos);
    this.hero.group.rotation.y = third ? this.heroYaw : this.rig.yaw;
    this.hero.group.visible = third;
    this.hero.animate(dt, speed > 0.08 ? speed : 0);
    const head = new THREE.Vector3(this.heroPos.x, this.heroPos.y + 1.62, this.heroPos.z);
    this.rig.apply(this.camera, head, 0, PortView.LIMITS, dt);
  }

  override paused(): void {
    resetMove();
  }

  private float(obj: THREE.Group, x: number, z: number, calm: number): void {
    obj.position.set(x, this.water.height(x, z) * 0.8 - 0.1, z);
    obj.rotation.z = (this.water.height(x + 1, z) - this.water.height(x - 1, z)) * 0.4 * calm;
    obj.rotation.x = (this.water.height(x, z + 1) - this.water.height(x, z - 1)) * 0.3 * calm;
  }

  update(dt: number): void {
    const game = app.game;
    this.t += dt;
    game.advance(dt);
    const weather = game.weather('anse');
    this.water.set(
      weather === 'storm' ? 0.95 : weather === 'rain' ? 0.6 : 0.42,
      weather === 'glow' ? 1 : 0,
      weather === 'rain' || weather === 'storm' ? 1 : 0,
    );
    this.env.update(dt, this.camera, this.stage.renderer);
    this.syncSound();
    this.moveHero(dt);
    const calm = game.state.settings.reducedMotion ? 0.3 : 1;
    this.float(this.boat, 0, 11.5, calm);
    this.others.forEach((o, i) => this.float(o, i === 0 ? -5.5 : 6, i === 0 ? 10 : 9.5, calm));
    const dark = Math.max(0, (this.env.darkness - 0.25) * 1.6);
    for (const lamp of this.lamps) lamp.intensity = dark * 22;
    for (const m of this.glowMats) m.emissiveIntensity = m.name === 'window' ? dark * 1.6 : 0.3 + dark * 2.5;

    // Keep the HTML buttons of the HUD above the places they open.
    const v = new THREE.Vector3();
    for (const anchor of this.anchors) {
      const el = document.getElementById(anchor.id);
      if (!el) continue;
      v.copy(anchor.pos).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * 100;
      const sy = (-v.y * 0.5 + 0.5) * 100;
      // A place that left the view has no button: walk back to it.
      const visible = v.z < 1 && sx > 4 && sx < 96 && sy > 8 && sy < 74;
      el.style.display = visible ? '' : 'none';
      el.style.left = `${Math.min(86, Math.max(14, sx)).toFixed(1)}%`;
      el.style.top = `${Math.min(62, Math.max(27, sy)).toFixed(1)}%`;
      el.classList.toggle(
        'is-near',
        Math.hypot(anchor.near.x - this.heroPos.x, anchor.near.z - this.heroPos.z) < 3.2,
      );
    }
    // Standing at the edge of the quay, next to the boat: the "go fishing" button lights up.
    document
      .getElementById('btn-fish')
      ?.classList.toggle('is-near', this.heroPos.z > 5.6 && Math.abs(this.heroPos.x) < 3.5);
  }

  override dispose(): void {
    resetMove();
    this.env.dispose();
    this.water.dispose();
    super.dispose();
  }
}
