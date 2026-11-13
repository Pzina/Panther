import * as THREE from 'three';
import type { Weather, ZoneId } from '../data/types';
import { getZone } from '../data/zones';
import { quality } from './quality';
import { nightness, skyColors } from './skyColors';

export interface EnvConfig {
  zone: ZoneId;
  hour: () => number;
  weather: () => Weather;
  reducedMotion: () => boolean;
  onThunder?: () => void;
}

/** Uniforms shared by the sky dome and by the water (which reflects the very same sky). */
export interface SkyUniforms {
  [uniform: string]: THREE.IUniform;
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uMoonDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uCloudColor: { value: THREE.Color };
  uCloud: { value: number };
  uNight: { value: number };
  uFogDensity: { value: number };
  uFlash: { value: number };
}

/** GLSL: procedural sky (gradient, sun, moon, stars, lit fbm clouds). Shared with the water shader. */
export const SKY_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloudColor;
uniform float uCloud;
uniform float uNight;
uniform float uFlash;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm4(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return s;
}
vec3 skyColor(vec3 d, float disc) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
  float s = max(dot(d, uSunDir), 0.0);
  float clear = 1.0 - uCloud * 0.85;
  col += uSunColor * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.35 + pow(s, 400.0) * 0.8) * clear;
  col += uSunColor * smoothstep(0.99955, 0.9998, s) * 9.0 * disc * clear;
  float m = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * uNight * clear * (smoothstep(0.9993, 0.9996, m) * 2.2 * disc + pow(m, 300.0) * 0.25 + pow(m, 20.0) * 0.04);
  if (uNight > 0.02 && disc > 0.5) {
    vec2 sp = d.xz / (abs(d.y) + 0.35) * 90.0;
    vec2 cell = floor(sp);
    float r = hash12(cell);
    vec2 c = fract(sp) - 0.5 - (vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5) * 0.6;
    float star = step(0.93, r) * smoothstep(0.09, 0.0, length(c)) * (0.5 + 0.5 * sin(uTime * 2.0 + r * 40.0));
    col += vec3(star) * uNight * clear * smoothstep(0.02, 0.2, d.y);
  }
  if (d.y > 0.0 && uCloud > 0.01) {
    vec2 uv = d.xz / (d.y + 0.16) * 0.55 + uTime * vec2(0.012, 0.004);
    float n = fbm4(uv * 1.6);
    float cover = smoothstep(0.86 - uCloud * 0.62, 1.0 - uCloud * 0.5, n + 0.2);
    float shade = fbm4(uv * 1.6 + uSunDir.xz * 0.22 + 0.11);
    float lit = clamp(0.62 + (n - shade) * 3.2, 0.0, 1.0);
    vec3 cc = mix(uCloudColor * 0.42, uCloudColor, lit) + uSunColor * pow(s, 5.0) * 0.22 * lit;
    col = mix(col, cc, cover * smoothstep(0.0, 0.12, d.y));
  }
  col += vec3(0.75, 0.8, 1.0) * uFlash;
  return col;
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
${SKY_GLSL}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyColor(vec3(d.x, max(d.y, 0.0), d.z), 1.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const lin = (hex: number): THREE.Color => new THREE.Color(hex);

/** Sky dome, sun and moon lights, fog, rain and lightning for a zone. */
export class Environment {
  readonly uniforms: SkyUniforms;
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly ambient = new THREE.HemisphereLight(0xffffff, 0x334455, 0.8);
  darkness = 0;
  private dome: THREE.Mesh;
  private rain: THREE.LineSegments;
  private rainVel: Float32Array;
  private time = 0;
  private refresh = 0;
  private flash = 0;
  private nextFlash = 5;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envTimer = 0;
  private lastWeather: Weather | null = null;
  private fog = new THREE.FogExp2(0xffffff, 0.004);

  constructor(
    private scene: THREE.Scene,
    private cfg: EnvConfig,
  ) {
    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uCloudColor: { value: new THREE.Color(1, 1, 1) },
      uCloud: { value: 0.3 },
      uNight: { value: 0 },
      uFogDensity: { value: 0.004 },
      uFlash: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        fog: false,
      }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -14;
    cam.right = 14;
    cam.top = 14;
    cam.bottom = -14;
    cam.near = 1;
    cam.far = 120;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target, this.ambient);
    scene.fog = this.fog;

    // Rain streaks.
    const count = 900;
    const pos = new Float32Array(count * 6);
    this.rainVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = Math.random() * 22;
      const z = 4 - Math.random() * 44;
      pos.set([x, y, z, x, y + 0.5, z], i * 6);
      this.rainVel[i] = 16 + Math.random() * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0.35, fog: false }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    this.apply();
  }

  private apply(): void {
    const zone = getZone(this.cfg.zone);
    const weather = this.cfg.weather();
    const hour = zone.permanentNight ? 0.5 : this.cfg.hour();
    const u = this.uniforms;
    const { top, bottom } = skyColors(hour, weather);
    u.uZenith.value.copy(lin(top));
    u.uHorizon.value.copy(lin(bottom));
    const night = zone.permanentNight ? 1 : nightness(hour);
    u.uNight.value = night;

    // Sun: rises in front-left, sets in front-right, so that its glitter path crosses the view.
    const t = (hour - 5.5) / 15;
    const elev = Math.sin(Math.PI * t);
    u.uSunDir.value.set(-Math.cos(Math.PI * t) * 0.85, Math.max(-0.4, elev * 0.95 + 0.02), -0.55).normalize();
    const tm = (((hour + 24 - 20) % 24) / 10) * Math.PI;
    u.uMoonDir.value.set(Math.cos(tm) * 0.6, Math.max(0.12, Math.sin(tm) * 0.8), -0.62).normalize();
    const low = 1 - Math.min(1, Math.max(0, elev) * 2.2);
    const sunCol = new THREE.Color(1, 0.96, 0.88).lerp(new THREE.Color(1, 0.45, 0.18), low);
    const overcast =
      weather === 'storm'
        ? 0.95
        : weather === 'rain'
          ? 0.85
          : weather === 'fog'
            ? 0.8
            : weather === 'clouds'
              ? 0.45
              : 0.12;
    const day = Math.min(1, Math.max(0, elev * 3 + 0.15)) * (1 - night * 0.9);
    u.uSunColor.value.copy(sunCol).multiplyScalar(day * (1 - overcast * 0.7));
    u.uCloud.value = zone.permanentNight ? 0.15 : overcast;
    const cloudBase = weather === 'storm' ? 0x596673 : weather === 'rain' ? 0xa8b2bc : 0xffffff;
    u.uCloudColor.value
      .copy(lin(cloudBase))
      .lerp(sunCol, low * 0.5 * (1 - overcast))
      .multiplyScalar(Math.max(0.06, day * (1 - overcast * 0.35) + night * 0.05));
    this.darkness = Math.min(1, night * 0.85 + (weather === 'storm' ? 0.2 : 0));

    // Lights.
    const useMoon = day < 0.08;
    const dir = useMoon ? u.uMoonDir.value : u.uSunDir.value;
    this.sun.position.copy(dir).multiplyScalar(60);
    this.sun.color.copy(useMoon ? new THREE.Color(0.55, 0.65, 1) : sunCol);
    this.sun.intensity = useMoon ? 0.35 * (1 - overcast * 0.8) : 3.2 * day * (1 - overcast * 0.8);
    this.ambient.color
      .copy(u.uZenith.value)
      .lerp(u.uHorizon.value, 0.5)
      .lerp(new THREE.Color(1, 1, 1), 0.25);
    this.ambient.groundColor.copy(u.uHorizon.value).multiplyScalar(0.35);
    this.ambient.intensity = 0.25 + 1.5 * day + night * 0.35 + overcast * 0.5 * day;

    const density =
      weather === 'fog' ? 0.045 : weather === 'storm' ? 0.016 : weather === 'rain' ? 0.011 : 0.0045;
    u.uFogDensity.value = density;
    this.fog.density = density;
    this.fog.color.copy(u.uHorizon.value);
    this.rain.visible = weather === 'rain' || weather === 'storm';
    (this.rain.material as THREE.LineBasicMaterial).opacity = weather === 'storm' ? 0.5 : 0.3;
  }

  /** Blurred copy of the sky used as an environment map for shiny materials. */
  private updateEnvMap(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const dome = new THREE.Mesh(this.dome.geometry, this.dome.material);
    dome.scale.setScalar(50);
    envScene.add(dome);
    const target = pmrem.fromScene(envScene, 0.02, 0.1, 100);
    this.envTarget?.dispose();
    this.envTarget = target;
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();
  }

  update(dt: number, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.time += dt;
    this.sun.castShadow = !quality.low;
    this.uniforms.uTime.value = this.time * (this.cfg.reducedMotion() ? 0.3 : 1);
    this.refresh -= dt;
    const weather = this.cfg.weather();
    if (this.refresh <= 0 || weather !== this.lastWeather) {
      this.refresh = 1;
      this.apply();
    }
    this.envTimer -= dt;
    if (this.envTimer <= 0 || weather !== this.lastWeather) {
      this.envTimer = 25;
      this.updateEnvMap(renderer);
    }
    this.lastWeather = weather;
    this.dome.position.copy(camera.position);
    this.dome.scale.setScalar(camera instanceof THREE.PerspectiveCamera ? camera.far * 0.9 : 500);

    this.rain.position.set(camera.position.x, 0, camera.position.z);
    if (this.rain.visible) {
      const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      const slant = weather === 'storm' ? 0.35 : 0.12;
      for (let i = 0; i < this.rainVel.length; i++) {
        const v = this.rainVel[i]! * dt;
        let y = a[i * 6 + 1]! - v;
        let x = a[i * 6]! + v * slant;
        if (y < -0.5) {
          y = 20 + Math.random() * 4;
          x = (Math.random() - 0.5) * 40;
        }
        a[i * 6] = x;
        a[i * 6 + 1] = y;
        a[i * 6 + 3] = x + 0.5 * slant;
        a[i * 6 + 4] = y + 0.55;
      }
      attr.needsUpdate = true;
    }
    if (weather === 'storm' && !this.cfg.reducedMotion()) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 5 + Math.random() * 9;
        this.flash = 1;
        this.cfg.onThunder?.();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.uniforms.uFlash.value = this.flash * 0.6;
  }

  dispose(): void {
    this.envTarget?.dispose();
    this.dome.geometry.dispose();
    (this.dome.material as THREE.Material).dispose();
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
  }
}
