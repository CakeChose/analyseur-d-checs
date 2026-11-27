# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~26,281 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 398 nodes · 1033 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `e71fd2e5`
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
- analyseLive

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
- `runAnalysis()` --calls--> `cachePut()`  [EXTRACTED]
  src/main.ts → src/cache.ts
- `analyseProfile()` --calls--> `cachePut()`  [EXTRACTED]
  src/profile.ts → src/cache.ts
- `winsMaterial()` --calls--> `fastLine()`  [EXTRACTED]
  src/profile.ts → src/analysis.ts
- `winsMaterial()` --calls--> `netCaptures()`  [EXTRACTED]
  src/profile.ts → src/explain.ts
- `tagsFor()` --calls--> `mateFor()`  [EXTRACTED]
  src/profile.ts → src/explain.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (13 total, 1 thin omitted)

### Community 0 - "profile.ts"
Cohesion: 0.09
Nodes (36): GameAnalysis, THRESHOLDS, cacheAll(), cacheGet(), cacheKeys(), cachePut(), run(), summaryAll() (+28 more)

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
Nodes (54): Classification, drawGraph(), MARKED, chessComPlayerExists(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats (+46 more)

### Community 5 - "tree.ts"
Cohesion: 0.24
Nodes (10): MoveReview, PositionEval, Game, parseClock(), parsePgn(), Fiche, buildTree(), findNode() (+2 more)

### Community 6 - "problems.ts"
Cohesion: 0.14
Nodes (30): profileCauses, profileMistakes, profileName, puzzleTarget(), recordPuzzle(), renderPuzzle(), showPuzzle(), showView() (+22 more)

### Community 7 - "explain.ts"
Cohesion: 0.13
Nodes (38): article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain(), describeMove() (+30 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.10
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 11 - "openings-view.ts"
Cohesion: 0.07
Nodes (70): gameId(), fetchChessCom(), applyAnalysis(), board, choosePromotion(), clearEngine(), coachCard(), current (+62 more)

### Community 12 - "analyseLive"
Cohesion: 0.31
Nodes (10): formatScore(), analyseLive(), isBookNode(), moveReviewContent(), puzzleFree(), renderEval(), renderReview(), scoreOf() (+2 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `analysis.ts`, `main.ts`, `tree.ts`, `explain.ts`, `calibrate-accuracy.mjs`, `openings-view.ts`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09041835357624832 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `openings-view.ts`, `main.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11942959001782531 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `analysis.ts` to `profile.ts`, `openings-view.ts`, `main.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._