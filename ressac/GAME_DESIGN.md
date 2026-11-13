# RESSAC — Document de game design

## 1. Intention

Un jeu de pêche contemplatif et collectionneur, en sessions de 3 à 15 minutes, jouable d'une main en portrait. Le plaisir vient de trois sources : **le geste** (lancer, ferrer, tenir la tension), **la découverte** (une silhouette qui devient un poisson nommé dans le carnet) et **la progression** (meilleur matériel → nouvelles eaux → nouvelles espèces). Aucune pression : pas de minuteur punitif, pas d'énergie, pas d'achat.

## 2. Boucle de jeu

```
   ┌───────────► Pêcher (lancer → attendre → ferrer → combattre → prise)
   │                              │
   │                       carte de prise : garder / vendre plus tard / relâcher
   │                              ▼
 Explorer ◄── S'équiper ◄── Vendre / fabriquer des appâts / missions
 (carte)       (boutique)          │
   │                              ▼
   └──────────── Collectionner (carnet, variantes, records, pages de Maëlle)
```

- **Session courte** : un vivier (12 à 48 places) se remplit en 5 à 15 minutes, puis retour au port.
- **Moyen terme** : missions d'histoire, missions du jour, nouvelle canne, nouveau bateau.
- **Long terme** : 62 espèces, 248 variantes, records, 39 succès, l'histoire en 3 actes.

## 3. La pêche

| Phase | Règle | Valeurs (`config/balance.ts`) |
| --- | --- | --- |
| Lancer | Maintenir : jauge de puissance oscillante ; glisser : viser ; relâcher : lancer. Distance = puissance × portée de la canne. | Cycle 0,9 s ; zone parfaite 0,82 ± 0,06 → +25 % de chance, touche 25 % plus rapide |
| Attente | Ombres de poissons ; 0 à 2 fausses touches (vibration légère) ; toucher trop tôt fait fuir le poisson. | Délai 4 à 10 s × zone × météo × heure × appât |
| Touche | Le bouchon plonge, « ! », vibration, son. | Fenêtre 0,4 à 1 s selon la rareté et l'hameçon (+0,2 s dans l'Anse) |
| Combat | Maintenir = mouliner (tension ↑, distance ↓) ; relâcher = laisser filer. Rester dans la zone sûre. Trop tendu trop longtemps → casse. Trop mou → décroche. | Durée cible 3 s (commun) → 30 s (mythique) ; zone sûre 36 % → 19 % de la jauge, ×1,5 en combat assisté |
| Prise | Animation, carte de résultat (nom, rareté, taille, poids, valeur, Nouveau !, Record !, variante). | Garder (verrouillé), vendre plus tard, relâcher (+2 réputation) |

**Profils de combat** (`systems/fight.ts`) :

- *calme* : la zone sûre ondule doucement ;
- *nerveux* : à-coups qui font sauter la tension et déplacent la zone ;
- *plongeur* : longues tirées vers le fond, il faut laisser filer ;
- *sauteur* : un saut est annoncé (cercle doré, vibration, « Il va sauter : relâchez ! ») ; mouliner pendant le saut abîme le fil, relâcher fait gagner du terrain ;
- *rusé* : change de cap, la zone sûre passe de l'autre côté de la jauge.

Un poisson qui dure plus longtemps que prévu **fatigue** (la remontée accélère), ce qui évite les combats interminables.

**Équipement** : la canne donne la portée, la chance et le contrôle (zone sûre plus large) ; le moulinet la vitesse et la douceur (tension qui monte moins vite) ; le fil la résistance ; l'hameçon la fenêtre de ferrage et la tenue (décroche moins).

## 4. Ce qui décide d'une prise

Le tirage se fait par **table de probabilités pondérées** (`systems/fishing.ts`) :

```
poids = poids_rareté
      × (heure hors préférence ? 0,12 : 1)
      × (météo hors préférence ? 0,4 : 1)
      × (saison hors préférence ? 0,45 : 1)
      × (appât préféré ? 2,4 : 1)
      × (1 + chance × 2 × sensibilité_rareté)
      × pitié
```

- Seules les espèces de la zone **et** de la profondeur atteinte entrent dans la table ; les conditions strictes (`requires`) les excluent sinon.
- **Pitié** : chaque prise sans Rare+ ajoute +7 % aux Rare+ (plafond ×4) ; chaque prise sans Légendaire+ ajoute +2,5 % aux Légendaire+ (plafond ×6). Le compteur repart à zéro dès qu'une telle prise tombe.
- **Graine** : le RNG (`core/rng.ts`, mulberry32) est sérialisé dans la sauvegarde ; les tests et la simulation utilisent des graines fixes.
- **Variantes** : albinos 2,2 % (×2), mélanique 1,6 % (×2,5), doré 0,8 % (×5), chatoyant 0,4 % (×8) ; la chance les augmente.

| Rareté | Couleur + forme | Poids | Valeur | XP | Espèces |
| --- | --- | --- | --- | --- | --- |
| Commun | gris, rond | 100 | ×1 | 8 | 18 |
| Peu commun | vert, losange | 34 | ×2,4 | 18 | 12 |
| Rare | bleu, triangle | 11 | ×6 | 45 | 12 |
| Épique | violet, pentagone | 3,4 | ×15 | 110 | 8 |
| Légendaire | or, étoile | 0,65 | ×40 | 280 | 6 |
| Mythique | arc-en-ciel, soleil | 0,17 | ×110 | 750 | 6 (1 par zone) |

**Temps et météo** : une journée dure 24 minutes réelles ; aube 5 h–8 h, jour 8 h–18 h, crépuscule 18 h–21 h, nuit 21 h–5 h ; une saison dure 7 jours. La météo change toutes les 3 heures de jeu, tirée de la graine du monde (soleil, nuages, pluie, orage, brouillard), avec des poids par zone et par saison ; une **marée luisante** remplace 5,5 % des créneaux de nuit dans toutes les zones et fait monter deux espèces spéciales. Pluie et orage accélèrent les touches. Dormir à la cabane avance l'heure jusqu'à la phase choisie et donne le bonus « Reposé » (+15 % de chance, +15 % d'XP pendant 8 h de jeu).

## 5. Zones

| Zone | Ouverture | Valeur | Élément propre |
| --- | --- | --- | --- |
| L'Anse aux Galets | départ | ×1 | eaux tranquilles : fenêtre de ferrage +0,2 s |
| L'Étang des Saules | mission s04 | ×1,6 | eau dormante : un lancer parfait attire aussitôt les poissons |
| La Rivière Torse | mission s07 | ×2,6 | courant : le bouchon dérive, il faut viser en amont ; tension de fond |
| Le Récif Corail | s10, bateau 2 | ×4,2 | bancs scintillants : lancer dedans = +35 % de chance, touches ×0,6 |
| Le Large | s13, bateau 3 | ×6,8 | houle : la tension monte et descend ; plus de fausses touches |
| La Fosse | s16, bateau 4 | ×11 | nuit permanente : la jauge n'apparaît que par éclairs, il faut lire les vibrations et le son (désactivé en combat assisté) |

Chaque zone a son paysage 3D, sa couleur d'eau, son état de mer, son ambiance sonore et sa gamme musicale.

## 6. Économie

- **Vente** : valeur = base × (0,7 + 0,7 × taille relative) × variante, +1 % par niveau.
- **Prix** : cannes 90 → 75 000, moulinets 150 → 34 000, fils 110 → 16 000, hameçons 80 → 14 000, bateaux 2 400 / 15 000 / 48 000. Certains articles demandent un niveau, de la réputation ou une mission.
- **Appâts** : achetés en lots (vers, maïs, crevettes, mouches, cuillers, calmar) ou **fabriqués à partir des prises** : Pâtée (3 communs), Strouille (2 peu communs), Lumignon (1 rare), Leurre de Maëlle (1 épique, après la mission s17).
- **Récompenses** : missions d'histoire (30 → 15 000 pièces), quotidiennes (35 → 140 et plus selon le niveau), défis, paliers de collection (100 / 400 / 1 500 / 5 000 / 20 000), pièces à chaque niveau.
- **Rétention douce** : bonus de connexion sur 7 jours (une journée manquée relance simplement le cycle), « filet à la traîne » qui rapporte 22 pièces/h × valeur de la meilleure zone pendant 8 h maximum, événements météo rares.

## 7. Progression

- **Niveau** : XP pour passer du niveau n au n+1 = 45 × n^1,55 (niveau 10 ≈ 2 h, niveau 20 ≈ 9 h) ; une première prise d'espèce rapporte double XP.
- **Réputation** : ventes (+0,25 / poisson), relâchés (+2), missions ; débloque des articles.
- **Histoire** : 18 missions en 3 actes, avec dialogues de Hervé, Jo, Nell et pages du carnet de Maëlle ; chaque acte ouvre des zones.
- **Carnet** : une page de Maëlle tous les 10 % de collection ; paliers à 10, 25, 50, 75 et 100 %.
- **Fin d'arc** : la Veilleuse attrapée avec le leurre de Maëlle ouvre l'écran de fin ; le jeu continue (variantes, records, défis, collection).

## 8. Équilibrage (simulation)

`npm run simulate` joue 1 000 carrières complètes avec les vraies règles (`Game`, tables de prise, `FightModel`, économie, missions). Le joueur simulé lance à des distances variées, réagit à la touche en 0,25–0,55 s, combat avec un temps de réaction et une attention imparfaits, vend, achète le matériel suivant, fabrique des appâts, choisit sa zone selon la météo et les espèces qui lui manquent, et joue des sessions d'environ 35 minutes (une par jour réel). Chaque action coûte 10 s de manipulation en plus de l'attente et du combat.

Résultat (graine 2024, `docs/balance-report.txt`) :

| Palier | Moyenne | Médiane | P10 – P90 | Cible |
| --- | --- | --- | --- | --- |
| Premier poisson | 1 min | 1 min | 1 – 1 min | < 2 min |
| Anse terminée → Étang ouvert | 30 min | 26 min | 18 – 46 min | ≈ 30 min |
| Fin de l'acte 1 | 1 h 51 | 1 h 49 | 1 h 05 – 2 h 44 | ≈ 2 h |
| Fin de l'acte 2 | 2 h 39 | 2 h 34 | 1 h 50 – 3 h 33 | |
| La Fosse ouverte | 8 h 04 | 8 h 02 | 6 h 50 – 9 h 21 | |
| Histoire terminée | 8 h 15 | 8 h 13 | 6 h 59 – 9 h 31 | |
| Collection 50 % | 2 h 29 | 2 h 24 | 1 h 42 – 3 h 22 | |
| Collection 100 % | 17 h 26 | 16 h 42 | 11 h 47 – 23 h 44 | 15 – 25 h |

100 % des carrières finissent l'histoire et la collection. Le joueur simulé connaît les conditions d'apparition : un vrai joueur, qui les découvre, sera plus lent sur les dernières espèces, ce qui place la collection complète dans la partie haute de la cible.

**Réglages issus de la simulation** : comportement « plongeur » corrigé (il était impossible à attraper : la tirée du poisson dépassait ce que relâcher permettait de compenser) ; efficacité de combat recalée pour respecter 3–30 s ; fatigue du poisson ajoutée ; objectifs de l'acte 1 allongés (7 espèces de l'Anse, 15 prises à l'étang, 17 espèces) ; légendaires et mythiques raréfiés (1 → 0,65 et 0,3 → 0,17) ; marée luisante 7 % → 5,5 % ; récompense de l'acte 3 portée à 5 leurres.

## 9. Accessibilité et confort

Rareté par la couleur **et** la forme ; mode daltonien (motifs sur les raretés et la jauge) ; combat assisté sans pénalité ; mode gaucher ; 4 tailles de texte ; réduction des animations ; vibrations désactivables ; toutes les informations sonores ont un équivalent visuel (« ! », consignes, couleurs et libellés de la jauge) ; zones tactiles de 44 px minimum ; contrastes AA sur les textes ; thème de nuit automatique quand il fait nuit en jeu ; pause automatique en arrière-plan.
