# Graph Report - analyseur-d-checs  (2026-11-23)

## Corpus Check
- 9 files · ~16,017 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 314 nodes · 598 edges · 20 communities (11 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.9)
- Token cost: 85,388 input · 0 output

## Community Hubs (Navigation)
- Interface, import et profil
- Explications des coups
- Dépendances npm
- Job de déploiement
- Page HTML et onglets
- Analyse et notes des coups
- Notation et bonus (plan)
- Config TypeScript
- Arbre de coups et fiches
- Moteur Stockfish
- Stockage IndexedDB
- Import de parties
- Barre d'évaluation
- Graphique d'évaluation
- Point d'entrée
- Navigation et moments clés
- Colonne centrale
- Colonne gauche
- Colonne droite
- Organisation du code

## God Nodes (most connected - your core abstractions)
1. `show()` - 17 edges
2. `explainMove()` - 15 edges
3. `load()` - 12 edges
4. `Engine` - 11 edges
5. `runAnalysis()` - 11 edges
6. `compilerOptions` - 10 edges
7. `reviewGame()` - 10 edges
8. `chess.js` - 9 edges
9. `analyseGame()` - 9 edges
10. `gameId()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Échiquier (#board)` --references--> `@lichess-org/chessground`  [INFERRED]
  index.html → package.json
- `Interface trois colonnes` --references--> `@lichess-org/chessground`  [INFERRED]
  PLAN.md → package.json
- `README Analyseur de parties d'échecs` --references--> `@lichess-org/chessground`  [EXTRACTED]
  README.md → package.json
- `Panneau moteur Stockfish 19 (#engine-lines)` --references--> `Stockfish 19 WASM lite single-threaded`  [INFERRED]
  index.html → PLAN.md
- `Vue profil (#view-profil)` --implements--> `Phase 8 : profil du joueur`  [INFERRED]
  index.html → PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Evaluation-to-rating pipeline (win%, accuracy, classification, thresholds)** — plan_win_probability, plan_accuracy, plan_move_classification, plan_thresholds, plan_multipv_3 [INFERRED 0.85]
- **Phase 8 player profile components** — plan_batch_analysis, plan_error_tags, plan_profile_summary, plan_targeted_exercises, plan_game_record_storage, plan_json_export_import [EXTRACTED 1.00]
- **Three-column analysis layout** — index_game_col, index_board_col, index_side_col, index_view_analyse [EXTRACTED 1.00]

## Communities (20 total, 9 thin omitted)

### Community 0 - "Interface, import et profil"
Cohesion: 0.07
Nodes (64): cachePut(), gameId(), fetchChessCom(), fetchLichess(), OnlineGame, analyseLive(), applyAnalysis(), BAD (+56 more)

### Community 1 - "Explications des coups"
Cohesion: 0.09
Nodes (43): article(), colorName(), describeGain(), DIRS, explainMove(), forkTargets(), hangingPieces(), lineText() (+35 more)

### Community 2 - "Dépendances npm"
Cohesion: 0.06
Nodes (29): dependencies, @anthropic-ai/sdk@^1.12.0, chess.js@^1.4.0, stockfish@^19.0.1, devDependencies, typescript@^7.0.2, vite@^8.3.8, license (+21 more)

### Community 3 - "Job de déploiement"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 4 - "Page HTML et onglets"
Cohesion: 0.07
Nodes (32): Clé API Anthropic (#api-key), Échiquier (#board), Sélecteur de profondeur (#depth), Panneau moteur Stockfish 19 (#engine-lines), Formulaire profil (pseudo, parties, cadence, moteurs, export/import), Onglets Analyse / Mon profil, Vue analyse (#view-analyse), Vue profil (#view-profil) (+24 more)

### Community 5 - "Analyse et notes des coups"
Cohesion: 0.10
Nodes (27): analyseGame(), Classification, evaluatePosition(), gameAccuracy(), GameAnalysis, isSacrifice(), LABELS, markBook() (+19 more)

### Community 6 - "Notation et bonus (plan)"
Cohesion: 0.17
Nodes (9): Elo estimé, Rapport de partie, Base d'ouvertures Lichess (CC0), Base de problèmes Lichess (option), Classification des coups (Livre, Meilleur, Gaffe, Brillant…), Mode Réessayer, Risques (seuils, Brillant, vitesse, moteur lite), 8.4 Exercices ciblés (+1 more)

### Community 7 - "Config TypeScript"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 8 - "Arbre de coups et fiches"
Cohesion: 0.25
Nodes (10): MoveReview, PositionEval, Fiche, buildTree(), deleteNode(), findNode(), mainline(), makeNode() (+2 more)

### Community 10 - "Stockage IndexedDB"
Cohesion: 0.50
Nodes (3): cacheAll(), cacheGet(), run()

### Community 11 - "Import de parties"
Cohesion: 0.67
Nodes (3): Import chess.com / Lichess (#online-*), Import PGN (#pgn), Import de partie (PGN, chess.com, Lichess)

## Knowledge Gaps
- **27 isolated node(s):** `Licence GPL-3.0`, `Protocole UCI`, `chess.js`, `Organisation du code src/`, `Base d'ouvertures Lichess (CC0)` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@lichess-org/chessground` connect `Page HTML et onglets` to `Interface, import et profil`, `Dépendances npm`?**
  _High betweenness centrality (0.217) - this node is a cross-community bridge._
- **What connects `Licence GPL-3.0`, `Protocole UCI`, `chess.js` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Interface, import et profil` be split into smaller, more focused modules?**
  _Cohesion score 0.06935908691834942 - nodes in this community are weakly interconnected._
- **Should `Explications des coups` be split into smaller, more focused modules?**
  _Cohesion score 0.08792270531400966 - nodes in this community are weakly interconnected._
- **Should `Dépendances npm` be split into smaller, more focused modules?**
  _Cohesion score 0.06456456456456457 - nodes in this community are weakly interconnected._
- **Should `Job de déploiement` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Page HTML et onglets` be split into smaller, more focused modules?**
  _Cohesion score 0.07196969696969698 - nodes in this community are weakly interconnected._