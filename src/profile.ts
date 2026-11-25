/**
 * Profil du joueur : fiches de parties analysées, étiquettes des erreurs,
 * synthèse des forces et faiblesses, analyse en lot, export / import.
 */
import { Chess, type Color, type Move } from 'chess.js';
import {
  analyseGame,
  puzzlePosition,
  reviewGame,
  type Classification,
  type GameAnalysis,
  type MoveReview,
  type PositionEval,
} from './analysis';
import { Engine } from './engine';
import { forkTargets, mateFor, netCaptures, pinByMove, playLine } from './explain';
import { gameId, parsePgn, type Game } from './game';
import { fetchChessCom } from './import';
import { cacheAll, cacheGet, cachePut } from './cache';
import { openingName } from './openings';

// ---------------------------------------------------------------------------
// Fiches
// ---------------------------------------------------------------------------

/** Une partie analysée, telle qu'elle est stockée et exportée. */
export interface Fiche {
  id: string;
  pgn: string;
  depth: number;
  /** Évaluations du moteur, allégées (voir `toFiche`). */
  positions: PositionEval[];
}

/** Garde la meilleure suite (8 demi-coups) et le score du 2e coup : assez pour noter et expliquer. */
export function toFiche(game: Game, pgn: string, positions: PositionEval[], depth: number): Fiche {
  return {
    id: gameId(game),
    pgn,
    depth,
    positions: positions.map((p) => ({ ...p, lines: p.lines.slice(0, 2).map((l, i) => ({ ...l, pv: l.pv.slice(0, i ? 1 : 8) })) })),
  };
}

/** Vérifie une fiche venue d'un fichier importé (donnée non fiable). */
function isFiche(x: unknown): x is Fiche {
  const f = x as Fiche;
  return (
    !!f &&
    typeof f.id === 'string' &&
    typeof f.pgn === 'string' &&
    Number.isFinite(f.depth) &&
    Array.isArray(f.positions) &&
    f.positions.every((p) => p && Number.isFinite(p.win) && Array.isArray(p.lines))
  );
}

// ---------------------------------------------------------------------------
// Étiquettes des erreurs
// ---------------------------------------------------------------------------

export type Phase = 'ouverture' | 'milieu' | 'finale';
export const PHASES: Phase[] = ['ouverture', 'milieu', 'finale'];

export const TAGS = {
  'en-prise': 'Pièce laissée en prise',
  'subie-mat': 'Mat adverse non vu',
  'subie-fourchette': 'Fourchette adverse non vue',
  'subie-clouage': 'Clouage adverse non vu',
  'manquee-mat': 'Mat manqué',
  'manquee-fourchette': 'Fourchette manquée',
  'manquee-clouage': 'Clouage manqué',
  'manquee-materiel': 'Gain de matériel manqué',
  occasion: "Occasion manquée (l'adversaire venait de se tromper)",
  temps: 'Erreur en manque de temps',
  position: 'Erreur de position (sans tactique)',
} as const;
export type Tag = keyof typeof TAGS;

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Finale : plus de dames, ou peu de pièces (≤ 13 points hors pions) de chaque côté. */
function phaseOf(fen: string, ply: number): Phase {
  const pieces = { w: 0, b: 0 };
  let queens = 0;
  for (const row of new Chess(fen).board()) {
    for (const p of row) {
      if (!p || p.type === 'p' || p.type === 'k') continue;
      pieces[p.color] += VALUES[p.type];
      if (p.type === 'q') queens++;
    }
  }
  if (!queens || (pieces.w <= 13 && pieces.b <= 13)) return 'finale';
  return ply <= 24 ? 'ouverture' : 'milieu';
}

/** Motif tactique créé par un coup : fourchette, clouage, ou rien. */
function motif(move: Move): 'fourchette' | 'clouage' | null {
  const chess = new Chess(move.after);
  if (forkTargets(chess, move).length) return 'fourchette';
  if (pinByMove(chess, move)) return 'clouage';
  return null;
}

/** Une suite du moteur fait-elle gagner du matériel (ou mater) au camp `who` ? */
function winsMaterial(fen: string, pv: string[], who: Color, before: Move[] = []): boolean {
  return netCaptures([...before, ...playLine(fen, pv, 6)], who).won.length > 0;
}

/** Pourquoi ce coup est une erreur : une ou plusieurs étiquettes. */
function tagsFor(move: Move, before: PositionEval, after: PositionEval, review: MoveReview, clock?: number, base?: number): Tag[] {
  const tags: Tag[] = [];
  const me = move.color;
  const them: Color = me === 'w' ? 'b' : 'w';

  // Ce que l'adversaire peut faire après le coup.
  const reply = after.lines[0];
  if (reply) {
    const replyMove = playLine(move.after, reply.pv, 1)[0];
    const m = replyMove && motif(replyMove);
    if (mateFor(reply, them)) tags.push('subie-mat');
    else if (m === 'fourchette') tags.push('subie-fourchette');
    else if (m === 'clouage') tags.push('subie-clouage');
    else if (winsMaterial(move.after, reply.pv.slice(0, 3), them, [move])) tags.push('en-prise');
  }

  // Ce que le meilleur coup permettait.
  const best = before.lines[0];
  if (best && best.pv[0] !== move.from + move.to + (move.promotion ?? '')) {
    const bestMove = playLine(move.before, best.pv, 1)[0];
    if (mateFor(best, me)) tags.push('manquee-mat');
    else if (winsMaterial(move.before, best.pv, me)) {
      const m = bestMove && motif(bestMove);
      tags.push(m === 'fourchette' ? 'manquee-fourchette' : m === 'clouage' ? 'manquee-clouage' : 'manquee-materiel');
    }
  }

  if (review.classification === 'miss') tags.push('occasion');
  if (clock !== undefined && base && clock < base * 0.1) tags.push('temps');
  if (!tags.some((t) => t !== 'temps')) tags.push('position');
  return tags;
}

// ---------------------------------------------------------------------------
// Synthèse d'une partie
// ---------------------------------------------------------------------------

const BAD: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];
const GOOD: Classification[] = ['brilliant', 'great', 'best', 'excellent'];

export interface MistakeRecord {
  id: string;
  /** Numéro du demi-coup fautif (1 = premier coup des Blancs). */
  ply: number;
  san: string;
  opponent: string;
  classification: Classification;
  /** Chances de gain perdues (points de la barre d'évaluation). */
  loss: number;
  phase: Phase;
  tags: Tag[];
  /** Il n'y avait qu'un seul bon coup : la position peut servir de problème. */
  onlyMove: boolean;
}

export interface GameSummary {
  id: string;
  color: Color;
  opponent: string;
  result: 'win' | 'draw' | 'loss';
  speed: string;
  /** "2026.11.23 18:04:12" : pour trier les parties dans l'ordre où elles ont été jouées. */
  date: string;
  /** "2026.11" */
  month: string;
  opening: string;
  accuracy: number;
  mistakes: MistakeRecord[];
  movesByPhase: Record<Phase, number>;
  /** Positions où une tactique gagnante existait et a été trouvée (les manquées sont dans `mistakes`). */
  tacticsFound: number;
  /** A eu une position gagnante (≥ 80 %), et l'a convertie ou non. */
  wasWinning: boolean;
  /** Demi-coup où la position gagnante a été atteinte (pour l'exemple « avantage gâché »). */
  winningPly: number;
  /** Nombre de coups du joueur par classification (brillants, gaffes…). */
  counts: Partial<Record<Classification, number>>;
}

/**
 * Cadence d'après le champ TimeControl ("180+2", "1/86400"…), avec les seuils de chess.com
 * (durée estimée = base + 40 × incrément) : bullet < 3 min, blitz < 10 min, sinon rapide.
 */
function speedOf(tc: string | undefined): string {
  if (!tc || tc.includes('/')) return 'daily';
  const [base, inc] = tc.split('+').map(Number);
  const t = base + 40 * (inc || 0);
  return t < 180 ? 'bullet' : t < 600 ? 'blitz' : 'rapid';
}

/** Résume une fiche du point de vue de `username` ; null si ce joueur n'est pas dans la partie. */
export function summarize(fiche: Fiche, username: string): GameSummary | null {
  let game: Game;
  try {
    game = parsePgn(fiche.pgn);
  } catch {
    return null;
  }
  const h = game.headers;
  const u = username.toLowerCase();
  const color: Color | null = h.White?.toLowerCase() === u ? 'w' : h.Black?.toLowerCase() === u ? 'b' : null;
  if (!color || fiche.positions.length !== game.fens.length) return null;

  const analysis: GameAnalysis = reviewGame(game, fiche.positions, fiche.depth);
  const pov = (w: number) => (color === 'w' ? w : 100 - w);
  const base = Number(h.TimeControl?.split('+')[0]) || undefined;
  const summary: GameSummary = {
    id: fiche.id,
    color,
    opponent: (color === 'w' ? h.Black : h.White) ?? '?',
    result: h.Result === '1/2-1/2' ? 'draw' : (h.Result === '1-0') === (color === 'w') ? 'win' : 'loss',
    speed: speedOf(h.TimeControl),
    date: `${h.UTCDate ?? h.Date ?? ''} ${h.UTCTime ?? ''}`,
    month: (h.Date ?? '').slice(0, 7),
    opening: '',
    accuracy: color === 'w' ? analysis.accuracy.white : analysis.accuracy.black,
    mistakes: [],
    movesByPhase: { ouverture: 0, milieu: 0, finale: 0 },
    tacticsFound: 0,
    wasWinning: false,
    winningPly: 0,
    counts: {},
  };
  for (const fen of game.fens) summary.opening = openingName(fen) ?? summary.opening;
  if (!summary.opening) summary.opening = h.ECO ?? 'Inconnue';

  game.moves.forEach((move, i) => {
    if (move.color !== color) return;
    const review = analysis.moves[i];
    const before = fiche.positions[i];
    const after = fiche.positions[i + 1];
    const phase = phaseOf(move.before, i + 1);
    summary.movesByPhase[phase]++;
    summary.counts[review.classification] = (summary.counts[review.classification] ?? 0) + 1;
    if (!summary.wasWinning && pov(after.win) >= 80 && i >= 10) {
      summary.wasWinning = true;
      summary.winningPly = i + 1;
    }
    const best = before.lines[0];
    const tacticAvailable = best && (mateFor(best, color) || winsMaterial(move.before, best.pv, color));
    if (BAD.includes(review.classification)) {
      const tags = tagsFor(move, before, after, review, game.clocks[i], base);
      summary.mistakes.push({
        id: fiche.id,
        ply: i + 1,
        san: move.san,
        opponent: summary.opponent,
        classification: review.classification,
        loss: review.loss,
        phase,
        tags,
        onlyMove: puzzlePosition(before, color === 'w'),
      });
    } else if (tacticAvailable && GOOD.includes(review.classification)) {
      summary.tacticsFound++;
    }
  });
  return summary;
}

// ---------------------------------------------------------------------------
// Synthèse du profil
// ---------------------------------------------------------------------------

export interface ProfileStats {
  games: GameSummary[];
  record: { win: number; draw: number; loss: number };
  accuracy: { all: number; w: number; b: number };
  byPhase: { phase: Phase; moves: number; mistakes: number; per100: number }[];
  /** Causes d'erreur, de la plus fréquente à la moins fréquente. */
  causes: { tag: Tag | 'gache'; count: number; examples: MistakeRecord[] }[];
  totalMistakes: number;
  openings: { name: string; games: number; score: number; accuracy: number }[];
  byMonth: { month: string; games: number; accuracy: number }[];
  strengths: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

/** `minLoss` : ne garder que les erreurs qui font perdre au moins autant de points de chances de gain. */
export function profileStats(games: GameSummary[], minLoss = 0): ProfileStats {
  const mistakes = games.flatMap((g) => g.mistakes).filter((m) => m.loss >= minLoss);
  const record = { win: 0, draw: 0, loss: 0 };
  for (const g of games) record[g.result]++;

  const byPhase = PHASES.map((phase) => {
    const moves = games.reduce((a, g) => a + g.movesByPhase[phase], 0);
    const n = mistakes.filter((m) => m.phase === phase).length;
    return { phase, moves, mistakes: n, per100: moves ? (100 * n) / moves : 0 };
  });

  const causes: ProfileStats['causes'] = (Object.keys(TAGS) as Tag[])
    .map((tag) => {
      const ex = mistakes.filter((m) => m.tags.includes(tag));
      return { tag, count: ex.length, examples: ex };
    })
    .filter((c) => c.count > 0);
  // Avantage gâché : se compte par partie, pas par coup.
  const gache = games.filter((g) => g.wasWinning && g.result !== 'win');
  if (gache.length) {
    causes.push({
      tag: 'gache',
      count: gache.length,
      examples: gache.map((g) => ({
        id: g.id,
        ply: g.winningPly,
        san: '',
        opponent: g.opponent,
        classification: 'mistake' as Classification,
        loss: 0,
        phase: 'milieu' as Phase,
        tags: [],
        onlyMove: false,
      })),
    });
  }
  causes.sort((a, b) => b.count - a.count);

  const openings = [...groupBy(games, (g) => g.opening)]
    .map(([name, gs]) => ({
      name,
      games: gs.length,
      score: (100 * gs.reduce((a, g) => a + (g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0), 0)) / gs.length,
      accuracy: mean(gs.map((g) => g.accuracy)),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  const byMonth = [...groupBy(games, (g) => g.month)]
    .map(([month, gs]) => ({ month, games: gs.length, accuracy: mean(gs.map((g) => g.accuracy)) }))
    .sort((a, b) => a.month.localeCompare(b.month));


  // Forces : ce qui va mieux que le reste.
  const strengths: string[] = [];
  const found = games.reduce((a, g) => a + g.tacticsFound, 0);
  const missed = mistakes.filter((m) => m.tags.some((t) => t.startsWith('manquee-'))).length;
  if (found + missed >= 5) {
    strengths.push(`Tactiques trouvées : ${found} sur ${found + missed} (${Math.round((100 * found) / (found + missed))} %).`);
  }
  const winning = games.filter((g) => g.wasWinning);
  if (winning.length >= 3) {
    const conv = winning.filter((g) => g.result === 'win').length;
    strengths.push(`Positions gagnantes converties : ${conv} sur ${winning.length} (${Math.round((100 * conv) / winning.length)} %).`);
  }
  const phases = byPhase.filter((p) => p.moves >= 30).sort((a, b) => a.per100 - b.per100);
  if (phases.length >= 2) {
    strengths.push(`Phase la plus solide : ${phases[0].phase} (${phases[0].per100.toFixed(1)} erreurs pour 100 coups).`);
  }
  const bestOpening = openings.filter((o) => o.games >= 3).sort((a, b) => b.score - a.score)[0];
  if (bestOpening) strengths.push(`Meilleure ouverture : ${bestOpening.name} (${Math.round(bestOpening.score)} % des points).`);

  return {
    games,
    record,
    accuracy: {
      all: mean(games.map((g) => g.accuracy)),
      w: mean(games.filter((g) => g.color === 'w').map((g) => g.accuracy)),
      b: mean(games.filter((g) => g.color === 'b').map((g) => g.accuracy)),
    },
    byPhase,
    causes,
    totalMistakes: mistakes.length,
    openings,
    byMonth,
    strengths,
  };
}

/** Toutes les parties stockées où `username` joue, résumées. */
export async function loadProfile(username: string): Promise<GameSummary[]> {
  const fiches = await cacheAll<Fiche>();
  return fiches.flatMap((f) => (isFiche(f) ? (summarize(f, username) ?? []) : []));
}

// ---------------------------------------------------------------------------
// Analyse en lot
// ---------------------------------------------------------------------------

/**
 * Analyse les `count` dernières parties chess.com de `username` dans chacune des cadences `speeds`,
 * avec `engines` moteurs en parallèle.
 * Les parties déjà analysées à cette profondeur ou plus sont sautées ; chaque partie finie est
 * enregistrée tout de suite (on peut fermer la page et reprendre).
 */
export async function analyseProfile(
  username: string,
  count: number,
  speeds: string[],
  engines: number,
  depth: number,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<{ total: number; skipped: number }> {
  const online = await fetchChessCom(username, count, speeds);
  const todo: { game: Game; pgn: string }[] = [];
  for (const g of online) {
    let game: Game;
    try {
      game = parsePgn(g.pgn);
    } catch {
      continue;
    }
    const existing = await cacheGet<Fiche>(gameId(game));
    if (!existing || existing.depth < depth) todo.push({ game, pgn: g.pgn });
  }
  const total = online.length;
  let done = total - todo.length;
  onProgress(done, total);
  let next = 0;
  const worker = async () => {
    const engine = new Engine();
    try {
      while (next < todo.length && !isCancelled()) {
        const { game, pgn } = todo[next++];
        const res = await analyseGame([engine], game, depth, () => {}, isCancelled);
        if (!res) break;
        await cachePut(gameId(game), toFiche(game, pgn, res.positions, depth));
        onProgress(++done, total);
      }
    } finally {
      engine.destroy();
    }
  };
  await Promise.all(Array.from({ length: Math.min(engines, todo.length) }, worker));
  return { total, skipped: total - todo.length };
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

const FORMAT = 'analyseur-echecs-profil';

export async function exportProfile(username: string): Promise<Blob> {
  const games = (await cacheAll<Fiche>()).filter(isFiche);
  const data = { format: FORMAT, version: 1, username, exportedAt: new Date().toISOString(), games };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** Fusionne un fichier exporté : une partie déjà présente garde la version la plus profonde. */
export async function importProfile(text: string): Promise<{ username?: string; added: number; kept: number; invalid: number }> {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("fichier illisible (ce n'est pas un fichier JSON)");
  }
  if (data?.format !== FORMAT || !Array.isArray(data.games)) throw new Error("ce fichier n'est pas un profil exporté par l'analyseur");
  let added = 0;
  let kept = 0;
  let invalid = 0;
  for (const f of data.games) {
    if (!isFiche(f)) {
      invalid++;
      continue;
    }
    const existing = await cacheGet<Fiche>(f.id);
    if (existing && existing.depth >= f.depth) kept++;
    else {
      await cachePut(f.id, f);
      added++;
    }
  }
  return { username: typeof data.username === 'string' ? data.username : undefined, added, kept, invalid };
}
