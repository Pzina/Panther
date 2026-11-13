import { app } from '../../app';
import { getBoat, getCosmetic } from '../../data/equipment';
import { getZone } from '../../data/zones';
import { makeBoat, makeLighthouse } from '../props';
import { Environment } from '../sky';
import { Stage, View } from '../stage';
import { landMesh, scatterTrees, type HeightFn } from '../terrain';
import { fbm } from '../noise';
import { Water } from '../water';
import type * as THREE from 'three';

/** Home page backdrop: open sea, the rocking boat, a sky following the device clock. */
export class TitleView extends View {
  private env: Environment;
  private water: Water;
  private boat: THREE.Group;
  private t = 0;

  constructor(stage: Stage) {
    super(stage);
    const state = app.game.state;
    const zone = getZone('anse');
    this.env = new Environment(this.scene, {
      zone: 'anse',
      hour: () => {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
      },
      weather: () => 'sun',
      reducedMotion: () => app.game.state.settings.reducedMotion,
    });
    this.water = new Water(this.env.uniforms, {
      deep: zone.palette.waterBottom,
      shallow: zone.palette.waterTop,
      rough: 1,
    });
    this.scene.add(this.water.mesh);
    const height: HeightFn = (x, z) => {
      const left = Math.max(0, 1 - Math.hypot((x + 60) / 55, (z + 130) / 40));
      const right = Math.max(0, 1 - Math.hypot((x - 70) / 60, (z + 150) / 45));
      return (left * 30 + right * 24) * (0.6 + 0.8 * fbm(x * 0.03, z * 0.03, 4, 2)) - 1.2;
    };
    this.scene.add(
      landMesh(-220, 220, -240, -90, 110, 40, height, { sand: 0xd8c79a, grass: 0x5d8a4c, rock: 0x7b756a }),
    );
    this.scene.add(
      scatterTrees('broadleaf', 90, { x0: -180, x1: 200, z0: -220, z1: -110 }, height, 4, [2, 22]),
    );
    const lighthouse = makeLighthouse();
    lighthouse.position.set(-34, height(-34, -118) - 0.3, -118);
    lighthouse.scale.setScalar(1.5);
    this.scene.add(lighthouse);
    this.boat = makeBoat(getCosmetic(state.cosmetics.boatColor), getBoat(state.equipment.boat).tier);
    this.boat.rotation.y = Math.PI * 0.42;
    this.scene.add(this.boat);
    this.camera.fov = 52;
    this.camera.position.set(0, 2.6, 12);
    this.camera.lookAt(0, 3.4, -30);
    app.audio.setScene({ zone: 'anse', phase: 'day', weather: 'sun', calm: true });
  }

  update(dt: number): void {
    this.t += dt;
    this.env.update(dt, this.camera, this.stage.renderer);
    const x = 0;
    const z = -7;
    const y = this.water.height(x, z);
    const calm = app.game.state.settings.reducedMotion ? 0.3 : 1;
    this.boat.position.set(x, y * 0.8 - 0.2, z);
    this.boat.rotation.z = (this.water.height(x + 1, z) - this.water.height(x - 1, z)) * 0.35 * calm;
    this.boat.rotation.x = (this.water.height(x, z + 1.5) - this.water.height(x, z - 1.5)) * 0.22 * calm;
  }

  override dispose(): void {
    this.env.dispose();
    super.dispose();
  }
}
