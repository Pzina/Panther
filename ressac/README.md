# RESSAC

**Pêche · Exploration · Collection** — un jeu mobile solo, en mode portrait, jouable hors ligne, sans compte, sans publicité et sans achat réel.

Vous héritez d'une vieille barque et d'une cabane sur l'archipel de Ressac. L'ichtyologue Maëlle Corvec y a laissé un carnet à moitié vide : à vous de le compléter, de remettre le petit port en état et de découvrir ce qui vit au fond de la Fosse.

- 6 zones, 62 espèces dessinées par le code (chacune avec 4 variantes), 6 raretés ;
- un mini-jeu de combat à tension avec 5 comportements de poisson ;
- heure, météo (dont la rare « marée luisante »), saisons et appâts qui changent les prises ;
- 18 missions d'histoire en 3 actes, 3 missions quotidiennes, 12 défis, 39 succès ;
- une boutique complète (8 cannes, 6 moulinets, 5 fils, 5 hameçons, 10 appâts + le leurre de l'histoire, 4 bateaux, 18 cosmétiques) ;
- graphismes 100 % vectoriels générés par le code, sons et musique 100 % synthétisés (Web Audio).

Le nom du jeu est centralisé dans `src/config/constants.ts` (`GAME_NAME`).

Captures d'écran : [`docs/screenshots/`](docs/screenshots/). Rapport d'équilibrage : [`docs/balance-report.txt`](docs/balance-report.txt).

---

## Installation et commandes

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev          # serveur de développement (http://localhost:5173)
npm run build        # vérification TypeScript + build de production dans dist/
npm run preview      # sert dist/ (http://localhost:4173), avec le service worker
npm test             # tests unitaires Vitest (logique : économie, probabilités, sauvegarde, missions…)
npm run test:e2e     # test de bout en bout Playwright en viewport mobile 390×844
npm run lint         # ESLint + Prettier (vérification)
npm run format       # Prettier (correction)
npm run simulate     # simulation d'équilibrage : 1 000 carrières (options : -- --runs 200 --seed 7)
npm run icons        # régénère les icônes PNG à partir de assets-src/icon.svg
npm run screenshots  # captures de tous les écrans (nécessite `npm run preview` lancé à côté)
```

`npm run test:e2e` construit le jeu et lance lui-même le serveur de prévisualisation. Les tests utilisent le Chromium fourni par Playwright (`npx playwright install chromium` si besoin).

**Mode debug** : ajoutez `?debug=1` à l'URL. Un bouton « Debug » apparaît au port : pièces, déblocage de tout le contenu, validation de la mission en cours, fin de l'histoire, niveaux, avance du temps, météo forcée. Il permet de vérifier que l'histoire se termine de bout en bout.

---

## Architecture

```
src/
  main.ts           point d'entrée : Phaser, sauvegarde auto, retour Android, arrière-plan, notifications
  app.ts            services partagés (jeu, sauvegarde, audio, interface)
  config/           constantes et équilibrage (TOUS les chiffres du jeu sont dans balance.ts)
  data/             espèces, zones, équipement, missions, succès, dialogues (TypeScript typé)
  core/             état, sauvegarde + migrations, événements, horloge, RNG à graine, i18n, façade Game
  systems/          pêche (tables pondérées + pitié), combat, météo, économie, progression, missions
  scenes/           scènes Phaser : Boot, Preload, Title (accueil), Port, Fishing
  ui/               couche HTML/CSS : HUD, écrans, modales, toasts, transitions, style.css
    screens/        boutique, vivier, carnet, missions, succès, carte, cabane, paramètres, pause…
  art/              générateurs procéduraux : poissons, décors, eau, ciel, icônes, portraits, illustrations
  audio/            synthèse des effets, musique générative, ambiances
  i18n/fr.json      textes de l'interface
tests/              tests unitaires (Vitest)
e2e/                tests de bout en bout (Playwright)
scripts/            simulation, icônes, captures, gabarit du service worker
```

**La logique est indépendante de Phaser.** `core/`, `systems/` et `data/` n'importent ni Phaser ni le DOM : la classe `Game` (`src/core/game.ts`) applique toutes les règles. Les scènes, l'interface HTML, les tests et la simulation passent tous par elle.

**Pourquoi des menus en HTML/CSS par-dessus le canvas ?** Phaser dessine ce qui bouge (mer, ciel, météo, bateau, ligne, poisson, particules) ; tout ce qui se lit (menus, listes, fiches, boutons) est en HTML/CSS. Ce choix donne gratuitement : un texte net à toutes les densités d'écran, le défilement natif des longues listes, la mise en page fluide de 360 px à la tablette, les *safe areas* via `env(safe-area-inset-*)`, la taille de texte réglable, l'accessibilité (rôles ARIA, lecteurs d'écran, focus clavier) et un style unique pour tous les écrans. Le canvas est rendu en haute définition (jusqu'à ×2,5 selon l'appareil) dans un monde logique de 390 unités de large.

**Rendu des poissons.** `src/art/fish.ts` construit un SVG à partir des paramètres de chaque espèce (forme du corps, allongement, queue, dorsale, motif, trois couleurs, taille de l'œil, attribut spécial). Les variantes (albinos, mélanique, doré, chatoyant) changent la palette et ajoutent un effet. Au démarrage, la scène Preload transforme chaque SVG en texture Phaser : la barre de chargement suit ce travail réel.

**Son.** `src/audio/engine.ts` synthétise tout : effets (lancer, plouf, touche, moulinet, fil tendu, casse, prise, prise rare, pièces, clic, page…), musique générative pentatonique qui dépend de la zone et de l'heure, ambiances (vagues, vent, pluie, mouettes, grillons, gouttes et grondement dans la Fosse). Trois volumes séparés plus les vibrations.

**Sauvegarde.** `localStorage` (+ copie dans IndexedDB), automatique toutes les 30 s et à chaque événement important. Format versionné (`saveVersion`) avec migrations, somme de contrôle, validation champ par champ (une sauvegarde abîmée ne fait jamais planter le jeu), copie de secours proposée automatiquement, export/import par code texte (`RSC1.` + base64 + somme de contrôle).

**PWA.** `public/manifest.webmanifest`, icônes générées depuis `assets-src/icon.svg`, et un service worker produit au build (`scripts/sw.template.js`) qui met en cache la totalité du jeu : une fois chargé, il fonctionne hors ligne et s'installe sur l'écran d'accueil.

---

## Ajouter du contenu

### Ajouter une espèce

Dans `src/data/species.ts`, ajoutez une entrée avec la fonction `sp(...)` :

```ts
sp('rouget', 'Rouget barbet', 'uncommon', 'anse', [0.2, 0.8], 'calm', [12, 30], [0.05, 0.4],
  art('fusiform', 3.4, 'fork', 'spiny', 'belly', '#d9573b', '#f3d2b0', '#c0402a', 1.0, 'whiskers'),
  'Il fouille le sable avec ses deux barbillons, comme on cherche ses clés.',
  { baits: ['ver', 'crevette'], phases: ['day'], seasons: ['summer'] }),
```

- `depth` : plage de distance de lancer (0 = au bateau, 1 = au plus loin) ;
- `phases`, `weathers`, `seasons` : préférences (hors préférence, la chance baisse sans tomber à zéro) ;
- `requires` : conditions strictes (ex. `{ weather: ['fog'] }`) ;
- la valeur de base est calculée depuis la zone et la rareté (`BALANCE.rarity[...].value`).

Les tests (`tests/data.test.ts`, `tests/fishing.test.ts`) vérifient automatiquement l'unicité, la cohérence des plages, que l'espèce a un visuel unique et qu'elle peut être attrapée dans au moins une condition. Relancez `npm run simulate` pour contrôler l'équilibrage.

### Ajouter une zone

1. Ajoutez l'identifiant au type `ZoneId` (`src/data/types.ts`).
2. Ajoutez la zone dans `src/data/zones.ts` : palette, élément de gameplay (`gimmick`), météo, position sur la carte, musique, multiplicateur de valeur, mission qui la débloque.
3. Ajoutez son décor dans `Backdrop.drawLand()` (`src/art/backdrop.ts`) et, si besoin, la règle de son élément de gameplay dans `FishingScene` (dérive, bancs…) ou `FightModel` (houle…).
4. Créez la mission qui la débloque (`reward: { unlockZone: 'nouvelle' }`) dans `src/data/missions.ts`, puis ajoutez ~10 espèces.

### Traduire

Les textes d'interface sont dans `src/i18n/fr.json`. Pour une autre langue, créez `src/i18n/en.json` et enregistrez-le avec `registerLanguage('en', en)` (`src/core/i18n.ts`). Le contenu (noms d'espèces, descriptions) peut être surchargé avec des clés `content.<id>.name` / `content.<id>.description`. Le sélecteur de langue existe déjà dans les paramètres.

---

## iOS et Android avec Capacitor

La configuration est prête (`capacitor.config.ts`, identifiant `fr.ressac.jeu`, dossier web `dist`).

```bash
npm run build
npx cap add android        # une seule fois : crée le projet Android Studio (dossier android/)
npx cap add ios            # une seule fois : crée le projet Xcode (dossier ios/, macOS + Xcode requis)
npm run cap:sync           # à chaque mise à jour : build + copie de dist/ dans les projets natifs
npx cap open android       # ouvre Android Studio → Run / Build > Generate Signed Bundle
npx cap open ios           # ouvre Xcode → Product > Archive
```

À configurer côté natif : orientation portrait seulement (Android : `android:screenOrientation="portrait"` dans `AndroidManifest.xml` ; iOS : *Supported interface orientations* = Portrait), icônes et écran de lancement (`npx @capacitor/assets generate` à partir de `assets-src/icon.svg` exporté en 1024 px), et nom affiché. Le bouton retour d'Android est déjà géré : le jeu s'appuie sur l'historique du navigateur, que la WebView de Capacitor utilise par défaut. Le service worker n'est pas enregistré dans l'app native (les fichiers sont déjà locaux).

### Ce qu'il reste à faire pour publier

- **Comptes développeur** : Apple Developer Program (99 $/an) et Google Play Console (25 $ une fois).
- **Signature** : certificat de distribution et profil de provisionnement (iOS), clé d'upload (Android, *Play App Signing*).
- **Icônes et écrans de lancement finaux** dans toutes les tailles (1024 px pour l'App Store, 512 px + icône adaptative pour Google Play).
- **Politique de confidentialité** publiée en ligne (obligatoire même sans collecte) : le jeu ne collecte aucune donnée, n'a ni serveur, ni compte, ni traceur, ni publicité. Formulaires « App Privacy » (Apple) et « Sécurité des données » (Google) : *aucune donnée collectée*.
- **Captures d'écran** aux formats demandés (iPhone 6,7″ et 6,5″, iPad si supporté ; téléphone Android) — `npm run screenshots` fournit une base en 390×844.
- **Classification d'âge** : questionnaire IARC (Google) et Apple — pas de violence, pas d'achat, pas d'interaction en ligne : catégorie « 4+ » / « PEGI 3 » attendue.
- **Fiche magasin** : description, mots-clés, catégorie « Jeux > Simulation / Occasionnel », coordonnées de support.
- **Achats intégrés** : aucun pour l'instant. Une interface `Store` vide n'est pas branchée (voir `DESIGN_DECISIONS.md`).
- **Tests sur appareils réels** (performances, encoche, geste retour) et passage par TestFlight / test interne Google Play.

---

## Qualité

| Vérification | Résultat |
| --- | --- |
| `npm run build` | sans erreur ; JS ≈ 420 Ko gzip au total (dont Phaser ≈ 332 Ko), bien sous la limite de 2 Mo |
| `npm test` | 71 tests unitaires verts |
| `npm run test:e2e` | 4 scénarios verts : nouvelle partie → intro → tutoriel → premier poisson (≈ 25 s) → vente → appât → rechargement ; sauvegarde corrompue → copie de secours ; histoire complète en mode debug jusqu’à la Veilleuse et l’écran de fin ; jeu rechargé hors ligne grâce au service worker |
| `npm run lint` | ESLint + Prettier sans erreur |
| `npm run simulate` | voir `GAME_DESIGN.md` § Équilibrage |

### Limites connues

- Dans Chromium *headless* (rendu WebGL logiciel), le pilote GL écrit des avertissements « GPU stall due to ReadPixels » ; ils ne viennent pas du code du jeu et n'apparaissent pas sur un appareil réel.
- Les performances (60 i/s) ont été pensées pour un téléphone milieu de gamme (rendu limité à ×2,5, géométrie redessinée simplement), mais n'ont été mesurées que sur ordinateur.
- Seul le français est fourni.
- L'export de sauvegarde utilise le presse-papiers ; s'il est refusé, le code reste sélectionnable à la main.

### Pistes pour la version 1.1

Mode coopératif local (passer le téléphone), tournois hebdomadaires hors ligne avec graine partagée, aquarium décoratif (plantes, décors à acheter), nouvelle région (une mer froide avec banquise et pêche sous la glace), saisons qui changent le décor, sauvegarde dans le cloud optionnelle.
