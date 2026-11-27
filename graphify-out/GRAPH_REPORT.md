# Graph Report - analyseur d'échecs  (2026-11-27)

## Corpus Check
- 23 files · ~57,289 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 353 nodes · 930 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `489cfb26`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- profile.ts
- analysis.ts
- Workflow de déploiement
- Dépendances npm
- main.ts
- $
- problems.ts
- explain.ts
- tree.ts
- Config TypeScript
- $

## God Nodes (most connected - your core abstractions)
1. `$` - 39 edges
2. `load()` - 25 edges
3. `show()` - 23 edges
4. `explainMove()` - 21 edges
5. `esc()` - 18 edges
6. `renderProfile()` - 17 edges
7. `runAnalysis()` - 14 edges
8. `renderPuzzle()` - 13 edges
9. `Engine` - 13 edges
10. `describeMove()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `onUserMove()` --calls--> `playMove()`  [EXTRACTED]
  src/main.ts → src/tree.ts
- `show()` --calls--> `renderBookMoves()`  [EXTRACTED]
  src/main.ts → src/openings-view.ts
- `renderEval()` --calls--> `uciToSan()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `analyseLive()` --calls--> `reviewMove()`  [EXTRACTED]
  src/main.ts → src/analysis.ts
- `analyseLive()` --calls--> `renderBookMoves()`  [EXTRACTED]
  src/main.ts → src/openings-view.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (12 total, 1 thin omitted)

### Community 0 - "profile.ts"
Cohesion: 0.09
Nodes (28): Classification, cacheAll(), cacheGet(), cachePut(), run(), Game, parseClock(), parsePgn() (+20 more)

### Community 1 - "analysis.ts"
Cohesion: 0.11
Nodes (24): analyseGame(), evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook(), materialBalance() (+16 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.06
Nodes (64): chessComPlayerExists(), fetchChessCom(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats, accById, BAD (+56 more)

### Community 5 - "$"
Cohesion: 0.15
Nodes (21): board, current, go, root, CatalogueLine, loadBook(), loadCatalogue(), familyIndex() (+13 more)

### Community 6 - "problems.ts"
Cohesion: 0.16
Nodes (26): profileCauses, profileMistakes, profileName, showView(), startPuzzleQueue(), exoKey(), ExoScore, exoScore() (+18 more)

### Community 7 - "explain.ts"
Cohesion: 0.14
Nodes (35): article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain(), describeMove() (+27 more)

### Community 8 - "tree.ts"
Cohesion: 0.33
Nodes (8): MoveReview, PositionEval, Fiche, buildTree(), findNode(), makeNode(), playMove(), TreeNode

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "$"
Cohesion: 0.11
Nodes (46): formatScore(), gameId(), analyseLive(), applyAnalysis(), clearEngine(), estimateElo(), finishAnalysis(), importDialog() (+38 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `profile.ts`, `analysis.ts`, `main.ts`, `$`, `explain.ts`, `tree.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Should `profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0928030303030303 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `$`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1140819964349376 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `analysis.ts` to `profile.ts`, `$`, `main.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._