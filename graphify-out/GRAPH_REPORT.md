# Graph Report - analyseur-d-checs  (2026-11-23)

## Corpus Check
- Corpus is ~13,580 words - fits in a single context window. You may not need a graph.

## Summary
- 275 nodes · 547 edges · 30 communities (17 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Explications des coups
- Dépendances et échiquier
- Workflow de déploiement
- Analyse et notes des coups
- Interface principale
- Page profil
- Chargement et fiches
- Moteur Stockfish
- Config TypeScript
- Arbre de coups et fiches
- Exercices et jeu sur l'échiquier
- Moteur en direct
- Liste des coups et variantes
- Stockage IndexedDB
- Import en ligne
- Bilan, Elo et exercices
- Onglets
- Point d'entrée
- Clé API Claude
- Colonne centrale
- Sélecteur de profondeur
- Panneau moteur
- Barre d'évaluation
- Colonne gauche
- Graphique
- Navigation
- Formulaire d'import en ligne
- Import PGN
- Formulaire profil
- Colonne droite

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 15 edges
3. `load()` - 12 edges
4. `Engine` - 11 edges
5. `runAnalysis()` - 11 edges
6. `reviewGame()` - 10 edges
7. `compilerOptions` - 10 edges
8. `gameId()` - 9 edges
9. `refreshProfile()` - 9 edges
10. `renderPuzzle()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Échiquier (#board)` --references--> `@lichess-org/chessground`  [INFERRED]
  index.html → package.json
- `README Analyseur de parties d'échecs` --references--> `@lichess-org/chessground`  [EXTRACTED]
  README.md → package.json
- `importProfile()` --calls--> `cachePut()`  [EXTRACTED]
  src/profile.ts → src/cache.ts
- `showPuzzle()` --calls--> `gameId()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `startPuzzles()` --calls--> `gameId()`  [EXTRACTED]
  src/main.ts → src/game.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three-column analysis layout** — index_game_col, index_board_col, index_side_col, index_view_analyse [EXTRACTED 1.00]

## Communities (30 total, 13 thin omitted)

### Community 0 - "Explications des coups"
Cohesion: 0.09
Nodes (40): GameAnalysis, article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces() (+32 more)

### Community 1 - "Dépendances et échiquier"
Cohesion: 0.06
Nodes (34): Échiquier (#board), dependencies, @anthropic-ai/sdk@^1.12.0, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2 (+26 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Analyse et notes des coups"
Cohesion: 0.15
Nodes (19): analyseGame(), evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook(), materialBalance(), moveAccuracy() (+11 more)

### Community 4 - "Interface principale"
Cohesion: 0.12
Nodes (15): Classification, drawGraph(), MARKED, BAD, board, engine, go, KEY_MOMENTS (+7 more)

### Community 5 - "Page profil"
Cohesion: 0.23
Nodes (13): esc(), exportFile(), importFile(), pct(), profileUser(), refreshProfile(), renderProfile(), runProfile() (+5 more)

### Community 6 - "Chargement et fiches"
Cohesion: 0.27
Nodes (12): cachePut(), gameId(), applyAnalysis(), finishAnalysis(), load(), openFiche(), renderGraph(), runAnalysis() (+4 more)

### Community 7 - "Moteur Stockfish"
Cohesion: 0.27
Nodes (4): AnalyseOptions, Engine, formatScore(), parseInfo()

### Community 8 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 9 - "Arbre de coups et fiches"
Cohesion: 0.25
Nodes (10): MoveReview, PositionEval, Fiche, buildTree(), deleteNode(), findNode(), mainline(), makeNode() (+2 more)

### Community 10 - "Exercices et jeu sur l'échiquier"
Cohesion: 0.31
Nodes (10): goodAnswers(), jumpKeyMoment(), legalDests(), onUserMove(), puzzleMove(), puzzleTarget(), renderPuzzle(), scrollMoveIntoView() (+2 more)

### Community 11 - "Moteur en direct"
Cohesion: 0.43
Nodes (7): analyseLive(), clearEngine(), evaluateNode(), isBookNode(), renderEval(), setEvalBar(), updateEngine()

### Community 12 - "Liste des coups et variantes"
Cohesion: 0.40
Nodes (6): isInside(), moveNumber(), moveSpan(), renderLine(), renderMoves(), variationBlock()

### Community 13 - "Stockage IndexedDB"
Cohesion: 0.50
Nodes (3): cacheAll(), cacheGet(), run()

### Community 14 - "Import en ligne"
Cohesion: 0.50
Nodes (4): fetchChessCom(), fetchLichess(), OnlineGame, searchOnline()

### Community 15 - "Bilan, Elo et exercices"
Cohesion: 0.40
Nodes (5): estimateElo(), renderReport(), showView(), startPuzzleQueue(), startPuzzles()

### Community 16 - "Onglets"
Cohesion: 0.67
Nodes (3): Onglets Analyse / Mon profil, Vue analyse (#view-analyse), Vue profil (#view-profil)

## Knowledge Gaps
- **18 isolated node(s):** `Import chess.com / Lichess (#online-*)`, `Import PGN (#pgn)`, `Barre d'évaluation (#evalbar)`, `Graphique (#graph)`, `index.html (page de l'application)` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 94 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances et échiquier` to `Explications des coups`, `Arbre de coups et fiches`, `Analyse et notes des coups`, `Interface principale`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `Import chess.com / Lichess (#online-*)`, `Import PGN (#pgn)`, `Barre d'évaluation (#evalbar)` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Explications des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances et échiquier` to `Interface principale`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Dépendances et échiquier` be split into smaller, more focused modules?**
  _Cohesion score 0.056910569105691054 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Explications des coups`, `Analyse et notes des coups`, `Interface principale`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._