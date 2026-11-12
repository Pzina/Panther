import type { CharacterId } from './types';

export const CHARACTERS: Record<CharacterId, { name: string; role: string }> = {
  herve: { name: 'Capitaine Hervé', role: 'Vieux marin' },
  jo: { name: 'Jo', role: 'Marchande du port' },
  nell: { name: 'Nell', role: 'Cartographe' },
  maelle: { name: 'Carnet de Maëlle', role: 'Ichtyologue' },
};

/** Introduction comic: four illustrated panels. */
export const INTRO_PANELS: { art: 'letter' | 'boat' | 'journal' | 'fosse'; text: string }[] = [
  { art: 'letter', text: "Un matin, une lettre arrive : une certaine Maëlle Corvec vous lègue une barque et une cabane, sur un archipel dont vous n'avez jamais entendu parler." },
  { art: 'boat', text: "L'archipel de Ressac. Un port minuscule, trois habitants, et une vieille barque rouge qui tangue au bout du quai." },
  { art: 'journal', text: "Dans la cabane, un carnet. Maëlle y dessinait chaque poisson de l'archipel. La moitié des pages sont restées blanches." },
  { art: 'fosse', text: "Sur la dernière page, un seul mot entouré trois fois : « la Fosse ». À vous de remplir le carnet… et de découvrir ce qui vit tout au fond." },
];

/** Tutorial steps, spoken by Capitaine Hervé. */
export const TUTORIAL_STEPS: { id: string; text: string }[] = [
  { id: 'cast', text: "Bienvenue à bord ! Maintiens le doigt sur l'eau pour charger ton lancer, glisse pour viser, puis relâche." },
  { id: 'wait', text: 'Bien lancé. Maintenant, patience : regarde le bouchon. Ne touche à rien tant qu’il ne plonge pas.' },
  { id: 'hook', text: 'Quand le bouchon plonge et que le « ! » apparaît, touche vite l’écran pour ferrer !' },
  { id: 'reel', text: 'Ferré ! Maintiens pour mouliner, relâche pour laisser filer. Garde le curseur dans la zone claire.' },
  { id: 'port', text: 'Belle prise ! Garde-la dans le vivier, puis rentre au port avec le bouton en haut à gauche.' },
  { id: 'sell', text: 'Va voir Jo, la marchande, et vends-lui ton poisson.' },
  { id: 'bait', text: 'Avec tes pièces, achète des vers dans l’onglet « Appâts » : les poissons mordent plus vite.' },
  { id: 'done', text: "Te voilà pêcheur. Le panneau des missions t'indiquera la suite. Bon vent !" },
];

/** Maëlle's notebook: one page every 10 % of collection. */
export const JOURNAL_PAGES: { title: string; text: string }[] = [
  { title: 'Arrivée', text: "Premier jour à Ressac. Le port tient en trois maisons et un quai. Jo m'a vendu une canne trop chère et offert un café. J'ai compté onze espèces rien que depuis le brise-lames. Je crois que je vais rester un peu." },
  { title: "L'Anse", text: "Les galets chantent quand la vague se retire — d'où le nom, je suppose. Le capitaine Hervé prétend qu'un des galets est vivant. Il prétend beaucoup de choses. Je note quand même." },
  { title: 'Les saules', text: "L'étang au matin : on n'y voit pas sa propre canne. Les carpes font des ronds dans la brume comme si elles signaient. Une chose énorme a bougé sous la barque cette nuit. Très lente. Très polie." },
  { title: 'La Torse', text: "La rivière ne coule pas droit. J'ai relevé son cours trois fois : il change. Nell, la petite qui dessine des cartes, dit que c'est la rivière qui suit un poisson. Elle a peut-être raison. Les enfants regardent mieux." },
  { title: 'Le récif', text: "Trop de couleurs pour mes crayons. J'ai dû en commander. Le perroquet fabrique le sable, la demoiselle garde le corail, et moi je prends des notes : chacun son travail." },
  { title: 'Marée luisante', text: "Cette nuit la mer s'est allumée. Chaque coup de rame laissait une traînée bleue. Des poissons que je n'avais jamais vus sont montés des profondeurs pour danser dedans. D'où viennent-ils ? D'en bas. Tout vient d'en bas." },
  { title: 'Le large', text: "Hervé m'a emmenée au-delà de la dernière balise. Un marlin a sauté si près que j'ai lâché mon carnet. Mais ce n'est pas lui que je cherche. Sous le large, la sonde ne touche plus le fond." },
  { title: 'La sonde', text: "Huit cents brasses de fil et toujours rien. Puis une secousse, et le plomb est remonté tiède, couvert d'une poussière qui brille. Il y a une fosse sous l'archipel. Et quelque chose l'éclaire." },
  { title: 'La lumière', text: "Je l'ai vue. Une lueur lente, large comme le port, qui passait sous la coque. Les petits poissons-lanternes la suivaient comme des enfants derrière un fanal. Je l'appelle la Veilleuse." },
  { title: 'Dernière page', text: "Mon leurre est prêt : du verre soufflé, une goutte de marée luisante dedans. Mais mes mains tremblent trop pour ce combat-là. Alors je laisse la barque, la cabane et ce carnet à quelqu'un de plus patient. Finissez-le. Et quand vous la verrez… relâchez-la, peut-être. — M. C." },
];

export const TIPS: string[] = [
  'Plus vous lancez loin, plus l’eau est profonde… et plus les espèces changent.',
  'Certaines espèces ne mordent que la nuit. Dormez à la cabane pour choisir votre heure.',
  'Un lancer parfait (zone verte) augmente vos chances de belle prise.',
  'Relâcher un poisson fait grimper votre réputation au port.',
  'Chaque espèce a ses appâts préférés : consultez le carnet.',
  'Trois poissons communs suffisent pour fabriquer de la Pâtée de l’Anse.',
  'Pendant une marée luisante, des espèces venues des profondeurs remontent.',
  'Fil trop tendu : il casse. Fil trop mou : le poisson se décroche.',
  'Un poisson qui saute ? Relâchez le moulinet le temps du saut.',
  'Verrouillez un poisson dans le vivier pour ne pas le vendre par erreur.',
  'La pluie et l’orage rendent les poissons plus mordeurs.',
  'Le mode « combat assisté » agrandit la zone sûre, sans aucune pénalité.',
];

export const ENDING_TEXT: string[] = [
  "La Veilleuse est remontée lentement, comme un lever de lune sous la coque.",
  "Dans sa lumière, toute la Fosse est apparue : des milliers de poissons, immobiles, qui regardaient.",
  "Vous avez noté sa taille, son poids, la couleur exacte de sa lueur. Puis vous avez rempli la dernière page du carnet.",
  "Le carnet de Maëlle Corvec est complet sur l'essentiel. Mais l'archipel, lui, n'a pas fini de vous surprendre…",
];
