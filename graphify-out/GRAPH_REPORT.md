# Graph Report - analyseur-d-checs  (2026-11-23)

## Corpus Check
- 19 files · ~13,237 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 257 nodes · 508 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profil joueur
- Dépendances npm
- Analyse et notes des coups
- Interface (main.ts)
- Workflow de déploiement
- Explications des coups
- Arbre de coups
- Interface (main.ts)
- Workflow de déploiement
- Config TypeScript
- Interface (main.ts)
- Explications par Claude (llm.ts)
- Moteur Stockfish
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)
- Interface (main.ts)

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 14 edges
3. `Engine` - 11 edges
4. `compilerOptions` - 10 edges
5. `chess.js` - 9 edges
6. `refreshProfile()` - 9 edges
7. `load()` - 9 edges
8. `Explications par Claude (llm.ts)` - 8 edges
9. `renderPuzzle()` - 8 edges
10. `analyseGame()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `runAnalysis()` --calls--> `toFiche()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `refreshProfile()` --calls--> `loadProfile()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `refreshProfile()` --calls--> `profileStats()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `runProfile()` --calls--> `analyseProfile()`  [EXTRACTED]
  src/main.ts → src/profile.ts
- `TreeNode` --references--> `MoveReview`  [EXTRACTED]
  src/tree.ts → src/analysis.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "Profil joueur"
Cohesion: 0.09
Nodes (29): cacheAll(), cacheGet(), cachePut(), run(), key(), loadBook(), openingName(), BAD (+21 more)

### Community 1 - "Dépendances npm"
Cohesion: 0.08
Nodes (23): dependencies, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+15 more)

### Community 2 - "Analyse et notes des coups"
Cohesion: 0.13
Nodes (22): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook() (+14 more)

### Community 3 - "Interface (main.ts)"
Cohesion: 0.10
Nodes (18): fetchChessCom(), fetchLichess(), OnlineGame, BAD, board, engine, go, KEY_MOMENTS (+10 more)

### Community 4 - "Workflow de déploiement"
Cohesion: 0.11
Nodes (20): runs-on, steps, environment, needs, runs-on, steps, GITHUB_PAGES, name (+12 more)

### Community 5 - "Explications des coups"
Cohesion: 0.21
Nodes (17): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+9 more)

### Community 6 - "Arbre de coups"
Cohesion: 0.19
Nodes (13): MoveReview, PositionEval, Game, gameId(), parseClock(), parsePgn(), buildTree(), deleteNode() (+5 more)

### Community 7 - "Interface (main.ts)"
Cohesion: 0.22
Nodes (14): applyAnalysis(), clearEngine(), finishAnalysis(), jumpKeyMoment(), legalDests(), load(), openFiche(), renderGraph() (+6 more)

### Community 8 - "Workflow de déploiement"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 9 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 10 - "Interface (main.ts)"
Cohesion: 0.25
Nodes (11): esc(), exportFile(), importFile(), pct(), profileUser(), refreshProfile(), renderProfile(), runProfile() (+3 more)

### Community 11 - "Explications par Claude (llm.ts)"
Cohesion: 0.24
Nodes (9): @anthropic-ai/sdk@^1.12.0, @anthropic-ai/sdk, Explications par Claude (llm.ts), cache, getApiKey(), loadSdk(), MODEL, rephrase() (+1 more)

### Community 13 - "Interface (main.ts)"
Cohesion: 0.43
Nodes (7): analyseLive(), evaluateNode(), isBookNode(), renderEval(), renderReview(), setEvalBar(), updateEngine()

### Community 14 - "Interface (main.ts)"
Cohesion: 0.33
Nodes (7): isInside(), moveNumber(), moveSpan(), onUserMove(), renderLine(), renderMoves(), variationBlock()

### Community 15 - "Interface (main.ts)"
Cohesion: 0.40
Nodes (5): estimateElo(), renderReport(), showView(), startPuzzleQueue(), startPuzzles()

### Community 16 - "Interface (main.ts)"
Cohesion: 0.60
Nodes (5): goodAnswers(), puzzleMove(), puzzleTarget(), renderPuzzle(), showPuzzle()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `chess.js` connect `Dépendances npm` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`, `Explications des coups`, `Arbre de coups`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `Profil joueur` be split into smaller, more focused modules?**
  _Cohesion score 0.08912655971479501 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Moteur Stockfish` to `Profil joueur`, `Analyse et notes des coups`, `Interface (main.ts)`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.0812807881773399 - nodes in this community are weakly interconnected._
- **Why does `@lichess-org/chessground` connect `Dépendances npm` to `Interface (main.ts)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.13230769230769232 - nodes in this community are weakly interconnected._
- **Should `Interface (main.ts)` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._