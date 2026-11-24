# Graph Report - analyseur-d-checs  (2026-11-24)

## Corpus Check
- Corpus is ~14,117 words - fits in a single context window. You may not need a graph.

## Summary
- 258 nodes · 516 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profil joueur
- Workflow de déploiement
- Analyse et notes des coups
- Dépendances npm
- Interface (main.ts)
- Arbre de coups
- Explications des coups
- Moteur Stockfish
- Interface (main.ts)
- Config TypeScript
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 14 edges
3. `load()` - 13 edges
4. `Engine` - 11 edges
5. `compilerOptions` - 10 edges
6. `chess.js` - 9 edges
7. `finishAnalysis()` - 8 edges
8. `renderPuzzle()` - 8 edges
9. `refreshProfile()` - 8 edges
10. `analyseGame()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `runAnalysis()` --calls--> `toFiche()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `importFile()` --calls--> `importProfile()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `TreeNode` --references--> `MoveReview`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `TreeNode` --references--> `PositionEval`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `explainMove()` --calls--> `uciToSan()`  [EXTRACTED]
  src/explain.ts → src/game.ts

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.07
Nodes (40): GameAnalysis, cacheAll(), cacheGet(), cachePut(), run(), fetchChessCom(), fetchLichess(), OnlineGame (+32 more)

### Community 1 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 2 - "Analyse et notes des coups"
Cohesion: 0.13
Nodes (22): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook(), materialBalance() (+14 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.10
Nodes (21): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+13 more)

### Community 4 - "Interface (main.ts)"
Cohesion: 0.10
Nodes (21): accById, BAD, board, engine, go, importFile(), KEY_MOMENTS, listGames (+13 more)

### Community 5 - "Arbre de coups"
Cohesion: 0.13
Nodes (15): chess.js, book, MoveReview, PositionEval, Game, gameId(), parseClock(), parsePgn() (+7 more)

### Community 6 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 7 - "Moteur Stockfish"
Cohesion: 0.27
Nodes (4): AnalyseOptions, Engine, formatScore(), parseInfo()

### Community 8 - "Interface (main.ts)"
Cohesion: 0.23
Nodes (12): applyAnalysis(), clearEngine(), estimateElo(), finishAnalysis(), importDialog(), load(), openFiche(), renderGraph() (+4 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "Interface (main.ts)"
Cohesion: 0.31
Nodes (10): goodAnswers(), jumpKeyMoment(), legalDests(), onUserMove(), puzzleMove(), puzzleTarget(), renderPuzzle(), scrollMoveIntoView() (+2 more)

### Community 11 - "Interface (main.ts)"
Cohesion: 0.25
Nodes (9): esc(), groupCount(), linkOf(), pct(), renderGamesList(), renderPlayers(), renderProfile(), resultFor() (+1 more)

### Community 12 - "Interface (main.ts)"
Cohesion: 0.43
Nodes (7): analyseLive(), evaluateNode(), isBookNode(), renderEval(), renderReview(), setEvalBar(), updateEngine()

### Community 13 - "Interface (main.ts)"
Cohesion: 0.40
Nodes (6): isInside(), moveNumber(), moveSpan(), renderLine(), renderMoves(), variationBlock()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Arbre de coups` to `Profil joueur`, `Analyse et notes des coups`, `Dépendances npm`, `Interface (main.ts)`, `Explications des coups`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.07188160676532769 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.10276679841897234 - nodes in this community are weakly interconnected._