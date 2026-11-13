import { h } from './dom';

/** Movement input shared by the 3D views: x = right, y = forward, both in -1..1. */
export const moveInput = { x: 0, y: 0 };

/** Camera look deltas (radians) accumulated since the last frame; views consume and reset them. */
export const lookInput = { dx: 0, dy: 0 };
const LOOK_SPEED = 0.006;

/** Adds a drag (in CSS pixels) to the camera look input. */
export function addLook(px: number, py: number): void {
  lookInput.dx += px * LOOK_SPEED;
  lookInput.dy += py * LOOK_SPEED;
}

const stick = { x: 0, y: 0 };
const keys = new Set<string>();
const KEYMAP: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, 1],
  KeyZ: [0, 1],
  KeyS: [0, -1],
  KeyA: [-1, 0],
  KeyQ: [-1, 0],
  KeyD: [1, 0],
};

function sync(): void {
  let x = stick.x;
  let y = stick.y;
  for (const code of keys) {
    const k = KEYMAP[code];
    if (k) {
      x += k[0];
      y += k[1];
    }
  }
  const len = Math.hypot(x, y);
  moveInput.x = len > 1 ? x / len : x;
  moveInput.y = len > 1 ? y / len : y;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (ev) => {
    if (KEYMAP[ev.code] && document.activeElement === document.body) {
      keys.add(ev.code);
      sync();
    }
  });
  window.addEventListener('keyup', (ev) => {
    keys.delete(ev.code);
    sync();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    sync();
  });
}

/** On-screen joystick (thumb pad). Keyboard arrows / WASD / ZQSD work too. */
export function joystick(label: string): HTMLElement {
  const knob = h('div', { class: 'joystick-knob' });
  const el = h('div', { class: 'joystick', id: 'joystick', role: 'application', 'aria-label': label }, knob);
  let active: number | null = null;
  const set = (ev: PointerEvent): void => {
    const rect = el.getBoundingClientRect();
    const r = rect.width / 2;
    let dx = (ev.clientX - rect.left - r) / (r * 0.7);
    let dy = (ev.clientY - rect.top - r) / (r * 0.7);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    stick.x = dx;
    stick.y = -dy;
    knob.style.transform = `translate(${(dx * r * 0.55).toFixed(1)}px, ${(dy * r * 0.55).toFixed(1)}px)`;
    sync();
  };
  const release = (): void => {
    active = null;
    stick.x = 0;
    stick.y = 0;
    knob.style.transform = '';
    sync();
  };
  el.addEventListener('pointerdown', (ev) => {
    active = ev.pointerId;
    el.setPointerCapture(ev.pointerId);
    set(ev);
    ev.preventDefault();
  });
  el.addEventListener('pointermove', (ev) => {
    if (ev.pointerId === active) set(ev);
  });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  return el;
}

/** Stops any movement (used when a view is paused or replaced). */
export function resetMove(): void {
  stick.x = 0;
  stick.y = 0;
  keys.clear();
  sync();
}

/** Touch pad that turns the camera (the right mouse button does the same on a PC). */
export function lookPad(label: string): HTMLElement {
  const el = h(
    'div',
    { class: 'lookpad', id: 'lookpad', role: 'application', 'aria-label': label },
    h('div', { class: 'lookpad-eye' }),
  );
  let active: number | null = null;
  let lastX = 0;
  let lastY = 0;
  el.addEventListener('pointerdown', (ev) => {
    active = ev.pointerId;
    lastX = ev.clientX;
    lastY = ev.clientY;
    el.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  el.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== active) return;
    addLook((ev.clientX - lastX) * 1.6, (ev.clientY - lastY) * 1.6);
    lastX = ev.clientX;
    lastY = ev.clientY;
  });
  const release = (): void => {
    active = null;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  return el;
}
