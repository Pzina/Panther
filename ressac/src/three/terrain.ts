import * as THREE from 'three';
import { Rng } from '../core/rng';
import { fbm } from './noise';

export type HeightFn = (x: number, z: number) => number;

export interface LandPalette {
  sand: number;
  grass: number;
  rock: number;
  top?: number;
}

/** Heightfield mesh with slope / altitude based colours. Everything under the sea level is skipped visually by the water. */
export function landMesh(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  nx: number,
  nz: number,
  height: HeightFn,
  palette: LandPalette,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const normal = geo.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(palette.sand);
  const grass = new THREE.Color(palette.grass);
  const rock = new THREE.Color(palette.rock);
  const top = new THREE.Color(palette.top ?? palette.rock);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const slope = 1 - normal.getY(i);
    const n = fbm(pos.getX(i) * 0.35, pos.getZ(i) * 0.35, 3, 9);
    c.copy(sand);
    c.lerp(grass, THREE.MathUtils.smoothstep(y + n * 0.8, 0.5, 1.6));
    c.lerp(rock, THREE.MathUtils.smoothstep(slope + n * 0.12, 0.2, 0.42));
    c.lerp(top, THREE.MathUtils.smoothstep(y + n * 6, 26, 38));
    c.multiplyScalar(0.8 + n * 0.4);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

export type TreeKind = 'broadleaf' | 'pine' | 'palm' | 'willow';

/** Scatters instanced trees where the ground is suitable. */
export function scatterTrees(
  kind: TreeKind,
  count: number,
  area: { x0: number; x1: number; z0: number; z1: number },
  height: HeightFn,
  seed: number,
  range: [number, number] = [0.8, 14],
): THREE.Group {
  const rng = new Rng(seed);
  const group = new THREE.Group();
  const spots: { x: number; y: number; z: number; s: number; r: number }[] = [];
  for (let tries = 0; tries < count * 12 && spots.length < count; tries++) {
    const x = rng.range(area.x0, area.x1);
    const z = rng.range(area.z0, area.z1);
    const y = height(x, z);
    if (y < range[0] || y > range[1]) continue;
    spots.push({ x, y, z, s: rng.range(0.75, 1.4), r: rng.range(0, Math.PI * 2) });
  }
  if (spots.length === 0) return group;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: kind === 'palm' ? 0x8a6a4a : 0x4a3423,
    roughness: 1,
  });
  const leafColor =
    kind === 'pine' ? 0x24452f : kind === 'palm' ? 0x3f8a4a : kind === 'willow' ? 0x6f9a52 : 0x3f6f38;
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, flatShading: true });
  const trunkH = kind === 'palm' ? 5 : kind === 'pine' ? 1.6 : 2.4;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, trunkH, 6);
  trunkGeo.translate(0, trunkH / 2, 0);
  let leafGeo: THREE.BufferGeometry;
  let leavesPer = 1;
  if (kind === 'pine') {
    leafGeo = new THREE.ConeGeometry(1.5, 6, 7);
    leafGeo.translate(0, 4.4, 0);
  } else if (kind === 'palm') {
    leafGeo = new THREE.SphereGeometry(1, 6, 4);
    leafGeo.scale(2.4, 0.12, 0.5);
    leafGeo.translate(2.1, 0, 0);
    leavesPer = 7;
  } else {
    leafGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const p = leafGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + 0.4 * fbm(p.getX(i) * 1.3 + 5, p.getY(i) * 1.3 + p.getZ(i), 2, 3);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * (kind === 'willow' ? 1.25 : 0.95), p.getZ(i) * k);
    }
    leafGeo.translate(0, kind === 'willow' ? 3 : 3.6, 0);
    leafGeo.computeVertexNormals();
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length * leavesPer);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    const lean = kind === 'palm' ? rng.range(-0.22, 0.22) : 0;
    e.set(lean, s.r, lean * 0.7);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(s.x, s.y - 0.2, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
    trunks.setMatrixAt(i, m);
    for (let l = 0; l < leavesPer; l++) {
      if (kind === 'palm') {
        const top = new THREE.Vector3(0, trunkH * s.s, 0)
          .applyQuaternion(q)
          .add(new THREE.Vector3(s.x, s.y - 0.2, s.z));
        e.set(0, (l / leavesPer) * Math.PI * 2 + s.r, -0.45 + rng.range(-0.2, 0.2));
        m.compose(top, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(s.s, s.s, s.s));
      }
      leaves.setMatrixAt(i * leavesPer + l, m);
      leaves.setColorAt(i * leavesPer + l, col.setHex(leafColor).multiplyScalar(rng.range(0.75, 1.2)));
    }
  });
  trunks.castShadow = leaves.castShadow = true;
  group.add(trunks, leaves);
  return group;
}
