# Analyseur de parties d'échecs — Plan d'action

Objectif : une alternative locale et gratuite à l'analyse de parties de chess.com.
On donne une partie (PGN), le logiciel l'analyse avec Stockfish, note chaque coup
(Brillant, Excellent, Gaffe…), calcule la précision, et explique les erreurs.

**État (23/11/2026) : les 6 phases sont terminées et le site est en ligne :
https://cakechose.github.io/analyseur-d-checs/**

## Choix techniques

### Plateforme : application web (Vite + TypeScript)
- Tourne dans le navigateur, rien à installer, Stockfish compilé en WebAssembly.
- Site statique hébergé sur GitHub Pages ; chaque push sur `main` le republie
  (`.github/workflows/deploy.yml`). En local : `npm install` puis `npm run dev`.
- Peut devenir une appli de bureau plus tard avec Tauri sans réécrire.
- C'est l'architecture de l'analyse Lichess : prouvée.

### Moteur : Stockfish 19 WASM, version « lite single-threaded » (paquet npm `stockfish`)
- ~1,8 Mo (la version complète fait 99 Mo, trop lourde à charger) ; plus faible que la
  version complète mais très au-dessus du niveau humain. Aucun en-tête COOP/COEP requis.
- Copié de `node_modules` vers `public/stockfish/` après `npm install` (`scripts/copy-stockfish.mjs`),
  donc absent de git.
- Exécuté dans un Web Worker ; une seule recherche à la fois, une nouvelle position
  arrête la précédente (`src/engine.ts`). Scores ramenés au point de vue des Blancs.
- Protocole UCI : `position fen ...`, `go depth N`, lecture de `info ... score cp/mate ... pv ...`.
- MultiPV 3 : nécessaire pour détecter les coups "Great / seul bon coup" (écart entre 1er et 2e coup).

### Règles et notation : chess.js
- Parsing PGN, génération de FEN, validation des coups, SAN, cases attaquées (tactiques).

### Échiquier : @lichess-org/chessground
- L'ancien paquet `chessground` est abandonné sur npm ; on utilise la version maintenue par Lichess.
- Glisser-déposer, flèches (meilleur coup), surlignage des cases, animations.
- Licence GPL-3 : le projet est GPL (dépôt public).

## Organisation du code (`src/`)

| Fichier | Rôle |
|---|---|
| `main.ts` | Interface : affichage, navigation, analyse, exercices, import |
| `engine.ts` | Pilote UCI de Stockfish |
| `analysis.ts` | Évaluation des positions, notes des coups, précision ; seuils dans `THRESHOLDS` |
| `winprob.ts` | Conversion évaluation → probabilité de gain |
| `tree.ts` | Arbre des coups (partie principale + variantes) |
| `explain.ts` | Explications couche 1 (faits vérifiés) |
| `llm.ts` | Explications couche 2 (Claude, optionnelle) |
| `openings.ts` + `data/openings.json` | Base d'ouvertures (coups de livre, nom de l'ouverture) |
| `import.ts` | Parties chess.com / Lichess |
| `graph.ts` | Graphique d'évaluation |
| `cache.ts` | Cache des analyses (IndexedDB) |
| `game.ts` | Lecture du PGN, conversion UCI → SAN |

## Modules

### Import de partie — fait
- Coller un PGN.
- Récupérer ses 20 dernières parties via l'API publique chess.com
  (`api.chess.com/pub/player/{user}/games/archives`) et l'API Lichess (`/api/games/user/{user}`).

### Analyseur de partie (pipeline) — fait
- Pour chaque position de la partie : évaluation Stockfish (profondeur réglable 12 / 16 / 20, 16 par défaut ; MultiPV 3).
- Résultats affichés progressivement pendant l'analyse (barre de progression).
- Cache des analyses dans IndexedDB : seules les évaluations sont gardées, les notes sont
  recalculées, donc un changement de seuils s'applique aussi aux parties déjà analysées.

### Probabilité de gain (win%) — fait
- Conversion centipions -> probabilité de gain : `win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` (formule Lichess).
- Travailler en win% plutôt qu'en centipions : perdre 200 cp à +10 ne compte presque pas, à 0 c'est énorme.

### Précision par coup et par partie — fait
- Précision du coup : `103.1668 * exp(-0.04354 * perte_win%) - 3.1669`, bornée 0–100.
- Précision de la partie : moyenne pondérée (harmonique + pondération par volatilité, méthode Lichess).

### Classification des coups — fait
- Livre (Book) : la position et toutes celles d'avant sont dans la base d'ouvertures Lichess (CC0).
- Meilleur (Best) : coup n°1 du moteur.
- Excellent : perte de win% < 2.
- Bon (Good) : perte < 5.
- Imprécision : perte < 10.
- Erreur : perte < 20.
- Gaffe (Blunder) : perte >= 20.
- Très bon / Seul coup (Great) : meilleur coup ET écart win% avec le 2e coup MultiPV > 10
  ET le 2e coup ne garde pas une position nettement gagnante (≤ 75 %).
- Brillant : coup quasi parfait (perte < 2) qui sacrifie au moins 2 pions de matériel (mesuré
  après nos reprises sur la ligne du moteur), position pas déjà gagnée (< 97 %) et pas perdante après.
- Raté (Miss) : l'adversaire venait de perdre ≥ 10 points et le coup joué en perd entre 10 et 20
  (une vraie gaffe reste une gaffe).
- Les seuils sont des constantes réglables (`THRESHOLDS`), à calibrer en comparant avec des analyses chess.com.

### Barre d'évaluation — fait
- Affiche l'évaluation de la position courante (en probabilité de gain), animée ; « 1-0 / 0-1 » en cas de mat.

### Graphique d'évaluation — fait
- Courbe de la probabilité de gain sur toute la partie, cliquable, points colorés sur les erreurs et coups brillants.

### Mode exploration (jouer ses propres coups) — fait
- Depuis n'importe quelle position, jouer un autre coup sur l'échiquier (promotion automatique en dame).
- Analyse en direct par le moteur, classification du coup essayé.
- Arbre de variantes (la partie principale reste intacte), sous-variantes, suppression, ↑ pour revenir à la partie.

### Moteur d'explication — fait
- Couche 1 (règles, fiable) : faits extraits de Stockfish + chess.js :
  - réfutation : "l'adversaire répond X et gagne un cavalier" (bilan matériel sur la ligne du moteur) ;
  - pièce en prise, mat forcé, fourchette, clouage (devant le roi ou la dame) ;
  - ce que le meilleur coup obtenait (gain de matériel, mat en N, évaluation) ;
  - sacrifice d'un coup brillant, seul coup, occasion manquée.
- Couche 2 (optionnelle) : Claude (Opus 5.5, via le SDK Anthropic chargé à la demande) reformule ces faits.
  - Clé API fournie par l'utilisateur, gardée dans son navigateur.
  - Le LLM reçoit uniquement des faits vérifiés par le moteur : un LLM seul invente des coups aux échecs.
  - Pas encore testé avec une vraie clé.

### Interface (UI) — fait
- Trois colonnes sur grand écran : partie / bilan / import à gauche, échiquier + barre d'éval au centre,
  commentaire du coup + moteur + liste des coups à droite. Deux colonnes sur écran moyen, une sur téléphone.
- L'échiquier prend la hauteur disponible ; la liste des coups défile seule (le plateau reste visible).
- Navigation clavier (flèches gauche/droite, ↑, Début/Fin).
- Icônes et style propres au projet (ne pas copier les visuels de chess.com).

## Idées bonus — faites
- Mode "Réessayer" : rejouer ses erreurs comme des exercices (moteur masqué, solution à la demande).
- Moments clés : boutons « ‹ Clé / Clé › » pour sauter aux gaffes, erreurs, coups brillants.
- Elo estimé à partir de la précision (simple ordre de grandeur, interpolation sur des repères).
- Rapport de partie : précision et nombre de coups par catégorie pour chaque joueur.

## Phases
1. ~~Socle : projet Vite + TS, chess.js, chessground, import PGN, navigation dans les coups.~~
2. ~~Moteur : Worker Stockfish WASM, barre d'évaluation, flèche du meilleur coup en direct.~~
3. ~~Analyse complète : pipeline, win%, précision, classification, graphique d'évaluation.~~
4. ~~Mode exploration : jouer ses coups, arbre de variantes, analyse en direct.~~
5. ~~Explications : couche règles, puis couche LLM optionnelle.~~
6. ~~Bonus : import chess.com/Lichess, coups de livre, mode Réessayer, moments clés.~~
7. ~~Mise en ligne : GitHub Pages, déploiement automatique.~~

## Pistes pour la suite
- Calibrer les seuils (surtout Brillant et Seul coup) sur des parties analysées par chess.com.
- Tester la couche Claude avec une vraie clé API.
- Choix de la pièce lors d'une promotion (aujourd'hui : dame automatique).
- Version multithread de Stockfish pour analyser plus vite (nécessite les en-têtes COOP/COEP, non disponibles sur GitHub Pages).
- Appli installable (PWA) ou appli de bureau (Tauri).

## Risques
- Les seuils de classification ne correspondront jamais exactement à chess.com (leur modèle est privé) : on vise "cohérent", pas "identique".
- La détection "Brillant" est la plus subjective : à calibrer sur des exemples (aucun sur la partie de l'Opéra de Morphy, la position y étant déjà gagnante).
- Vitesse : Stockfish WASM monothread ~1 s par position -> 1 à 2 min pour une partie de 40 coups.
- Le moteur lite est un peu plus faible que celui de chess.com : de petites différences d'évaluation sont normales.
