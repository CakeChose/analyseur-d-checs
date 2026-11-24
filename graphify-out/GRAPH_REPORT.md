# Graph Report - analyseur-d-checs  (2026-11-24)

## Corpus Check
- Corpus is ~17,705 words - fits in a single context window. You may not need a graph.

## Summary
- 308 nodes · 649 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profil joueur
- Analyse et notes des coups
- Workflow de déploiement
- Dépendances npm
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Explications des coups
- Interface (main.ts)
- Config TypeScript
- Interface (main.ts)
- Arbre de coups
- Import en ligne
- Interface (main.ts)
- Base et catalogue d'ouvertures
- Interface (main.ts)

## God Nodes (most connected - your core abstractions)
1. `show()` - 21 edges
2. `load()` - 18 edges
3. `explainMove()` - 14 edges
4. `esc()` - 14 edges
5. `renderProfile()` - 12 edges
6. `Engine` - 11 edges
7. `renderPuzzle()` - 11 edges
8. `compilerOptions` - 10 edges
9. `chess.js` - 9 edges
10. `renderProblems()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `TreeNode` --references--> `MoveReview`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `TreeNode` --references--> `PositionEval`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `analyseProfile()` --calls--> `fetchChessCom()`  [EXTRACTED]
  src/profile.ts → src/import.ts
- `explainMove()` --calls--> `uciToSan()`  [EXTRACTED]
  src/explain.ts → src/game.ts
- `lineText()` --calls--> `uciToSan()`  [EXTRACTED]
  src/explain.ts → src/game.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.09
Nodes (32): cacheAll(), cacheGet(), cachePut(), run(), Game, gameId(), parseClock(), parsePgn() (+24 more)

### Community 1 - "Analyse et notes des coups"
Cohesion: 0.10
Nodes (24): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook() (+16 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "Interface (main.ts)"
Cohesion: 0.07
Nodes (26): accById, BAD, board, END_REASONS, engine, ExoScore, ExoStats, ExoStatus (+18 more)

### Community 5 - "Interface (main.ts)"
Cohesion: 0.12
Nodes (27): analyseLive(), applyAnalysis(), clearEngine(), evaluateNode(), isBookNode(), isInside(), jumpKeyMoment(), legalDests() (+19 more)

### Community 6 - "Interface (main.ts)"
Cohesion: 0.19
Nodes (20): exoKey(), exoScore(), exoStats(), exoStatus(), goodAnswers(), openProblems(), openRandomProblems(), puzzleMove() (+12 more)

### Community 7 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 8 - "Interface (main.ts)"
Cohesion: 0.22
Nodes (13): estimateElo(), finishAnalysis(), importDialog(), linkOf(), load(), openFiche(), openListGame(), openOpenings() (+5 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "Interface (main.ts)"
Cohesion: 0.33
Nodes (11): endingsCard(), fact(), groupCount(), opponentCard(), pct(), renderProfile(), resultFor(), shortDate() (+3 more)

### Community 11 - "Arbre de coups"
Cohesion: 0.29
Nodes (9): MoveReview, PositionEval, buildTree(), deleteNode(), findNode(), mainline(), makeNode(), playMove() (+1 more)

### Community 12 - "Import en ligne"
Cohesion: 0.22
Nodes (9): fetchChessCom(), fetchLichess(), OnlineGame, SpeedStats, loadGames(), resultBadge(), searchOnline(), analyseProfile() (+1 more)

### Community 13 - "Interface (main.ts)"
Cohesion: 0.29
Nodes (10): esc(), familyIndex(), lineButton(), linePgn(), renderAllOpenings(), renderBookMoves(), renderOpeningLine(), renderOpenings() (+2 more)

### Community 14 - "Base et catalogue d'ouvertures"
Cohesion: 0.32
Nodes (5): CatalogueLine, key(), loadBook(), loadCatalogue(), openingName()

### Community 15 - "Interface (main.ts)"
Cohesion: 0.33
Nodes (6): fetchChessComStats(), exportFile(), loadChessStats(), profileUser(), refreshProfile(), runProfile()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`, `Explications des coups`, `Arbre de coups`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.10084033613445378 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Analyse et notes des coups` to `Profil joueur`, `Interface (main.ts)`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._