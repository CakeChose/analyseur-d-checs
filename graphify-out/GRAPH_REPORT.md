# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~25,797 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 394 nodes · 1016 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `a1e8714c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cache.ts
- profile.ts
- Workflow de déploiement
- Dépendances npm
- main.ts
- openings-view.ts
- problems.ts
- explain.ts
- calibrate-accuracy.mjs
- Config TypeScript
- renderProfile
- openings-view.ts
- analyseLive
- Classification
- renderLine

## God Nodes (most connected - your core abstractions)
1. `$` - 40 edges
2. `load()` - 25 edges
3. `explainMove()` - 23 edges
4. `show()` - 23 edges
5. `esc()` - 19 edges
6. `renderProfile()` - 16 edges
7. `describeMove()` - 15 edges
8. `runAnalysis()` - 14 edges
9. `renderPuzzle()` - 13 edges
10. `Engine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `startPuzzles()` --calls--> `puzzlePosition()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `analyseLive()` --calls--> `reviewMove()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `load()` --calls--> `reviewGame()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `openFiche()` --calls--> `reviewGame()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `runAnalysis()` --calls--> `reviewGame()`  [EXTRACTED]
  src/main.ts → src/analysis.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (16 total, 1 thin omitted)

### Community 0 - "cache.ts"
Cohesion: 0.18
Nodes (11): cacheAll(), cacheGet(), cachePut(), run(), exportFile(), importFile(), profileUser(), saveUser() (+3 more)

### Community 1 - "profile.ts"
Cohesion: 0.06
Nodes (56): analyseGame(), evaluatePosition(), fastLine(), gameAccuracy(), GameAnalysis, isRecapture(), isSacrifice(), LABELS (+48 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.10
Nodes (23): chessComPlayerExists(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats, accById, BAD, brilliantItems (+15 more)

### Community 5 - "openings-view.ts"
Cohesion: 0.15
Nodes (34): gameId(), fetchChessCom(), applyAnalysis(), finishAnalysis(), importDialog(), linkOf(), load(), loadGames() (+26 more)

### Community 6 - "problems.ts"
Cohesion: 0.14
Nodes (30): profileCauses, profileMistakes, profileName, puzzleTarget(), recordPuzzle(), renderPuzzle(), showPuzzle(), showView() (+22 more)

### Community 7 - "explain.ts"
Cohesion: 0.13
Nodes (39): article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain(), describeMove() (+31 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.11
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "renderProfile"
Cohesion: 0.20
Nodes (18): brilliantHtml(), brilliantsCard(), eloSeries(), eloTrend(), endingsCard(), fact(), heroCard(), mountMiniBoards() (+10 more)

### Community 11 - "openings-view.ts"
Cohesion: 0.09
Nodes (34): board, choosePromotion(), current, go, jumpKeyMoment(), legalDests(), moveSpan(), onUserMove() (+26 more)

### Community 12 - "analyseLive"
Cohesion: 0.23
Nodes (13): formatScore(), analyseLive(), clearEngine(), coachCard(), isBookNode(), moveReviewContent(), puzzleFree(), renderEval() (+5 more)

### Community 13 - "Classification"
Cohesion: 0.33
Nodes (5): Classification, drawGraph(), MARKED, GameSummary, MistakeRecord

### Community 14 - "renderLine"
Cohesion: 0.40
Nodes (5): isInside(), moveNumber(), renderLine(), variationBlock(), deleteNode()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `main.ts`, `explain.ts`, `calibrate-accuracy.mjs`, `openings-view.ts`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05839727195225917 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `openings-view.ts`, `main.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `profile.ts` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._