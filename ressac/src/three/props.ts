import * as THREE from 'three';
import type { Cosmetic } from '../data/types';
import { hexColor, paintTexture, woodTexture } from './textures';

/** Hull built by lofting cross-sections from stern (z = +half) to bow (z = -half). */
function hullGeometry(length: number, beam: number, depth: number): THREE.BufferGeometry {
  const stations = 18;
  const ring = 9;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let s = 0; s <= stations; s++) {
    const t = s / stations;
    const z = length / 2 - t * length;
    const w =
      (beam / 2) *
      Math.pow(Math.sin(Math.PI * Math.min(1, 0.16 + t * 0.84) ** 0.9), 0.55) *
      (t > 0.985 ? 0.05 : 1);
    const sheer = depth * (1 + 0.28 * Math.pow(t, 3) + 0.08 * Math.pow(1 - t, 2));
    const keel = -depth * 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6;
    for (let r = 0; r <= ring; r++) {
      const a = (r / ring) * Math.PI;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      const flare = Math.pow(Math.abs(cx), 0.75) * Math.sign(cx);
      positions.push(flare * w, sheer - sy ** 0.8 * (sheer - keel), z);
      uvs.push(t * 3, r / ring);
    }
  }
  for (let s = 0; s < stations; s++) {
    for (let r = 0; r < ring; r++) {
      const a = s * (ring + 1) + r;
      const b = a + ring + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * The player's boat. Origin at the waterline, bow towards -z.
 * `deckOnly` leaves out the cabin, mast and sail (first-person view from the stern).
 */
export function makeBoat(hull: Cosmetic, tier: number, deckOnly = false): THREE.Group {
  const boat = new THREE.Group();
  const length = 4.6 + tier * 0.9;
  const beam = 1.7 + tier * 0.22;
  const depth = 0.62 + tier * 0.05;
  const paint = new THREE.MeshStandardMaterial({
    map: paintTexture(hexColor(hull.color)),
    roughness: 0.42,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#a07a4c', 2), roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: hull.color2, roughness: 0.5 });
  const body = new THREE.Mesh(hullGeometry(length, beam, depth), paint);
  body.castShadow = body.receiveShadow = true;
  boat.add(body);
  // Inner hull (wood) and floor.
  const inner = new THREE.Mesh(
    hullGeometry(length * 0.97, beam * 0.92, depth * 0.96),
    new THREE.MeshStandardMaterial({ map: woodTexture('#8a6238', 2), roughness: 0.85, side: THREE.BackSide }),
  );
  inner.position.y = 0.03;
  inner.receiveShadow = true;
  boat.add(inner);
  // Floor following the hull outline, above the waterline so that the sea never shows inside.
  const outline = new THREE.Shape();
  const half = (t: number): number =>
    (beam / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, 0.16 + t * 0.84) ** 0.9), 0.55) * 0.9;
  for (let i = 0; i <= 20; i++)
    outline[i === 0 ? 'moveTo' : 'lineTo'](half(i / 20), (i / 20 - 0.5) * length * 0.985);
  for (let i = 20; i >= 0; i--) outline.lineTo(-half(i / 20), (i / 20 - 0.5) * length * 0.985);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(outline), wood);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = depth * 0.5;
  floor.receiveShadow = true;
  boat.add(floor);
  // Gunwale strip and thwarts.
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const w =
        (beam / 2) *
        Math.pow(Math.sin(Math.PI * Math.min(1, 0.16 + t * 0.84) ** 0.9), 0.55) *
        (t > 0.985 ? 0.05 : 1);
      pts.push(
        new THREE.Vector3(
          side * w,
          depth * (1 + 0.28 * t ** 3 + 0.08 * (1 - t) ** 2) + 0.01,
          length / 2 - t * length,
        ),
      );
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 6), trim);
    rail.castShadow = true;
    boat.add(rail);
  }
  for (const z of [length * 0.22, -length * 0.12]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.86, 0.05, 0.3), wood);
    seat.position.set(0, depth * 0.72, z);
    seat.castShadow = seat.receiveShadow = true;
    boat.add(seat);
  }
  if (deckOnly) return boat;
  if (tier >= 2) {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(beam * 0.62, 0.9, length * 0.26),
      new THREE.MeshStandardMaterial({ map: paintTexture('#f1e8d2'), roughness: 0.6 }),
    );
    cabin.position.set(0, depth + 0.42, length * 0.2);
    cabin.castShadow = true;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(beam * 0.64, 0.3, length * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x24465a, roughness: 0.05, metalness: 0.6 }),
    );
    glass.position.set(0, depth + 0.56, length * 0.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.72, 0.06, length * 0.3), trim);
    roof.position.set(0, depth + 0.9, length * 0.2);
    roof.castShadow = true;
    boat.add(cabin, glass, roof);
  }
  if (tier >= 3) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 6.5, 8), wood);
    mast.position.set(0, depth + 3.2, -length * 0.05);
    mast.castShadow = true;
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 5.4);
    sailShape.quadraticCurveTo(1.2, 2.4, 2.6, 0);
    const sailGeo = new THREE.ShapeGeometry(sailShape, 10);
    const sp = sailGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++)
      sp.setZ(i, Math.sin((sp.getX(i) / 2.6) * Math.PI) * 0.35 * (1 - sp.getY(i) / 5.6));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.9, side: THREE.DoubleSide }),
    );
    sail.rotation.y = -Math.PI / 2;
    sail.position.set(0, depth + 0.7, -length * 0.02);
    sail.castShadow = true;
    boat.add(mast, sail);
  }
  if (tier >= 4) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 2 }),
    );
    lamp.position.set(0, depth + 1.15, length * 0.2);
    boat.add(lamp);
  }
  return boat;
}

/** Bobber, modelled as a lathe: top half painted, antenna on top. */
export function makeBobber(cosmetic: Cosmetic): THREE.Group {
  const g = new THREE.Group();
  const profile = [
    new THREE.Vector2(0, -0.16),
    new THREE.Vector2(0.05, -0.12),
    new THREE.Vector2(0.085, -0.03),
    new THREE.Vector2(0.085, 0.03),
    new THREE.Vector2(0.05, 0.11),
    new THREE.Vector2(0.012, 0.15),
    new THREE.Vector2(0.012, 0.34),
    new THREE.Vector2(0, 0.34),
  ];
  const geo = new THREE.LatheGeometry(profile, 16);
  const colors = new Float32Array(geo.getAttribute('position').count * 3);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const top = new THREE.Color(cosmetic.color);
  const bottom = new THREE.Color(cosmetic.color2);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const stripe = cosmetic.style === 'striped' ? Math.floor((y + 0.2) * 22) % 2 === 0 : y > 0;
    const c = stripe ? top : bottom;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const glow = cosmetic.style === 'glow' || cosmetic.style === 'moon' || cosmetic.style === 'lighthouse';
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.25,
      metalness: 0.05,
      emissive: glow ? new THREE.Color(cosmetic.color) : new THREE.Color(0),
      emissiveIntensity: glow ? 0.9 : 0,
    }),
  );
  mesh.castShadow = true;
  g.add(mesh);
  if (cosmetic.style === 'star') {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07),
      new THREE.MeshStandardMaterial({ color: cosmetic.color2, roughness: 0.3 }),
    );
    star.position.y = 0.38;
    g.add(star);
  }
  return g;
}

export function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Striped lighthouse with a glowing lantern. */
export function makeLighthouse(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb8402e, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const r0 = 1.5 - i * 0.14;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.14, r0, 2.4, 14), i % 2 === 0 ? white : red);
    seg.position.y = 1.2 + i * 2.4;
    seg.castShadow = true;
    g.add(seg);
  }
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.2, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2f36 }),
  );
  gallery.position.y = 12.1;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd070, emissiveIntensity: 1.5 }),
  );
  lamp.position.y = 12.8;
  lamp.name = 'lamp';
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 10), red);
  cap.position.y = 13.9;
  g.add(gallery, lamp, cap);
  return g;
}

/** Small house with a pitched roof (the cabin, the port houses). */
export function makeHouse(w: number, d: number, h: number, wall: string, roofColor: number): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: paintTexture(wall), roughness: 0.85 });
  g.add(box(w, h, d, wallMat, 0, h / 2, 0));
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w * 0.6, 0);
  roofShape.lineTo(0, h * 0.62);
  roofShape.lineTo(w * 0.6, 0);
  roofShape.closePath();
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roofShape, { depth: d * 1.12, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }),
  );
  roof.position.set(0, h, -d * 0.56);
  roof.castShadow = true;
  g.add(roof);
  const door = box(
    w * 0.2,
    h * 0.62,
    0.06,
    new THREE.MeshStandardMaterial({ map: woodTexture('#6a4526') }),
    0,
    h * 0.31,
    d / 2 + 0.02,
  );
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ccbe0,
    roughness: 0.1,
    metalness: 0.3,
    emissive: 0xffc870,
    emissiveIntensity: 0,
  });
  glassMat.name = 'window';
  const w1 = box(w * 0.2, h * 0.26, 0.05, glassMat, -w * 0.28, h * 0.56, d / 2 + 0.02);
  const w2 = box(w * 0.2, h * 0.26, 0.05, glassMat, w * 0.28, h * 0.56, d / 2 + 0.02);
  const chimney = box(
    0.4,
    1.1,
    0.4,
    new THREE.MeshStandardMaterial({ color: 0x7a5a48, roughness: 0.9 }),
    w * 0.28,
    h + h * 0.5,
    -d * 0.15,
  );
  g.add(door, w1, w2, chimney);
  return g;
}
