# Graph Report - scratch-2026-11-23-3010d9  (2026-11-23)

## Corpus Check
- Corpus is ~881 words - fits in a single context window. You may not need a graph.

## Summary
- 31 nodes · 43 edges · 5 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Moteur et analyse
- Précision et exploration
- Classification des coups
- Plateforme et phases
- Import et explications

## God Nodes (most connected - your core abstractions)
1. `Classification des coups` - 9 edges
2. `Stockfish WASM (17+ NNUE)` - 8 edges
3. `Lichess` - 5 edges
4. `Analyseur de partie (pipeline)` - 5 edges
5. `Web app (Vite + TypeScript)` - 4 edges
6. `chess.com` - 4 edges
7. `Couche 1 : explications par règles` - 4 edges
8. `Analyseur de parties d'échecs` - 3 edges
9. `MultiPV 3` - 3 edges
10. `Import de partie (PGN)` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Analyseur de partie (pipeline)` --conceptually_related_to--> `Classification des coups`  [INFERRED]
  PLAN.md → PLAN.md  _Bridges community 0 → community 2_
- `Web app (Vite + TypeScript)` --references--> `Lichess`  [EXTRACTED]
  PLAN.md → PLAN.md  _Bridges community 3 → community 1_
- `Web app (Vite + TypeScript)` --references--> `Stockfish WASM (17+ NNUE)`  [EXTRACTED]
  PLAN.md → PLAN.md  _Bridges community 3 → community 0_
- `Couche 1 : explications par règles` --references--> `Stockfish WASM (17+ NNUE)`  [EXTRACTED]
  PLAN.md → PLAN.md  _Bridges community 0 → community 4_
- `Import de partie (PGN)` --references--> `Lichess`  [EXTRACTED]
  PLAN.md → PLAN.md  _Bridges community 1 → community 4_

## Hyperedges (group relationships)
- **Frontend tech stack** — plan_vite_typescript_web_app, plan_stockfish_wasm, plan_chess_js, plan_chessground [EXTRACTED 1.00]
- **Eval to win% to accuracy/classification flow** — plan_analysis_pipeline, plan_win_probability, plan_move_accuracy, plan_move_classification [INFERRED 0.85]

## Communities (5 total, 0 thin omitted)

### Community 0 - "Moteur et analyse"
Cohesion: 0.24
Nodes (9): Analyseur de partie (pipeline), Barre d'évaluation, Graphique d'évaluation, Très bon / Seul coup (Great), IndexedDB analysis cache, Stockfish WASM (17+ NNUE), UCI protocol, Interface (UI) (+1 more)

### Community 1 - "Précision et exploration"
Cohesion: 0.40
Nodes (4): Idées bonus (Réessayer, moments clés, Elo, rapport), chessground, Mode exploration (arbre de variantes), Lichess

### Community 2 - "Classification des coups"
Cohesion: 0.50
Nodes (4): Livre (Book) / ECO opening base, Brillant, Raté (Miss), Risques

### Community 3 - "Plateforme et phases"
Cohesion: 0.40
Nodes (5): chess.com, Analyseur de parties d'échecs, Phases 1-6, Tauri, Web app (Vite + TypeScript)

### Community 4 - "Import et explications"
Cohesion: 0.50
Nodes (3): chess.js, Moteur d'explication, Import de partie (PGN)

## Knowledge Gaps
- **8 isolated node(s):** `Tauri`, `Web Worker`, `UCI protocol`, `IndexedDB analysis cache`, `Livre (Book) / ECO opening base` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 8 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Stockfish WASM (17+ NNUE)` connect `Moteur et analyse` to `Classification des coups`, `Plateforme et phases`, `Import et explications`?**
  _High betweenness centrality (0.394) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Analyseur de partie (pipeline)` (e.g. with `Classification des coups` and `Graphique d'évaluation`) actually correct?**
  _`Analyseur de partie (pipeline)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tauri`, `Web Worker`, `UCI protocol` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Why does `Classification des coups` connect `Classification des coups` to `Moteur et analyse`, `Précision et exploration`, `Plateforme et phases`?**
  _High betweenness centrality (0.348) - this node is a cross-community bridge._
- **Why does `Web app (Vite + TypeScript)` connect `Plateforme et phases` to `Moteur et analyse`, `Précision et exploration`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._