import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION } from '../config/constants';
import { hasItem } from '../data/equipment';
import { hasSpecies } from '../data/species';
import { ZONE_IDS } from '../data/zones';
import type { CaughtFish, VariantId, ZoneId } from '../data/types';
import { createNewState, type DexEntry, type GameState } from './state';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Envelope {
  v: number;
  t: number;
  sum: string;
  data: unknown;
}

export type ParseResult = { ok: true; state: GameState } | { ok: false; error: string };

const EXPORT_PREFIX = 'RSC1.';
const VARIANT_IDS: VariantId[] = ['normal', 'albino', 'melanic', 'golden', 'shimmer'];

/** FNV-1a checksum (hex) of a string. */
export function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function serialize(state: GameState): string {
  const data = JSON.stringify(state);
  const envelope: Envelope = { v: state.saveVersion, t: state.updatedAt, sum: checksum(data), data: state };
  return JSON.stringify(envelope);
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Migrations from version N to N + 1. Add an entry here whenever SAVE_VERSION is bumped. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 (prototype) stored money as `gold`, had a single `volume` setting and no aquarium.
  1: (data) => {
    const next: Record<string, unknown> = { ...data };
    if (typeof next.gold === 'number' && typeof next.coins !== 'number') next.coins = next.gold;
    delete next.gold;
    const settings = { ...((next.settings as Record<string, unknown>) ?? {}) };
    if (typeof settings.volume === 'number') {
      settings.music = settings.volume;
      settings.sfx = settings.volume;
      settings.ambience = settings.volume;
      delete settings.volume;
    }
    next.settings = settings;
    if (!Array.isArray(next.aquarium)) next.aquarium = [];
    next.saveVersion = 2;
    return next;
  },
};

export function migrate(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let current = data;
  let version = fromVersion;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    current = step(current);
    version += 1;
  }
  current.saveVersion = SAVE_VERSION;
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Copies the fields of `source` that have the same primitive type as in `defaults`. */
function mergeFlat<T extends object>(defaults: T, source: unknown): T {
  const out = { ...defaults } as Record<string, unknown>;
  if (!isObject(source)) return out as T;
  for (const [key, def] of Object.entries(defaults)) {
    const value = source[key];
    if (typeof def === 'number') out[key] = num(value, def);
    else if (typeof def === 'boolean') out[key] = typeof value === 'boolean' ? value : def;
    else if (typeof def === 'string') out[key] = typeof value === 'string' ? value : def;
  }
  return out as T;
}

function sanitizeFish(value: unknown): CaughtFish | null {
  if (!isObject(value)) return null;
  if (typeof value.speciesId !== 'string' || !hasSpecies(value.speciesId)) return null;
  const variant = VARIANT_IDS.includes(value.variant as VariantId) ? (value.variant as VariantId) : 'normal';
  const zone = ZONE_IDS.includes(value.zone as ZoneId) ? (value.zone as ZoneId) : 'anse';
  return {
    uid: num(value.uid, 0, 0),
    speciesId: value.speciesId,
    size: num(value.size, 10, 0),
    weight: num(value.weight, 0.1, 0),
    variant,
    value: Math.round(num(value.value, 1, 0)),
    zone,
    day: num(value.day, 1, 1),
    locked: value.locked === true,
  };
}

/**
 * Rebuilds a valid state from arbitrary data: unknown ids are dropped, wrong types fall back
 * to defaults. Never throws on a plain object.
 */
export function sanitize(raw: Record<string, unknown>): GameState {
  const base = createNewState(num(raw.seed, 1, 0) >>> 0, num(raw.createdAt, Date.now(), 0));
  const state: GameState = { ...base };
  state.saveVersion = SAVE_VERSION;
  state.updatedAt = num(raw.updatedAt, base.updatedAt, 0);
  state.rngState = num(raw.rngState, base.rngState, 0) >>> 0;
  state.coins = Math.floor(num(raw.coins, 0, 0, 1e12));
  state.xp = Math.floor(num(raw.xp, 0, 0, 1e12));
  state.level = Math.floor(num(raw.level, 1, 1, 999));
  state.reputation = num(raw.reputation, 0, 0, 1e9);
  state.clockMinutes = num(raw.clockMinutes, base.clockMinutes, 0, 1e12);
  state.zone = ZONE_IDS.includes(raw.zone as ZoneId) ? (raw.zone as ZoneId) : 'anse';

  const zones = Array.isArray(raw.unlockedZones)
    ? (raw.unlockedZones.filter((z) => ZONE_IDS.includes(z as ZoneId)) as ZoneId[])
    : [];
  state.unlockedZones = [...new Set<ZoneId>(['anse', ...zones])];
  if (!state.unlockedZones.includes(state.zone)) state.zone = 'anse';

  const owned = Array.isArray(raw.owned)
    ? raw.owned.filter((id): id is string => typeof id === 'string' && hasItem(id))
    : [];
  state.owned = [...new Set([...base.owned, ...owned])];

  if (isObject(raw.equipment)) {
    for (const slot of Object.keys(base.equipment) as (keyof GameState['equipment'])[]) {
      const id = raw.equipment[slot];
      if (typeof id === 'string' && hasItem(id) && (slot === 'bait' || state.owned.includes(id))) {
        state.equipment[slot] = id;
      }
    }
  }
  if (isObject(raw.cosmetics)) {
    for (const slot of Object.keys(base.cosmetics) as (keyof GameState['cosmetics'])[]) {
      const id = raw.cosmetics[slot];
      if (typeof id === 'string' && state.owned.includes(id)) state.cosmetics[slot] = id;
    }
  }
  if (isObject(raw.baits)) {
    for (const [id, count] of Object.entries(raw.baits)) {
      if (hasItem(id)) state.baits[id] = Math.floor(num(count, 0, 0, 99999));
    }
  }

  const fishList = (value: unknown): CaughtFish[] =>
    Array.isArray(value) ? value.map(sanitizeFish).filter((f): f is CaughtFish => f !== null) : [];
  state.creel = fishList(raw.creel);
  state.aquarium = fishList(raw.aquarium);
  const maxUid = Math.max(0, ...state.creel.map((f) => f.uid), ...state.aquarium.map((f) => f.uid));
  state.nextUid = Math.max(maxUid + 1, Math.floor(num(raw.nextUid, 1, 1)));

  if (isObject(raw.dex)) {
    for (const [id, entry] of Object.entries(raw.dex)) {
      if (!hasSpecies(id) || !isObject(entry)) continue;
      const variants = Array.isArray(entry.variants)
        ? (entry.variants.filter((v) => VARIANT_IDS.includes(v as VariantId)) as VariantId[])
        : [];
      const dexEntry: DexEntry = {
        count: Math.floor(num(entry.count, 1, 1)),
        maxSize: num(entry.maxSize, 0, 0),
        maxWeight: num(entry.maxWeight, 0, 0),
        variants: [...new Set(variants)],
        firstDay: Math.floor(num(entry.firstDay, 1, 1)),
      };
      state.dex[id] = dexEntry;
    }
  }

  state.pity = mergeFlat(base.pity, raw.pity);
  state.story = mergeFlat(base.story, raw.story);
  state.stats = mergeFlat(base.stats, raw.stats);
  state.login = mergeFlat(base.login, raw.login);
  state.flags = mergeFlat(base.flags, raw.flags);
  state.settings = mergeFlat(base.settings, raw.settings);
  state.settings.music = num(state.settings.music, 0.6, 0, 1);
  state.settings.sfx = num(state.settings.sfx, 0.8, 0, 1);
  state.settings.ambience = num(state.settings.ambience, 0.5, 0, 1);
  state.settings.textScale = num(state.settings.textScale, 1, 0.85, 1.3);
  state.lastSeen = num(raw.lastSeen, base.lastSeen, 0);
  state.restUntil = num(raw.restUntil, 0, 0);
  state.lastRestDay = num(raw.lastRestDay, 0, 0);
  state.journalPagesRead = Math.floor(num(raw.journalPagesRead, 0, 0, 100));

  if (isObject(raw.challenges)) {
    for (const [id, entry] of Object.entries(raw.challenges)) {
      if (!isObject(entry)) continue;
      state.challenges[id] = { progress: num(entry.progress, 0, 0), claimed: entry.claimed === true };
    }
  }
  if (isObject(raw.achievements)) {
    for (const [id, when] of Object.entries(raw.achievements)) {
      if (typeof when === 'number') state.achievements[id] = when;
    }
  }
  if (Array.isArray(raw.milestonesClaimed)) {
    state.milestonesClaimed = raw.milestonesClaimed.filter((n): n is number => typeof n === 'number');
  }
  if (isObject(raw.daily) && typeof raw.daily.date === 'string' && Array.isArray(raw.daily.missions)) {
    state.daily = {
      date: raw.daily.date,
      missions: raw.daily.missions.filter(isObject).map((m) => ({
        templateId: typeof m.templateId === 'string' ? m.templateId : 'd-catch',
        kind: typeof m.kind === 'string' ? m.kind : 'catch',
        zone: ZONE_IDS.includes(m.zone as ZoneId) ? (m.zone as ZoneId) : undefined,
        target: Math.max(1, Math.floor(num(m.target, 1, 1))),
        progress: num(m.progress, 0, 0),
        coins: Math.floor(num(m.coins, 0, 0)),
        claimed: m.claimed === true,
      })),
    };
  }
  return state;
}

/** Parses a serialised save. Never throws: any problem is reported as `{ ok: false }`. */
export function parseSave(raw: string | null | undefined): ParseResult {
  if (!raw) return { ok: false, error: 'empty' };
  try {
    const envelope = JSON.parse(raw) as Partial<Envelope>;
    if (!isObject(envelope) || !isObject(envelope.data)) return { ok: false, error: 'shape' };
    if (typeof envelope.sum !== 'string' || checksum(JSON.stringify(envelope.data)) !== envelope.sum) {
      return { ok: false, error: 'checksum' };
    }
    const version = num(envelope.v, 0, 0);
    if (version < 1 || version > SAVE_VERSION) return { ok: false, error: 'version' };
    const migrated = migrate(envelope.data, version);
    return { ok: true, state: sanitize(migrated) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Text code (base64 + checksum) that can be copied to another device. */
export function exportCode(state: GameState): string {
  return EXPORT_PREFIX + toBase64(serialize(state));
}

export function importCode(code: string): ParseResult {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(EXPORT_PREFIX)) return { ok: false, error: 'prefix' };
  try {
    return parseSave(fromBase64(trimmed.slice(EXPORT_PREFIX.length)));
  } catch {
    return { ok: false, error: 'base64' };
  }
}

export interface LoadResult {
  state: GameState | null;
  /** The main save existed but could not be read. */
  corrupted: boolean;
  /** A readable previous save that can be offered to the player. */
  backup: GameState | null;
}

/** Optional asynchronous mirror (IndexedDB) used when localStorage has been cleared. */
export interface MirrorLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

export class SaveManager {
  private lastBackupAt = 0;

  constructor(
    private storage: StorageLike,
    private mirror?: MirrorLike,
  ) {}

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): boolean {
    try {
      this.storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  load(): LoadResult {
    const rawMain = this.read(SAVE_KEY);
    const main = parseSave(rawMain);
    const backup = parseSave(this.read(SAVE_BACKUP_KEY));
    if (main.ok) {
      // The save that was just read successfully becomes the new backup.
      if (rawMain) this.write(SAVE_BACKUP_KEY, rawMain);
      this.lastBackupAt = Date.now();
      return { state: main.state, corrupted: false, backup: backup.ok ? backup.state : null };
    }
    return { state: null, corrupted: rawMain !== null, backup: backup.ok ? backup.state : null };
  }

  /** Looks for a save in the asynchronous mirror (used when localStorage is empty). */
  async loadFromMirror(): Promise<GameState | null> {
    if (!this.mirror) return null;
    try {
      const result = parseSave(await this.mirror.get(SAVE_KEY));
      return result.ok ? result.state : null;
    } catch {
      return null;
    }
  }

  save(state: GameState, now: number = Date.now()): boolean {
    state.updatedAt = now;
    state.lastSeen = now;
    const text = serialize(state);
    if (now - this.lastBackupAt > BACKUP_INTERVAL_MS) {
      const previous = this.read(SAVE_KEY);
      if (previous && parseSave(previous).ok) this.write(SAVE_BACKUP_KEY, previous);
      this.lastBackupAt = now;
    }
    const ok = this.write(SAVE_KEY, text);
    void this.mirror?.set(SAVE_KEY, text).catch(() => undefined);
    return ok;
  }

  clear(): void {
    try {
      this.storage.removeItem(SAVE_KEY);
      this.storage.removeItem(SAVE_BACKUP_KEY);
    } catch {
      /* storage unavailable */
    }
    void this.mirror?.remove(SAVE_KEY).catch(() => undefined);
  }
}

/** In-memory storage for tests and for browsers where localStorage is blocked. */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** IndexedDB-backed mirror. Every failure is swallowed: it is only a safety net. */
export function createIndexedDbMirror(): MirrorLike | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('ressac', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  };
  return {
    get: async (key) => ((await run('readonly', (s) => s.get(key))) as string | undefined) ?? null,
    set: async (key, value) => {
      await run('readwrite', (s) => s.put(value, key));
    },
    remove: async (key) => {
      await run('readwrite', (s) => s.delete(key));
    },
  };
}
