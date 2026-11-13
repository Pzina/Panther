import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** Supplied 3D models and textures (see the credits for authors and licences). */
const MODELS = ['person', 'boat', 'dock', 'rod', 'pine', 'light'] as const;
const TEXTURES = ['sand', 'pebbles'] as const;
export type ModelName = (typeof MODELS)[number];
export type TextureName = (typeof TEXTURES)[number];

/** File extension of the models. Some hosts only serve known types, hence the build-time override. */
const MODEL_EXT = (import.meta.env.VITE_MODEL_EXT as string | undefined) ?? 'glb';

const models = new Map<ModelName, GLTF>();
const textures = new Map<TextureName, THREE.Texture>();

/** Removes the triangles of a mesh for which `drop` is true on all three corners. */
function cullTriangles(mesh: THREE.Mesh, drop: (x: number, y: number, z: number) => boolean): void {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const index = geo.getIndex();
  if (!index) return;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (!tri.every((v) => drop(pos.getX(v), pos.getY(v), pos.getZ(v)))) kept.push(...tri);
  }
  geo.setIndex(kept);
}

/**
 * Loads every model and texture. A file that fails to load is simply skipped: the game then
 * falls back to its code-generated version of that object.
 */
export async function loadAssets(onProgress: (ratio: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const textureLoader = new THREE.TextureLoader();
  const total = MODELS.length + TEXTURES.length;
  let done = 0;
  const step = (): void => onProgress(++done / total);
  await Promise.all([
    ...MODELS.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`./assets/${name}.${MODEL_EXT}`);
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = name !== 'person';
          mesh.frustumCulled = name !== 'person';
          // Matte skin and clothes: the character must not mirror the sky.
          if (name === 'person') {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.metalness = 0;
            mat.metalnessMap = null;
            mat.roughness = 0.9;
            mat.roughnessMap = null;
            mat.envMapIntensity = 0.35;
            mat.transparent = false;
            mat.opacity = 1;
            mat.alphaTest = 0;
            mat.depthWrite = true;
            mat.side = THREE.FrontSide;
          }
        });
        // The rod model comes with a dangling line and float: the game draws its own line.
        if (name === 'rod') {
          gltf.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) cullTriangles(mesh, (x, y) => x > 0.9 && y < 0.66);
          });
        }
        // The pine foliage needs its transparency mask (kept in a separate texture).
        if (name === 'pine') {
          const twig = await textureLoader.loadAsync('./assets/pine_twig.png').catch(() => null);
          gltf.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
            if (!mesh.isMesh || !mat) return;
            if (mat.name.includes('twig') && twig) {
              twig.colorSpace = THREE.SRGBColorSpace;
              twig.flipY = false;
              mat.map = twig;
              mat.alphaTest = 0.35;
              mat.side = THREE.DoubleSide;
              mat.normalMap = null;
              mat.needsUpdate = true;
            }
            mesh.receiveShadow = false;
          });
        }
        models.set(name, gltf);
      } catch {
        /* optional asset */
      }
      step();
    }),
    ...TEXTURES.map(async (name) => {
      try {
        const tex = await textureLoader.loadAsync(`./assets/${name}.jpg`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        textures.set(name, tex);
      } catch {
        /* optional asset */
      }
      step();
    }),
  ]);
}

export function hasModel(name: ModelName): boolean {
  return models.has(name);
}

/** A fresh copy of a model (materials are shared, skinned meshes get their own skeleton). */
export function cloneModel(name: ModelName): THREE.Object3D | null {
  const gltf = models.get(name);
  if (!gltf) return null;
  return name === 'person' ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
}

export function modelAnimations(name: ModelName): THREE.AnimationClip[] {
  return models.get(name)?.animations ?? [];
}

export function assetTexture(name: TextureName): THREE.Texture | null {
  return textures.get(name) ?? null;
}
