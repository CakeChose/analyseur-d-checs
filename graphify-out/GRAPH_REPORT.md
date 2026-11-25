# Graph Report - analyseur d'échecs  (2026-11-25)

## Corpus Check
- 23 files · ~55,809 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 343 nodes · 901 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 167,135 input · 0 output

## Graph Freshness
- Built from commit: `8f7c9579`
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
- explain.ts
- Config TypeScript
- openings-view.ts

## God Nodes (most connected - your core abstractions)
1. `$` - 39 edges
2. `load()` - 25 edges
3. `show()` - 23 edges
4. `explainMove()` - 21 edges
5. `esc()` - 16 edges
6. `runAnalysis()` - 14 edges
7. `describeMove()` - 13 edges
8. `renderPuzzle()` - 13 edges
9. `renderProfile()` - 13 edges
10. `Engine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `moveReviewContent()` --calls--> `coachText()`  [EXTRACTED]
  src/main.ts → src/explain.ts
- `onUserMove()` --calls--> `trainingMove()`  [EXTRACTED]
  src/main.ts → src/openings-view.ts
- `onUserMove()` --calls--> `playMove()`  [EXTRACTED]
  src/main.ts → src/tree.ts
- `trainingMove()` --calls--> `show()`  [EXTRACTED]
  src/openings-view.ts → src/main.ts
- `trainingStep()` --calls--> `show()`  [EXTRACTED]
  src/openings-view.ts → src/main.ts

## Import Cycles
- 2-file cycle: `src/main.ts -> src/openings-view.ts -> src/main.ts`
- 2-file cycle: `src/main.ts -> src/problems.ts -> src/main.ts`

## Communities (11 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.09
Nodes (31): GameAnalysis, MoveReview, PositionEval, cacheAll(), cacheGet(), cachePut(), run(), Game (+23 more)

### Community 1 - "Analyse et notes des coups"
Cohesion: 0.12
Nodes (25): analyseGame(), evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook(), materialBalance(), moveAccuracy() (+17 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Dépendances npm"
Cohesion: 0.08
Nodes (24): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+16 more)

### Community 4 - "main.ts"
Cohesion: 0.06
Nodes (54): Classification, drawGraph(), MARKED, fetchChessCom(), fetchChessComStats(), fetchLichess(), OnlineGame, SpeedStats (+46 more)

### Community 5 - "$"
Cohesion: 0.12
Nodes (46): gameId(), analyseLive(), applyAnalysis(), clearEngine(), finishAnalysis(), importDialog(), jumpKeyMoment(), linkOf() (+38 more)

### Community 6 - "problems.ts"
Cohesion: 0.17
Nodes (24): profileCauses, profileMistakes, showView(), startPuzzleQueue(), exoKey(), ExoScore, exoScore(), ExoStats (+16 more)

### Community 7 - "explain.ts"
Cohesion: 0.12
Nodes (39): formatScore(), article(), cap(), CENTER, coachText(), colorName(), defenceRemoved(), describeGain() (+31 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 14 - "openings-view.ts"
Cohesion: 0.13
Nodes (22): board, current, go, profileName, root, CatalogueLine, loadCatalogue(), familyIndex() (+14 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `main.ts`, `explain.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.08558558558558559 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `main.ts`, `openings-view.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.11586452762923351 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Analyse et notes des coups` to `Profil joueur`, `main.ts`, `$`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.07816091954022988 - nodes in this community are weakly interconnected._