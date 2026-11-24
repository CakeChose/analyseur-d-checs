# Graph Report - analyseur-d-checs  (2026-11-24)

## Corpus Check
- Corpus is ~13,576 words - fits in a single context window. You may not need a graph.

## Summary
- 249 nodes · 491 edges · 18 communities (16 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profil joueur
- Analyse et notes des coups
- Dépendances npm
- Workflow de déploiement
- Explications des coups
- Interface (main.ts)
- Moteur Stockfish
- Workflow de déploiement
- Config TypeScript
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- 
- openings.ts
- Interface (main.ts)

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 14 edges
3. `Engine` - 11 edges
4. `load()` - 11 edges
5. `compilerOptions` - 10 edges
6. `chess.js` - 9 edges
7. `finishAnalysis()` - 8 edges
8. `renderPuzzle()` - 8 edges
9. `analyseGame()` - 7 edges
10. `reviewMove()` - 7 edges

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

## Communities (18 total, 2 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.08
Nodes (35): GameAnalysis, cacheAll(), cacheGet(), cachePut(), run(), gameId(), fetchChessCom(), fetchLichess() (+27 more)

### Community 1 - "Analyse et notes des coups"
Cohesion: 0.11
Nodes (30): chess.js, analyseGame(), Classification, evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook() (+22 more)

### Community 2 - "Dépendances npm"
Cohesion: 0.10
Nodes (21): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+13 more)

### Community 3 - "Workflow de déploiement"
Cohesion: 0.11
Nodes (20): runs-on, steps, environment, needs, runs-on, steps, GITHUB_PAGES, name (+12 more)

### Community 4 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 5 - "Interface (main.ts)"
Cohesion: 0.13
Nodes (15): BAD, board, engine, go, groupCount(), KEY_MOMENTS, LOSS_FILTERS, pct() (+7 more)

### Community 6 - "Moteur Stockfish"
Cohesion: 0.21
Nodes (6): AnalyseOptions, Engine, EngineLine, formatScore(), parseInfo(), winPercent()

### Community 7 - "Workflow de déploiement"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 8 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 9 - "Interface (main.ts)"
Cohesion: 0.29
Nodes (10): esc(), estimateElo(), finishAnalysis(), importDialog(), load(), openFiche(), renderPlayers(), renderReport() (+2 more)

### Community 10 - "Interface (main.ts)"
Cohesion: 0.31
Nodes (9): exportFile(), importFile(), profileUser(), refreshProfile(), runProfile(), saveUser(), showView(), startPuzzleQueue() (+1 more)

### Community 11 - "Interface (main.ts)"
Cohesion: 0.33
Nodes (9): goodAnswers(), jumpKeyMoment(), legalDests(), puzzleMove(), puzzleTarget(), renderPuzzle(), scrollMoveIntoView(), show() (+1 more)

### Community 12 - "Interface (main.ts)"
Cohesion: 0.43
Nodes (7): analyseLive(), evaluateNode(), isBookNode(), renderEval(), renderReview(), setEvalBar(), updateEngine()

### Community 13 - "Interface (main.ts)"
Cohesion: 0.33
Nodes (7): isInside(), moveNumber(), moveSpan(), onUserMove(), renderLine(), renderMoves(), variationBlock()

### Community 15 - "openings.ts"
Cohesion: 0.50
Nodes (3): key(), loadBook(), openingName()

### Community 16 - "Interface (main.ts)"
Cohesion: 0.40
Nodes (5): applyAnalysis(), clearEngine(), renderGraph(), runAnalysis(), setProgress()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Analyse et notes des coups` to `Profil joueur`, `Dépendances npm`, `Explications des coups`, `Interface (main.ts)`, ``?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.1051693404634581 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.10276679841897234 - nodes in this community are weakly interconnected._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._