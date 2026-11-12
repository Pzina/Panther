import { Game } from '../src/core/game';
import { createNewState } from '../src/core/state';

export function newGame(seed = 1234): Game {
  const state = createNewState(seed, 1_700_000_000_000);
  state.flags.tutorialDone = true;
  return new Game(state);
}

/** Lands a fish of the given species through the public API. */
export function land(game: Game, speciesId: string, depth = 0.3): ReturnType<Game['completeCatch']> {
  const plan = game.planBite(depth, false, { force: speciesId });
  game.startFight(plan);
  return game.completeCatch(plan.fish);
}
