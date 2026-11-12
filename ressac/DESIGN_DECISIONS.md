# Décisions de conception

Choix faits pendant la réalisation, quand le cahier des charges laissait la question ouverte. Pour chacun : la décision et sa raison.

## Technique

1. **Menus en HTML/CSS au-dessus du canvas Phaser.** Phaser dessine la mer, le ciel, la météo, le bateau, la ligne et les particules ; tout ce qui se lit est en HTML. Texte net à toute densité, défilement natif, *safe areas*, taille de texte réglable, accessibilité, un seul fichier de style. Voir le README.
2. **Monde logique de 390 unités de large**, hauteur variable selon l'écran, canvas en haute définition (jusqu'à ×2,5). Sur ordinateur, le jeu est affiché dans une colonne au ratio portrait (largeur max = 62 % de la hauteur).
3. **Phaser 3.90.0** épinglé exactement ; Vite 7, TypeScript 5.9 strict, Vitest 3, Playwright 1.63 (version du navigateur préinstallé).
4. **Aucune police embarquée** : la police système de l'appareil (San Francisco, Roboto…) est très lisible et ne pèse rien. Aucune licence tierce à citer.
5. **Données en TypeScript typé** plutôt qu'en JSON : le compilateur vérifie chaque espèce, chaque objet et chaque mission ; les tests contrôlent la cohérence entre fichiers.
6. **Météo calculée, pas stockée** : c'est une fonction pure de (graine du monde, zone, créneau de 3 h). Rien à sauvegarder, et elle reste identique après un rechargement.
7. **Service worker généré au build** (petit plugin Vite) plutôt qu'une dépendance : il liste les fichiers produits et les met tous en cache.
8. **Sauvegarde** : copie de secours mise à jour au chargement réussi et au plus toutes les 5 minutes (pour qu'une sauvegarde abîmée ne remplace pas la bonne). IndexedDB sert de miroir, consulté seulement si `localStorage` est vide.
9. **Retour Android** : le jeu garde une entrée d'historique « garde » et traite chaque `popstate` comme un retour logique (ferme la modale, puis l'écran, puis met en pause, puis revient au port, puis à l'accueil). Fonctionne dans le navigateur, en PWA et dans la WebView de Capacitor sans plugin supplémentaire. Échap fait la même chose au clavier.
10. **Interface `Store` pour les achats intégrés** : `src/core/store.ts` définit l'interface et une implémentation vide (`noStore`, qui ne vend rien). Elle n'est appelée nulle part : l'économie est entièrement en monnaie de jeu.
11. **Handle de test `window.ressac`** : exposé pour les tests de bout en bout et le script de captures (lecture de l'état, raccourcis de mise en place). Il ne donne rien de plus que le mode debug.

## Gameplay

12. **Profondeur = distance de lancer × portée de la canne.** Une meilleure canne ouvre réellement de nouvelles espèces dans une zone déjà connue.
13. **Le premier poisson du tutoriel est garanti** (Gobie des galets), son combat ne peut pas être perdu et rater la touche le fait revenir : le joueur ne peut pas rester bloqué. Le tutoriel peut être passé à tout moment, et rejoué depuis les paramètres.
14. **Si le joueur n'a pas assez de pièces pour ses premiers vers**, Hervé avance la différence (une seule fois, pendant le tutoriel).
15. **« Garder » verrouille le poisson** dans le vivier (il ne part pas avec « Tout vendre ») ; « Vendre plus tard » le range normalement ; « Relâcher » donne de la réputation. Fermer la carte avec le bouton retour équivaut à « Vendre plus tard » (ou relâcher si le vivier est plein).
16. **La vente se fait uniquement au port** (chez Jo). En mer, le vivier permet de verrouiller ou relâcher.
17. **Toucher l'écran pendant l'attente remonte la ligne** ; si la touche était imminente, le message dit « Trop tôt ! ».
18. **Fosse** : l'obscurité masque la jauge par intermittence ; le combat assisté la laisse visible (accessibilité d'abord). Les fausses touches et les vibrations restent.
19. **La Veilleuse ne mord qu'au Leurre de Maëlle**, lancé à au moins 55 % de distance dans la Fosse ; avec ce leurre, c'est toujours elle qui mord. C'est la « boss fight » de l'histoire : difficulté maximale (30 s). Le leurre se fabrique ensuite avec un poisson épique, donc on n'est jamais bloqué.
20. **Fatigue du poisson** : passé la durée prévue, la remontée accélère (+150 % par durée supplémentaire). Pas de combat interminable.
21. **Dormir** est toujours possible (pas de limite) : c'est un outil pour choisir l'heure, pas une ressource.
22. **Temps de trajet** : il s'écoule en temps de jeu quand on change de destination ; il n'y a pas d'attente réelle.
23. **Espèces de marée luisante** (Lueur-de-Lune, Feu-follet des saules) : comptées dans le carnet et rattachées à plusieurs zones ; d'où 11 espèces dans certaines zones et 62 au total.
24. **Fiches d'espèces inconnues** : silhouette, rareté, zone, profondeur et un indice (condition stricte ou heure préférée). Les détails complets arrivent à la première prise. Sans indice, la collection complète serait trop opaque.

## Progression et rétention

25. **Une session simulée par jour réel** : les missions du jour (3) et le bonus de connexion se renouvellent à minuit, heure locale. Manquer un jour relance simplement le cycle de 7 jours, sans autre perte.
26. **« Le filet à la traîne »** n'est actif qu'après le tutoriel, à partir de 10 minutes d'absence, plafonné à 8 h, et rapporte peu (22 pièces/h × la meilleure zone ouverte).
27. **Paliers de collection** à récupérer dans le carnet (bouton), avec une notification quand l'un devient disponible.
28. **Notifications différées** : les dialogues d'histoire, nouvelles zones et pages du carnet attendent la fin du combat et de la carte de prise, puis s'affichent l'un après l'autre.

## Présentation

29. **Couleurs de rareté** doublées d'une **forme** (rond, losange, triangle, pentagone, étoile, soleil) partout ; le mode daltonien ajoute des motifs.
30. **Thème de nuit automatique** des écrans quand il fait nuit dans la zone affichée (le carnet garde son papier clair).
31. **Personnages** : Jo à la boutique, Nell à la carte, Hervé pour le tutoriel, les missions et les défis ; le carnet de Maëlle parle avec ses pages.
32. **Transitions** : vague qui recouvre l'écran entre l'accueil, le port et la pêche ; simple fondu en mode « animations réduites ».
