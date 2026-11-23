# Analyseur de parties d'échecs

Une alternative locale et gratuite à l'analyse de parties de chess.com, qui tourne
entièrement dans le navigateur avec Stockfish 19 (WebAssembly).

**En ligne : https://cakechose.github.io/analyseur-d-checs/**

- Import d'une partie (PGN) ou de tes dernières parties chess.com / Lichess
- Analyse complète : note de chaque coup (Brillant, Meilleur… Gaffe), précision, graphique
- Explications des erreurs à partir des calculs du moteur
- Variantes jouées sur l'échiquier, moments clés, mode « Réessayer mes erreurs »

## Lancer en local

```
npm install
npm run dev
```

Le plan du projet est dans [PLAN.md](PLAN.md).

Licence GPL-3.0 (l'échiquier vient de [chessground](https://github.com/lichess-org/chessground)).
Base d'ouvertures : [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
