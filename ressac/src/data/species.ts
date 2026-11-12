import { BALANCE } from '../config/balance';
import { getZone } from './zones';
import type {
  Behavior,
  BodyShape,
  DayPhase,
  DorsalShape,
  FishArt,
  FishExtra,
  PatternKind,
  Rarity,
  Season,
  Species,
  TailShape,
  Weather,
  ZoneId,
} from './types';

const ALL_PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];
const ALL_WEATHERS: Weather[] = ['sun', 'clouds', 'rain', 'storm', 'fog', 'glow'];
const ALL_SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

function art(
  body: BodyShape,
  len: number,
  tail: TailShape,
  dorsal: DorsalShape,
  pattern: PatternKind,
  c1: string,
  c2: string,
  c3: string,
  eye: number,
  extra?: FishExtra,
): FishArt {
  return { body, len, tail, dorsal, pattern, c1, c2, c3, eye, extra };
}

interface Opts {
  phases?: DayPhase[];
  weathers?: Weather[];
  seasons?: Season[];
  baits?: string[];
  requires?: Species['requires'];
  /** Multiplier on the computed base value. */
  value?: number;
}

function sp(
  id: string,
  name: string,
  rarity: Rarity,
  zones: ZoneId | ZoneId[],
  depth: [number, number],
  behavior: Behavior,
  size: [number, number],
  weight: [number, number],
  a: FishArt,
  flavor: string,
  o: Opts = {},
): Species {
  const zoneList = Array.isArray(zones) ? zones : [zones];
  const zoneMult = Math.min(...zoneList.map((z) => getZone(z).valueMult));
  const baseValue = Math.max(
    2,
    Math.round(BALANCE.baseFishValue * zoneMult * BALANCE.rarity[rarity].value * (o.value ?? 1)),
  );
  return {
    id,
    name,
    rarity,
    zones: zoneList,
    depth,
    phases: o.phases ?? ALL_PHASES,
    weathers: o.weathers ?? ALL_WEATHERS,
    seasons: o.seasons ?? ALL_SEASONS,
    baits: o.baits ?? [],
    size,
    weight,
    baseValue,
    behavior,
    requires: o.requires,
    art: a,
    flavor,
  };
}

/* prettier-ignore */
export const SPECIES: Species[] = [
  // ───────────────────────── L'Anse aux Galets ─────────────────────────
  sp('gobie', 'Gobie des galets', 'common', 'anse', [0, 0.5], 'calm', [6, 14], [0.01, 0.06],
    art('fusiform', 3.2, 'round', 'low', 'spots', '#b8a68a', '#7d6b52', '#d9c9a8', 1.25),
    'Il se confond si bien avec le fond que Maëlle marchait dessus sans le voir.', { baits: ['mie', 'ver'] }),
  sp('eperlan', 'Éperlan', 'common', 'anse', [0, 0.62], 'calm', [10, 20], [0.02, 0.09],
    art('fusiform', 4.2, 'fork', 'low', 'belly', '#9fc4c9', '#eef6f4', '#c6dcdc', 1.0),
    'Sent le concombre frais. Personne ne sait pourquoi, et lui non plus.', { baits: ['mie', 'patee'] }),
  sp('anchois', 'Anchois argenté', 'common', 'anse', [0.15, 0.85], 'nervous', [8, 16], [0.01, 0.05],
    art('torpedo', 4.6, 'fork', 'low', 'bands', '#5d8fb0', '#e6eef2', '#8fb3c9', 1.15),
    "Voyage en bancs serrés : là où il y en a un, il y en a mille.", { baits: ['patee', 'ver'], phases: ['dawn', 'day', 'dusk'] }),
  sp('mulet', 'Mulet doré', 'uncommon', 'anse', [0.2, 0.85], 'nervous', [25, 55], [0.3, 1.8],
    art('fusiform', 3.6, 'fork', 'spiny', 'scales', '#a9b4b8', '#d9a441', '#8a979c', 0.9),
    "Rôde près du quai en attendant qu'on y jette du pain.", { baits: ['mie', 'patee'], phases: ['day', 'dusk'] }),
  sp('vieille', 'Vieille commune', 'uncommon', 'anse', [0.3, 0.95], 'calm', [20, 45], [0.3, 1.6],
    art('deep', 2.3, 'round', 'long', 'marble', '#b5553c', '#e0a458', '#7f3b2a', 1.0),
    "Change de couleur avec l'âge, comme les volets du port.", { baits: ['crevette', 'ver'], phases: ['dawn', 'day'] }),
  sp('bar', 'Bar moucheté', 'rare', 'anse', [0.45, 1], 'nervous', [35, 90], [0.6, 7],
    art('fusiform', 3.4, 'fork', 'spiny', 'spots', '#8d9aa5', '#3f4a54', '#6c7a86', 1.0),
    "Chasse dans l'écume quand la mer se fâche un peu.", { baits: ['crevette', 'cuiller'], phases: ['dawn', 'dusk'], weathers: ['clouds', 'rain', 'storm'] }),
  sp('sole', 'Sole des sables', 'rare', 'anse', [0.5, 1], 'diver', [22, 50], [0.2, 1.5],
    art('flat', 2.0, 'round', 'long', 'spots', '#c2a878', '#8a6f47', '#a88e60', 0.7),
    'Plate comme une lettre oubliée sous une porte.', { baits: ['ver'], phases: ['dusk', 'night'] }),
  sp('congre', 'Congre des roches', 'epic', 'anse', [0.6, 1], 'diver', [80, 200], [4, 40],
    art('eel', 6, 'point', 'long', 'belly', '#4d5560', '#9aa3ad', '#3a414a', 0.8),
    "Habite les failles du brise-lames. Ne sort que lorsque le port s'endort.", { baits: ['calmar', 'crevette'], phases: ['night'] }),
  sp('dorade', 'Dorade Couronnée', 'legendary', 'anse', [0.62, 1], 'cunning', [30, 70], [0.8, 6],
    art('deep', 2.1, 'fork', 'spiny', 'bands', '#c9ced6', '#f0c040', '#7f8a99', 1.0, 'crest'),
    "Une bande d'or entre les yeux. Jo jure qu'elle en a vu une saluer.", { baits: ['crevette', 'strouille'], phases: ['dawn'], seasons: ['spring', 'summer'] }),
  sp('galet-vivant', 'Galet-Vivant', 'mythic', 'anse', [0.3, 1], 'cunning', [18, 40], [1, 6],
    art('puffer', 1.4, 'round', 'none', 'marble', '#8f8a80', '#c9c4b8', '#6f6a60', 1.3),
    "« J'ai ramassé un galet. Il m'a regardée. » — carnet de Maëlle", { baits: ['strouille', 'lumignon'], requires: { weather: ['fog'] } }),

  // ───────────────────────── L'Étang des Saules ─────────────────────────
  sp('gardon', 'Gardon', 'common', 'etang', [0, 0.6], 'calm', [10, 30], [0.03, 0.5],
    art('fusiform', 3.0, 'fork', 'low', 'belly', '#a8b5b0', '#f0ede0', '#d9603b', 1.1),
    "L'œil rouge et la curiosité facile.", { baits: ['mie', 'mais'] }),
  sp('ablette', 'Ablette', 'common', 'etang', [0, 0.7], 'nervous', [8, 18], [0.01, 0.06],
    art('torpedo', 4.5, 'fork', 'low', 'plain', '#c7d6d9', '#eef4f4', '#aebfc4', 1.2),
    'Un éclat de miroir qui gobe les moucherons en surface.', { baits: ['mie', 'ver'], phases: ['day', 'dusk'] }),
  sp('perche-soleil', 'Perche soleil', 'common', 'etang', [0.1, 0.8], 'calm', [8, 20], [0.03, 0.25],
    art('round', 1.7, 'round', 'spiny', 'spots', '#d98f2b', '#3e8f8a', '#e3b34a', 1.1),
    'Petite, ronde, et beaucoup trop sûre d’elle.', { baits: ['ver', 'mais'], phases: ['day'], weathers: ['sun', 'clouds'] }),
  sp('tanche', 'Tanche', 'uncommon', 'etang', [0.25, 0.9], 'calm', [20, 55], [0.3, 3.5],
    art('deep', 2.5, 'round', 'low', 'plain', '#5d7040', '#8a9a5b', '#46562f', 0.7),
    'On la dit médecin des autres poissons. Elle ne dément pas.', { baits: ['mais', 'ver'], phases: ['dawn', 'dusk'] }),
  sp('carpe', 'Carpe miroir', 'uncommon', 'etang', [0.3, 1], 'diver', [35, 90], [1.5, 18],
    art('deep', 2.4, 'fork', 'long', 'scales', '#a67c3d', '#e0c07a', '#7d5a28', 0.8, 'whiskers'),
    'Quelques grandes écailles, comme des pièces oubliées.', { baits: ['mais', 'patee'], weathers: ['sun', 'clouds', 'fog'] }),
  sp('perche', 'Perche rayée', 'rare', 'etang', [0.35, 1], 'nervous', [18, 50], [0.2, 2.8],
    art('fusiform', 2.8, 'fork', 'spiny', 'stripes', '#7f9a4a', '#2f3d1f', '#d9532b', 1.0),
    'Zébrée pour disparaître entre les roseaux, nageoires en feu.', { baits: ['ver', 'cuiller'], phases: ['dawn', 'day'] }),
  sp('brochet', 'Brochet', 'rare', 'etang', [0.45, 1], 'jumper', [45, 120], [1, 16],
    art('torpedo', 4.8, 'fork', 'low', 'spots', '#6d8a4f', '#cfd9a0', '#b5673a', 0.9, 'teeth'),
    "Immobile des heures, puis plus du tout.", { baits: ['cuiller'], phases: ['dawn', 'dusk'], seasons: ['autumn', 'winter', 'spring'] }),
  sp('anguille', 'Anguille', 'epic', 'etang', [0.5, 1], 'cunning', [50, 130], [0.5, 6],
    art('eel', 6, 'point', 'long', 'belly', '#4a5a3a', '#d9d28a', '#3a472d', 0.8),
    "Née très loin d'ici, elle connaît tous les fossés de l'archipel.", { baits: ['ver', 'strouille'], phases: ['night'], weathers: ['rain', 'storm', 'fog', 'clouds'] }),
  sp('silure', 'Silure', 'legendary', 'etang', [0.6, 1], 'diver', [100, 260], [10, 110],
    art('eel', 4.2, 'round', 'none', 'marble', '#3d4a4a', '#7d8a80', '#2d3838', 0.6, 'whiskers'),
    "Les canards ne vont plus de ce côté de l'étang.", { baits: ['strouille', 'patee'], phases: ['night', 'dusk'], seasons: ['summer', 'autumn'] }),
  sp('carpe-lune', 'Carpe-Lune', 'mythic', 'etang', [0.4, 1], 'calm', [70, 130], [12, 45],
    art('deep', 2.2, 'fan', 'sail', 'glow', '#e8eef5', '#a9c4e8', '#cfdcf0', 1.2, 'whiskers'),
    "Ne monte que par nuit claire, pour regarder son reflet dans le ciel.", { baits: ['lumignon', 'mais'], requires: { phase: ['night'], weather: ['sun', 'clouds', 'glow'] } }),

  // ───────────────────────── La Rivière Torse ─────────────────────────
  sp('vairon', 'Vairon', 'common', 'riviere', [0, 0.6], 'nervous', [5, 12], [0.005, 0.03],
    art('fusiform', 3.6, 'fork', 'low', 'bands', '#8a9a70', '#d9402b', '#b5c49a', 1.2),
    'Minuscule et pressé, il remonte le courant par principe.', { baits: ['mie', 'ver'] }),
  sp('goujon', 'Goujon', 'common', 'riviere', [0, 0.7], 'calm', [8, 18], [0.01, 0.1],
    art('fusiform', 3.8, 'fork', 'low', 'spots', '#b5a57a', '#6d5f3d', '#cfc29a', 1.0, 'whiskers'),
    'Fouille le gravier avec ses deux petits barbillons.', { baits: ['ver'] }),
  sp('chevesne', 'Chevesne', 'common', 'riviere', [0.1, 0.85], 'calm', [20, 55], [0.15, 3],
    art('fusiform', 3.3, 'fork', 'low', 'scales', '#9aa58a', '#e8e4d0', '#d9703b', 0.9),
    "Mange de tout, y compris les cerises tombées de la berge.", { baits: ['mie', 'mouche'], phases: ['day', 'dusk'] }),
  sp('truite', 'Truite fario', 'uncommon', 'riviere', [0.2, 0.9], 'jumper', [20, 60], [0.15, 3.5],
    art('fusiform', 3.4, 'fork', 'low', 'spots', '#a68a4f', '#c93a2b', '#8a6f3a', 1.0),
    "Des points rouges cerclés de clair : la signature de l'eau vive.", { baits: ['mouche', 'ver'], phases: ['dawn', 'dusk'], seasons: ['spring', 'summer'] }),
  sp('barbeau', 'Barbeau', 'uncommon', 'riviere', [0.3, 1], 'diver', [30, 80], [0.5, 6],
    art('fusiform', 3.9, 'fork', 'spiny', 'belly', '#9a8a5a', '#e8dcb0', '#c97a3a', 0.8, 'whiskers'),
    'Se plaque au fond et laisse la rivière se battre à sa place.', { baits: ['ver', 'patee'] }),
  sp('ombre', 'Ombre commun', 'rare', 'riviere', [0.35, 1], 'nervous', [25, 50], [0.2, 1.6],
    art('fusiform', 3.3, 'fork', 'sail', 'scales', '#8a95a5', '#b56a9a', '#6a5a8a', 1.0),
    "Sa dorsale se déploie comme un étendard. Sent le thym, dit-on.", { baits: ['mouche'], phases: ['day', 'dusk'], seasons: ['autumn', 'winter'] }),
  sp('saumon', 'Saumon atlantique', 'rare', 'riviere', [0.45, 1], 'jumper', [50, 120], [2, 20],
    art('torpedo', 3.8, 'fork', 'low', 'spots', '#b5bcc4', '#d9705a', '#8a95a0', 0.9),
    'Revient de la mer pour retrouver exactement le caillou de son enfance.', { baits: ['mouche', 'cuiller'], seasons: ['autumn', 'spring'], weathers: ['rain', 'clouds', 'storm'] }),
  sp('esturgeon', 'Esturgeon', 'epic', 'riviere', [0.55, 1], 'diver', [90, 220], [8, 90],
    art('torpedo', 5.2, 'lunate', 'spiny', 'bands', '#5a6068', '#b5a57a', '#454a52', 0.6, 'whiskers'),
    'Un fossile qui a simplement refusé de se laisser faire.', { baits: ['ver', 'crevette'], phases: ['night', 'dawn'] }),
  sp('omble', 'Omble chevalier', 'legendary', 'riviere', [0.6, 1], 'cunning', [35, 80], [0.6, 7],
    art('fusiform', 3.5, 'fork', 'low', 'belly', '#3d6a7a', '#e8502b', '#f0e8d0', 1.0),
    "Ventre de braise, dos de glacier. Il n'aime que l'eau la plus froide.", { baits: ['mouche', 'strouille'], phases: ['dawn'], seasons: ['winter', 'autumn'] }),
  sp('torsade', 'La Torsade', 'mythic', 'riviere', [0.5, 1], 'cunning', [120, 240], [6, 30],
    art('eel', 6, 'fan', 'sail', 'stripes', '#2b8a8a', '#e8d03a', '#d9402b', 1.1, 'horn'),
    "La rivière ne serpente pas par hasard : elle suit quelqu'un.", { baits: ['lumignon', 'strouille'], requires: { weather: ['rain', 'storm'] } }),

  // ───────────────────────── Le Récif Corail ─────────────────────────
  sp('demoiselle', 'Demoiselle bleue', 'common', 'recif', [0, 0.6], 'nervous', [5, 12], [0.01, 0.05],
    art('round', 1.6, 'fork', 'low', 'plain', '#2b7ad9', '#5ab0f0', '#f0d03a', 1.3),
    "Un confetti bleu électrique qui défend son corail comme un château.", { baits: ['mie', 'crevette'] }),
  sp('girelle', 'Girelle paon', 'common', 'recif', [0, 0.7], 'calm', [10, 25], [0.03, 0.2],
    art('fusiform', 3.8, 'round', 'long', 'bands', '#3aa58a', '#e8602b', '#3a6ad9', 1.0),
    "S'enfouit dans le sable pour dormir, et parfois pour bouder.", { baits: ['ver', 'crevette'], phases: ['day'] }),
  sp('sergent', 'Sergent-major', 'common', 'recif', [0.1, 0.85], 'calm', [10, 20], [0.05, 0.25],
    art('round', 1.7, 'fork', 'spiny', 'stripes', '#e8e04a', '#2b2b3a', '#c9c9d0', 1.1),
    'Cinq galons noirs sur fond jaune. Toujours de service.', { baits: ['mie', 'patee'] }),
  sp('papillon', 'Poisson-papillon', 'uncommon', 'recif', [0.2, 0.9], 'nervous', [10, 22], [0.05, 0.3],
    art('round', 1.3, 'round', 'tall', 'stripes', '#f0c82b', '#2b2b2b', '#f0f0e8', 1.0),
    'Nage toujours à deux. Maëlle trouvait cela très bien élevé.', { baits: ['crevette'], phases: ['day', 'dawn'], weathers: ['sun', 'clouds'] }),
  sp('perroquet', 'Poisson-perroquet', 'uncommon', 'recif', [0.3, 1], 'calm', [30, 70], [0.6, 6],
    art('deep', 2.3, 'lunate', 'long', 'scales', '#2bb5a5', '#e85a8a', '#f0a02b', 0.9),
    'Croque le corail et le rend en sable blanc. La plage, c’est lui.', { baits: ['crevette', 'patee'], phases: ['day'] }),
  sp('baliste', 'Baliste', 'rare', 'recif', [0.35, 1], 'nervous', [25, 60], [0.5, 4.5],
    art('deep', 1.9, 'fan', 'tall', 'marble', '#3a5a8a', '#f0b02b', '#2b8ad9', 0.8),
    'Un caractère de portail rouillé et des dents pour le prouver.', { baits: ['crevette', 'cuiller'], seasons: ['summer', 'spring'] }),
  sp('rascasse', 'Rascasse volante', 'rare', 'recif', [0.45, 1], 'cunning', [20, 40], [0.3, 1.4],
    art('deep', 2.0, 'fan', 'spiny', 'stripes', '#c9502b', '#f0e8d0', '#8a2b1a', 1.0, 'wings'),
    "Belle comme un éventail. À admirer avec les yeux seulement.", { baits: ['crevette', 'strouille'], phases: ['dusk', 'night'] }),
  sp('merou', 'Mérou brun', 'epic', 'recif', [0.55, 1], 'diver', [50, 140], [3, 45],
    art('deep', 2.4, 'round', 'spiny', 'spots', '#7a5a3a', '#c9a57a', '#5a4028', 0.8),
    'Vous observe depuis son trou avec la patience des gens du pays.', { baits: ['calmar', 'crevette'], phases: ['dawn', 'dusk'] }),
  sp('napoleon', 'Labre Napoléon', 'legendary', 'recif', [0.62, 1], 'diver', [70, 200], [8, 150],
    art('deep', 2.0, 'round', 'long', 'scales', '#2b8a7a', '#5a6ad9', '#3aa5a5', 0.7, 'horn'),
    'Une bosse sur le front et un regard de vieux sage.', { baits: ['calmar', 'strouille'], phases: ['day'], weathers: ['sun'] }),
  sp('chimere', 'Chimère de Corail', 'mythic', 'recif', [0.5, 1], 'jumper', [40, 90], [2, 12],
    art('deep', 2.2, 'fan', 'sail', 'glow', '#f06a8a', '#f0e08a', '#f09a5a', 1.2, 'crest'),
    "Des ramures roses lui poussent sur le dos. On la prend pour un massif qui s'en va.", { baits: ['lumignon', 'strouille'], requires: { phase: ['dawn', 'dusk'] } }),

  // ───────────────────────── Le Large ─────────────────────────
  sp('sardine', 'Sardine', 'common', 'large', [0, 0.6], 'nervous', [10, 22], [0.02, 0.12],
    art('torpedo', 4.2, 'fork', 'low', 'belly', '#4a7a9a', '#e8eef2', '#7a9ab5', 1.1),
    "Le pain quotidien de tout ce qui nage plus vite qu'elle.", { baits: ['mie', 'patee'] }),
  sp('maquereau', 'Maquereau', 'common', 'large', [0, 0.75], 'nervous', [20, 45], [0.15, 1.2],
    art('torpedo', 4.4, 'fork', 'low', 'stripes', '#2b8a7a', '#1a3a4a', '#d9e4e8', 1.0),
    'Le dos tigré de vert, pressé comme un lundi.', { baits: ['patee', 'cuiller'] }),
  sp('orphie', 'Orphie', 'common', 'large', [0.1, 0.85], 'jumper', [35, 80], [0.15, 1],
    art('eel', 6, 'fork', 'low', 'belly', '#3a9a8a', '#e8f0f0', '#5ab5a5', 0.9, 'sword'),
    "Une aiguille d'argent aux arêtes vertes. Vraiment vertes.", { baits: ['crevette', 'cuiller'], phases: ['day', 'dusk'] }),
  sp('bonite', 'Bonite', 'uncommon', 'large', [0.2, 0.9], 'nervous', [35, 80], [0.8, 8],
    art('torpedo', 3.4, 'lunate', 'spiny', 'bands', '#3a5a8a', '#c9d4e0', '#2b4060', 0.9),
    "Chasse en meute et ne s'excuse jamais.", { baits: ['cuiller', 'patee'], phases: ['dawn', 'day'] }),
  sp('coryphene', 'Coryphène', 'uncommon', 'large', [0.3, 1], 'jumper', [50, 140], [2, 25],
    art('fusiform', 3.6, 'fork', 'long', 'spots', '#3ab58a', '#f0d03a', '#2b7ad9', 0.9),
    "Vert, or et bleu : elle s'éteint dès qu'on la sort de l'eau, alors relâchez-la.", { baits: ['calmar', 'cuiller'], seasons: ['summer'], weathers: ['sun', 'clouds'] }),
  sp('thon', 'Thon rouge', 'rare', 'large', [0.4, 1], 'diver', [80, 250], [10, 300],
    art('torpedo', 3.0, 'lunate', 'spiny', 'belly', '#2b3a5a', '#c9d0d9', '#f0c02b', 0.8),
    "Un obus à sang chaud. Prévoyez du fil. Beaucoup de fil.", { baits: ['calmar', 'strouille'], phases: ['dawn', 'dusk'] }),
  sp('exocet', 'Exocet volant', 'rare', 'large', [0.35, 1], 'jumper', [18, 40], [0.1, 0.7],
    art('fusiform', 3.8, 'fork', 'low', 'belly', '#3a6ad9', '#e8eef5', '#8ab5f0', 1.1, 'wings'),
    "Il ne vole pas, il plane. Il tient à la nuance.", { baits: ['crevette', 'patee'], weathers: ['sun', 'clouds'], phases: ['day', 'dusk'] }),
  sp('peau-bleue', 'Requin peau-bleue', 'epic', 'large', [0.55, 1], 'diver', [150, 320], [30, 180],
    art('torpedo', 4.6, 'lunate', 'tall', 'belly', '#3a5a9a', '#e8eef5', '#2b4a80', 0.6),
    "Grand voyageur indigo. Traverse l'océan comme on traverse la rue.", { baits: ['calmar'], phases: ['night', 'dusk'] }),
  sp('marlin', 'Marlin bleu', 'legendary', 'large', [0.65, 1], 'jumper', [200, 400], [80, 600],
    art('torpedo', 4.4, 'lunate', 'sail', 'bands', '#2b4a9a', '#c9d9f0', '#1a2b6a', 0.7, 'sword'),
    "Le capitaine Hervé en a ferré un, une fois. Il en parle encore au présent.", { baits: ['calmar', 'strouille'], phases: ['day'], seasons: ['summer', 'autumn'] }),
  sp('voile', 'Voile-des-Tempêtes', 'mythic', 'large', [0.5, 1], 'jumper', [220, 380], [90, 400],
    art('torpedo', 4.2, 'lunate', 'sail', 'glow', '#4a3a8a', '#f0e84a', '#8a5ad9', 0.9, 'sword'),
    "On dit que les éclairs le cherchent, et qu'il les sème.", { baits: ['lumignon', 'calmar'], requires: { weather: ['storm'] } }),

  // ───────────────────────── La Fosse ─────────────────────────
  sp('lanterne', 'Poisson-lanterne', 'common', 'fosse', [0, 0.65], 'calm', [5, 15], [0.005, 0.05],
    art('fusiform', 3.2, 'fork', 'low', 'glow', '#3a3a5a', '#6af0e0', '#5a5a80', 1.5),
    'Une guirlande de points bleus le long du ventre. La nuit lui appartient.', { baits: ['mie', 'lumignon'] }),
  sp('hache', "Hache d'argent", 'common', 'fosse', [0, 0.75], 'nervous', [4, 10], [0.003, 0.02],
    art('round', 1.3, 'fork', 'tall', 'belly', '#8a95a5', '#e8eef5', '#5a6575', 1.6),
    'Mince comme une lame, les yeux tournés vers le haut, toujours étonnée.', { baits: ['patee', 'crevette'] }),
  sp('grenadier', 'Grenadier', 'common', 'fosse', [0.1, 0.9], 'calm', [30, 90], [0.3, 4],
    art('eel', 5, 'point', 'spiny', 'plain', '#5a5a6a', '#8a8a9a', '#4a4a5a', 1.4),
    'Une grosse tête, une queue de rat, et tout le temps du monde.', { baits: ['calmar', 'ver'] }),
  sp('vipere', 'Poisson-vipère', 'uncommon', 'fosse', [0.2, 1], 'nervous', [20, 35], [0.02, 0.1],
    art('eel', 5.4, 'fork', 'spiny', 'glow', '#2b2b3a', '#5ad9f0', '#3a3a4a', 1.2, 'teeth'),
    'Des dents si longues qu’il ne peut pas fermer la bouche. Il fait avec.', { baits: ['lumignon', 'crevette'] }),
  sp('ogre', 'Poisson-ogre', 'uncommon', 'fosse', [0.3, 1], 'nervous', [10, 18], [0.05, 0.2],
    art('round', 1.6, 'round', 'low', 'plain', '#5a2b2b', '#8a4a4a', '#3a1a1a', 0.8, 'teeth'),
    'Terrifiant sur le papier, grand comme la main en vrai.', { baits: ['calmar', 'patee'] }),
  sp('baudroie', 'Baudroie abyssale', 'rare', 'fosse', [0.4, 1], 'diver', [15, 60], [0.3, 8],
    art('angler', 1.5, 'round', 'none', 'marble', '#3a2b3a', '#f0e06a', '#2b1a2b', 0.6, 'lure'),
    'Elle pêche à la ligne, elle aussi. Respect entre collègues.', { baits: ['lumignon', 'calmar'] }),
  sp('grandgousier', 'Grandgousier', 'rare', 'fosse', [0.45, 1], 'cunning', [60, 180], [0.5, 4],
    art('eel', 6, 'point', 'none', 'glow', '#1a1a2b', '#f05a8a', '#2b2b3a', 0.7),
    "Une bouche avec un poisson autour. Le bout de sa queue clignote en rose.", { baits: ['lumignon', 'strouille'] }),
  sp('dragon', 'Dragon des abysses', 'epic', 'fosse', [0.55, 1], 'cunning', [15, 45], [0.05, 0.6],
    art('eel', 5.6, 'fork', 'low', 'glow', '#1a2b2b', '#5af0a0', '#2b3a3a', 1.0, 'lure'),
    "Voit une lumière rouge que personne d'autre ne voit. Triche, donc.", { baits: ['lumignon'] }),
  sp('regalec', 'Régalec', 'legendary', 'fosse', [0.65, 1], 'diver', [300, 800], [40, 250],
    art('eel', 6, 'point', 'sail', 'bands', '#c9d0d9', '#f04a4a', '#e83a3a', 1.0, 'crest'),
    'Le roi des harengs : un ruban d’argent long comme le quai, crête rouge au vent.', { baits: ['calmar', 'lumignon'] }),
  sp('veilleuse', 'La Veilleuse', 'mythic', 'fosse', [0.55, 1], 'cunning', [350, 600], [300, 900],
    art('angler', 2.0, 'fan', 'sail', 'glow', '#2b3a6a', '#8af0f0', '#f0e88a', 1.3, 'lure'),
    "« Elle existe. Elle éclaire le fond pour que les autres trouvent leur chemin. » — dernière page de Maëlle", { baits: ['leurre'] }),

  // ───────────────────────── Marée luisante ─────────────────────────
  sp('lueur', 'Lueur-de-Lune', 'epic', ['anse', 'recif', 'large'], [0, 1], 'calm', [20, 45], [0.3, 2],
    art('round', 1.5, 'fan', 'tall', 'glow', '#3a8ad9', '#a0f0f0', '#6ab5f0', 1.3),
    'Ne monte que lorsque la mer se met à briller. On dirait un morceau de ciel tombé.', { baits: ['lumignon'], requires: { weather: ['glow'] }, value: 1.4 }),
  sp('feu-follet', 'Feu-follet des saules', 'epic', ['etang', 'riviere'], [0, 1], 'nervous', [12, 30], [0.1, 0.8],
    art('fusiform', 3.0, 'fan', 'sail', 'glow', '#5ad98a', '#e8f08a', '#8af0b5', 1.4),
    'Les anciens suivaient sa lueur. Les anciens se perdaient beaucoup.', { baits: ['lumignon'], requires: { weather: ['glow'] }, value: 1.4 }),
];

const speciesIndex = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species {
  const s = speciesIndex.get(id);
  if (!s) throw new Error(`Unknown species ${id}`);
  return s;
}

export function hasSpecies(id: string): boolean {
  return speciesIndex.has(id);
}

export function speciesOfZone(zone: ZoneId): Species[] {
  return SPECIES.filter((s) => s.zones.includes(zone));
}

/** The fish that closes the story arc. */
export const LEGEND_ID = 'veilleuse';
