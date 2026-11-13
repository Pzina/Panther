import * as THREE from 'three';
import { addLook } from '../ui/joystick';

/** A 3D scene of the game (title, port, fishing). */
export abstract class View {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 0.5, 0.1, 1200);
  width = 390;
  height = 844;
  private baseFov: number | undefined;

  constructor(readonly stage: Stage) {}

  abstract update(dt: number): void;
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Field of view chosen for portrait; narrowed on wide (desktop) screens to keep the framing.
    this.baseFov ??= this.camera.fov;
    this.camera.fov = width > height ? this.baseFov * 0.68 : this.baseFov;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  /** When true, dragging on the canvas turns the camera instead of acting on the game. */
  dragLook = false;

  pointer(_type: 'down' | 'up' | 'move', _x: number, _y: number): void {
    /* optional */
  }
  paused(): void {
    /* optional */
  }
  dispose(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    });
  }
}

export type ViewFactory = (stage: Stage) => View;

const MAX_PIXEL_RATIO = 2;

/** Owns the WebGL renderer and the active view. Mirrors the small scene API the UI relies on. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private factories = new Map<string, ViewFactory>();
  private view: View | null = null;
  private key: string | null = null;
  private isPausedFlag = false;
  private last = 0;
  private container: HTMLElement;
  /** Resolution factor lowered automatically when the device cannot keep up. */
  private quality = 1;
  private slowFrames = 0;
  private frames = 0;

  /** Scene manager facade: start / stop / pause / resume by key. */
  readonly scene = {
    isActive: (key: string): boolean => this.key === key && !this.isPausedFlag,
    isPaused: (key: string): boolean => this.key === key && this.isPausedFlag,
    pause: (key: string): void => {
      if (this.key !== key) return;
      this.isPausedFlag = true;
      this.view?.paused();
    },
    resume: (key: string): void => {
      if (this.key === key) this.isPausedFlag = false;
    },
    stop: (key: string): void => {
      if (this.key !== key) return;
      this.view?.dispose();
      this.view = null;
      this.key = null;
    },
    start: (key: string): void => {
      this.view?.dispose();
      const factory = this.factories.get(key);
      if (!factory) return;
      this.isPausedFlag = false;
      this.key = key;
      this.view = factory(this);
      this.resize();
    },
    getScene: (key: string): View | null => (this.key === key ? this.view : null),
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0f2a3d);
    container.appendChild(this.renderer.domElement);
    const canvas = this.renderer.domElement;
    let dragging = false;
    let rightDrag = false;
    let lastX = 0;
    let lastY = 0;
    const send = (type: 'down' | 'up' | 'move') => (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const view = this.view;
      if (this.isPausedFlag || !view) return;
      if (type === 'down') {
        dragging = true;
        rightDrag = ev.button === 2;
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
      // Right mouse button, or any drag in a view that asks for it: turn the camera.
      const looking = dragging && (rightDrag || view.dragLook);
      if (type === 'move' && looking) {
        addLook(ev.clientX - lastX, ev.clientY - lastY);
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
      if (type === 'up') dragging = false;
      if (rightDrag) {
        if (type === 'up') rightDrag = false;
        return;
      }
      view.pointer(type, (ev.clientX - rect.left) / rect.width, (ev.clientY - rect.top) / rect.height);
    };
    canvas.addEventListener('pointerdown', send('down'));
    canvas.addEventListener('pointermove', send('move'));
    window.addEventListener('pointerup', send('up'));
    window.addEventListener('pointercancel', send('up'));
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    // Keyboard bonus on desktop: the space bar acts like a finger.
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space' && !ev.repeat && !this.isPausedFlag && document.activeElement === document.body)
        this.view?.pointer('down', 0.5, 0.6);
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'Space' && !this.isPausedFlag) this.view?.pointer('up', 0.5, 0.6);
    });
    this.resize();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  register(key: string, factory: ViewFactory): void {
    this.factories.set(key, factory);
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1) * this.quality);
    this.renderer.setSize(width, height, false);
    this.view?.resize(width, height);
  }

  private frame(time: number): void {
    const raw = (time - this.last) / 1000;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.last = time;
    // Adaptive resolution: after a second of slow frames, render fewer pixels.
    if (raw < 1) {
      this.frames += 1;
      if (raw > 0.03) this.slowFrames += 1;
      if (this.frames >= 40) {
        if (this.slowFrames > 24 && this.quality > 0.45) {
          this.quality *= 0.75;
          this.resize();
        }
        this.frames = 0;
        this.slowFrames = 0;
      }
    }
    const view = this.view;
    if (!view) return;
    if (!this.isPausedFlag) view.update(dt);
    this.renderer.render(view.scene, view.camera);
  }
}
