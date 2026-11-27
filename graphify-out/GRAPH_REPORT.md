# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~24,117 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 379 nodes · 967 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `3d9e882e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- profile.ts
- analysis.ts
- Workflow de déploiement
- Dépendances npm
- main.ts
- openings-view.ts
- problems.ts
- explain.ts
- calibrate-accuracy.mjs
- Config TypeScript
- tree.ts
- analyseLive

## God Nodes (most connected - your core abstractions)
1. `$` - 39 edges
2. `load()` - 25 edges
3. `show()` - 23 edges
4. `explainMove()` - 21 edges
5. `esc()` - 18 edges
6. `renderProfile()` - 16 edges
7. `runAnalysis()` - 14 edges
8. `renderPuzzle()` - 13 edges
9. `Engine` - 13 edges
10. `describeMove()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `PositionEval` --references--> `EngineLine`  [EXTRACTED]
  src/analysis.ts → src/engine.ts
- `evaluateNode()` --calls--> `evaluatePosition()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
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
Nodes (33): Classification, cacheAll(), cacheGet(), cachePut(), run(), Game, parseClock(), parsePgn() (+25 more)

### Community 1 - "analysis.ts"
Cohesion: 0.10
Nodes (26): analyseGame(), evaluatePosition(), gameAccuracy(), GameAnalysis, isRecapture(), isSacrifice(), LABELS, markBook() (+18 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.07
Nodes (51): drawGraph(), MARKED, chessComPlayerExists(), fetchChessCom(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats (+43 more)

### Community 5 - "openings-view.ts"
Cohesion: 0.08
Nodes (63): reviewGame(), gameId(), applyAnalysis(), board, clearEngine(), current, finishAnalysis(), go (+55 more)

### Community 6 - "problems.ts"
Cohesion: 0.16
Nodes (26): profileCauses, profileMistakes, profileName, showView(), startPuzzleQueue(), exoKey(), ExoScore, exoScore() (+18 more)

### Community 7 - "explain.ts"
Cohesion: 0.14
Nodes (35): article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain(), describeMove() (+27 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.10
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "tree.ts"
Cohesion: 0.25
Nodes (10): MoveReview, PositionEval, coachCard(), showLine(), Fiche, buildTree(), findNode(), makeNode() (+2 more)

### Community 11 - "analyseLive"
Cohesion: 0.33
Nodes (10): formatScore(), analyseLive(), evaluateNode(), moveReviewContent(), puzzleFree(), renderEval(), renderReview(), scoreOf() (+2 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `analysis.ts`, `main.ts`, `openings-view.ts`, `explain.ts`, `calibrate-accuracy.mjs`, `tree.ts`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08108108108108109 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10476190476190476 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `analysis.ts` to `profile.ts`, `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._