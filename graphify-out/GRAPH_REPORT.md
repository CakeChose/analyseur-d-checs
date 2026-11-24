# Graph Report - analyseur-d-checs  (2026-11-24)

## Corpus Check
- Corpus is ~15,902 words - fits in a single context window. You may not need a graph.

## Summary
- 283 nodes · 584 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profil joueur
- Workflow de déploiement
- Dépendances npm
- Analyse et notes des coups
- Interface (main.ts)
- Interface (main.ts)
- Explications des coups
- Arbre de coups
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Moteur Stockfish
- Config TypeScript
- Base et catalogue d'ouvertures
- Interface (main.ts)

## God Nodes (most connected - your core abstractions)
1. `show()` - 21 edges
2. `load()` - 16 edges
3. `explainMove()` - 14 edges
4. `Engine` - 11 edges
5. `renderPuzzle()` - 11 edges
6. `compilerOptions` - 10 edges
7. `esc()` - 10 edges
8. `chess.js` - 9 edges
9. `analyseLive()` - 8 edges
10. `finishAnalysis()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runAnalysis()` --calls--> `loadBook()`  [EXTRACTED]
  src/main.ts → src/openings.ts
- `openFiche()` --calls--> `loadBook()`  [EXTRACTED]
  src/main.ts → src/openings.ts
- `refreshProfile()` --calls--> `loadBook()`  [EXTRACTED]
  src/main.ts → src/openings.ts
- `runProfile()` --calls--> `loadBook()`  [EXTRACTED]
  src/main.ts → src/openings.ts
- `renderBookMoves()` --calls--> `openingName()`  [EXTRACTED]
  src/main.ts → src/openings.ts

## Import Cycles
- None detected.

## Communities (16 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.08
Nodes (33): cacheAll(), cacheGet(), cachePut(), run(), fetchChessCom(), fetchLichess(), OnlineGame, analyseProfile() (+25 more)

### Community 1 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 2 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 3 - "Analyse et notes des coups"
Cohesion: 0.15
Nodes (20): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook() (+12 more)

### Community 4 - "Interface (main.ts)"
Cohesion: 0.09
Nodes (21): accById, BAD, board, engine, ExoStats, exportFile(), go, KEY_MOMENTS (+13 more)

### Community 5 - "Interface (main.ts)"
Cohesion: 0.15
Nodes (21): analyseLive(), evaluateNode(), isInside(), jumpKeyMoment(), legalDests(), moveNumber(), moveSpan(), onUserMove() (+13 more)

### Community 6 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 7 - "Arbre de coups"
Cohesion: 0.19
Nodes (13): MoveReview, PositionEval, Game, gameId(), parseClock(), parsePgn(), buildTree(), deleteNode() (+5 more)

### Community 8 - "Interface (main.ts)"
Cohesion: 0.21
Nodes (15): exoKey(), exoStats(), goodAnswers(), importFile(), openProblems(), puzzleMove(), puzzleTarget(), recordExo() (+7 more)

### Community 9 - "Interface (main.ts)"
Cohesion: 0.20
Nodes (14): applyAnalysis(), clearEngine(), estimateElo(), finishAnalysis(), importDialog(), load(), openFiche(), openOpenings() (+6 more)

### Community 10 - "Interface (main.ts)"
Cohesion: 0.23
Nodes (12): esc(), familyIndex(), lineButton(), linePgn(), pct(), renderAllOpenings(), renderBookMoves(), renderOpeningLine() (+4 more)

### Community 11 - "Moteur Stockfish"
Cohesion: 0.27
Nodes (4): AnalyseOptions, Engine, formatScore(), parseInfo()

### Community 12 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 13 - "Base et catalogue d'ouvertures"
Cohesion: 0.32
Nodes (6): isBookNode(), showOpening(), CatalogueLine, key(), loadBook(), openingName()

### Community 14 - "Interface (main.ts)"
Cohesion: 0.29
Nodes (8): groupCount(), linkOf(), loadGames(), refreshProfile(), renderGamesList(), renderProfile(), resultFor(), sparkline()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`, `Explications des coups`, `Arbre de coups`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.08408408408408409 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._
- **Should `Interface (main.ts)` be split into smaller, more focused modules?**
  _Cohesion score 0.09486166007905138 - nodes in this community are weakly interconnected._