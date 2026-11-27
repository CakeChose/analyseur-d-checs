import { Chess, type Move } from 'chess.js';
import type { Engine, EngineLine } from './engine';
import type { Game } from './game';
import { winPercent } from './winprob';
import { openingName } from './openings';

// ---------------------------------------------------------------------------
// Réglages (seuils en points de probabilité de gain perdus par le joueur)
// Calibrés sur 345 coups de 6 parties revues par chess.com (novembre 2026) :
// même note sur 219 coups, contre 191 avec les anciens réglages (2 / 5 / 10 / 20, « Seul coup » à 10).
// ---------------------------------------------------------------------------
export const THRESHOLDS = {
  excellent: 3.5,
  good: 7,
  inaccuracy: 10,
  mistake: 20,
  /** Écart minimal entre le 1er et le 2e coup du moteur pour un « Seul coup ». */
  great: 9,
  /** …et le 2e coup ne doit pas garder une position nettement gagnante (sinon ce n'est pas le « seul »). */
  greatAlternativeMax: 75,
  /** Matériel (en pions) qu'il faut sacrifier pour un « Brillant ». */
  brilliantSacrifice: 2,
  /** Au-delà de cette probabilité de gain, la position est déjà « totalement gagnante ». */
  alreadyWinning: 97,
  /** L'adversaire doit avoir perdu au moins ça au coup d'avant pour parler de « Raté ». */
  missOpportunity: 10,
};

export type Classification =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export const LABELS: Record<Classification, { name: string; symbol: string }> = {
  book: { name: 'Livre', symbol: '📖' },
  brilliant: { name: 'Brillant', symbol: '!!' },
  great: { name: 'Seul coup', symbol: '!' },
  best: { name: 'Meilleur', symbol: '★' },
  excellent: { name: 'Excellent', symbol: '✓' },
  good: { name: 'Bon', symbol: '○' },
  inaccuracy: { name: 'Imprécision', symbol: '?!' },
  mistake: { name: 'Erreur', symbol: '?' },
  miss: { name: 'Raté', symbol: '✗' },
  blunder: { name: 'Gaffe', symbol: '??' },
};

/** Analyse d'une position : lignes du moteur + probabilité de gain des Blancs. */
export interface PositionEval {
  lines: EngineLine[];
  /** Probabilité de gain des Blancs (0–100). */
  win: number;
  /** Partie terminée dans cette position. */
  result?: '1-0' | '0-1' | '1/2-1/2';
}

export interface MoveReview {
  classification: Classification;
  /** Probabilité de gain perdue par le joueur qui a joué (≥ 0). */
  loss: number;
  accuracy: number;
  /** Meilleur coup du moteur dans la position d'avant (UCI). */
  bestUci?: string;
}

export interface GameAnalysis {
  depth: number;
  positions: PositionEval[];
  moves: MoveReview[];
  accuracy: { white: number; black: number };
}

// ---------------------------------------------------------------------------
// Évaluation des positions
// ---------------------------------------------------------------------------

/** Évalue une position : partie finie (mat, pat…) ou recherche Stockfish. */
export async function evaluatePosition(
  engine: Engine,
  fen: string,
  depth: number,
  onUpdate?: (lines: EngineLine[]) => void,
): Promise<PositionEval> {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const whiteWins = chess.turn() === 'b';
    return { lines: [], win: whiteWins ? 100 : 0, result: whiteWins ? '1-0' : '0-1' };
  }
  if (chess.isDraw()) return { lines: [], win: 50, result: '1/2-1/2' };
  const lines = await engine.analyse(fen, { depth, multipv: 3, onUpdate });
  return { lines, win: lines[0] ? winPercent(lines[0]) : 50 };
}

// ---------------------------------------------------------------------------
// Précision (formules Lichess)
// ---------------------------------------------------------------------------

/** Précision d'un coup à partir de la probabilité de gain perdue. */
export function moveAccuracy(loss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

/**
 * Précision de la partie pour chaque camp : moyenne (pondérée par la volatilité
 * de la position) et moyenne harmonique des précisions des coups, à parts égales.
 */
export function gameAccuracy(wins: number[]): { white: number; black: number } {
  const n = wins.length;
  if (n < 2) return { white: 100, black: 100 };
  const size = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const windows: number[][] = [];
  for (let i = 0; i < size - 2; i++) windows.push(wins.slice(0, size));
  for (let i = 0; i + size <= n; i++) windows.push(wins.slice(i, i + size));
  const per: Record<'white' | 'black', { acc: number; w: number }[]> = { white: [], black: [] };
  for (let i = 0; i < n - 1; i++) {
    const white = i % 2 === 0;
    const loss = white ? wins[i] - wins[i + 1] : wins[i + 1] - wins[i];
    const weight = Math.max(0.5, Math.min(12, stdDev(windows[Math.min(i, windows.length - 1)])));
    per[white ? 'white' : 'black'].push({ acc: moveAccuracy(loss), w: weight });
  }
  const combine = (xs: { acc: number; w: number }[]) => {
    if (!xs.length) return 100;
    const weighted = xs.reduce((a, x) => a + x.acc * x.w, 0) / xs.reduce((a, x) => a + x.w, 0);
    const harmonic = xs.length / xs.reduce((a, x) => a + 1 / Math.max(x.acc, 1), 0);
    return (weighted + harmonic) / 2;
  };
  return { white: combine(per.white), black: combine(per.black) };
}

// ---------------------------------------------------------------------------
// Classification des coups
// ---------------------------------------------------------------------------

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Matériel des Blancs moins matériel des Noirs, en pions. */
function materialBalance(chess: Chess): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq) total += (sq.color === 'w' ? 1 : -1) * VALUES[sq.type];
    }
  }
  return total;
}

const toUci = (m: Pick<Move, 'from' | 'to' | 'promotion'>) => m.from + m.to + (m.promotion ?? '');

/**
 * Le coup sacrifie-t-il du matériel ? On rejoue la suite prévue par le moteur
 * et on regarde le bilan matériel après chacun de nos coups suivants
 * (donc après les reprises éventuelles) : s'il baisse d'au moins N pions, c'est un sacrifice.
 */
function isSacrifice(move: Move, after: PositionEval): boolean {
  const sign = move.color === 'w' ? 1 : -1;
  const chess = new Chess(move.before);
  const start = materialBalance(chess) * sign;
  chess.move(move.san);
  let worst = materialBalance(chess) * sign;
  const pv = after.lines[0]?.pv ?? [];
  for (let i = 0; i < Math.min(pv.length, 4); i++) {
    try {
      chess.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] });
    } catch {
      break;
    }
    // i impair = un de nos coups : on mesure après notre reprise éventuelle.
    if (i % 2 === 1 || chess.isGameOver()) worst = Math.min(worst, materialBalance(chess) * sign);
  }
  return start - worst >= THRESHOLDS.brilliantSacrifice;
}

/**
 * Un seul bon coup dans la position (pour le camp `white` ou non) : le 2e coup du moteur perd
 * nettement plus que le 1er et ne garde pas une position gagnante. Sert au « Seul coup » et aux problèmes.
 */
export function onlyGoodMove(before: PositionEval, white: boolean): boolean {
  const [best, second] = before.lines;
  if (!best || !second) return false;
  const pov = (w: number) => (white ? w : 100 - w);
  return (
    pov(winPercent(best)) - pov(winPercent(second)) > THRESHOLDS.great &&
    pov(winPercent(second)) <= THRESHOLDS.greatAlternativeMax
  );
}

/**
 * Position qui peut servir de problème : un seul bon coup, ou un mat que le 2e coup du moteur
 * ne donne plus (même si ce 2e coup reste gagnant, il n'y a qu'une réponse à trouver).
 */
export function puzzlePosition(before: PositionEval, white: boolean): boolean {
  const [best, second] = before.lines;
  const mates = (l: EngineLine) => l.mate !== undefined && (white ? l.mate > 0 : l.mate < 0);
  return onlyGoodMove(before, white) || (!!second && mates(best) && !mates(second));
}

/** Simple reprise de la pièce qui vient d'être prise : coup évident, jamais un « Seul coup » (comme chess.com). */
function isRecapture(move: Move, previousMove: Move | undefined): boolean {
  return !!previousMove?.captured && !!move.captured && move.to === previousMove.to;
}

export function reviewMove(
  move: Move,
  before: PositionEval,
  after: PositionEval,
  previous: MoveReview | undefined,
  previousMove?: Move,
): MoveReview {
  const white = move.color === 'w';
  const pov = (w: number) => (white ? w : 100 - w);
  const winBefore = pov(before.win);
  const winAfter = pov(after.win);
  const loss = Math.max(0, winBefore - winAfter);
  const best = before.lines[0];
  const bestUci = best?.pv[0];
  const played = toUci(move);
  const isBest = played === bestUci;
  const T = THRESHOLDS;

  let classification: Classification;
  if (isBest) classification = 'best';
  else if (loss < T.excellent) classification = 'excellent';
  else if (loss < T.good) classification = 'good';
  else if (loss < T.inaccuracy) classification = 'inaccuracy';
  else if (loss < T.mistake) classification = 'mistake';
  else classification = 'blunder';

  if (loss < T.excellent) {
    if (isSacrifice(move, after) && winBefore < T.alreadyWinning && winAfter >= 50) {
      classification = 'brilliant';
    } else if (isBest && onlyGoodMove(before, white) && !isRecapture(move, previousMove)) {
      classification = 'great';
    }
  }

  // L'adversaire vient de se tromper et on ne profite pas de l'occasion. Comme chess.com,
  // même une grosse perte devient « Raté » (17 « Raté » sur 20 retrouvés, contre 7 avec une limite à 20).
  if (previous && previous.loss >= T.missOpportunity && loss >= T.inaccuracy) {
    classification = 'miss';
  }

  return { classification, loss, accuracy: moveAccuracy(loss), bestUci };
}

/** Coup de livre : la position atteinte est dans la base d'ouvertures, comme toutes celles d'avant. */
function markBook(game: Game, moves: MoveReview[], i: number) {
  if (openingName(game.fens[i + 1]) && (i === 0 || moves[i - 1].classification === 'book')) {
    moves[i].classification = 'book';
  }
}

/** Note chaque coup et calcule la précision à partir des positions évaluées. */
export function reviewGame(game: Game, positions: PositionEval[], depth: number): GameAnalysis {
  const moves: MoveReview[] = [];
  game.moves.forEach((move, i) => {
    moves.push(reviewMove(move, positions[i], positions[i + 1], moves[i - 1], game.moves[i - 1]));
    markBook(game, moves, i);
  });
  return { depth, positions, moves, accuracy: gameAccuracy(positions.map((p) => p.win)) };
}

/**
 * Analyse complète : évalue les positions en parallèle sur `engines` et note chaque coup
 * dès que la position d'avant et celle d'après sont connues (affichage progressif via `onProgress`).
 */
export async function analyseGame(
  engines: Engine[],
  game: Game,
  depth: number,
  onProgress: (positions: PositionEval[], moves: MoveReview[], done: number) => void,
  isCancelled: () => boolean,
): Promise<GameAnalysis | null> {
  // Les positions sont indépendantes : chaque moteur (un cœur chacun) prend la suivante.
  // (Des blocs de positions consécutives par moteur n'allaient pas plus vite : 33 s contre 30 s.)
  const total = game.fens.length;
  let next = 0;
  const evals: (PositionEval | undefined)[] = new Array(total);
  const positions: PositionEval[] = [];
  const moves: MoveReview[] = [];
  let done = 0;
  /** Note les coups dans l'ordre, dès que la position d'avant et celle d'après sont connues. */
  const flush = () => {
    while (positions.length < total && evals[positions.length]) {
      positions.push(evals[positions.length]!);
      const i = positions.length - 1;
      if (i > 0) {
        moves.push(reviewMove(game.moves[i - 1], positions[i - 1], positions[i], moves[i - 2], game.moves[i - 2]));
        markBook(game, moves, i - 1);
      }
    }
    onProgress(positions, moves, done);
  };
  const worker = async (engine: Engine) => {
    while (next < total && !isCancelled()) {
      const i = next++;
      evals[i] = await evaluatePosition(engine, game.fens[i], depth);
      if (isCancelled()) return;
      done++;
      flush();
    }
  };
  await Promise.all(engines.map(worker));
  if (isCancelled() || positions.length < evals.length) return null;
  return { depth, positions, moves, accuracy: gameAccuracy(positions.map((p) => p.win)) };
}
