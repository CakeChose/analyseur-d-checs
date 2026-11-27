# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~26,635 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 399 nodes · 1041 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `16535d2e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- profile.ts
- analysis.ts
- Workflow de déploiement
- Dépendances npm
- main.ts
- tree.ts
- problems.ts
- explain.ts
- calibrate-accuracy.mjs
- Config TypeScript
- openings-view.ts
- openings-view.ts

## God Nodes (most connected - your core abstractions)
1. `$` - 40 edges
2. `load()` - 25 edges
3. `explainMove()` - 23 edges
4. `show()` - 23 edges
5. `esc()` - 19 edges
6. `coachText()` - 17 edges
7. `renderProfile()` - 16 edges
8. `describeMove()` - 15 edges
9. `runAnalysis()` - 14 edges
10. `Engine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `PositionEval` --references--> `EngineLine`  [EXTRACTED]
  src/analysis.ts → src/engine.ts
- `winsMaterial()` --calls--> `fastLine()`  [EXTRACTED]
  src/profile.ts → src/analysis.ts
- `startPuzzles()` --calls--> `puzzlePosition()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `summarize()` --calls--> `puzzlePosition()`  [EXTRACTED]
  src/profile.ts → src/analysis.ts
- `analyseLive()` --calls--> `reviewMove()`  [EXTRACTED]
  src/main.ts → src/analysis.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (13 total, 1 thin omitted)

### Community 0 - "profile.ts"
Cohesion: 0.08
Nodes (38): GameAnalysis, THRESHOLDS, cacheAll(), cacheGet(), cacheKeys(), cachePut(), run(), summaryAll() (+30 more)

### Community 1 - "analysis.ts"
Cohesion: 0.12
Nodes (24): analyseGame(), evaluatePosition(), fastLine(), gameAccuracy(), isRecapture(), isSacrifice(), LABELS, markBook() (+16 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.06
Nodes (60): Classification, drawGraph(), MARKED, chessComPlayerExists(), fetchChessCom(), fetchChessComStats(), fetchLichess(), OnlineGame (+52 more)

### Community 5 - "tree.ts"
Cohesion: 0.36
Nodes (7): MoveReview, PositionEval, Fiche, buildTree(), findNode(), makeNode(), TreeNode

### Community 6 - "problems.ts"
Cohesion: 0.18
Nodes (24): profileCauses, profileMistakes, showView(), startPuzzleQueue(), exoKey(), ExoScore, exoScore(), ExoStats (+16 more)

### Community 7 - "explain.ts"
Cohesion: 0.12
Nodes (42): formatScore(), article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain() (+34 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.10
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "openings-view.ts"
Cohesion: 0.10
Nodes (24): board, current, go, profileName, root, CatalogueLine, loadCatalogue(), familyIndex() (+16 more)

### Community 11 - "openings-view.ts"
Cohesion: 0.10
Nodes (54): gameId(), analyseLive(), applyAnalysis(), choosePromotion(), clearEngine(), finishAnalysis(), importDialog(), isBookNode() (+46 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `analysis.ts`, `main.ts`, `tree.ts`, `explain.ts`, `calibrate-accuracy.mjs`, `openings-view.ts`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08246225319396051 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `openings-view.ts`, `main.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `analysis.ts` to `profile.ts`, `openings-view.ts`, `main.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._