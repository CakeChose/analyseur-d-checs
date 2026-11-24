# Graph Report - analyseur-d-checs  (2026-11-24)

## Corpus Check
- Corpus is ~13,024 words - fits in a single context window. You may not need a graph.

## Summary
- 246 nodes · 482 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Interface (main.ts)
- Profil joueur
- Dépendances npm
- Analyse et notes des coups
- Workflow de déploiement
- Explications des coups
- Arbre de coups
- Workflow de déploiement
- Moteur Stockfish
- Config TypeScript

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 14 edges
3. `Engine` - 11 edges
4. `compilerOptions` - 10 edges
5. `chess.js` - 9 edges
6. `load()` - 9 edges
7. `renderPuzzle()` - 8 edges
8. `analyseGame()` - 7 edges
9. `reviewMove()` - 7 edges
10. `analyseLive()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `TreeNode` --references--> `MoveReview`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `TreeNode` --references--> `PositionEval`  [EXTRACTED]
  src/tree.ts → src/analysis.ts
- `explainMove()` --calls--> `uciToSan()`  [EXTRACTED]
  src/explain.ts → src/game.ts
- `lineText()` --calls--> `uciToSan()`  [EXTRACTED]
  src/explain.ts → src/game.ts

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Interface (main.ts)"
Cohesion: 0.08
Nodes (59): analyseLive(), applyAnalysis(), BAD, board, clearEngine(), engine, esc(), estimateElo() (+51 more)

### Community 1 - "Profil joueur"
Cohesion: 0.08
Nodes (34): GameAnalysis, cacheAll(), cacheGet(), cachePut(), run(), fetchChessCom(), fetchLichess(), OnlineGame (+26 more)

### Community 2 - "Dépendances npm"
Cohesion: 0.08
Nodes (23): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+15 more)

### Community 3 - "Analyse et notes des coups"
Cohesion: 0.13
Nodes (22): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook(), materialBalance() (+14 more)

### Community 4 - "Workflow de déploiement"
Cohesion: 0.11
Nodes (20): runs-on, steps, environment, needs, runs-on, steps, GITHUB_PAGES, name (+12 more)

### Community 5 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 6 - "Arbre de coups"
Cohesion: 0.19
Nodes (13): MoveReview, PositionEval, Game, gameId(), parseClock(), parsePgn(), buildTree(), deleteNode() (+5 more)

### Community 7 - "Workflow de déploiement"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 8 - "Moteur Stockfish"
Cohesion: 0.27
Nodes (4): AnalyseOptions, Engine, formatScore(), parseInfo()

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Interface (main.ts)`, `Profil joueur`, `Analyse et notes des coups`, `Explications des coups`, `Arbre de coups`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `Interface (main.ts)` be split into smaller, more focused modules?**
  _Cohesion score 0.07540983606557378 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Interface (main.ts)`, `Profil joueur`, `Analyse et notes des coups`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.07965860597439545 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.0812807881773399 - nodes in this community are weakly interconnected._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._