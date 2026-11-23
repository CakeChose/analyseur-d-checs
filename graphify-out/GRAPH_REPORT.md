# Graph Report - analyseur-d-checs  (2026-11-23)

## Corpus Check
- Corpus is ~12,998 words - fits in a single context window. You may not need a graph.

## Summary
- 255 nodes · 541 edges · 10 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Interface principale (main.ts)
- Dépendances npm
- Workflow de déploiement
- Stockage et profil joueur
- Analyse et notes des coups
- Explications des coups
- Page profil
- Moteur Stockfish
- Config TypeScript
- Arbre de coups et fiches

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 15 edges
3. `load()` - 12 edges
4. `Engine` - 11 edges
5. `runAnalysis()` - 11 edges
6. `reviewGame()` - 10 edges
7. `compilerOptions` - 10 edges
8. `summarize()` - 9 edges
9. `renderPuzzle()` - 9 edges
10. `analyseGame()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `load()` --calls--> `parsePgn()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `summarize()` --calls--> `parsePgn()`  [EXTRACTED]
  src/profile.ts → src/game.ts
- `renderEval()` --calls--> `uciToSan()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `renderPuzzle()` --calls--> `uciToSan()`  [EXTRACTED]
  src/main.ts → src/game.ts
- `refreshProfile()` --calls--> `profileStats()`  [EXTRACTED]
  src/main.ts → src/profile.ts

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "Interface principale (main.ts)"
Cohesion: 0.09
Nodes (47): analyseLive(), applyAnalysis(), BAD, board, clearEngine(), engine, estimateElo(), evaluateNode() (+39 more)

### Community 1 - "Dépendances npm"
Cohesion: 0.06
Nodes (31): dependencies, @anthropic-ai/sdk@^1.12.0, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8 (+23 more)

### Community 2 - "Workflow de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 3 - "Stockage et profil joueur"
Cohesion: 0.10
Nodes (27): GameAnalysis, cacheAll(), cacheGet(), cachePut(), run(), Game, gameId(), parseClock() (+19 more)

### Community 4 - "Analyse et notes des coups"
Cohesion: 0.12
Nodes (23): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), isSacrifice(), LABELS, markBook(), materialBalance() (+15 more)

### Community 5 - "Explications des coups"
Cohesion: 0.16
Nodes (24): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+16 more)

### Community 6 - "Page profil"
Cohesion: 0.23
Nodes (13): esc(), exportFile(), importFile(), pct(), profileUser(), refreshProfile(), renderProfile(), runProfile() (+5 more)

### Community 7 - "Moteur Stockfish"
Cohesion: 0.27
Nodes (4): AnalyseOptions, Engine, formatScore(), parseInfo()

### Community 8 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 9 - "Arbre de coups et fiches"
Cohesion: 0.25
Nodes (10): MoveReview, PositionEval, Fiche, buildTree(), deleteNode(), findNode(), mainline(), makeNode() (+2 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Interface principale (main.ts)`, `Stockage et profil joueur`, `Analyse et notes des coups`, `Explications des coups`, `Arbre de coups et fiches`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `Interface principale (main.ts)` be split into smaller, more focused modules?**
  _Cohesion score 0.08897959183673469 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Interface principale (main.ts)`, `Stockage et profil joueur`, `Analyse et notes des coups`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.0620782726045884 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface principale (main.ts)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Workflow de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Stockage et profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._