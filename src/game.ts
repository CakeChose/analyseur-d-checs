import { Chess, type Move } from 'chess.js';

/** Une partie chargée : les coups joués et la position (FEN) après chacun. */
export interface Game {
  headers: Record<string, string>;
  moves: Move[];
  /** fens[0] = position de départ, fens[i] = position après le coup i. */
  fens: string[];
}

export function parsePgn(pgn: string): Game {
  const chess = new Chess();
  chess.loadPgn(pgn); // lève une erreur si le PGN est invalide
  const moves = chess.history({ verbose: true });
  const fens = [moves.length ? moves[0].before : chess.fen(), ...moves.map((m) => m.after)];
  return { headers: chess.getHeaders(), moves, fens };
}
