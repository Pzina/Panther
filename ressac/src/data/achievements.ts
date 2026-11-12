import type { GameState } from '../core/state';
import { collectionCount, collectionPercent, collectionTotal, variantsFound } from '../systems/progression';
import { getBoat } from './equipment';
import { SPECIES } from './species';
import { ZONES } from './zones';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  target: number;
  value: (state: GameState) => number;
}

function a(
  id: string,
  name: string,
  description: string,
  icon: string,
  target: number,
  value: (state: GameState) => number,
): Achievement {
  return { id, name, description, icon, target, value };
}

/* prettier-ignore */
export const ACHIEVEMENTS: Achievement[] = [
  a('first-fish', 'Ça mord !', 'Attrapez votre premier poisson.', 'fish', 1, (s) => s.stats.catches),
  a('catch-50', 'Bonne pêche', 'Attrapez 50 poissons.', 'fish', 50, (s) => s.stats.catches),
  a('catch-250', 'Pêcheur aguerri', 'Attrapez 250 poissons.', 'fish', 250, (s) => s.stats.catches),
  a('catch-1000', 'Mille et une prises', 'Attrapez 1 000 poissons.', 'fish', 1000, (s) => s.stats.catches),
  a('perfect-1', 'Dans le mille', 'Réussissez un lancer parfait.', 'target', 1, (s) => s.stats.perfectCasts),
  a('perfect-50', 'Poignet d’or', 'Réussissez 50 lancers parfaits.', 'target', 50, (s) => s.stats.perfectCasts),
  a('rare-1', 'Belle prise', 'Attrapez un poisson Rare.', 'star', 1, (s) => s.stats.rareCatches),
  a('epic-1', 'Pièce de choix', 'Attrapez un poisson Épique.', 'star', 1, (s) => s.stats.epicCatches),
  a('legend-1', 'Une légende au bout du fil', 'Attrapez un poisson Légendaire.', 'crown', 1, (s) => s.stats.legendaryCatches),
  a('mythic-1', 'Personne ne vous croira', 'Attrapez un poisson Mythique.', 'crown', 1, (s) => s.stats.mythicCatches),
  a('mythic-6', 'Bestiaire impossible', 'Attrapez les 6 poissons Mythiques.', 'crown', 6, (s) => SPECIES.filter((x) => x.rarity === 'mythic' && s.dex[x.id]).length),
  a('variant-1', 'Drôle de couleur', 'Attrapez un poisson à variante.', 'sparkle', 1, (s) => s.stats.variantCatches),
  a('variant-20', 'Cabinet de curiosités', 'Répertoriez 20 variantes différentes.', 'sparkle', 20, (s) => variantsFound(s)),
  a('dex-10', 'Naturaliste en herbe', 'Répertoriez 10 espèces.', 'book', 10, (s) => collectionCount(s)),
  a('dex-30', 'Ichtyologue', 'Répertoriez 30 espèces.', 'book', 30, (s) => collectionCount(s)),
  a('dex-all', 'Le carnet est plein', 'Répertoriez toutes les espèces.', 'book', collectionTotal(), (s) => collectionCount(s)),
  a('zone-complete', 'Fin connaisseur', "Complétez la collection d'une zone.", 'map', 1, (s) => ZONES.filter((z) => collectionPercent(s, z.id) >= 100).length),
  a('zones-all', 'Tour de l’archipel', 'Débloquez les 6 zones.', 'map', 6, (s) => s.unlockedZones.length),
  a('night-25', 'Oiseau de nuit', 'Attrapez 25 poissons la nuit.', 'moon', 25, (s) => s.stats.nightCatches),
  a('dawn-25', 'À la fraîche', "Attrapez 25 poissons à l'aube.", 'sun', 25, (s) => s.stats.dawnCatches),
  a('rain-25', 'Trempé jusqu’aux os', 'Attrapez 25 poissons sous la pluie.', 'rain', 25, (s) => s.stats.rainCatches),
  a('storm-10', 'Même pas peur', "Attrapez 10 poissons pendant l'orage.", 'storm', 10, (s) => s.stats.stormCatches),
  a('glow-1', 'La mer qui brille', 'Attrapez un poisson pendant une marée luisante.', 'sparkle', 1, (s) => s.stats.glowCatches),
  a('big-100', 'Plus grand que le bras', "Attrapez un poisson d'au moins 100 cm.", 'ruler', 100, (s) => Math.floor(s.stats.biggestCm)),
  a('big-300', 'Plus grand que la barque', "Attrapez un poisson d'au moins 300 cm.", 'ruler', 300, (s) => Math.floor(s.stats.biggestCm)),
  a('heavy-50', 'Poids lourd', "Attrapez un poisson d'au moins 50 kg.", 'weight', 50, (s) => Math.floor(s.stats.heaviestKg)),
  a('coins-1k', 'Premières économies', 'Gagnez 1 000 pièces en vendant du poisson.', 'coin', 1000, (s) => s.stats.coinsEarned),
  a('coins-50k', 'Fortune de mer', 'Gagnez 50 000 pièces en vendant du poisson.', 'coin', 50000, (s) => s.stats.coinsEarned),
  a('sale-500', 'La vente du siècle', 'Vendez un poisson 500 pièces ou plus.', 'coin', 500, (s) => s.stats.bestSale),
  a('release-25', 'Ami des poissons', 'Relâchez 25 poissons.', 'heart', 25, (s) => s.stats.released),
  a('streak-15', 'Fil d’acier', 'Attrapez 15 poissons de suite sans casser ni décrocher.', 'hook', 15, (s) => s.stats.bestStreakNoBreak),
  a('craft-5', 'Recettes de Jo', 'Fabriquez 5 lots d’appâts.', 'bait', 5, (s) => s.stats.crafted),
  a('boat-4', 'Capitaine', 'Achetez La Corvec.', 'boat', 4, (s) => getBoat(s.equipment.boat).tier),
  a('level-10', 'Du métier', 'Atteignez le niveau 10.', 'trophy', 10, (s) => s.level),
  a('level-25', 'Maître pêcheur', 'Atteignez le niveau 25.', 'trophy', 25, (s) => s.level),
  a('aquarium-6', 'Aquarium complet', 'Installez 6 poissons dans l’aquarium de la cabane.', 'home', 6, (s) => s.aquarium.length),
  a('daily-10', 'Régulier', 'Terminez 10 missions quotidiennes.', 'calendar', 10, (s) => s.stats.dailiesDone),
  a('journal-10', 'Dernière page', 'Débloquez les 10 pages du carnet de Maëlle.', 'book', 10, (s) => Math.min(10, Math.floor((collectionPercent(s) + 1e-9) / 10))),
  a('ending', 'La Veilleuse', "Terminez l'histoire de Ressac.", 'crown', 1, (s) => (s.story.finished ? 1 : 0)),
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((x) => x.id === id);
}
