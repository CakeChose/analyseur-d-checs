/**
 * Moteur d'explication, couche 1 : des faits vérifiés, tirés de Stockfish
 * (les lignes calculées) et de chess.js (les règles). Rien n'est inventé.
 */
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { EngineLine } from './engine';
import type { TreeNode } from './tree';
import { uciToSan } from './game';
import { formatScore } from './engine';

const NAMES: Record<PieceSymbol, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};
const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const article = (p: PieceSymbol) => (p === 'q' || p === 'r' ? 'la ' : 'le ');
const un = (p: PieceSymbol) => (p === 'q' || p === 'r' ? 'une ' : 'un ');

/** "un cavalier et deux pions" */
function listPieces(pieces: PieceSymbol[]): string {
  const counts = new Map<PieceSymbol, number>();
  for (const p of pieces) counts.set(p, (counts.get(p) ?? 0) + 1);
  const words = ['', '', 'deux', 'trois', 'quatre', 'cinq'];
  const parts = [...counts.entries()]
    .sort((a, b) => VALUES[b[0]] - VALUES[a[0]])
    .map(([p, n]) => (n === 1 ? un(p) + NAMES[p] : `${words[n] ?? n} ${NAMES[p]}s`));
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts.at(-1) : parts[0] ?? '';
}

/** Joue une ligne UCI ; renvoie les coups joués (s'arrête au premier coup invalide). */
function playLine(fen: string, uci: string[], max: number): Move[] {
  const chess = new Chess(fen);
  const out: Move[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      out.push(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Bilan des prises sur une ligne, pour le camp `who` : pièces gagnées
 * moins pièces perdues (les échanges de même type s'annulent).
 */
function netCaptures(moves: Move[], who: Color): { won: PieceSymbol[]; lost: PieceSymbol[] } {
  const won: PieceSymbol[] = [];
  const lost: PieceSymbol[] = [];
  for (const m of moves) {
    if (!m.captured) continue;
    (m.color === who ? won : lost).push(m.captured);
  }
  // Les prises de même type s'annulent (échange cavalier contre cavalier…).
  for (let i = won.length - 1; i >= 0; i--) {
    const j = lost.indexOf(won[i]);
    if (j >= 0) {
      won.splice(i, 1);
      lost.splice(j, 1);
    }
  }
  const value = (xs: PieceSymbol[]) => xs.reduce((a, p) => a + VALUES[p], 0);
  // Seul le solde compte : un fou contre un cavalier n'est pas un gain,
  // et prendre un pion en perdant un cavalier n'en est pas un non plus.
  if (value(won) - value(lost) < 1) return { won: [], lost: [] };
  return { won, lost };
}

/** "un cavalier", ou "un cavalier contre un pion" s'il y a eu des prises en retour. */
function describeGain(c: { won: PieceSymbol[]; lost: PieceSymbol[] }): string {
  return listPieces(c.won) + (c.lost.length ? ` contre ${listPieces(c.lost)}` : '');
}

const lineText = (fen: string, uci: string[], n = 6) => uciToSan(fen, uci.slice(0, n)).join(' ');

/** Mat pour le camp `who` dans cette ligne ? (score toujours du point de vue des Blancs) */
function mateFor(line: EngineLine | undefined, who: Color): number | undefined {
  if (line?.mate === undefined) return undefined;
  const m = who === 'w' ? line.mate : -line.mate;
  return m > 0 ? m : undefined;
}

/** "blanc", "noire"… accordé avec la pièce. */
const colorName = (c: Color, p: PieceSymbol) => {
  const fem = p === 'q' || p === 'r';
  return c === 'w' ? (fem ? 'blanche' : 'blanc') : fem ? 'noire' : 'noir';
};

/** Pièces du camp `who` attaquées et mal défendues dans la position. */
function hangingPieces(chess: Chess, who: Color): { sq: Square; type: PieceSymbol }[] {
  const them: Color = who === 'w' ? 'b' : 'w';
  const out: { sq: Square; type: PieceSymbol }[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== who || p.type === 'k') continue;
      const attackers = chess.attackers(p.square, them);
      if (!attackers.length) continue;
      const defended = chess.attackers(p.square, who).length > 0;
      const cheapest = Math.min(...attackers.map((s) => VALUES[chess.get(s)!.type]));
      if (!defended || cheapest < VALUES[p.type]) out.push({ sq: p.square, type: p.type });
    }
  }
  return out.sort((a, b) => VALUES[b.type] - VALUES[a.type]);
}

/** La pièce qui vient de jouer attaque-t-elle plusieurs cibles de valeur ? (fourchette) */
function forkTargets(chess: Chess, move: Move): PieceSymbol[] {
  const them: Color = move.color === 'w' ? 'b' : 'w';
  const targets: PieceSymbol[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== them) continue;
      if (p.type === 'p' || !chess.attackers(p.square, move.color).includes(move.to)) continue;
      const defended = chess.attackers(p.square, them).length > 0;
      if (p.type === 'k' || VALUES[p.type] > VALUES[move.piece] || !defended) targets.push(p.type);
    }
  }
  return targets.length >= 2 ? targets : [];
}

const DIRS: Record<'b' | 'r', [number, number][]> = {
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
};

/** Clouage créé par la pièce qui vient de jouer : pièce clouée et pièce derrière. */
function pinByMove(chess: Chess, move: Move): { pinned: Square; type: PieceSymbol; behind: PieceSymbol } | null {
  const type = move.piece;
  const dirs = type === 'b' ? DIRS.b : type === 'r' ? DIRS.r : type === 'q' ? [...DIRS.b, ...DIRS.r] : [];
  const file = move.to.charCodeAt(0) - 97;
  const rank = Number(move.to[1]) - 1;
  for (const [df, dr] of dirs) {
    const seen: { sq: Square; type: PieceSymbol; color: Color }[] = [];
    for (let f = file + df, r = rank + dr; f >= 0 && f < 8 && r >= 0 && r < 8; f += df, r += dr) {
      const sq = (String.fromCharCode(97 + f) + (r + 1)) as Square;
      const p = chess.get(sq);
      if (!p) continue;
      seen.push({ sq, type: p.type, color: p.color });
      if (seen.length === 2) break;
    }
    const [first, second] = seen;
    if (
      first &&
      second &&
      first.color !== move.color &&
      second.color !== move.color &&
      first.type !== 'k' &&
      // Un clouage n'a d'intérêt que devant le roi ou la dame (et pas pour un simple pion).
      (second.type === 'k' || (second.type === 'q' && first.type !== 'p')) &&
      VALUES[second.type] > VALUES[first.type]
    ) {
      return { pinned: first.sq, type: first.type, behind: second.type };
    }
  }
  return null;
}

/**
 * Faits expliquant le coup qui mène à `node` (phrases en français).
 * Nécessite que le coup ait été noté (node.review) et les deux positions évaluées.
 */
export function explainMove(node: TreeNode): string[] {
  const move = node.move;
  const parent = node.parent;
  const review = node.review;
  if (!move || !parent || !review) return [];
  const facts: string[] = [];
  const me = move.color;
  const them: Color = me === 'w' ? 'b' : 'w';
  const after = new Chess(node.fen);
  const before = parent.eval;
  const afterEval = node.eval;
  const bestLine = before?.lines[0];
  const bestSan = review.bestUci ? uciToSan(parent.fen, [review.bestUci])[0] : undefined;
  const bad = ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(review.classification);

  if (after.isCheckmate()) return ['Échec et mat : la partie est gagnée.'];

  // --- Ce que fait le coup joué --------------------------------------------
  if (review.classification === 'brilliant' && afterEval?.lines[0]) {
    const line = playLine(node.fen, afterEval.lines[0].pv, 4);
    const { lost } = netCaptures([move, ...line], me);
    if (lost.length) {
      facts.push(
        `${move.san} sacrifie ${listPieces(lost)} : la suite ${lineText(node.fen, afterEval.lines[0].pv)} montre que ce sacrifice est payant.`,
      );
    }
  }
  const myMate = mateFor(afterEval?.lines[0], me);
  if (myMate) {
    facts.push(`Après ${move.san}, il y a un mat forcé en ${myMate} : ${lineText(node.fen, afterEval!.lines[0].pv, myMate * 2)}.`);
  }
  if (move.captured && !bad) {
    facts.push(`${move.san} prend ${article(move.captured)}${NAMES[move.captured]} ${colorName(them, move.captured)}.`);
  }
  const fork = forkTargets(after, move);
  if (fork.length) {
    facts.push(
      `${move.san} est une fourchette : ${article(move.piece)}${NAMES[move.piece]} attaque ${fork.map((p) => article(p) + NAMES[p]).join(' et ')} en même temps.`,
    );
  }
  const pin = pinByMove(after, move);
  if (pin) {
    facts.push(
      pin.behind === 'k'
        ? `${move.san} cloue ${article(pin.type)}${NAMES[pin.type]} en ${pin.pinned} : il ne peut plus bouger, le roi est derrière.`
        : `${move.san} cloue ${article(pin.type)}${NAMES[pin.type]} en ${pin.pinned} : s'il bouge, la dame derrière sera prise.`,
    );
  }
  if (review.classification === 'great' && before?.lines[1]) {
    const second = before.lines[1];
    facts.push(
      `C'était le seul bon coup : le deuxième choix du moteur, ${uciToSan(parent.fen, [second.pv[0]])[0]}, ne donnait que ${formatScore(second)}.`,
    );
  }

  // --- Ce qui ne va pas avec le coup joué ----------------------------------
  if (bad && afterEval?.lines[0]) {
    const reply = afterEval.lines[0];
    const theirMate = mateFor(reply, them);
    const replySan = uciToSan(node.fen, reply.pv.slice(0, 1))[0];
    if (theirMate) {
      facts.push(`Après ${move.san}, l'adversaire a un mat en ${theirMate} : ${lineText(node.fen, reply.pv, theirMate * 2)}.`);
    } else {
      const line = playLine(node.fen, reply.pv, 6);
      const gain = netCaptures([move, ...line], them);
      if (gain.won.length && replySan) {
        facts.push(
          `L'adversaire répond ${replySan} et gagne ${describeGain(gain)} (suite probable : ${lineText(node.fen, reply.pv)}).`,
        );
      } else if (replySan) {
        facts.push(
          `La meilleure réponse est ${replySan} (suite probable : ${lineText(node.fen, reply.pv)}) ; l'évaluation passe de ${before?.lines[0] ? formatScore(before.lines[0]) : '?'} à ${formatScore(reply)}.`,
        );
      }
    }
    const hanging = hangingPieces(after, me).filter((h) => h.sq !== move.from);
    if (hanging.length && !theirMate) {
      const h = hanging[0];
      facts.push(`${article(h.type)[0].toUpperCase() + article(h.type).slice(1)}${NAMES[h.type]} ${colorName(me, h.type)} en ${h.sq} est en prise.`);
    }
  }

  // --- Le meilleur coup ------------------------------------------------------
  if (bad && bestLine && bestSan && bestSan !== move.san) {
    const mate = mateFor(bestLine, me);
    const line = playLine(parent.fen, bestLine.pv, 6);
    const gain = netCaptures(line, me);
    if (mate) {
      facts.push(`Le meilleur coup était ${bestSan}, avec un mat en ${mate} : ${lineText(parent.fen, bestLine.pv, mate * 2)}.`);
    } else if (gain.won.length) {
      facts.push(`Le meilleur coup était ${bestSan}, qui gagnait ${describeGain(gain)} : ${lineText(parent.fen, bestLine.pv)}.`);
    } else {
      facts.push(`Le meilleur coup était ${bestSan} (${formatScore(bestLine)}) : ${lineText(parent.fen, bestLine.pv)}.`);
    }
    if (review.classification === 'miss' && parent.move) {
      facts.push(`L'adversaire venait de se tromper avec ${parent.move.san}, et ${bestSan} permettait d'en profiter.`);
    }
  } else if (['best', 'excellent', 'good'].includes(review.classification) && !facts.length) {
    if (review.classification === 'best') facts.push(`${move.san} est le coup que le moteur préfère.`);
    else if (bestSan) facts.push(`Le moteur préférait ${bestSan}, mais ${move.san} est ${review.classification === 'excellent' ? 'presque aussi bon' : 'correct'}.`);
  }
  return facts;
}
