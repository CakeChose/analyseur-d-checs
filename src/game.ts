import { Chess, type Move } from 'chess.js';

/** Une partie chargée : les coups joués et la position (FEN) après chacun. */
export interface Game {
  headers: Record<string, string>;
  moves: Move[];
  /** fens[0] = position de départ, fens[i] = position après le coup i. */
  fens: string[];
}

/** Convertit une suite de coups UCI (e2e4, e7e8q…) en notation SAN depuis `fen`. */
export function uciToSan(fen: string, uci: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const u of uci) {
    try {
      san.push(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return san;
}

export function parsePgn(pgn: string): Game {
  const chess = new Chess();
  chess.loadPgn(pgn); // lève une erreur si le PGN est invalide
  const moves = chess.history({ verbose: true });
  const fens = [moves.length ? moves[0].before : chess.fen(), ...moves.map((m) => m.after)];
  return { headers: chess.getHeaders(), moves, fens };
}
