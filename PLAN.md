# Analyseur de parties d'échecs — Plan d'action

Objectif : une alternative locale et gratuite à l'analyse de parties de chess.com.
On donne une partie (PGN), le logiciel l'analyse avec Stockfish, note chaque coup
(Brillant, Excellent, Gaffe…), calcule la précision, et explique les erreurs.

## Choix techniques

### Plateforme : application web (Vite + TypeScript)
- Tourne dans le navigateur, rien à installer, Stockfish compilé en WebAssembly.
- Peut devenir une appli de bureau plus tard avec Tauri sans réécrire.
- C'est l'architecture de l'analyse Lichess : prouvée.

### Moteur : Stockfish WASM (stockfish.js, version 17+ NNUE)
- Exécuté dans un Web Worker pour ne pas bloquer l'interface.
- Protocole UCI : `position fen ...`, `go depth N`, lecture de `info ... score cp/mate ... pv ...`.
- MultiPV 3 : nécessaire pour détecter les coups "Great / seul bon coup" (écart entre 1er et 2e coup).

### Règles et notation : chess.js
- Parsing PGN, génération de FEN, validation des coups, SAN.

### Échiquier : chessground (librairie de Lichess)
- Glisser-déposer, flèches (meilleur coup), surlignage des cases, animations.
- Licence GPL-3 : le projet devient GPL (aucun problème pour un projet perso/open source).

## Modules

### Import de partie
- Coller un PGN.
- Bonus : récupérer ses parties via l'API publique chess.com (`api.chess.com/pub/player/{user}/games/archives`) et l'API Lichess.

### Analyseur de partie (pipeline)
- Pour chaque position de la partie : évaluation Stockfish (profondeur ~18, MultiPV 3).
- Résultats affichés progressivement pendant l'analyse.
- Cache des analyses dans IndexedDB (ne pas réanalyser la même partie).

### Probabilité de gain (win%)
- Conversion centipions -> probabilité de gain : `win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` (formule Lichess).
- Travailler en win% plutôt qu'en centipions : perdre 200 cp à +10 ne compte presque pas, à 0 c'est énorme.

### Précision par coup et par partie
- Précision du coup : `103.1668 * exp(-0.04354 * perte_win%) - 3.1669`, bornée 0–100.
- Précision de la partie : moyenne pondérée (harmonique + pondération par volatilité, méthode Lichess).

### Classification des coups
- Livre (Book) : coup présent dans une base d'ouvertures (fichier ECO / arbre d'ouvertures).
- Meilleur (Best) : coup n°1 du moteur.
- Excellent : perte de win% < 2.
- Bon (Good) : perte < 5.
- Imprécision : perte < 10.
- Erreur : perte < 20.
- Gaffe (Blunder) : perte >= 20.
- Très bon / Seul coup (Great) : meilleur coup ET écart win% avec le 2e coup MultiPV > 10.
- Brillant : bon coup qui sacrifie du matériel (le matériel baisse sur la ligne principale) sans que la position soit déjà totalement gagnante.
- Raté (Miss) : l'adversaire venait de gaffer et le coup joué ne profite pas de l'occasion.
- Les seuils sont des constantes réglables, calibrées en comparant avec des analyses chess.com.

### Barre d'évaluation
- Affiche l'évaluation de la position courante (cp ou mat), animée.

### Graphique d'évaluation
- Courbe de l'évaluation sur toute la partie, cliquable pour naviguer vers un coup.

### Mode exploration (jouer ses propres coups)
- Depuis n'importe quelle position, jouer un autre coup sur l'échiquier.
- Analyse en direct par le moteur, classification du coup essayé.
- Arbre de variantes (la partie principale reste intacte).

### Moteur d'explication
- Couche 1 (règles, fiable) : faits extraits de Stockfish + chess.js :
  - réfutation : "après ton coup, l'adversaire joue X et gagne un cavalier" (différence de matériel sur la ligne principale) ;
  - pièce en prise, menace de mat, fourchette, clouage détectés sur la position ;
  - ce que le meilleur coup obtient (gain de matériel, mat en N, amélioration de win%).
- Couche 2 (optionnelle) : un LLM (API Claude) reformule ces faits en langage naturel.
  - Le LLM reçoit uniquement des faits vérifiés par le moteur : un LLM seul invente des coups aux échecs.

### Interface (UI)
- Échiquier + barre d'éval à gauche, liste des coups annotés avec icônes, explication et graphique à droite.
- Navigation clavier (flèches gauche/droite).
- Icônes et style propres au projet (ne pas copier les visuels de chess.com).

## Idées bonus
- Mode "Réessayer" : rejouer ses erreurs comme des puzzles.
- Moments clés : sauter directement aux gaffes et aux occasions manquées.
- Estimation d'Elo de la partie à partir de la précision.
- Rapport de partie : nombre de coups par catégorie pour chaque joueur.

## Phases
1. Socle : projet Vite + TS, chess.js, chessground, import PGN, navigation dans les coups.
2. Moteur : Worker Stockfish WASM, barre d'évaluation, flèche du meilleur coup en direct.
3. Analyse complète : pipeline, win%, précision, classification, graphique d'évaluation.
4. Mode exploration : jouer ses coups, arbre de variantes, analyse en direct.
5. Explications : couche règles, puis couche LLM optionnelle.
6. Bonus : import chess.com/Lichess, coups de livre, mode Réessayer, moments clés.

## Risques
- Les seuils de classification ne correspondront jamais exactement à chess.com (leur modèle est privé) : on vise "cohérent", pas "identique".
- La détection "Brillant" est la plus subjective : à calibrer sur des exemples.
- Vitesse : Stockfish WASM monothread ~1 s par position à profondeur 18 -> 1 à 2 min pour une partie de 40 coups. Version multithread possible (nécessite les en-têtes COOP/COEP).
