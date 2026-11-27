# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~25,386 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 393 nodes · 1013 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `c3fd60ec`
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
- renderProfile

## God Nodes (most connected - your core abstractions)
1. `$` - 40 edges
2. `load()` - 25 edges
3. `show()` - 23 edges
4. `explainMove()` - 23 edges
5. `esc()` - 19 edges
6. `renderProfile()` - 16 edges
7. `describeMove()` - 15 edges
8. `runAnalysis()` - 14 edges
9. `Engine` - 13 edges
10. `renderPuzzle()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `showView()` --calls--> `stopTraining()`  [EXTRACTED]
  src/main.ts → src/openings-view.ts
- `openOpenings()` --calls--> `loadProfile()`  [EXTRACTED]
  src/openings-view.ts → src/profile.ts
- `renderOpenings()` --calls--> `pct()`  [EXTRACTED]
  src/openings-view.ts → src/ui.ts
- `renderOpeningLine()` --calls--> `pct()`  [EXTRACTED]
  src/openings-view.ts → src/ui.ts
- `PlayedHere` --calls--> `posKey()`  [EXTRACTED]
  src/openings-view.ts → src/profile.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (12 total, 1 thin omitted)

### Community 0 - "profile.ts"
Cohesion: 0.07
Nodes (43): Classification, MoveReview, PositionEval, cacheAll(), cacheGet(), cachePut(), run(), Game (+35 more)

### Community 1 - "analysis.ts"
Cohesion: 0.11
Nodes (25): analyseGame(), evaluatePosition(), gameAccuracy(), GameAnalysis, isRecapture(), isSacrifice(), LABELS, markBook() (+17 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.07
Nodes (55): formatScore(), drawGraph(), MARKED, chessComPlayerExists(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats (+47 more)

### Community 5 - "openings-view.ts"
Cohesion: 0.08
Nodes (56): gameId(), fetchChessCom(), applyAnalysis(), board, current, finishAnalysis(), go, importDialog() (+48 more)

### Community 6 - "problems.ts"
Cohesion: 0.14
Nodes (30): profileCauses, profileMistakes, profileName, puzzleTarget(), recordPuzzle(), renderPuzzle(), showPuzzle(), showView() (+22 more)

### Community 7 - "explain.ts"
Cohesion: 0.12
Nodes (40): article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain(), describeMove() (+32 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.11
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "renderProfile"
Cohesion: 0.20
Nodes (18): brilliantHtml(), brilliantsCard(), eloSeries(), eloTrend(), endingsCard(), fact(), heroCard(), mountMiniBoards() (+10 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `analysis.ts`, `main.ts`, `openings-view.ts`, `explain.ts`, `calibrate-accuracy.mjs`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06560283687943262 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11092436974789915 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `analysis.ts` to `profile.ts`, `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._