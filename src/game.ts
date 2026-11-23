import { Chess, type Move } from 'chess.js';

/** Une partie chargée : les coups joués et la position (FEN) après chacun. */
export interface Game {
  headers: Record<string, string>;
  moves: Move[];
  /** fens[0] = position de départ, fens[i] = position après le coup i. */
  fens: string[];
  /** Temps restant (secondes) au joueur après chaque coup, si le PGN contient la pendule (%clk). */
  clocks: (number | undefined)[];
}

/**
 * Identifiant stable d'une partie : son lien (chess.com, Lichess), sinon une empreinte
 * de la position de départ et des coups (PGN collé à la main).
 */
export function gameId(game: Game): string {
  const link = game.headers.Link ?? game.headers.Site;
  if (link?.startsWith('http')) return link;
  let h = 0;
  for (const c of game.fens[0] + game.moves.map((m) => m.san).join(' ')) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return `pgn:${game.moves.length}:${(h >>> 0).toString(36)}`;
}

/** "{[%clk 0:02:31.4]}" → 151.4 secondes */
function parseClock(comment: string | undefined): number | undefined {
  const m = comment?.match(/%clk (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
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
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));
  return { headers: chess.getHeaders(), moves, fens, clocks: moves.map((m) => parseClock(comments.get(m.after))) };
}
