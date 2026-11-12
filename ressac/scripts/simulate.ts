/**
 * Balance simulation: plays simulated careers with the real game rules (Game, catch tables,
 * fight model, economy, missions) and reports the average time to reach each milestone.
 *
 *   npm run simulate              → 1 000 careers
 *   npm run simulate -- --runs 200 --seed 7
 */
import { BALANCE } from '../src/config/balance';
import { Game } from '../src/core/game';
import { Rng } from '../src/core/rng';
import { createNewState } from '../src/core/state';
import { BAITS, HOOKS, LINES, REELS, RODS } from '../src/data/equipment';
import { STORY } from '../src/data/missions';
import { SPECIES } from '../src/data/species';
import type { Item, Species, ZoneId } from '../src/data/types';
import { getZone, ZONES } from '../src/data/zones';
import { autoFight, buildFightParams, type FightStatus } from '../src/systems/fight';
import { collectionCount, collectionPercent, collectionTotal } from '../src/systems/progression';

const args = process.argv.slice(2);
const arg = (name: string, fallback: number): number => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const RUNS = arg('runs', 1000);
const SEED = arg('seed', 2024);
const MAX_HOURS = arg('max-hours', 60);
const SESSION_MINUTES = 35;

const MILESTONES: { id: string; label: string; target?: string }[] = [
  { id: 'first', label: 'Premier poisson', target: '< 2 min' },
  { id: 's04', label: 'Anse terminée → Étang ouvert (s04)', target: '≈ 30 min' },
  { id: 's07', label: 'Fin de l’acte 1 (s07)', target: '≈ 2 h' },
  { id: 's12', label: 'Fin de l’acte 2 (s12)' },
  { id: 's16', label: 'La Fosse ouverte (s16)' },
  { id: 's18', label: 'Histoire terminée (Veilleuse)' },
  { id: 'c10', label: 'Collection 10 %' },
  { id: 'c25', label: 'Collection 25 %' },
  { id: 'c50', label: 'Collection 50 %' },
  { id: 'c75', label: 'Collection 75 %' },
  { id: 'c100', label: 'Collection 100 %', target: '15 – 25 h' },
  { id: 'lvl10', label: 'Niveau 10' },
  { id: 'lvl20', label: 'Niveau 20' },
];

// ───────────────────────── Fight outcome cache ─────────────────────────

const fightCache = new Map<string, { win: number; seconds: number; snap: number }>();

function fightOutcome(game: Game, species: Species, rng: Rng): { status: FightStatus; seconds: number } {
  const eq = game.state.equipment;
  const key = `${species.id}|${eq.rod}|${eq.reel}|${eq.line}|${eq.hook}|${game.state.zone}`;
  let stats = fightCache.get(key);
  if (!stats) {
    const sampler = new Rng(1234);
    let win = 0;
    let snap = 0;
    let seconds = 0;
    const samples = 24;
    for (let i = 0; i < samples; i++) {
      const params = buildFightParams(
        species,
        sampler.next(),
        game.stats(),
        getZone(game.state.zone).gimmick,
        false,
      );
      const r = autoFight(params, sampler, sampler.range(0.55, 0.9));
      if (r.status === 'caught') win++;
      if (r.status === 'snapped') snap++;
      seconds += r.seconds;
    }
    stats = { win: win / samples, seconds: seconds / samples, snap: snap / samples };
    fightCache.set(key, stats);
  }
  const roll = rng.next();
  const status: FightStatus =
    roll < stats.win ? 'caught' : roll < stats.win + stats.snap ? 'snapped' : 'escaped';
  return { status, seconds: stats.seconds * rng.range(0.8, 1.2) };
}

// ───────────────────────── Simulated player ─────────────────────────

const GEAR_LINES: Item[][] = [RODS, REELS, LINES, HOOKS];

function missingIn(game: Game, zone: ZoneId): Species[] {
  return SPECIES.filter((s) => s.zones.includes(zone) && !game.state.dex[s.id]);
}

function shop(game: Game): void {
  const state = game.state;
  const mission = game.currentStory();
  // Saving up for the boat the story asks for.
  if (mission?.objective.kind === 'boat') {
    const boat = `boat-${mission.objective.tier}`;
    if (game.checkBuy(boat).ok) game.buy(boat);
    if (!state.owned.includes(boat)) return;
  }
  // Gear: the next item of each line, cheapest upgrades first.
  for (let pass = 0; pass < 4; pass++) {
    const candidates = GEAR_LINES.map((line) => line.find((item) => !state.owned.includes(item.id)))
      .filter((item): item is Item => Boolean(item) && game.checkBuy(item!.id).ok)
      .sort((a, b) => a.price - b.price);
    const next = candidates[0];
    if (!next || next.price > state.coins * 0.85) break;
    game.buy(next.id);
  }
  // Baits: a few packs when they are cheap compared with the purse.
  for (const bait of BAITS.filter((b) => b.price > 0)) {
    if ((state.baits[bait.id] ?? 0) < 4 && game.checkBuy(bait.id).ok && bait.price < state.coins * 0.05)
      game.buy(bait.id);
  }
}

/** Crafting happens before selling: rare fish become glowing baits, an epic becomes a lure. */
function craftBaits(game: Game): void {
  const state = game.state;
  if ((state.baits.leurre ?? 0) === 0 && game.currentStory()?.id === 's18' && game.canCraft('leurre'))
    game.craft('leurre');
  for (const id of ['lumignon', 'strouille']) {
    if ((state.baits[id] ?? 0) < 4 && game.canCraft(id)) game.craft(id);
  }
}

/** True when a species' hard requirements are met right now in its zone. */
function conditionsMet(game: Game, s: Species, zone: ZoneId): boolean {
  if (s.requires?.weather && !s.requires.weather.includes(game.weather(zone))) return false;
  if (s.requires?.phase && !s.requires.phase.includes(game.phase(zone))) return false;
  return true;
}

function pickZone(game: Game, rng: Rng): ZoneId {
  const open = ZONES.filter((z) => game.zoneAccess(z.id).ok);
  const mission = game.currentStory();
  const obj = mission?.objective;
  if (obj && 'zone' in obj && obj.zone && game.zoneAccess(obj.zone).ok && obj.kind === 'catch')
    return obj.zone;
  if (mission?.id === 's18' && game.zoneAccess('fosse').ok && (game.state.baits.leurre ?? 0) > 0)
    return 'fosse';
  // A player reads the weather: zones where a missing rare species can bite right now come first.
  const scored = open.map((z, i) => {
    let score = 0;
    for (const s of missingIn(game, z.id)) {
      if (s.id === 'veilleuse') continue;
      const special = Boolean(s.requires);
      score += conditionsMet(game, s, z.id) ? (special ? 12 : 2) : special ? 0 : 1;
    }
    return { id: z.id, score: score + i * 0.5 + rng.next() };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.id;
}

function pickBait(game: Game, rng: Rng): void {
  const state = game.state;
  if (game.currentStory()?.id === 's18' && state.zone === 'fosse' && (state.baits.leurre ?? 0) > 0) {
    game.equip('leurre');
    return;
  }
  const missing = missingIn(game, state.zone);
  const wanted = new Map<string, number>();
  for (const s of missing)
    for (const b of s.baits) if (b !== 'leurre') wanted.set(b, (wanted.get(b) ?? 0) + 1);
  const owned = BAITS.filter((b) => !b.special && (b.infinite || (state.baits[b.id] ?? 0) > 0));
  const best = owned
    .map((b) => ({ id: b.id, score: (wanted.get(b.id) ?? 0) * 2 + b.luck * 3 + rng.next() }))
    .sort((a, b) => b.score - a.score)[0];
  game.equip(best?.id ?? 'mie');
}

interface Career {
  times: Record<string, number>;
  catches: number;
  missing: string[];
}

function career(seed: number): Career {
  const rng = new Rng(seed);
  const state = createNewState(seed, 0);
  state.flags.introSeen = true;
  const game = new Game(state);
  const times: Record<string, number> = {};
  let elapsed = 0;
  let sessionLeft = SESSION_MINUTES * 60;
  let realDay = Date.parse('2026-01-01T09:00:00');
  game.ensureDaily(realDay);
  game.claimLoginBonus(realDay);
  const mark = (id: string): void => {
    if (times[id] === undefined) times[id] = elapsed;
  };
  const spend = (seconds: number): void => {
    elapsed += seconds;
    sessionLeft -= seconds;
    game.advance(seconds);
  };
  const claimEverything = (): void => {
    game.state.daily.missions.forEach((_, i) => game.claimDaily(i));
    for (const id of Object.keys(game.state.challenges)) game.claimChallenge(id);
    for (const m of BALANCE.milestones) game.claimMilestone(m.percent);
  };
  let catches = 0;

  while (elapsed < MAX_HOURS * 3600) {
    // A new play session on a new real day: login bonus, daily missions, trailing net.
    if (sessionLeft <= 0) {
      game.state.lastSeen = realDay + SESSION_MINUTES * 60_000;
      realDay += 86_400_000;
      game.collectOffline(realDay);
      game.ensureDaily(realDay);
      game.claimLoginBonus(realDay);
      sessionLeft = SESSION_MINUTES * 60 * rng.range(0.6, 1.4);
    }
    // At the port: craft, sell, shop, choose a destination.
    craftBaits(game);
    game.sellAll();
    claimEverything();
    shop(game);
    game.travel(pickZone(game, rng));
    pickBait(game, rng);
    spend(25);

    // Fishing until the creel is full or the session ends.
    let guard = 0;
    let sinceChoice = 0;
    while (!game.creelFull() && sessionLeft > 0 && guard++ < 400) {
      const legendHunt = game.baitId() === 'leurre';
      const perfect = rng.chance(0.3);
      const power = legendHunt ? rng.range(0.85, 1) : perfect ? BALANCE.cast.sweetSpot : rng.range(0.25, 1);
      const depth = game.registerCast(power, perfect);
      const plan = game.planBite(depth, perfect);
      spend(BALANCE.overheadSeconds + plan.delay);
      // Human reaction to the bite.
      if (rng.range(0.25, 0.55) > plan.window) {
        game.failCatch('missed');
        continue;
      }
      game.startFight(plan);
      const fight = fightOutcome(game, plan.species, rng);
      spend(fight.seconds);
      if (fight.status !== 'caught') {
        game.failCatch(fight.status === 'snapped' ? 'snapped' : 'escaped');
        continue;
      }
      game.completeCatch(plan.fish);
      catches++;
      mark('first');
      // Keeps rare fish for crafting, releases sometimes.
      if (rng.chance(0.06)) game.releaseFish(plan.fish);
      else game.keepFish(plan.fish);
      if (game.baitId() === 'mie') pickBait(game, rng);
      if (legendHunt && (game.state.baits.leurre ?? 0) === 0) break;
      // Every few catches the player checks the sky and may move on.
      if (++sinceChoice >= 8) break;
    }

    // Milestones.
    for (const m of ['s04', 's07', 's12', 's16']) {
      const index = STORY.findIndex((x) => x.id === m);
      if (game.state.story.index > index || game.state.story.finished) mark(m);
    }
    if (game.state.story.finished) mark('s18');
    const pct = collectionPercent(game.state);
    for (const p of [10, 25, 50, 75]) if (pct >= p) mark(`c${p}`);
    if (collectionCount(game.state) >= collectionTotal()) mark('c100');
    if (game.state.level >= 10) mark('lvl10');
    if (game.state.level >= 20) mark('lvl20');
    if (times.c100 !== undefined && times.s18 !== undefined) break;
  }
  return { times, catches, missing: SPECIES.filter((x) => !game.state.dex[x.id]).map((x) => x.id) };
}

// ───────────────────────── Report ─────────────────────────

function fmt(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  return `${h} h ${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')}`;
}

function quantile(sorted: number[], q: number): number | undefined {
  if (sorted.length === 0) return undefined;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const started = Date.now();
const results: Career[] = [];
const master = new Rng(SEED);
for (let i = 0; i < RUNS; i++) {
  results.push(career(master.int(1, 0x7fffffff)));
  if (process.stdout.isTTY && i % 50 === 49) process.stdout.write(`\r${i + 1}/${RUNS} carrières…`);
}
if (process.stdout.isTTY) process.stdout.write('\r');

console.log(
  `\nRESSAC — simulation d'équilibrage : ${RUNS} carrières (graine ${SEED}, sessions de ~${SESSION_MINUTES} min, plafond ${MAX_HOURS} h)\n`,
);
const rows = MILESTONES.map((m) => {
  const values = results
    .map((r) => r.times[m.id])
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);
  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : undefined;
  return {
    Palier: m.label,
    Moyenne: fmt(mean),
    Médiane: fmt(quantile(values, 0.5)),
    'P10 – P90': `${fmt(quantile(values, 0.1))} – ${fmt(quantile(values, 0.9))}`,
    Atteint: `${Math.round((values.length / RUNS) * 100)} %`,
    Cible: m.target ?? '',
  };
});
console.table(rows);
const missingCount = new Map<string, number>();
for (const r of results) for (const id of r.missing) missingCount.set(id, (missingCount.get(id) ?? 0) + 1);
if (missingCount.size > 0) {
  const top = [...missingCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(
    `Espèces les plus souvent manquantes en fin de simulation : ${top.map(([id, n]) => `${id} (${Math.round((n / RUNS) * 100)} %)`).join(', ')}`,
  );
}
const avgCatches = results.reduce((s, r) => s + r.catches, 0) / RUNS;
console.log(
  `Prises moyennes par carrière : ${Math.round(avgCatches)} · durée de calcul : ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
