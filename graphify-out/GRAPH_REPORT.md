# Graph Report - analyseur-d-checs  (2026-11-23)

## Corpus Check
- Corpus is ~11,182 words - fits in a single context window. You may not need a graph.

## Summary
- 254 nodes · 464 edges · 11 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.83)
- Token cost: 81,747 input · 0 output

## Community Hubs (Navigation)
- Interface et import
- Dépendances npm
- Fonctionnalités du plan
- Analyse et notes des coups
- Explications des coups
- Job de déploiement
- Pipeline et explications (plan)
- Workflow GitHub Pages
- Config TypeScript
- Partie et arbre de coups
- Cache IndexedDB

## God Nodes (most connected - your core abstractions)
1. `explainMove()` - 16 edges
2. `show()` - 15 edges
3. `Engine` - 10 edges
4. `runAnalysis()` - 10 edges
5. `load()` - 10 edges
6. `compilerOptions` - 10 edges
7. `reviewMove()` - 9 edges
8. `chess.js` - 8 edges
9. `uciToSan()` - 8 edges
10. `analyseLive()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Colonne centrale (échiquier, evalbar, nav, graph)` --implements--> `Barre d'évaluation`  [INFERRED]
  index.html → PLAN.md
- `Colonne centrale (échiquier, evalbar, nav, graph)` --implements--> `Mode exploration / arbre de variantes`  [INFERRED]
  index.html → PLAN.md
- `index.html (structure de l'app)` --implements--> `Interface trois colonnes`  [INFERRED]
  index.html → PLAN.md
- `Colonne centrale (échiquier, evalbar, nav, graph)` --implements--> `Moments clés`  [INFERRED]
  index.html → PLAN.md
- `TreeNode` --references--> `PositionEval`  [EXTRACTED]
  src/tree.ts → src/analysis.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne évaluation vers notes des coups** — plan_stockfish_wasm_lite, plan_win_probability, plan_move_accuracy, plan_move_classification, plan_analysis_pipeline [EXTRACTED 1.00]
- **Explications à deux couches (moteur + Claude)** — plan_explanation_layer1, plan_explanation_layer2_claude, plan_src_explain_ts, plan_src_llm_ts, index_api_key_form [INFERRED 0.85]
- **Import de partie (PGN, chess.com, Lichess)** — plan_src_import_ts, plan_chesscom_public_api, plan_lichess_games_api, index_online_import_form, index_pgn_import [INFERRED 0.85]

## Communities (11 total, 0 thin omitted)

### Community 0 - "Interface et import"
Cohesion: 0.08
Nodes (48): Classification, GameAnalysis, LABELS, drawGraph(), MARKED, fetchChessCom(), fetchLichess(), OnlineGame (+40 more)

### Community 1 - "Dépendances npm"
Cohesion: 0.06
Nodes (33): dependencies, @anthropic-ai/sdk@^1.12.0, chess.js@^1.4.0, @lichess-org/chessground@^10.5.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8 (+25 more)

### Community 2 - "Fonctionnalités du plan"
Cohesion: 0.08
Nodes (27): index.html (structure de l'app), Colonne centrale (échiquier, evalbar, nav, graph), Colonne droite (review, moteur, coups), Analyseur de parties d'échecs (plan), @lichess-org/chessground, Elo estimé, Barre d'évaluation, Graphique d'évaluation (+19 more)

### Community 3 - "Analyse et notes des coups"
Cohesion: 0.14
Nodes (18): analyseGame(), evaluatePosition(), gameAccuracy(), isSacrifice(), materialBalance(), moveAccuracy(), PositionEval, reviewGame() (+10 more)

### Community 4 - "Explications des coups"
Cohesion: 0.16
Nodes (23): formatScore(), article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces() (+15 more)

### Community 5 - "Job de déploiement"
Cohesion: 0.11
Nodes (20): runs-on, steps, environment, needs, runs-on, steps, GITHUB_PAGES, name (+12 more)

### Community 6 - "Pipeline et explications (plan)"
Cohesion: 0.13
Nodes (13): Clé API Anthropic (#api-key), Sélecteur de profondeur (12/16/20), Colonne gauche (partie, analyse, import), Formulaire import chess.com / Lichess, Import PGN (textarea #pgn), chess.js, API publique chess.com, API Lichess /api/games/user (+5 more)

### Community 7 - "Workflow GitHub Pages"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 8 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 9 - "Partie et arbre de coups"
Cohesion: 0.29
Nodes (8): MoveReview, Game, parsePgn(), buildTree(), findNode(), makeNode(), playMove(), TreeNode

### Community 10 - "Cache IndexedDB"
Cohesion: 0.60
Nodes (3): cacheGet(), cachePut(), run()

## Knowledge Gaps
- **12 isolated node(s):** `Protocole UCI`, `MultiPV 3`, `src/tree.ts (arbre des coups)`, `src/explain.ts (explications couche 1)`, `src/openings.ts + data/openings.json` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 77 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Probabilité de gain (win%, formule Lichess)` connect `Fonctionnalités du plan` to `Analyse et notes des coups`?**
  _High betweenness centrality (0.237) - this node is a cross-community bridge._
- **What connects `Protocole UCI`, `MultiPV 3`, `src/tree.ts (arbre des coups)` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Interface et import` be split into smaller, more focused modules?**
  _Cohesion score 0.07756813417190776 - nodes in this community are weakly interconnected._
- **Why does `chess.js` connect `Dépendances npm` to `Interface et import`, `Partie et arbre de coups`, `Analyse et notes des coups`, `Explications des coups`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.05975609756097561 - nodes in this community are weakly interconnected._
- **Should `Fonctionnalités du plan` be split into smaller, more focused modules?**
  _Cohesion score 0.08387096774193549 - nodes in this community are weakly interconnected._
- **Should `Analyse et notes des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._