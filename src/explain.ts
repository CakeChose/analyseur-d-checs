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
export function playLine(fen: string, uci: string[], max: number): Move[] {
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
export function netCaptures(moves: Move[], who: Color): { won: PieceSymbol[]; lost: PieceSymbol[] } {
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
export function mateFor(line: EngineLine | undefined, who: Color): number | undefined {
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
export function forkTargets(chess: Chess, move: Move): PieceSymbol[] {
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
export function pinByMove(chess: Chess, move: Move): { pinned: Square; type: PieceSymbol; behind: PieceSymbol } | null {
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
 * La suite `pv` du camp `who` aboutit-elle depuis `fen` ? Un mat en `mate` coups si c'est
 * un mat, sinon un gain de matériel. Faux si la suite n'est pas jouable en entier :
 * sinon une prise isolée (« Rxd5 ») compterait comme un gain alors que la reprise n'est pas jouée.
 */
function lineWorks(fen: string, pv: string[], who: Color, mate?: number): boolean {
  try {
    const n = Math.min(pv.length, mate ? 2 * mate - 1 : 6);
    const moves = playLine(fen, pv, n);
    if (moves.length < n || moves[0]?.color !== who) return false;
    if (mate) return new Chess(moves.at(-1)!.after).isCheckmate();
    return netCaptures(moves, who).won.length > 0;
  } catch {
    return false; // position impossible (roi en échec du camp qui n'a pas le trait…)
  }
}

/** Même position, mais c'est à `who` de jouer : pour voir ce qu'il menaçait déjà. */
function withTurn(fen: string, who: Color): string {
  const f = fen.split(' ');
  f[1] = who;
  f[3] = '-';
  return f.join(' ');
}

/** Pièce que le coup laisse en prise alors qu'elle était défendue par la pièce qui vient de bouger. */
function defenceRemoved(beforeFen: string, after: Chess, move: Move): { sq: Square; type: PieceSymbol } | undefined {
  const before = new Chess(beforeFen);
  const wasHanging = new Set(hangingPieces(before, move.color).map((h) => h.sq));
  return hangingPieces(after, move.color).find(
    (h) => h.sq !== move.to && !wasHanging.has(h.sq) && before.attackers(h.sq, move.color).includes(move.from),
  );
}

/** Choix stable d'une tournure (toujours la même pour une position donnée) : le texte ne change pas à chaque affichage. */
function pick(seed: string, options: string[]): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return options[Math.abs(h) % options.length];
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const ton = (p: PieceSymbol) => (p === 'q' || p === 'r' ? 'ta ' : 'ton ');

/**
 * Explication du coup qui mène à `node` : le détail des faits, plus, pour un coup fautif, sa cause
 * principale, ce que le meilleur coup apportait et la menace qu'il empêchait (pour le coach).
 * Nécessite que le coup ait été noté (node.review) et les deux positions évaluées.
 */
export function explainMove(node: TreeNode): { facts: string[]; cause?: string; better?: string; stops?: string } {
  const move = node.move;
  const parent = node.parent;
  const review = node.review;
  if (!move || !parent || !review) return { facts: [] };
  const facts: string[] = [];
  const me = move.color;
  const them: Color = me === 'w' ? 'b' : 'w';
  const after = new Chess(node.fen);
  const before = parent.eval;
  const afterEval = node.eval;
  const bestLine = before?.lines[0];
  const bestSan = review.bestUci ? uciToSan(parent.fen, [review.bestUci])[0] : undefined;
  const bad = ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(review.classification);

  if (after.isCheckmate()) return { facts: ['Échec et mat : la partie est gagnée.'] };

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
  /** Cause principale, pour la synthèse (« tu n'as pas paré la menace Qxf7# »). */
  let cause = '';
  /** La suite gagnante de l'adversaire, si elle existait déjà avant le coup (menace ignorée). */
  let threat: { pv: string[]; san: string; mate?: number } | undefined;
  if (bad && afterEval?.lines[0]) {
    const reply = afterEval.lines[0];
    const theirMate = mateFor(reply, them);
    const replySan = uciToSan(node.fen, reply.pv.slice(0, 1))[0];
    const gain = theirMate ? undefined : netCaptures([move, ...playLine(node.fen, reply.pv, 6)], them);
    const winning = !!replySan && (!!theirMate || !!gain?.won.length);
    // La même suite marchait-elle déjà si l'adversaire avait eu le trait avant ton coup ?
    if (winning && lineWorks(withTurn(parent.fen, them), reply.pv, them, theirMate)) {
      threat = { pv: reply.pv, san: replySan, mate: theirMate };
    }
    const lostDefence = theirMate ? undefined : defenceRemoved(parent.fen, after, move);
    if (theirMate) {
      facts.push(
        pick(node.fen, [
          `Après ${move.san}, l'adversaire a un mat en ${theirMate} : ${lineText(node.fen, reply.pv, theirMate * 2)}.`,
          `${move.san} permet à l'adversaire de mater en ${theirMate} : ${lineText(node.fen, reply.pv, theirMate * 2)}.`,
        ]),
      );
      cause = threat
        ? `tu n'as pas paré la menace de mat ${replySan}`
        : `${move.san} permet un mat en ${theirMate} (${replySan})`;
    } else if (gain?.won.length && replySan) {
      facts.push(
        pick(node.fen, [
          `L'adversaire répond ${replySan} et gagne ${describeGain(gain)} (suite probable : ${lineText(node.fen, reply.pv)}).`,
          `Sur ${replySan}, tu perds ${describeGain(gain)} (suite probable : ${lineText(node.fen, reply.pv)}).`,
        ]),
      );
      cause = threat
        ? `tu n'as pas paré la menace ${replySan}, qui gagne ${describeGain(gain)}`
        : lostDefence
          ? `${move.san} retire la défense de ${ton(lostDefence.type)}${NAMES[lostDefence.type]} en ${lostDefence.sq}`
          : `${move.san} perd ${describeGain(gain)}`;
    } else if (replySan) {
      facts.push(
        `La meilleure réponse est ${replySan} (suite probable : ${lineText(node.fen, reply.pv)}) ; l'évaluation passe de ${before?.lines[0] ? formatScore(before.lines[0]) : '?'} à ${formatScore(reply)}.`,
      );
    }
    if (threat) {
      facts.push(`${replySan} était déjà une menace avant ${move.san} : ton coup ne s'en occupe pas.`);
    }
    // Le bilan sur 6 demi-coups peut s'arrêter avant une reprise : le défenseur retiré reste la cause.
    if (!cause && lostDefence) cause = `${move.san} retire la défense de ${ton(lostDefence.type)}${NAMES[lostDefence.type]} en ${lostDefence.sq}`;
    if (lostDefence) {
      facts.push(
        `En jouant ${move.san}, ${article(move.piece)}${NAMES[move.piece]} ne défend plus ${article(lostDefence.type)}${NAMES[lostDefence.type]} en ${lostDefence.sq}, qui se retrouve en prise.`,
      );
    } else if (!theirMate) {
      const h = hangingPieces(after, me).filter((x) => x.sq !== move.from)[0];
      if (h) facts.push(`${cap(article(h.type))}${NAMES[h.type]} ${colorName(me, h.type)} en ${h.sq} est en prise.`);
    }
  }

  // --- Le meilleur coup ------------------------------------------------------
  let better = '';
  /** `better` ne fait que nommer le meilleur coup (déjà affiché sous le verdict). */
  let generic = false;
  /** Menace que le meilleur coup empêchait (coup en notation), pour la carte du meilleur coup. */
  let stopsSan: string | undefined;
  if (bad && bestLine && bestSan && bestSan !== move.san) {
    const mate = mateFor(bestLine, me);
    const line = playLine(parent.fen, bestLine.pv, 6);
    const gain = netCaptures(line, me);
    // Le meilleur coup empêchait-il la menace que le coup joué a laissée ?
    const stops = threat && line[0] && !lineWorks(line[0].after, threat.pv, them, threat.mate);
    if (stops) stopsSan = threat!.san;
    if (mate) {
      facts.push(`Le meilleur coup était ${bestSan}, avec un mat en ${mate} : ${lineText(parent.fen, bestLine.pv, mate * 2)}.`);
      better = pick(parent.fen, [`tu avais un mat en ${mate} avec ${bestSan}`, `${bestSan} matait en ${mate}`]);
    } else if (gain.won.length) {
      facts.push(`Le meilleur coup était ${bestSan}, qui gagnait ${describeGain(gain)} : ${lineText(parent.fen, bestLine.pv)}.`);
      better = `${bestSan} gagnait ${describeGain(gain)}`;
    } else if (stops) {
      facts.push(`Le meilleur coup était ${bestSan}, qui empêchait ${threat!.san} : ${lineText(parent.fen, bestLine.pv)}.`);
    } else {
      facts.push(`Le meilleur coup était ${bestSan} (${formatScore(bestLine)}) : ${lineText(parent.fen, bestLine.pv)}.`);
    }
    if (!better) {
      generic = !stops;
      better = stops
        ? pick(parent.fen, [`il fallait ${bestSan}, qui l'empêchait`, `${bestSan} l'empêchait`])
        : pick(parent.fen, [`il fallait jouer ${bestSan}`, `mieux valait ${bestSan}`, `le bon coup était ${bestSan}`]);
    }
    if (review.classification === 'miss' && parent.move) {
      facts.push(`L'adversaire venait de se tromper avec ${parent.move.san}, et ${bestSan} permettait d'en profiter.`);
    }
  } else if (['best', 'excellent', 'good'].includes(review.classification) && !facts.length) {
    if (review.classification === 'best') facts.push(`${move.san} est le coup que le moteur préfère.`);
    else if (bestSan) facts.push(`Le moteur préférait ${bestSan}, mais ${move.san} est ${review.classification === 'excellent' ? 'presque aussi bon' : 'correct'}.`);
  }

  // Sans cause trouvée, « le bon coup était Qd1 » ne dit rien de plus que la carte du meilleur coup.
  return { facts, cause: cause || undefined, better: better && !generic ? better : undefined, stops: stopsSan };
}

// ---------------------------------------------------------------------------
// Coach : une phrase sur le coup joué, une sur le meilleur coup
// ---------------------------------------------------------------------------

/** Cases de départ des pièces mineures (pour « développe »). */
const START: Partial<Record<Square, PieceSymbol>> = { b1: 'n', g1: 'n', c1: 'b', f1: 'b', b8: 'n', g8: 'n', c8: 'b', f8: 'b' };
const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'];

/** Aucun pion sur la colonne. */
const openFile = (chess: Chess, file: string) =>
  [1, 2, 3, 4, 5, 6, 7, 8].every((r) => chess.get(`${file}${r}` as Square)?.type !== 'p');

/** Pion passé : aucun pion adverse devant lui, sur sa colonne ou les colonnes voisines. */
function isPassed(chess: Chess, sq: Square, who: Color): boolean {
  const f = sq.charCodeAt(0);
  const r = Number(sq[1]);
  for (const ff of [f - 1, f, f + 1]) {
    if (ff < 97 || ff > 104) continue;
    for (let rr = who === 'w' ? r + 1 : r - 1; rr >= 1 && rr <= 8; rr += who === 'w' ? 1 : -1) {
      const p = chess.get(`${String.fromCharCode(ff)}${rr}` as Square);
      if (p?.type === 'p' && p.color !== who) return false;
    }
  }
  return true;
}

/** Un coup qui mate tout de suite depuis `fen`, en notation (« Qxf7# »), s'il y en a un. */
function mateInOne(fen: string): string | undefined {
  try {
    const chess = new Chess(fen);
    for (const m of chess.moves()) {
      chess.move(m);
      const mate = chess.isCheckmate();
      chess.undo();
      if (mate) return m;
    }
  } catch {
    /* position impossible (camp qui n'a pas le trait en échec…) */
  }
  return undefined;
}

/**
 * Ce que fait un coup, pour compléter « Ce coup … » (le plus marquant d'abord) :
 * mat, promotion, roque, fourchette, clouage, prise, échec, attaque, défense, développement…
 */
export function describeMove(fenBefore: string, move: Move): string {
  const before = new Chess(fenBefore);
  const after = new Chess(move.after);
  const me = move.color;
  const them: Color = me === 'w' ? 'b' : 'w';
  const p = move.piece;
  if (after.isCheckmate()) return 'donne échec et mat';
  if (move.promotion) return `promeut un pion en ${NAMES[move.promotion]}`;
  if (move.flags.includes('k') || move.flags.includes('q')) return 'met ton roi à l\'abri en roquant';
  const fork = forkTargets(after, move);
  const pin = pinByMove(after, move);
  const mateNext = after.inCheck() ? undefined : mateInOne(withTurn(move.after, me));
  // Ce que le coup menace en plus (mat, fourchette, clouage), à ajouter après une prise.
  const threat = mateNext
    ? `menace ${mateNext}, échec et mat`
    : fork.length
    ? `attaque ${fork.map((x) => article(x) + NAMES[x]).join(' et ')} en même temps`
    : pin
      ? `cloue ${article(pin.type)}${NAMES[pin.type]} adverse contre ${pin.behind === 'k' ? 'son roi' : 'sa dame'}`
      : '';
  if (move.captured) {
    const take =
      p === 'p' && move.captured === 'p' && 'cdef'.includes(move.to[0])
        ? 'échange un pion central'
        : `prend ${un(move.captured)}${NAMES[move.captured]} ${colorName(them, move.captured)}`;
    return threat ? `${take} et ${threat}` : after.inCheck() ? `${take} avec échec` : take;
  }
  if (threat) return threat;
  if (after.inCheck()) return 'met le roi adverse en échec';
  // Attaque une pièce plus forte que la sienne, ou une pièce (même un pion) non défendue.
  const target = after
    .board()
    .flat()
    .find(
      (x) =>
        x &&
        x.color === them &&
        x.type !== 'k' &&
        after.attackers(x.square, me).includes(move.to) &&
        ((x.type !== 'p' && VALUES[x.type] > VALUES[p]) || !after.attackers(x.square, them).length),
    );
  if (target) {
    return target.type === 'p'
      ? `attaque un pion adverse non défendu en ${target.square}`
      : `attaque ${article(target.type)}${NAMES[target.type]} adverse en ${target.square}`;
  }
  const wasHanging = hangingPieces(before, me);
  if (wasHanging.some((h) => h.sq === move.from)) return `met ${ton(p)}${NAMES[p]} à l'abri`;
  const stillHanging = new Set(hangingPieces(after, me).map((h) => h.sq));
  const saved = wasHanging.find((h) => !stillHanging.has(h.sq) && after.get(h.sq)?.color === me);
  if (saved) return `protège ${ton(saved.type)}${NAMES[saved.type]} en ${saved.sq}`;
  // Ajoute un défenseur à une pièce que l'adversaire attaque déjà.
  const guarded = after
    .board()
    .flat()
    .find(
      (x) =>
        x &&
        x.color === me &&
        x.type !== 'k' &&
        x.square !== move.to &&
        before.attackers(x.square, them).length > 0 &&
        after.attackers(x.square, me).includes(move.to),
    );
  if (guarded) return `renforce la défense de ${ton(guarded.type)}${NAMES[guarded.type]} en ${guarded.square}`;
  if (START[move.from] === p && move.from[1] === (me === 'w' ? '1' : '8')) {
    return `active ${un(p)}${NAMES[p]} en le développant depuis sa case de départ`;
  }
  if (p === 'p' && CENTER.includes(move.to)) return 'prend de l\'espace au centre';
  if (p === 'r' && openFile(after, move.to[0])) return 'place la tour sur une colonne ouverte';
  if (p === 'p' && isPassed(after, move.to, me)) return 'fait avancer un pion passé';
  if (p === 'k') return 'déplace le roi';
  return `place ${article(p)}${NAMES[p]} en ${move.to}`;
}

/** Une variante stable parmi plusieurs (même position → même phrase). */
const say = (seed: string, ...options: string[]) => pick(seed, options);

/**
 * Textes du coach pour le coup qui mène à `node` : une phrase sur le coup joué et, s'il était
 * différent, une sur le meilleur coup (avec son coup en UCI pour « Voir la suite »).
 */
export function coachText(node: TreeNode): { played: string; best?: { san: string; text: string }; facts: string[] } | null {
  const move = node.move;
  const parent = node.parent;
  const review = node.review;
  if (!move || !parent || !review) return null;
  const { facts, cause, better, stops } = explainMove(node);
  const me = move.color;
  const desc = describeMove(parent.fen, move);
  const bestLine = parent.eval?.lines[0];
  const bestUci = review.bestUci;
  const bestSan = bestUci ? uciToSan(parent.fen, [bestUci])[0] : undefined;
  const seed = node.fen;
  let played: string;
  switch (review.classification) {
    case 'book':
      played = say(seed, 'Un coup connu de la théorie des ouvertures.', 'Coup de théorie : tu restes en terrain connu.');
      break;
    case 'brilliant': {
      const line = node.eval?.lines[0] ? playLine(node.fen, node.eval.lines[0].pv, 4) : [];
      const lost = netCaptures([move, ...line], me).lost[0];
      played = lost
        ? say(seed, `Superbe sacrifice de ${ton(lost)}${NAMES[lost]} ! Une vraie idée tactique.`, `Très bien vu : sacrifier ${ton(lost)}${NAMES[lost]} était difficile à trouver.`)
        : say(seed, 'Très bien vu ! Ce coup était difficile à trouver.', 'Brillant : peu de joueurs auraient vu ce coup.');
      break;
    }
    case 'great':
      played = `Le seul bon coup, bien trouvé : il ${desc}.`;
      break;
    case 'best':
      played = say(seed, `Le meilleur coup : il ${desc}.`, `Parfait, ce coup ${desc}.`, `Bien joué : ce coup ${desc}.`);
      break;
    case 'excellent':
      played = say(seed, `Très bon coup : il ${desc}.`, `Presque le meilleur : ce coup ${desc}.`);
      break;
    case 'good':
      played = `Correct : ce coup ${desc}${bestSan ? `, même si ${bestSan} était un peu mieux` : ''}.`;
      break;
    case 'inaccuracy':
      played = cause ? `Imprécision : ${cause}.` : `Pas le plus précis : ce coup ${desc}, mais ${bestSan ?? 'un autre coup'} faisait mieux.`;
      break;
    case 'mistake':
      played = cause ? `Erreur : ${cause}.` : `Erreur : ce coup ${desc}, mais il te fait perdre du terrain.`;
      break;
    case 'miss':
      played = cause ? `Occasion manquée : ${cause}.` : `Occasion manquée : ${better ?? `${bestSan ?? 'un autre coup'} profitait de l'erreur adverse`}.`;
      break;
    case 'blunder':
      played = cause ? say(seed, `Aïe : ${cause}.`, `Gaffe : ${cause}.`) : `Gaffe : ce coup ${desc}, mais il gâche ta position.`;
      break;
  }
  if (!bestUci || !bestSan || bestSan === move.san || ['book', 'brilliant', 'great', 'best'].includes(review.classification)) {
    return { played, facts };
  }
  // Le meilleur coup : ce qu'il fait, et ce qu'il gagne ou empêche.
  const bestMove = playLine(parent.fen, [bestUci], 1)[0];
  if (!bestMove) return { played, facts };
  const mate = mateFor(bestLine, me);
  const gain = bestLine ? netCaptures(playLine(parent.fen, bestLine.pv, 6), me) : { won: [], lost: [] };
  const parts = [mate && mate > 1 ? `lance un mat en ${mate}` : describeMove(parent.fen, bestMove)];
  if (!mate && gain.won.length && !bestMove.captured) parts.push(`gagne ${describeGain(gain)}`);
  if (stops) parts.push(`empêche ${stops}`);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}` : parts[0];
  return { played, best: { san: bestSan, text: `Ce coup ${text}.` }, facts };
}
