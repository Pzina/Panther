import * as THREE from 'three';
import type { Cosmetic } from '../data/types';
import { cloneModel, modelAnimations } from './assets';
import { makeBoat, makeCharacter, type Character } from './props';

/**
 * The player's character: the supplied animated model when it is available, otherwise the
 * code-generated figure. Faces -z, origin at the feet.
 */
export function makeHero(outfit: Cosmetic): Character {
  const model = cloneModel('person');
  if (!model) return makeCharacter(outfit);
  const group = new THREE.Group();
  model.rotation.y = Math.PI; // the model faces +z
  group.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clips = modelAnimations('person');
  const action = (name: string): THREE.AnimationAction | null => {
    const clip = clips.find((c) => c.name === name);
    return clip ? mixer.clipAction(clip) : null;
  };
  const idle = action('Idle');
  const walk = action('Walk');
  const run = action('Run');
  for (const a of [idle, walk, run]) {
    if (!a) continue;
    a.play();
    a.setEffectiveWeight(a === idle ? 1 : 0);
  }
  let blend = 0;
  return {
    group,
    animate: (dt, speed) => {
      // Cross-fade between standing, walking and running.
      blend += (speed - blend) * Math.min(1, dt * 8);
      const moving = Math.min(1, blend * 1.6);
      const running = THREE.MathUtils.clamp((blend - 0.75) * 4, 0, 1);
      idle?.setEffectiveWeight(1 - moving);
      walk?.setEffectiveWeight(moving * (1 - running));
      run?.setEffectiveWeight(moving * running);
      if (walk) walk.timeScale = 0.9 + blend * 0.6;
      mixer.update(dt);
    },
  };
}

export interface PlayerBoat {
  group: THREE.Group;
  /** Height of the deck under a point of the boat (boat-local x, z), or null outside the deck. */
  floorAt: (x: number, z: number) => number | null;
  /** Half-width and half-length of the walkable deck. */
  halfWidth: number;
  halfLength: number;
}

/** The player's boat: supplied model (bow towards -z, waterline at y = 0) or the generated hull. */
export function makePlayerBoat(hull: Cosmetic, tier: number, deckOnly = false): PlayerBoat {
  const model = cloneModel('boat');
  if (!model) {
    const depth = 0.62 + tier * 0.05;
    return {
      group: makeBoat(hull, tier, deckOnly),
      floorAt: () => depth * 0.5,
      halfWidth: 0.55,
      halfLength: 1.8,
    };
  }
  const group = new THREE.Group();
  const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(hull.color), 0.45);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.color.multiply(tint);
    mesh.material = mat;
  });
  // The model's bow points to +x and its hull is not centred: recentre, then turn the bow to -z.
  const inner = new THREE.Group();
  model.position.set(-2.33, 0, 0);
  inner.add(model);
  inner.rotation.y = Math.PI / 2;
  const scale = 1 + (tier - 1) * 0.1;
  inner.scale.setScalar(scale);
  group.add(inner);
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const cast = (x: number, z: number): number | null => {
    ray.set(new THREE.Vector3(x, 5, z), down);
    const hit = ray.intersectObject(inner, true)[0];
    return hit ? hit.point.y : null;
  };
  // Sit the hull in the water: the floor ends up a little above the waterline.
  const floor = cast(0, 0.3) ?? -0.6;
  inner.position.y = 0.16 - floor;
  group.updateMatrixWorld(true);
  const base = 0.16;
  return {
    group,
    floorAt: (x, z) => {
      // Ray in the boat's own frame: independent from where the boat currently is.
      const origin = new THREE.Vector3(x, 5, z).applyMatrix4(group.matrixWorld);
      const dir = down.clone().transformDirection(group.matrixWorld);
      ray.set(origin, dir);
      const hit = ray.intersectObject(inner, true)[0];
      if (!hit) return null;
      const y = group.worldToLocal(hit.point.clone()).y;
      return y < base + 0.75 ? Math.max(base, y) : null;
    },
    halfWidth: 0.62 * scale,
    halfLength: 2.1 * scale,
  };
}
