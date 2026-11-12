import { app } from '../app';
import { portraitSvg } from '../art/portraits';
import { CHARACTERS } from '../data/dialogues';
import type { DialogueLine } from '../data/types';
import { button, clear, h, icon, iconButton, svg } from './dom';

export type Mode = 'boot' | 'home' | 'port' | 'fishing';

export interface Screen {
  id: string;
  el: HTMLElement;
  /** Re-renders the content after a state change. */
  refresh?: () => void;
  onClose?: () => void;
}

export type ScreenFactory = (params: Record<string, unknown>) => Screen;

export interface Hud {
  el: HTMLElement;
  refresh: () => void;
  destroy?: () => void;
}

interface ModalHandle {
  el: HTMLElement;
  dismissible: boolean;
  close: () => void;
}

const SCENE_OF_MODE: Record<Exclude<Mode, 'boot'>, string> = { home: 'Title', port: 'Port', fishing: 'Fishing' };

/** Owns the HTML layers above the canvas: HUD, full screens, modals, toasts, transitions. */
export class Ui {
  readonly root: HTMLElement;
  private hudLayer = h('div', { class: 'layer hud-layer' });
  private screenLayer = h('div', { class: 'layer screen-layer' });
  private modalLayer = h('div', { class: 'layer modal-layer' });
  private toastLayer = h('div', { class: 'layer toast-layer', 'aria-live': 'polite' });
  private curtain = h('div', { class: 'curtain', 'aria-hidden': 'true' });
  private factories = new Map<string, ScreenFactory>();
  private hudFactories = new Map<string, () => Hud>();
  private stack: Screen[] = [];
  private modals: ModalHandle[] = [];
  private pending: (() => Promise<void>)[] = [];
  private flushing = false;
  private refreshQueued = false;
  private switching = false;
  mode: Mode = 'boot';
  hud: Hud | null = null;
  /** Set by the fishing scene while a fight or a catch is in progress: dialogs wait. */
  busy = false;
  /** Extra condition that delays queued notifications (e.g. during the tutorial). */
  holdNotifications: () => boolean = () => false;
  /** Called after every mode switch. */
  onModeChange: (mode: Mode) => void = () => undefined;

  constructor(root: HTMLElement) {
    this.root = root;
    root.append(this.hudLayer, this.screenLayer, this.modalLayer, this.toastLayer, this.curtain);
    root.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest('button')) app.audio.sfx('click');
    });
  }

  registerScreen(id: string, factory: ScreenFactory): void {
    this.factories.set(id, factory);
  }

  registerHud(mode: Mode, factory: () => Hud): void {
    this.hudFactories.set(mode, factory);
  }

  // ───────────────────────── Modes & scenes ─────────────────────────

  private activeSceneKey(): string | null {
    return this.mode === 'boot' ? null : SCENE_OF_MODE[this.mode];
  }

  /** True when something covers the playfield (the scene is paused meanwhile). */
  get covered(): boolean {
    return this.stack.length > 0 || this.modals.length > 0;
  }

  private syncPause(): void {
    const key = this.activeSceneKey();
    const scenes = app.phaser?.scene;
    if (!key || !scenes) return;
    const shouldPause = this.covered && this.mode !== 'home';
    if (shouldPause && scenes.isActive(key)) scenes.pause(key);
    else if (!shouldPause && scenes.isPaused(key)) scenes.resume(key);
    this.root.classList.toggle('is-covered', this.covered);
  }

  private async playCurtain(action: () => void): Promise<void> {
    const reduced = app.game?.state.settings.reducedMotion ?? false;
    const half = reduced ? 140 : 380;
    this.curtain.className = `curtain ${reduced ? 'curtain-fade' : 'curtain-wave'} is-in`;
    app.audio.sfx('whoosh');
    await wait(half);
    action();
    await wait(60);
    this.curtain.className = `curtain ${reduced ? 'curtain-fade' : 'curtain-wave'} is-out`;
    await wait(half);
    this.curtain.className = 'curtain';
  }

  /** Switches between the title, the port and the fishing scene with a transition. */
  async setMode(mode: Exclude<Mode, 'boot'>, instant = false): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    const apply = (): void => {
      this.closeAllScreens();
      const scenes = app.phaser?.scene;
      const previous = this.activeSceneKey();
      this.mode = mode;
      this.mountHud();
      if (scenes) {
        if (previous && previous !== SCENE_OF_MODE[mode]) scenes.stop(previous);
        if (previous === SCENE_OF_MODE[mode]) scenes.getScene(previous)?.scene.restart();
        else scenes.start(SCENE_OF_MODE[mode]);
      }
      this.root.dataset.mode = mode;
    };
    try {
      if (instant || this.mode === 'boot') apply();
      else await this.playCurtain(apply);
    } finally {
      this.switching = false;
    }
    this.onModeChange(mode);
    this.flush();
  }

  private mountHud(): void {
    this.hud?.destroy?.();
    clear(this.hudLayer);
    const factory = this.hudFactories.get(this.mode);
    this.hud = factory ? factory() : null;
    if (this.hud) this.hudLayer.appendChild(this.hud.el);
  }

  // ───────────────────────── Screens ─────────────────────────

  open(id: string, params: Record<string, unknown> = {}): void {
    const factory = this.factories.get(id);
    if (!factory) return;
    const screen = factory(params);
    screen.el.classList.add('screen');
    screen.el.dataset.screen = id;
    this.stack.push(screen);
    this.screenLayer.appendChild(screen.el);
    this.syncPause();
    app.audio.sfx('page');
  }

  /** Replaces the top screen (used by tab-like navigation between sibling screens). */
  replace(id: string, params: Record<string, unknown> = {}): void {
    this.popScreen();
    this.open(id, params);
  }

  private popScreen(): boolean {
    const screen = this.stack.pop();
    if (!screen) return false;
    screen.onClose?.();
    screen.el.remove();
    return true;
  }

  closeScreen(): void {
    if (this.popScreen()) {
      this.syncPause();
      this.refresh();
      this.flush();
    }
  }

  closeAllScreens(): void {
    while (this.popScreen());
    this.syncPause();
  }

  get topScreen(): string | null {
    return this.stack[this.stack.length - 1]?.id ?? null;
  }

  /** Re-renders the visible HUD and screen (batched to once per frame). */
  refresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      this.hud?.refresh();
      this.stack[this.stack.length - 1]?.refresh?.();
    });
  }

  // ───────────────────────── Back navigation ─────────────────────────

  /** Logical "back": closes the top-most thing. Returns false when there is nothing left to close. */
  back(): boolean {
    const modal = this.modals[this.modals.length - 1];
    if (modal) {
      if (modal.dismissible) modal.close();
      return true;
    }
    if (this.stack.length > 0) {
      this.closeScreen();
      return true;
    }
    if (this.mode === 'fishing') {
      this.open('pause');
      return true;
    }
    if (this.mode === 'port') {
      app.save();
      void this.setMode('home');
      return true;
    }
    return false;
  }

  // ───────────────────────── Modals ─────────────────────────

  modal(content: HTMLElement, opts: { dismissible?: boolean; cls?: string; onClose?: () => void } = {}): () => void {
    const dismissible = opts.dismissible ?? true;
    const backdrop = h('div', { class: `modal-backdrop ${opts.cls ?? ''}`.trim() });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content);
    backdrop.appendChild(box);
    let closed = false;
    const handle: ModalHandle = {
      el: backdrop,
      dismissible,
      close: () => {
        if (closed) return;
        closed = true;
        this.modals = this.modals.filter((m) => m !== handle);
        backdrop.remove();
        opts.onClose?.();
        this.syncPause();
        this.refresh();
      },
    };
    if (dismissible) {
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) handle.close();
      });
    }
    this.modals.push(handle);
    this.modalLayer.appendChild(backdrop);
    this.syncPause();
    return handle.close;
  }

  confirm(title: string, text: string, okLabel: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;
      const answer = (value: boolean): void => {
        if (answered) return;
        answered = true;
        close();
        resolve(value);
      };
      const content = h(
        'div',
        { class: 'dialog' },
        h('h2', null, title),
        h('p', null, text),
        h(
          'div',
          { class: 'dialog-actions' },
          button('Annuler', () => answer(false), { kind: 'ghost' }),
          button(okLabel, () => answer(true), { kind: danger ? 'danger' : 'primary', id: 'confirm-ok' }),
        ),
      );
      const close = this.modal(content, { onClose: () => answer(false) });
    });
  }

  /** Simple information box with a single button. */
  notice(title: string, body: HTMLElement | string, okLabel = 'OK', iconName?: string): Promise<void> {
    return new Promise((resolve) => {
      const content = h(
        'div',
        { class: 'dialog' },
        iconName ? h('div', { class: 'dialog-icon' }, icon(iconName)) : null,
        h('h2', null, title),
        typeof body === 'string' ? h('p', null, body) : body,
        h('div', { class: 'dialog-actions' }, button(okLabel, () => close(), { kind: 'primary', id: 'notice-ok' })),
      );
      const close = this.modal(content, { onClose: () => resolve() });
    });
  }

  /** Character dialogue, one line at a time. */
  dialogue(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => {
      if (lines.length === 0) {
        resolve();
        return;
      }
      let index = 0;
      const portrait = h('div', { class: 'dlg-portrait' });
      const name = h('div', { class: 'dlg-name' });
      const text = h('p', { class: 'dlg-text' });
      const next = button('Suivant', () => advance(), { kind: 'primary', icon: 'next', id: 'dialogue-next' });
      const show = (): void => {
        const line = lines[index]!;
        portrait.innerHTML = portraitSvg(line.who);
        name.textContent = CHARACTERS[line.who].name;
        text.textContent = line.text;
        (next.querySelector('.btn-label') as HTMLElement).textContent = index === lines.length - 1 ? 'Continuer' : 'Suivant';
      };
      const advance = (): void => {
        index += 1;
        if (index >= lines.length) close();
        else show();
      };
      const content = h('div', { class: 'dlg' }, portrait, h('div', { class: 'dlg-body' }, name, text, h('div', { class: 'dlg-actions' }, next)));
      const close = this.modal(content, { cls: 'modal-bottom', dismissible: false, onClose: () => resolve() });
      show();
    });
  }

  // ───────────────────────── Toasts ─────────────────────────

  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', iconName?: string): void {
    const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, iconName ? icon(iconName) : null, h('span', null, text));
    this.toastLayer.appendChild(el);
    while (this.toastLayer.children.length > 3) this.toastLayer.firstElementChild?.remove();
    setTimeout(() => el.classList.add('is-leaving'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // ───────────────────────── Deferred notifications ─────────────────────────

  /** Queues a modal-like notification; it is shown as soon as the player is not busy. */
  enqueue(task: () => Promise<void>): void {
    this.pending.push(task);
    this.flush();
  }

  /** Shows queued notifications one after the other when nothing important is on screen. */
  flush(): void {
    if (this.flushing || this.busy || this.switching || this.mode === 'boot' || this.holdNotifications()) return;
    const task = this.pending.shift();
    if (!task) return;
    this.flushing = true;
    void task()
      .catch(() => undefined)
      .then(() => {
        this.flushing = false;
        this.flush();
      });
  }

  get hasPending(): boolean {
    return this.pending.length > 0 || this.flushing;
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Standard full-screen layout: header with a back button, optional tabs, scrollable body. */
export function screenShell(
  title: string,
  iconName: string,
  opts: { tabs?: { id: string; label: string; icon?: string; badge?: () => boolean }[]; tab?: string; onTab?: (id: string) => void; right?: HTMLElement } = {},
): { el: HTMLElement; body: HTMLElement; setTab: (id: string) => void; right: HTMLElement } {
  const body = h('div', { class: 'screen-body' });
  const right = opts.right ?? h('div', { class: 'screen-right' });
  const header = h(
    'header',
    { class: 'screen-header' },
    iconButton('back', 'Retour', () => app.ui.back(), 'screen-back'),
    h('h1', null, icon(iconName), h('span', null, title)),
    right,
  );
  const tabButtons = new Map<string, HTMLButtonElement>();
  let tabs: HTMLElement | null = null;
  const setTab = (id: string): void => {
    for (const [tabId, btn] of tabButtons) {
      btn.classList.toggle('is-active', tabId === id);
      btn.setAttribute('aria-selected', String(tabId === id));
    }
  };
  if (opts.tabs) {
    tabs = h('nav', { class: 'tabs', role: 'tablist' });
    for (const tab of opts.tabs) {
      const btn = h(
        'button',
        {
          class: 'tab',
          type: 'button',
          role: 'tab',
          'data-tab': tab.id,
          onclick: () => {
            setTab(tab.id);
            opts.onTab?.(tab.id);
          },
        },
        tab.icon ? icon(tab.icon) : null,
        h('span', null, tab.label),
        tab.badge?.() ? h('i', { class: 'badge-dot' }) : null,
      );
      tabButtons.set(tab.id, btn);
      tabs.appendChild(btn);
    }
    setTab(opts.tab ?? opts.tabs[0]!.id);
  }
  const el = h('section', { class: 'screen-root' }, header, tabs, body);
  return { el, body, setTab, right };
}

export { svg };
