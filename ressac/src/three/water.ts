import * as THREE from 'three';
import { SKY_GLSL, type SkyUniforms } from './sky';

/** Wave set shared by the shader and by the game objects that float (boat, bobber). */
const WAVES: { dx: number; dz: number; k: number; a: number; w: number }[] = [
  { dx: 0.85, dz: 0.52, k: 0.16, a: 0.2, w: 0.9 },
  { dx: -0.4, dz: 0.92, k: 0.29, a: 0.11, w: 1.25 },
  { dx: 0.98, dz: -0.2, k: 0.55, a: 0.05, w: 1.9 },
  { dx: 0.3, dz: 0.95, k: 0.9, a: 0.028, w: 2.6 },
];

/** Height of the water surface at a point (same formula as the vertex shader). */
export function waveHeight(x: number, z: number, t: number, rough: number): number {
  let y = 0;
  for (const w of WAVES) y += w.a * Math.sin((x * w.dx + z * w.dz) * w.k + t * w.w);
  return y * rough;
}

const waveGlsl = WAVES.map(
  (
    w,
    i,
  ) => `  { float ph = dot(p, vec2(${w.dx.toFixed(3)}, ${w.dz.toFixed(3)})) * ${w.k.toFixed(3)} + uTime * ${w.w.toFixed(3)};
    h += ${w.a.toFixed(3)} * sin(ph); d += vec2(${w.dx.toFixed(3)}, ${w.dz.toFixed(3)}) * ${(w.k * w.a).toFixed(5)} * cos(ph); } // wave ${i}`,
).join('\n');

const VERT = /* glsl */ `
uniform float uTime;
uniform float uRough;
varying vec3 vWorld;
float waves(vec2 p) {
  float h = 0.0; vec2 d = vec2(0.0);
${waveGlsl}
  return h * uRough;
}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += waves(world.xz);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = /* glsl */ `
${SKY_GLSL}
uniform float uRough;
uniform float uFogDensity;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uGlow;
uniform float uRain;
uniform float uFlow;
varying vec3 vWorld;

vec3 waveInfo(vec2 p) {
  float h = 0.0; vec2 d = vec2(0.0);
${waveGlsl}
  return vec3(h, d) * uRough;
}
void main() {
  vec3 V = cameraPosition - vWorld;
  float dist = length(V);
  V /= dist;
  vec3 info = waveInfo(vWorld.xz);
  // Small ripples: several layers of moving noise, fading with distance to avoid shimmering.
  vec2 p = vWorld.xz + vec2(uTime * uFlow, 0.0);
  float fade = 1.0 / (1.0 + dist * 0.03);
  float fade2 = 1.0 / (1.0 + dist * 0.09);
  float fade3 = 1.0 / (1.0 + dist * 0.35);
  float e = 0.12;
  vec2 q1 = p * 0.55 + uTime * vec2(0.21, 0.13);
  vec2 q2 = p * 1.7 - uTime * vec2(0.17, 0.26);
  vec2 q3 = p * 5.0 + uTime * vec2(0.4, -0.3);
  float hi = (0.12 + uRain * 0.5) * fade3;
  float n0 = fbm3(q1) + 0.45 * fade2 * vnoise(q2) + hi * vnoise(q3);
  float nx = fbm3(q1 + vec2(e * 0.55, 0.0)) + 0.45 * fade2 * vnoise(q2 + vec2(e * 1.7, 0.0)) + hi * vnoise(q3 + vec2(e * 5.0, 0.0));
  float nz = fbm3(q1 + vec2(0.0, e * 0.55)) + 0.45 * fade2 * vnoise(q2 + vec2(0.0, e * 1.7)) + hi * vnoise(q3 + vec2(0.0, e * 5.0));
  vec2 ripple = vec2(nx - n0, nz - n0) / e * (0.2 + 0.12 * uRough) * fade;
  vec3 N = normalize(vec3(-info.y - ripple.x, 1.0, -info.z - ripple.y));

  float ndv = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  R = normalize(R);
  vec3 refl = skyColor(R, 0.0);
  float spec = pow(max(dot(R, uSunDir), 0.0), 260.0) * 7.0 * (0.25 + 0.75 * fade2) + pow(max(dot(R, uSunDir), 0.0), 36.0) * 0.4;
  refl += uSunColor * spec * (1.0 - uCloud * 0.8);
  float mspec = pow(max(dot(R, uMoonDir), 0.0), 260.0) * 5.0 * uNight * (1.0 - uCloud * 0.8);
  refl += vec3(0.8, 0.88, 1.0) * mspec;

  // Water body: deep colour, lighter where the light scatters through wave crests.
  float lightAmount = clamp(length(uSunColor) * 0.6 + 0.08 + uNight * 0.02, 0.0, 1.0);
  float crest = smoothstep(-0.1, 0.35, info.x);
  vec3 body = mix(uDeep, uShallow, 0.08 + 0.4 * crest * ndv) * (lightAmount * 0.8 + 0.03);
  body += uShallow * pow(max(dot(V, -uSunDir), 0.0), 3.0) * crest * 0.35 * length(uSunColor);
  vec3 col = mix(body, refl, fresnel);

  // Foam on the highest crests.
  float foam = smoothstep(0.62, 0.95, crest + (n0 - 0.75) * 0.9) * smoothstep(0.55, 1.2, uRough) * fade;
  col = mix(col, vec3(0.9, 0.95, 1.0) * (lightAmount + 0.05), foam * 0.55);

  // Bioluminescence (glowing tide, the Fosse).
  if (uGlow > 0.0) {
    float sp = pow(vnoise(p * 3.0 + uTime * 0.2) * vnoise(p * 7.0 - uTime * 0.35), 3.0) * 9.0;
    col += vec3(0.15, 0.95, 0.9) * (sp + crest * 0.06) * uGlow * fade;
  }

  float fog = 1.0 - exp(-pow(dist * uFogDensity * 1.25, 1.35));
  col = mix(col, uHorizon + vec3(0.75, 0.8, 1.0) * uFlash, clamp(fog, 0.0, 1.0));
  float alpha = mix(0.86, 1.0, clamp(fresnel * 3.0 + dist * 0.03, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface WaterOptions {
  deep: number;
  shallow: number;
  rough: number;
  flow?: number;
}

/** Animated sea surface reflecting the procedural sky. */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  rough: number;

  constructor(sky: SkyUniforms, options: WaterOptions) {
    this.rough = options.rough;
    this.uniforms = {
      ...sky,
      uRough: { value: options.rough },
      uDeep: { value: new THREE.Color(options.deep) },
      uShallow: { value: new THREE.Color(options.shallow) },
      uGlow: { value: 0 },
      uRain: { value: 0 },
      uFlow: { value: options.flow ?? 0 },
    };
    const geometry = new THREE.PlaneGeometry(700, 700, 220, 220);
    geometry.rotateX(-Math.PI / 2);
    // More triangles near the camera: compress the grid towards the centre.
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 350;
      const z = pos.getZ(i) / 350;
      pos.setX(i, Math.sign(x) * Math.pow(Math.abs(x), 2.4) * 350);
      pos.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), 2.4) * 350);
    }
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        fog: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  set(rough: number, glow: number, rain: number): void {
    this.rough = rough;
    this.uniforms.uRough!.value = rough;
    this.uniforms.uGlow!.value = glow;
    this.uniforms.uRain!.value = rain;
  }

  height(x: number, z: number): number {
    return waveHeight(x, z, this.uniforms.uTime!.value as number, this.rough);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
