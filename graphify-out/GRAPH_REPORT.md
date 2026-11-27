# Graph Report - analyseur-d-checs  (2026-11-27)

## Corpus Check
- 23 files · ~24,792 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 386 nodes · 994 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `fc2503ff`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- runAnalysis
- analysis.ts
- Workflow de déploiement
- Dépendances npm
- main.ts
- openings-view.ts
- problems.ts
- explain.ts
- calibrate-accuracy.mjs
- Config TypeScript

## God Nodes (most connected - your core abstractions)
1. `$` - 40 edges
2. `load()` - 25 edges
3. `explainMove()` - 23 edges
4. `show()` - 23 edges
5. `esc()` - 18 edges
6. `renderProfile()` - 16 edges
7. `describeMove()` - 15 edges
8. `runAnalysis()` - 14 edges
9. `renderPuzzle()` - 13 edges
10. `Engine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `explainMove()` --calls--> `formatScore()`  [EXTRACTED]
  src/explain.ts → src/engine.ts
- `moveReviewContent()` --calls--> `coachText()`  [EXTRACTED]
  src/main.ts → src/explain.ts
- `setEvalBar()` --calls--> `$`  [EXTRACTED]
  src/main.ts → src/ui.ts
- `renderEval()` --calls--> `uciToSan()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `renderEval()` --calls--> `$`  [EXTRACTED]
  src/main.ts → src/ui.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (11 total, 1 thin omitted)

### Community 0 - "runAnalysis"
Cohesion: 0.20
Nodes (9): cacheAll(), cacheGet(), cachePut(), run(), Engine, gameId(), runAnalysis(), analyseProfile() (+1 more)

### Community 1 - "analysis.ts"
Cohesion: 0.11
Nodes (31): analyseGame(), evaluatePosition(), gameAccuracy(), isRecapture(), isSacrifice(), LABELS, markBook(), materialBalance() (+23 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.05
Nodes (71): Classification, formatScore(), drawGraph(), MARKED, chessComPlayerExists(), fetchChessCom(), fetchChessComStats(), fetchLichess() (+63 more)

### Community 5 - "openings-view.ts"
Cohesion: 0.08
Nodes (59): applyAnalysis(), board, choosePromotion(), current, finishAnalysis(), go, importDialog(), jumpKeyMoment() (+51 more)

### Community 6 - "problems.ts"
Cohesion: 0.15
Nodes (26): profileCauses, profileMistakes, profileName, recordPuzzle(), startPuzzleQueue(), exoKey(), ExoScore, exoScore() (+18 more)

### Community 7 - "explain.ts"
Cohesion: 0.07
Nodes (64): GameAnalysis, article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain() (+56 more)

### Community 8 - "calibrate-accuracy.mjs"
Cohesion: 0.11
Nodes (15): best, CACHE, CURRENT, DEPTH, Engine, engines, gameAccuracy(), moveAccuracy() (+7 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `analysis.ts`, `main.ts`, `openings-view.ts`, `explain.ts`, `calibrate-accuracy.mjs`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10756302521008404 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `runAnalysis` to `analysis.ts`, `main.ts`, `explain.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05117117117117117 - nodes in this community are weakly interconnected._