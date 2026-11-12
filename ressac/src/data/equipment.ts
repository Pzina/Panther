import type { Bait, Boat, Cosmetic, CosmeticSlot, Hook, Item, ItemCategory, Line, Reel, Rod } from './types';

export const RODS: Rod[] = [
  { id: 'rod-heritage', category: 'rod', name: "Canne de l'héritage", description: 'Vieille, tordue, fidèle. Elle était dans la barque.', price: 0, reach: 0.42, luck: 0, control: 0 },
  { id: 'rod-noisetier', category: 'rod', name: 'Canne en noisetier', description: 'Taillée par Jo un soir de pluie. Lance un peu plus loin.', price: 90, reach: 0.55, luck: 0.02, control: 0.01 },
  { id: 'rod-bambou', category: 'rod', name: 'Canne en bambou', description: 'Souple et légère, elle pardonne les à-coups.', price: 380, level: 3, reach: 0.66, luck: 0.05, control: 0.02 },
  { id: 'rod-verre', category: 'rod', name: 'Canne en fibre de verre', description: 'Le premier vrai outil de pêcheur.', price: 1300, level: 6, reach: 0.76, luck: 0.08, control: 0.03 },
  { id: 'rod-corvec', category: 'rod', name: 'Canne Corvec', description: 'Le modèle que Maëlle avait dessiné pour ses relevés.', price: 4200, level: 9, reputation: 30, reach: 0.85, luck: 0.12, control: 0.04 },
  { id: 'rod-coraux', category: 'rod', name: 'Canne des coraux', description: 'Scion fin, précis jusque dans les massifs du récif.', price: 12000, level: 13, reach: 0.91, luck: 0.18, control: 0.05 },
  { id: 'rod-hauturiere', category: 'rod', name: 'Canne hauturière', description: 'Faite pour les poissons qui tirent la barque.', price: 30000, level: 17, reach: 0.96, luck: 0.24, control: 0.06 },
  { id: 'rod-abysses', category: 'rod', name: 'Canne des Abysses', description: "Assez de fil pour toucher ce que personne n'a vu.", price: 75000, level: 21, reputation: 120, reach: 1, luck: 0.32, control: 0.08 },
];

export const REELS: Reel[] = [
  { id: 'reel-bois', category: 'reel', name: 'Moulinet en bois', description: 'Il grince, mais il tourne.', price: 0, speed: 1, smooth: 0 },
  { id: 'reel-laiton', category: 'reel', name: 'Moulinet en laiton', description: 'Un peu plus vif, un peu plus doux.', price: 150, speed: 1.1, smooth: 0.05 },
  { id: 'reel-acier', category: 'reel', name: 'Moulinet en acier', description: 'Robuste. Ne craint pas le sel.', price: 700, level: 4, speed: 1.2, smooth: 0.1 },
  { id: 'reel-roulements', category: 'reel', name: 'Moulinet à roulements', description: 'Tourne comme une horloge bien remontée.', price: 2600, level: 8, speed: 1.32, smooth: 0.15 },
  { id: 'reel-large', category: 'reel', name: 'Moulinet du large', description: 'Grande bobine, gros frein, longs combats.', price: 9000, level: 13, speed: 1.45, smooth: 0.2 },
  { id: 'reel-corvec', category: 'reel', name: 'Moulinet Corvec n°7', description: 'Le septième prototype de Maëlle. Le seul qui marche.', price: 34000, level: 19, reputation: 100, speed: 1.6, smooth: 0.28 },
];

export const LINES: Line[] = [
  { id: 'line-chanvre', category: 'line', name: 'Fil de chanvre', description: 'Rêche et honnête.', price: 0, strength: 1 },
  { id: 'line-lin', category: 'line', name: 'Fil de lin ciré', description: 'La cire le protège des frottements.', price: 110, strength: 1.2 },
  { id: 'line-nylon', category: 'line', name: 'Nylon tressé', description: 'Encaisse les coups de tête.', price: 600, level: 4, strength: 1.45 },
  { id: 'line-tresse', category: 'line', name: 'Tresse marine', description: 'Huit brins serrés. Pour le gros.', price: 3200, level: 9, strength: 1.75 },
  { id: 'line-abysse', category: 'line', name: "Fil d'abysse", description: 'Ne casse presque jamais. Presque.', price: 16000, level: 16, strength: 2.1 },
];

export const HOOKS: Hook[] = [
  { id: 'hook-rouille', category: 'hook', name: 'Hameçon rouillé', description: 'Il a connu des jours meilleurs.', price: 0, window: 0, hold: 1 },
  { id: 'hook-simple', category: 'hook', name: 'Hameçon simple', description: 'Propre et bien affûté.', price: 80, window: 0.05, hold: 1.15 },
  { id: 'hook-forge', category: 'hook', name: 'Hameçon forgé', description: 'Battu à la main à la forge du port.', price: 500, level: 4, window: 0.1, hold: 1.35 },
  { id: 'hook-triple', category: 'hook', name: 'Hameçon triple', description: "Trois pointes : le poisson s'accroche tout seul.", price: 2800, level: 9, window: 0.15, hold: 1.6 },
  { id: 'hook-argent', category: 'hook', name: "Hameçon d'argent", description: 'Brille juste assez pour intriguer.', price: 14000, level: 15, window: 0.2, hold: 1.9 },
];

export const BAITS: Bait[] = [
  { id: 'mie', category: 'bait', name: 'Mie de pain', description: 'Toujours dans la poche. Ne manque jamais.', price: 0, pack: 0, speed: 1, luck: 0, infinite: true },
  { id: 'ver', category: 'bait', name: 'Ver de vase', description: 'Le classique. Presque tout le monde en veut.', price: 15, pack: 10, speed: 0.88, luck: 0.03 },
  { id: 'mais', category: 'bait', name: 'Maïs doux', description: "Les poissons d'étang en raffolent.", price: 20, pack: 10, level: 2, speed: 0.9, luck: 0.03 },
  { id: 'crevette', category: 'bait', name: 'Crevette', description: 'Un régal pour les poissons de mer.', price: 60, pack: 8, level: 3, speed: 0.85, luck: 0.08 },
  { id: 'mouche', category: 'bait', name: 'Mouche artificielle', description: 'Plumes et fil rouge, montée par Hervé.', price: 45, pack: 8, level: 4, speed: 0.85, luck: 0.06 },
  { id: 'cuiller', category: 'bait', name: 'Cuiller ondulante', description: 'Scintille comme un petit poisson blessé.', price: 120, pack: 6, level: 6, speed: 0.9, luck: 0.12 },
  { id: 'calmar', category: 'bait', name: 'Lanière de calmar', description: 'Pour ce qui est gros, ou profond.', price: 260, pack: 6, level: 11, speed: 0.88, luck: 0.16 },
  { id: 'patee', category: 'bait', name: "Pâtée de l'Anse", description: 'Trois petits poissons pilés. Les touches arrivent vite.', price: 0, pack: 6, speed: 0.7, luck: 0.04, craft: { count: 3, rarity: 'common' } },
  { id: 'strouille', category: 'bait', name: 'Strouille', description: 'Une recette de Jo. Attire les belles pièces.', price: 0, pack: 5, speed: 0.85, luck: 0.2, craft: { count: 2, rarity: 'uncommon' } },
  { id: 'lumignon', category: 'bait', name: 'Lumignon', description: 'Un appât qui luit doucement. Idéal la nuit et dans la Fosse.', price: 0, pack: 4, speed: 0.8, luck: 0.28, craft: { count: 1, rarity: 'rare' } },
  { id: 'leurre', category: 'bait', name: 'Leurre de Maëlle', description: "Un leurre de verre et de lumière. Lancé loin dans la Fosse, il appelle la Veilleuse.", price: 0, pack: 2, speed: 1, luck: 0, craft: { count: 1, rarity: 'epic' }, special: true, mission: 's17' },
];

export const BOATS: Boat[] = [
  { id: 'boat-1', category: 'boat', name: 'La Vieille Barque', description: "Elle prend un peu l'eau. Elle a du caractère.", price: 0, tier: 1, creel: 12, travel: 1 },
  { id: 'boat-2', category: 'boat', name: 'Le Canot ponté', description: 'Tient la mer jusqu’au récif. Vivier plus grand.', price: 2400, tier: 2, creel: 20, travel: 0.8, mission: 's09' },
  { id: 'boat-3', category: 'boat', name: 'Le Cotre', description: 'Une vraie voile, une vraie quille : le large est à vous.', price: 15000, tier: 3, creel: 32, travel: 0.6, mission: 's12' },
  { id: 'boat-4', category: 'boat', name: 'La Corvec', description: "Le bateau d'exploration de Maëlle, remis à flot. Seul capable d'atteindre la Fosse.", price: 48000, tier: 4, creel: 48, travel: 0.45, mission: 's15' },
];

function cos(id: string, slot: CosmeticSlot, name: string, description: string, price: number, color: number, color2: number, style = 'plain', reputation?: number): Cosmetic {
  return { id, category: 'cosmetic', slot, name, description, price, color, color2, style, reputation };
}

export const COSMETICS: Cosmetic[] = [
  cos('hull-rouge', 'boatColor', 'Coque rouge sardine', "La couleur d'origine, un peu passée.", 0, 0xc94a3a, 0xf0e0c0),
  cos('hull-bleu', 'boatColor', 'Coque bleu de mer', 'Pour se fondre dans le paysage.', 150, 0x2f6f9f, 0xf0f0e8),
  cos('hull-vert', 'boatColor', 'Coque vert bouteille', 'Élégante et discrète.', 150, 0x2f7a5a, 0xe8e0b0),
  cos('hull-jaune', 'boatColor', 'Coque jaune citron', 'On vous voit venir de loin.', 300, 0xe8b830, 0x3a5a7a),
  cos('hull-blanc', 'boatColor', 'Coque blanche', 'Comme les yachts, en plus modeste.', 600, 0xf0ede4, 0x2f6f9f),
  cos('hull-noir', 'boatColor', 'Coque goudron', 'Noire comme une nuit sans lune.', 1200, 0x2a2a34, 0xd9a441, 'plain', 40),
  cos('bob-classique', 'bobber', 'Bouchon classique', 'Rouge et blanc. Indémodable.', 0, 0xe04a3a, 0xffffff),
  cos('bob-raye', 'bobber', 'Bouchon rayé', 'Jaune et noir, visible par tous les temps.', 120, 0xf0c82b, 0x2a2a34, 'striped'),
  cos('bob-etoile', 'bobber', 'Bouchon étoile', "Une étoile de mer qui flotte.", 400, 0xf08a4a, 0xf0e08a, 'star'),
  cos('bob-phare', 'bobber', 'Bouchon phare', 'Un petit phare en liège.', 900, 0xffffff, 0xe04a3a, 'lighthouse', 30),
  cos('bob-lune', 'bobber', 'Bouchon lune', 'Un croissant pâle sur l’eau.', 2000, 0xe8eef5, 0xa9c4e8, 'moon'),
  cos('bob-luciole', 'bobber', 'Bouchon luciole', 'Il brille tout seul dans le noir.', 5000, 0x6af0e0, 0xe8f08a, 'glow', 80),
  cos('out-cire', 'outfit', 'Ciré jaune', 'Le ciré trouvé dans la cabane.', 0, 0xf0c02b, 0x3a5a7a),
  cos('out-mariniere', 'outfit', 'Marinière', 'Rayures réglementaires.', 200, 0xf0f0e8, 0x2f4f7f, 'striped'),
  cos('out-vareuse', 'outfit', 'Vareuse bleue', 'Toile épaisse, poches profondes.', 500, 0x3a5a8a, 0xd9c9a8),
  cos('out-bonnet', 'outfit', 'Pull et bonnet rouge', 'Tricotés par Jo. Ça gratte un peu.', 800, 0x8a9a9a, 0xd9402b, 'beanie'),
  cos('out-tempete', 'outfit', 'Ciré de tempête', 'Vert sombre, capuche serrée.', 2500, 0x2f5a4a, 0xf0c02b, 'hood', 50),
  cos('out-maelle', 'outfit', "Tenue d'exploratrice", 'La veste à carreaux de Maëlle, retrouvée dans une malle.', 8000, 0xb5553c, 0xe8dcb0, 'plaid', 100),
];

export const ITEMS: Item[] = [...RODS, ...REELS, ...LINES, ...HOOKS, ...BAITS, ...BOATS, ...COSMETICS];

const itemIndex = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): Item {
  const item = itemIndex.get(id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}
export function hasItem(id: string): boolean {
  return itemIndex.has(id);
}
export function itemsOf(category: ItemCategory): Item[] {
  return ITEMS.filter((i) => i.category === category);
}
export function getRod(id: string): Rod {
  return getItem(id) as Rod;
}
export function getReel(id: string): Reel {
  return getItem(id) as Reel;
}
export function getLine(id: string): Line {
  return getItem(id) as Line;
}
export function getHook(id: string): Hook {
  return getItem(id) as Hook;
}
export function getBait(id: string): Bait {
  return getItem(id) as Bait;
}
export function getBoat(id: string): Boat {
  return getItem(id) as Boat;
}
export function getCosmetic(id: string): Cosmetic {
  return getItem(id) as Cosmetic;
}
export function boatOfTier(tier: number): Boat {
  const boat = BOATS.find((b) => b.tier === tier);
  if (!boat) throw new Error(`Unknown boat tier ${tier}`);
  return boat;
}

export const DEFAULT_EQUIPMENT = {
  rod: 'rod-heritage',
  reel: 'reel-bois',
  line: 'line-chanvre',
  hook: 'hook-rouille',
  bait: 'mie',
  boat: 'boat-1',
};
export const DEFAULT_COSMETICS: Record<CosmeticSlot, string> = {
  boatColor: 'hull-rouge',
  bobber: 'bob-classique',
  outfit: 'out-cire',
};
