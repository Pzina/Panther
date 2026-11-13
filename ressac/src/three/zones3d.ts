import * as THREE from 'three';
import type { ZoneId } from '../data/types';
import { fbm } from './noise';
import { makeLighthouse } from './props';
import { landMesh, scatterTrees, type HeightFn } from './terrain';

const blob = (x: number, z: number, cx: number, cz: number, rx: number, rz: number): number =>
  Math.max(0, 1 - Math.hypot((x - cx) / rx, (z - cz) / rz));
/** Smoothstep that also works when the edges are given in decreasing order. */
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Height of the land around each fishing spot (the boat sits at the origin, looking towards -z). */
export function zoneHeight(zone: ZoneId): HeightFn {
  switch (zone) {
    case 'anse':
      return (x, z) => {
        const n = 0.55 + 0.9 * fbm(x * 0.03, z * 0.03, 4, 2);
        return (
          (blob(x, z, -58, -88, 52, 36) ** 1.2 * 30 + blob(x, z, 66, -100, 60, 38) ** 1.2 * 24) * n - 1.5
        );
      };
    case 'etang':
      return (x, z) => {
        const r = Math.hypot(x * 0.9, z + 24);
        const n = fbm(x * 0.05, z * 0.05, 4, 5);
        return smooth(52 + n * 16, 95, r) * (5 + n * 14) - 1.2 + smooth(46 + n * 16, 60, r) * 1.6;
      };
    case 'riviere':
      return (x, z) => {
        const n = fbm(x * 0.022, z * 0.022, 5, 8);
        const bank = smooth(-46 - Math.sin(x * 0.05) * 6, -70, z);
        return bank * (4 + n * 10) + smooth(-80, -200, z) * (20 + n * 95) - 1.4;
      };
    case 'recif':
      return (x, z) => {
        const n = fbm(x * 0.08, z * 0.08, 3, 3);
        return (
          (blob(x, z, -42, -78, 26, 14) ** 0.8 * 3.4 +
            blob(x, z, 52, -105, 34, 16) ** 0.8 * 4 +
            blob(x, z, 8, -170, 44, 16) ** 0.8 * 3) *
            (0.8 + n * 0.5) -
          1
        );
      };
    case 'large':
      return (x, z) => blob(x, z, 70, -190, 14, 10) ** 0.7 * (9 + fbm(x * 0.2, z * 0.2, 3, 1) * 8) - 2;
    case 'fosse':
      return (x, z) => {
        const n = fbm(x * 0.06, z * 0.06, 4, 11);
        let h = 0;
        for (const [cx, cz, r, hh] of [
          [-48, -95, 20, 46],
          [-80, -150, 30, 70],
          [44, -110, 18, 38],
          [86, -160, 34, 78],
          [10, -210, 30, 55],
        ] as const) {
          h += blob(x, z, cx, cz, r, r * 0.8) ** 1.7 * hh;
        }
        return h * (0.6 + n * 0.9) - 2;
      };
  }
}

/** Distant land, trees and landmarks of a zone. */
export function buildZoneLand(zone: ZoneId): THREE.Group {
  const group = new THREE.Group();
  const height = zoneHeight(zone);
  const area = { x0: -230, x1: 230, z0: -260, z1: zone === 'etang' ? 60 : -30 };
  const palettes: Record<ZoneId, { sand: number; grass: number; rock: number; top?: number }> = {
    anse: { sand: 0xd6c59a, grass: 0x5f8a4c, rock: 0x7b756a },
    etang: { sand: 0x6a7a48, grass: 0x4f7a3c, rock: 0x5a6048 },
    riviere: { sand: 0x9a9080, grass: 0x58783f, rock: 0x6f6e6a, top: 0xf2f4f6 },
    recif: { sand: 0xf0e2b8, grass: 0xe6d6a6, rock: 0xc9b98f },
    large: { sand: 0x4a4e52, grass: 0x4a4e52, rock: 0x3a3e44 },
    fosse: { sand: 0x14161f, grass: 0x181a26, rock: 0x0e1018 },
  };
  group.add(
    landMesh(area.x0, area.x1, area.z0, area.z1, 150, zone === 'etang' ? 110 : 80, height, palettes[zone]),
  );
  if (zone === 'anse') {
    group.add(scatterTrees('broadleaf', 110, area, height, 4, [2.5, 24]));
    const lighthouse = makeLighthouse();
    lighthouse.position.set(-36, height(-36, -78) - 0.4, -78);
    lighthouse.scale.setScalar(1.4);
    group.add(lighthouse);
  } else if (zone === 'etang') {
    group.add(scatterTrees('willow', 90, area, height, 6, [0.6, 5]));
    group.add(scatterTrees('broadleaf', 160, area, height, 7, [2.5, 20]));
  } else if (zone === 'riviere') {
    group.add(scatterTrees('pine', 260, area, height, 9, [1, 26]));
  } else if (zone === 'recif') {
    group.add(scatterTrees('palm', 26, area, height, 3, [1.2, 6]));
  }
  return group;
}
