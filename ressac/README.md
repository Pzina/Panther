# RESSAC

**Pêche · Exploration · Collection** — un jeu mobile solo, en mode portrait, jouable hors ligne, sans compte, sans publicité et sans achat réel.

Vous héritez d'une vieille barque et d'une cabane sur l'archipel de Ressac. L'ichtyologue Maëlle Corvec y a laissé un carnet à moitié vide : à vous de le compléter, de remettre le petit port en état et de découvrir ce qui vit au fond de la Fosse.

- 6 zones, 62 espèces dessinées par le code (chacune avec 4 variantes), 6 raretés ;
- un mini-jeu de combat à tension avec 5 comportements de poisson ;
- heure, météo (dont la rare « marée luisante »), saisons et appâts qui changent les prises ;
- 18 missions d'histoire en 3 actes, 3 missions quotidiennes, 12 défis, 39 succès ;
- une boutique complète (8 cannes, 6 moulinets, 5 fils, 5 hameçons, 10 appâts + le leurre de l'histoire, 4 bateaux, 18 cosmétiques) ;
- un monde en **3D temps réel** (Three.js) : mer animée qui reflète le ciel, soleil, lune, nuages, pluie, orage, brouillard, îles en relief, bateau, canne, poissons modélisés ;
- graphismes 100 % générés par le code (aucune image ni modèle importé), sons et musique 100 % synthétisés (Web Audio).

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
  main.ts           point d'entrée : moteur 3D, sauvegarde auto, retour Android, arrière-plan, notifications
  app.ts            services partagés (jeu, sauvegarde, audio, interface)
  config/           constantes et équilibrage (TOUS les chiffres du jeu sont dans balance.ts)
  data/             espèces, zones, équipement, missions, succès, dialogues (TypeScript typé)
  core/             état, sauvegarde + migrations, événements, horloge, RNG à graine, i18n, façade Game
  systems/          pêche (tables pondérées + pitié), combat, météo, économie, progression, missions
  three/            rendu 3D (Three.js) : ciel, eau, relief, objets, poissons 3D, moteur de scènes
    views/          les trois scènes : TitleView (accueil), PortView, FishingView
  ui/               couche HTML/CSS : HUD, écrans, modales, toasts, transitions, style.css
    screens/        boutique, vivier, carnet, missions, succès, carte, cabane, paramètres, pause…
  art/              générateurs 2D : icônes, portraits, illustrations de l'intro, paramètres de dessin des poissons
  audio/            synthèse des effets, musique générative, ambiances
  i18n/fr.json      textes de l'interface
tests/              tests unitaires (Vitest)
e2e/                tests de bout en bout (Playwright)
scripts/            simulation, icônes, captures, gabarit du service worker
```

**La logique est indépendante du rendu.** `core/`, `systems/` et `data/` n'importent ni Three.js ni le DOM : la classe `Game` (`src/core/game.ts`) applique toutes les règles. Les scènes, l'interface HTML, les tests et la simulation passent tous par elle.

**Pourquoi Three.js et plus Phaser ?** Le cahier des charges d'origine imposait Phaser 3 (moteur 2D). La demande d'un jeu en 3D aux graphismes réalistes l'a remplacé par **Three.js 0.170.0** (épinglé), qui dessine les trois scènes dans un seul canvas WebGL. Les règles du jeu, les écrans et les tests n'ont pas changé.

**Pourquoi des menus en HTML/CSS par-dessus le canvas ?** Le moteur 3D dessine le monde ; tout ce qui se lit (menus, listes, fiches, boutons) est en HTML/CSS : texte net à toutes les densités d'écran, défilement natif, mise en page fluide de 360 px à la tablette, *safe areas*, taille de texte réglable, accessibilité, et un style unique. Au port, les boutons HTML sont accrochés aux lieux 3D qu'ils ouvrent (projection à chaque image).

**Déplacement du personnage.** Un joystick tactile (`src/ui/joystick.ts`, flèches ou ZQSD au clavier) déplace le joueur : au port, il marche librement sur le quai, la passerelle et l'île, la caméra le suit et le bouton d'un lieu s'illumine quand il s'en approche ; en pêche, il se déplace sur le pont de la barque. Le personnage actuel est généré par le code (`makeCharacter` dans `src/three/props.ts`) en attendant un modèle fourni.

**Rendu 3D (`src/three/`).**
- *Ciel* (`sky.ts`) : un shader calcule dégradé atmosphérique, disque et halo du soleil, lune, étoiles et nuages éclairés (bruit fractal) selon l'heure et la météo ; brouillard, pluie et éclairs s'y ajoutent. Le même ciel sert de carte d'environnement pour les reflets des objets.
- *Eau* (`water.ts`) : houle par somme de vagues (la même formule fait flotter le bateau et le bouchon), rides, reflet du ciel par effet de Fresnel, scintillement du soleil et de la lune, écume, transparence, bioluminescence de la marée luisante et de la Fosse.
- *Relief* (`terrain.ts`, `zones3d.ts`) : chaque zone a son paysage généré (caps et phare, berges boisées, montagnes enneigées, îlots à palmiers, pics de la Fosse).
- *Poissons* (`fishMesh.ts`) : chaque espèce est modélisée à partir de ses paramètres (corps par sections, nageoires, yeux, barbillons, rostre, leurre lumineux…), avec une peau texturée (contre-ombrage, motif, écailles) et un matériau humide et brillant. Les variantes changent la peau (dorée métallique, irisée…). Le même modèle sert en jeu (saut, sortie de l'eau) et pour les images du carnet, photographiées dans un petit studio 3D.
- *Performance* : ombres portées, tone mapping filmique, résolution limitée à ×2 et **abaissée automatiquement** si l'appareil ne tient pas la cadence.

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
| `npm run build` | sans erreur ; JS ≈ 230 Ko gzip au total (dont Three.js ≈ 134 Ko), bien sous la limite de 2 Mo |
| `npm test` | 71 tests unitaires verts |
| `npm run test:e2e` | 4 scénarios verts : nouvelle partie → intro → tutoriel → premier poisson (≈ 25 s) → vente → appât → rechargement ; sauvegarde corrompue → copie de secours ; histoire complète en mode debug jusqu’à la Veilleuse et l’écran de fin ; jeu rechargé hors ligne grâce au service worker |
| `npm run lint` | ESLint + Prettier sans erreur |
| `npm run simulate` | voir `GAME_DESIGN.md` § Équilibrage |

### Limites connues

- Dans Chromium *headless* (rendu WebGL logiciel), le pilote GL écrit des avertissements « GPU stall due to ReadPixels » ; ils ne viennent pas du code du jeu et n'apparaissent pas sur un appareil réel.
- Le rendu 3D est plus exigeant que la version 2D d'origine. La résolution s'adapte toute seule, mais les performances n'ont été vérifiées que dans un navigateur sans carte graphique (rendu logiciel, donc lent) : un essai sur de vrais téléphones reste à faire.
- « Réaliste » a ici une limite assumée : sans aucune image ni modèle importé, les arbres, bâtiments et rochers restent stylisés ; l'eau, le ciel, la lumière et les poissons portent l'essentiel du réalisme.
- Seul le français est fourni.
- L'export de sauvegarde utilise le presse-papiers ; s'il est refusé, le code reste sélectionnable à la main.

### Pistes pour la version 1.1

Mode coopératif local (passer le téléphone), tournois hebdomadaires hors ligne avec graine partagée, aquarium décoratif (plantes, décors à acheter), nouvelle région (une mer froide avec banquise et pêche sous la glace), saisons qui changent le décor, sauvegarde dans le cloud optionnelle.
