# Graph Report - analyseur d'échecs  (2026-11-25)

## Corpus Check
- 23 files · ~53,263 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 324 nodes · 841 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `a3a77914`
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
- Config TypeScript
- Arbre de coups
- openings-view.ts

## God Nodes (most connected - your core abstractions)
1. `$` - 38 edges
2. `load()` - 25 edges
3. `show()` - 22 edges
4. `explainMove()` - 16 edges
5. `esc()` - 16 edges
6. `runAnalysis()` - 13 edges
7. `renderPuzzle()` - 13 edges
8. `renderProfile()` - 13 edges
9. `renderProblems()` - 12 edges
10. `Engine` - 12 edges

## Surprising Connections (you probably didn't know these)
- `PositionEval` --references--> `EngineLine`  [EXTRACTED]
  src/analysis.ts → src/engine.ts
- `startPuzzles()` --calls--> `puzzlePosition()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `summarize()` --calls--> `puzzlePosition()`  [EXTRACTED]
  src/profile.ts → src/analysis.ts
- `analyseLive()` --calls--> `reviewMove()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `markBook()` --calls--> `openingName()`  [EXTRACTED]
  src/analysis.ts → src/openings.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (11 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.08
Nodes (48): cacheAll(), cacheGet(), cachePut(), run(), article(), colorName(), describeGain(), DIRS (+40 more)

### Community 1 - "Analyse et notes des coups"
Cohesion: 0.11
Nodes (25): analyseGame(), evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook(), materialBalance() (+17 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.07
Nodes (47): Classification, drawGraph(), MARKED, fetchChessCom(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats (+39 more)

### Community 5 - "$"
Cohesion: 0.16
Nodes (32): gameId(), applyAnalysis(), clearEngine(), finishAnalysis(), importDialog(), linkOf(), load(), openFiche() (+24 more)

### Community 6 - "problems.ts"
Cohesion: 0.14
Nodes (28): profileCauses, profileMistakes, profileName, puzzleMove(), recordPuzzle(), renderPuzzle(), showView(), startPuzzleQueue() (+20 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 11 - "Arbre de coups"
Cohesion: 0.33
Nodes (8): MoveReview, PositionEval, Fiche, buildTree(), findNode(), makeNode(), playMove(), TreeNode

### Community 14 - "openings-view.ts"
Cohesion: 0.10
Nodes (34): formatScore(), analyseLive(), board, current, go, isBookNode(), jumpKeyMoment(), legalDests() (+26 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `main.ts`, `Arbre de coups`, `openings-view.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.07619738751814223 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.11260504201680673 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Analyse et notes des coups` to `Profil joueur`, `main.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._