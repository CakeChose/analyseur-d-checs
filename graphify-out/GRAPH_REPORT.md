# Graph Report - analyseur d'échecs  (2026-11-25)

## Corpus Check
- 23 files · ~53,328 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 325 nodes · 845 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `1a2746c9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Profil joueur
- Analyse et notes des coups
- Workflow de déploiement
- Dépendances npm
- main.ts
- $
- problems.ts
- analyseLive
- Config TypeScript
- Arbre de coups
- openings-view.ts

## God Nodes (most connected - your core abstractions)
1. `$` - 39 edges
2. `load()` - 25 edges
3. `show()` - 22 edges
4. `explainMove()` - 16 edges
5. `esc()` - 16 edges
6. `runAnalysis()` - 13 edges
7. `renderPuzzle()` - 13 edges
8. `renderProfile()` - 13 edges
9. `Engine` - 12 edges
10. `renderProblems()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `onUserMove()` --calls--> `playMove()`  [EXTRACTED]
  src/main.ts → src/tree.ts
- `scrollMoveIntoView()` --calls--> `$`  [EXTRACTED]
  src/main.ts → src/ui.ts
- `setEvalBar()` --calls--> `$`  [EXTRACTED]
  src/main.ts → src/ui.ts
- `renderEval()` --calls--> `uciToSan()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `renderEval()` --calls--> `$`  [EXTRACTED]
  src/main.ts → src/ui.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (12 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.07
Nodes (48): cacheAll(), cacheGet(), cachePut(), run(), article(), colorName(), describeGain(), DIRS (+40 more)

### Community 1 - "Analyse et notes des coups"
Cohesion: 0.12
Nodes (20): evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, materialBalance(), moveAccuracy(), onlyGoodMove() (+12 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.07
Nodes (43): Classification, drawGraph(), MARKED, fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats, accById (+35 more)

### Community 5 - "$"
Cohesion: 0.12
Nodes (38): analyseGame(), markBook(), puzzlePosition(), reviewGame(), gameId(), fetchChessCom(), applyAnalysis(), estimateElo() (+30 more)

### Community 6 - "problems.ts"
Cohesion: 0.14
Nodes (29): profileCauses, profileMistakes, puzzleLine(), puzzleMove(), puzzleTarget(), recordPuzzle(), renderPuzzle(), showPuzzle() (+21 more)

### Community 7 - "analyseLive"
Cohesion: 0.36
Nodes (9): formatScore(), analyseLive(), clearEngine(), puzzleFree(), renderEval(), renderReview(), setEvalBar(), setShapes() (+1 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 11 - "Arbre de coups"
Cohesion: 0.33
Nodes (8): MoveReview, PositionEval, Fiche, buildTree(), findNode(), makeNode(), playMove(), TreeNode

### Community 14 - "openings-view.ts"
Cohesion: 0.11
Nodes (28): board, current, go, legalDests(), onUserMove(), profileName, root, scrollMoveIntoView() (+20 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `main.ts`, `Arbre de coups`, `openings-view.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.07474600870827286 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.11954022988505747 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Analyse et notes des coups` to `Profil joueur`, `main.ts`, `$`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._