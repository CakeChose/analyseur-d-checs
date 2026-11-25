import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { gameId, parsePgn, uciToSan, type Game } from './game';
import { Engine, formatScore } from './engine';
import {
  analyseGame,
  evaluatePosition,
  LABELS,
  puzzlePosition,
  THRESHOLDS,
  reviewGame,
  reviewMove,
  type Classification,
  type GameAnalysis,
  type MoveReview,
  type PositionEval,
} from './analysis';
import { Chess, type Move, type Square } from 'chess.js';
import { buildTree, deleteNode, mainline, playMove, type TreeNode } from './tree';
import { drawGraph } from './graph';
import { cacheGet, cachePut } from './cache';
import {
  analyseProfile,
  exportProfile,
  importProfile,
  loadProfile,
  profileStats,
  TAGS,
  toFiche,
  type Fiche,
  type MistakeRecord,
  type ProfileStats,
} from './profile';
import { winPercent } from './winprob';
import { coachText, mateFor, playLine } from './explain';
import { loadBook, openingName } from './openings';
import { fetchChessCom, fetchChessComStats, fetchLichess, type OnlineGame, type SpeedStats } from './import';
import { $, esc, groupCount, pct } from './ui';
import { openProblems, openRandomProblems, recordExo, renderProblems } from './problems';
import { openOpenings, renderBookMoves, stopTraining, training, trainingMove } from './openings-view';

export const board = Chessground($('board'), {
  coordinates: true,
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
});
const engine = new Engine();
/** Téléphone ou tablette : moins de cœurs, ça chauffe → analyses moins profondes. */
const MOBILE = matchMedia('(pointer: coarse)').matches;
const LIVE_DEPTH = MOBILE ? 14 : 18;
/** Moteurs en parallèle (un par cœur, en laissant un cœur à la page) : 8 au plus, 2 sur téléphone. */
const ENGINES = Math.min(MOBILE ? 2 : 8, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
if (MOBILE) $<HTMLSelectElement>('depth').value = '12';

// Téléphone : glisser le doigt sur l'échiquier (ailleurs que sur une pièce) pour changer de coup.
let touchX = 0;
let touchY = 0;
let touchOnPiece = false;
$('board').addEventListener(
  'touchstart',
  (e) => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    touchOnPiece = (e.target as HTMLElement).tagName === 'PIECE';
  },
  { passive: true },
);
$('board').addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (touchOnPiece || Math.abs(dx) < 50 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  if (dx < 0) go.next();
  else go.prev();
});

let game: Game | null = null;
export let root: TreeNode | null = null;
export let current: TreeNode | null = null;
let analysis: GameAnalysis | null = null;
/** Texte PGN de la partie affichée (gardé tel quel dans sa fiche). */
let currentPgn = '';
/** Analyse complète en cours (le moteur lui est réservé). */
let analysing = false;
/** Incrémenté pour annuler une analyse en cours (nouvelle partie chargée…). */
let analysisToken = 0;

// ---------------------------------------------------------------------------
// Affichage d'une position
// ---------------------------------------------------------------------------

/** Coups légaux de la position, au format attendu par chessground. */
function legalDests(fen: string): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = dests.get(m.from as Key) ?? [];
    list.push(m.to as Key);
    dests.set(m.from as Key, list);
  }
  return dests;
}

/** L'utilisateur joue un coup sur l'échiquier : on l'ajoute à l'arbre (variante). */
function onUserMove(orig: Key, dest: Key) {
  if (!current) return;
  if (training) return trainingMove(orig, dest);
  if (puzzle && !puzzleFree()) return puzzleMove(orig, dest);
  const piece = new Chess(current.fen).get(orig as Square);
  const promoting = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1');
  const node = playMove(current, orig, dest, promoting ? 'q' : undefined);
  if (!node) return show(current);
  renderMoves();
  show(node);
}

export function show(node: TreeNode) {
  current = node;
  const m = node.move;
  const turn = node.ply % 2 === 0 ? 'white' : 'black';
  board.set({
    fen: node.fen,
    lastMove: m ? [m.from as Key, m.to as Key] : undefined,
    check: m ? /[+#]$/.test(m.san) : false,
    turnColor: turn,
    movable: { color: turn, dests: legalDests(node.fen) },
  });
  document.querySelectorAll('.moves .move').forEach((el) => {
    el.classList.toggle('current', Number((el as HTMLElement).dataset.id) === node.id);
  });
  scrollMoveIntoView();
  renderReview(node);
  if (document.body.dataset.view === 'ouvertures' && !training) renderBookMoves();
  renderGraph();
  updateEngine(node);
}

/**
 * Fait défiler la liste des coups (et elle seule, pas la page) pour montrer
 * le coup courant : l'échiquier reste à l'écran.
 */
function scrollMoveIntoView() {
  const list = $('moves');
  const el = list.querySelector<HTMLElement>('.current');
  if (!el) return;
  const top = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  if (top < list.scrollTop) list.scrollTop = top - 8;
  else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = top + el.offsetHeight - list.clientHeight + 8;
  }
}

function setEvalBar(ev: PositionEval | null) {
  const fill = $('evalbar-fill');
  const text = $('evalbar-text');
  fill.style.height = `${ev ? ev.win : 50}%`;
  const best = ev?.lines[0];
  const s = ev?.result ?? (best ? formatScore(best) : '');
  text.textContent = s.replace('+', '');
  text.classList.toggle('black-ahead', ev ? ev.win < 50 : false);
}

/** Barre, flèches et meilleures lignes pour `node`, à partir de `ev`. */
function renderEval(node: TreeNode, ev: PositionEval, status: string) {
  setEvalBar(ev);
  $('engine-status').textContent = ev.result ? 'partie terminée' : status;
  const list = $('engine-lines');
  list.innerHTML = '';
  for (const l of ev.lines) {
    const li = document.createElement('li');
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = formatScore(l);
    li.append(score, uciToSan(node.fen, l.pv.slice(0, 10)).join(' '));
    list.append(li);
  }
  const shapes: DrawShape[] = [];
  const arrow = (uci: string | undefined, brush: string) => {
    if (uci) shapes.push({ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush });
  };
  // Coup qu'il fallait jouer à la place d'une erreur (en vert).
  const r = node.review;
  if (r && ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(r.classification)) arrow(r.bestUci, 'green');
  arrow(ev.lines[0]?.pv[0], 'paleBlue');
  setShapes(shapes);
}

/**
 * Flèches du moteur. L'analyse peut finir pendant qu'on est sur une autre page : sur un échiquier
 * caché (taille nulle), chessground calculerait des coordonnées NaN. On les garde pour le retour (showView).
 */
function setShapes(shapes: DrawShape[]) {
  if ($('board').offsetWidth) board.setAutoShapes(shapes);
  else board.state.drawable.autoShapes = shapes;
}

function clearEngine() {
  $('engine-lines').innerHTML = '';
  $('engine-status').textContent = '';
  setShapes([]);
}

function updateEngine(node: TreeNode) {
  if ((puzzle && !puzzleFree()) || training) {
    // Pas d'aide du moteur pendant un exercice : ça donnerait la réponse.
    clearEngine();
    $('engine-status').textContent = 'masqué pendant l’exercice';
    setEvalBar(null);
    return;
  }
  if (!$<HTMLInputElement>('engine-on').checked) {
    if (!analysing) engine.stop();
    clearEngine();
    setEvalBar(node.eval ?? null);
    return;
  }
  if (node.eval) {
    renderEval(node, node.eval, `profondeur ${node.evalDepth}`);
    return;
  }
  if (analysing) {
    clearEngine();
    $('engine-status').textContent = 'analyse de la partie en cours…';
    return;
  }
  analyseLive(node);
}

/** Évalue `node` (à fond) et garde le résultat dans l'arbre ; null si interrompu. */
async function evaluateNode(node: TreeNode, live: boolean): Promise<PositionEval | null> {
  const ev = await evaluatePosition(engine, node.fen, LIVE_DEPTH, (lines) => {
    if (!live || current !== node || !lines[0]) return;
    renderEval(node, { lines, win: winPercent(lines[0]) }, `profondeur ${lines[0].depth}`);
  });
  // Ne garder que les recherches allées jusqu'au bout.
  if (!ev.result && (ev.lines[0]?.depth ?? 0) < LIVE_DEPTH) return null;
  node.eval = ev;
  node.evalDepth = LIVE_DEPTH;
  return ev;
}

/**
 * Analyse en direct. Pour un coup essayé (variante), évalue d'abord la position
 * d'avant si besoin, puis note le coup comme dans l'analyse complète.
 */
async function analyseLive(node: TreeNode) {
  const parent = node.parent;
  const needsReview = !node.mainline && parent && node.move && !node.review;
  if (needsReview && !parent.eval) {
    $('engine-status').textContent = 'évaluation du coup…';
    if (!(await evaluateNode(parent, false)) || current !== node) return;
  }
  $('engine-status').textContent = 'calcul…';
  const ev = await evaluateNode(node, true);
  if (!ev || current !== node) return;
  if (needsReview && parent.eval) {
    node.review = reviewMove(node.move!, parent.eval, ev, parent.review);
    if (isBookNode(node)) node.review.classification = 'book';
    renderMoves();
    renderReview(node);
  if (document.body.dataset.view === 'ouvertures' && !training) renderBookMoves();
  }
  renderEval(node, ev, `profondeur ${LIVE_DEPTH}`);
}

// ---------------------------------------------------------------------------
// Liste des coups, commentaire du coup, graphique, bilan
// ---------------------------------------------------------------------------

function moveSpan(node: TreeNode): HTMLElement {
  const span = document.createElement('span');
  span.className = 'move';
  span.dataset.id = String(node.id);
  span.textContent = node.move!.san;
  const c = node.review?.classification;
  if (c) {
    span.classList.add(`c-${c}`);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = LABELS[c].symbol;
    badge.title = LABELS[c].name;
    span.append(badge);
  }
  span.onclick = () => show(node);
  return span;
}

/** Numéro à afficher devant un coup : "12." pour les Blancs, "12..." pour les Noirs en début de ligne. */
function moveNumber(node: TreeNode, startOfLine: boolean): string {
  const n = Math.ceil(node.ply / 2);
  if (node.ply % 2 === 1) return `${n}.`;
  return startOfLine ? `${n}...` : '';
}

/**
 * Écrit une variante en ligne à partir de `node` : les coups suivants,
 * et les sous-variantes entre parenthèses.
 */
function renderLine(node: TreeNode, into: HTMLElement) {
  let n: TreeNode | undefined = node;
  let start = true;
  while (n) {
    const num = moveNumber(n, start);
    if (num) into.append(Object.assign(document.createElement('span'), { className: 'var-num', textContent: num }));
    into.append(moveSpan(n));
    start = false;
    const [next, ...alts]: TreeNode[] = n.children;
    for (const alt of alts) {
      const sub = document.createElement('span');
      sub.className = 'subvar';
      renderLine(alt, sub);
      into.append(sub);
      start = true;
    }
    n = next;
  }
}

/** Bloc d'une variante qui part de la partie principale, avec un bouton pour la supprimer. */
function variationBlock(node: TreeNode): HTMLElement {
  const block = document.createElement('div');
  block.className = 'variation';
  renderLine(node, block);
  const del = document.createElement('button');
  del.className = 'var-del';
  del.textContent = '✕';
  del.title = 'Supprimer cette variante';
  del.onclick = (e) => {
    e.stopPropagation();
    const parent = node.parent!;
    deleteNode(node);
    renderMoves();
    if (current && isInside(current, node)) show(parent);
  };
  block.append(del);
  return block;
}

/** `node` est-il `ancestor` ou l'un de ses descendants ? */
function isInside(node: TreeNode, ancestor: TreeNode): boolean {
  for (let n: TreeNode | undefined = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

export function renderMoves() {
  const list = $('moves');
  list.innerHTML = '';
  if (!root) return;
  const line = mainline(root);
  const nodes = line.slice(1);
  /** Variantes qui partent de la position `p` de la partie principale. */
  const variationsFrom = (p: TreeNode) => p.children.filter((c) => !c.mainline);
  for (const v of variationsFrom(root)) list.append(variationBlock(v));
  for (let i = 0; i < nodes.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = `${i / 2 + 1}.`;
    row.append(num, moveSpan(nodes[i]));
    if (nodes[i + 1]) row.append(moveSpan(nodes[i + 1]));
    list.append(row);
    for (const p of [nodes[i], nodes[i + 1]]) {
      if (p) for (const v of variationsFrom(p)) list.append(variationBlock(v));
    }
  }
  if (current) {
    list.querySelector(`[data-id="${current.id}"]`)?.classList.add('current');
  }
}

const VERDICT: Record<Classification, string> = {
  book: 'est un coup de livre',
  brilliant: 'est brillant',
  great: 'est le seul bon coup',
  best: 'est le meilleur coup',
  excellent: 'est excellent',
  good: 'est un bon coup',
  inaccuracy: 'est une imprécision',
  mistake: 'est une erreur',
  miss: "est une occasion manquée",
  blunder: 'est une gaffe',
};

function renderReview(node: TreeNode) {
  if (puzzle) {
    renderPuzzle();
    // Après l'exercice, les coups joués librement sont commentés sous le message.
    if (puzzleFree() && node.review) $('review').append(...moveReviewContent(node));
    return;
  }
  const box = $('review');
  const r = node.review;
  if (!r || !node.move || !node.parent) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.className = `review c-${r.classification}`;
  box.innerHTML = '';
  box.append(...moveReviewContent(node));
}

/** Une carte du coach : verdict + évaluation, une phrase, et « Voir la suite » (ligne du moteur depuis `from`). */
function coachCard(title: string, score: string, text: string, from: TreeNode, pv: string[] | undefined): HTMLElement {
  const card = Object.assign(document.createElement('div'), { className: 'coach-card' });
  const head = Object.assign(document.createElement('div'), { className: 'review-title' });
  head.append(title, Object.assign(document.createElement('span'), { className: 'score-badge', textContent: score }));
  card.append(head, Object.assign(document.createElement('p'), { className: 'coach-text', textContent: text }));
  if (pv?.length) {
    const b = Object.assign(document.createElement('button'), { className: 'link', textContent: 'Voir la suite' });
    b.onclick = () => showLine(from, pv);
    card.append(b);
  }
  return card;
}

let lineTimer = 0;
/** Joue la ligne du moteur sur l'échiquier, coup par coup, comme une variante (↑ pour revenir). */
function showLine(from: TreeNode, pv: string[]) {
  clearTimeout(lineTimer);
  const nodes: TreeNode[] = [];
  let n = from;
  for (const u of pv.slice(0, 8)) {
    const c = playMove(n, u.slice(0, 2), u.slice(2, 4), u[4]);
    if (!c) break;
    nodes.push((n = c));
  }
  if (!nodes.length) return;
  renderMoves();
  const step = (i: number) => {
    if (i > 0 && current !== nodes[i - 1]) return; // l'utilisateur a navigué ailleurs : on s'arrête
    show(nodes[i]);
    if (i + 1 < nodes.length) lineTimer = window.setTimeout(() => step(i + 1), 700);
  };
  show(from);
  lineTimer = window.setTimeout(() => step(0), 300);
}

const scoreOf = (ev: PositionEval | undefined) => (ev?.result ? (ev.result === '1/2-1/2' ? '½' : '#') : ev?.lines[0] ? formatScore(ev.lines[0]) : '');

/** Commentaire d'un coup : carte du coup joué, carte du meilleur coup, puis le détail des faits. */
function moveReviewContent(node: TreeNode): HTMLElement[] {
  const r = node.review!;
  const coach = coachText(node)!;
  const out: HTMLElement[] = [
    coachCard(`${LABELS[r.classification].symbol} ${node.move!.san} ${VERDICT[r.classification]}`, scoreOf(node.eval), coach.played, node, node.eval?.lines[0]?.pv),
  ];
  const detail = Object.assign(document.createElement('div'), { className: 'muted' });
  detail.textContent = `Précision du coup : ${Math.round(r.accuracy)} %` + (r.loss >= 1 ? ` · chances de gain perdues : ${r.loss.toFixed(1)} pts` : '');
  out.push(detail);
  if (coach.best) {
    const best = coachCard(`${LABELS.best.symbol} ${coach.best.san} ${VERDICT.best}`, scoreOf(node.parent!.eval), coach.best.text, node.parent!, node.parent!.eval?.lines[0]?.pv);
    best.classList.add('c-best');
    out.push(best);
  }
  // Le détail : faits vérifiés par le moteur et les règles, replié.
  const facts = coach.facts;
  if (facts.length) {
    const more = document.createElement('details');
    more.className = 'facts-more';
    const ul = Object.assign(document.createElement('ul'), { className: 'facts' });
    for (const f of facts) ul.append(Object.assign(document.createElement('li'), { textContent: f }));
    more.append(Object.assign(document.createElement('summary'), { textContent: 'Détails' }), ul);
    out.push(more);
  }
  return out;
}

function renderGraph() {
  const el = $('graph');
  if (!root || !analysis) {
    el.innerHTML = '';
    return;
  }
  const nodes = mainline(root);
  const wins = analysis.positions.map((p) => p.win);
  const classes = analysis.moves.map((m) => m.classification);
  const cur = current?.mainline ? current.ply : -1;
  drawGraph(el, wins, classes, cur, (ply) => show(nodes[Math.min(ply, nodes.length - 1)]));
}

const REPORT_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

function renderReport() {
  const el = $('report');
  if (!analysis || !game) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const count = (c: Classification, white: boolean) =>
    analysis!.moves.filter((m, i) => m.classification === c && i % 2 === (white ? 0 : 1)).length;
  const h = game.headers;
  const rows = REPORT_ORDER.filter((c) => count(c, true) + count(c, false) > 0)
    .map(
      (c) =>
        `<tr class="c-${c}"><td>${count(c, true)}</td><td><span class="badge">${LABELS[c].symbol}</span> ${LABELS[c].name}</td><td>${count(c, false)}</td></tr>`,
    )
    .join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>${esc(h.White ?? 'Blancs')}</th><th></th><th>${esc(h.Black ?? 'Noirs')}</th></tr></thead>
      <tbody>
        <tr class="accuracy"><td>${analysis.accuracy.white.toFixed(1)}</td><td>Précision</td><td>${analysis.accuracy.black.toFixed(1)}</td></tr>
        <tr title="Ordre de grandeur seulement, déduit de la précision sur cette seule partie"><td>~${estimateElo(analysis.accuracy.white)}</td><td>Elo estimé</td><td>~${estimateElo(analysis.accuracy.black)}</td></tr>
        ${rows}
      </tbody>
    </table>
    <div class="retry">
      Réessayer les erreurs des
      <button id="retry-w">Blancs</button>
      <button id="retry-b">Noirs</button>
    </div>
    <p id="report-msg" class="muted"></p>`;
  $('retry-w').onclick = () => startPuzzles('w');
  $('retry-b').onclick = () => startPuzzles('b');
}


// ---------------------------------------------------------------------------
// Analyse complète
// ---------------------------------------------------------------------------

/** Range les évaluations et les notes dans l'arbre, puis rafraîchit l'affichage. */
function applyAnalysis(positions: PositionEval[], moves: MoveReview[], depth: number) {
  if (!root) return;
  const nodes = mainline(root);
  positions.forEach((p, i) => {
    nodes[i].eval = p;
    nodes[i].evalDepth = depth;
  });
  moves.forEach((m, i) => (nodes[i + 1].review = m));
  analysis = {
    depth,
    positions,
    moves,
    accuracy: { white: 0, black: 0 },
  };
  renderMoves();
  renderGraph();
}

function setProgress(done: number, total: number) {
  $('progress').hidden = done >= total;
  $('progress-fill').style.width = `${(done / total) * 100}%`;
}

async function runAnalysis() {
  if (!game || !root || analysing) return;
  const g = game;
  const token = ++analysisToken;
  const depth = Number($<HTMLSelectElement>('depth').value);
  const pgn = currentPgn;
  analysing = true;
  $<HTMLButtonElement>('analyse').disabled = true;
  engine.stop();
  clearEngine();
  await loadBook();

  let result: GameAnalysis | null;
  const stored = await cacheGet<Fiche>(gameId(g));
  if (stored && stored.depth >= depth && stored.positions.length === g.fens.length) {
    result = reviewGame(g, stored.positions, stored.depth);
  } else {
    setProgress(0, g.fens.length);
    // Le moteur de la page plus des moteurs temporaires : un par cœur (l'analyse en lot, elle, en met un par partie).
    const helpers = Array.from({ length: ENGINES - 1 }, () => new Engine());
    try {
      result = await analyseGame(
        [engine, ...helpers],
        g,
        depth,
        (positions, moves, done) => {
          applyAnalysis(positions, moves, depth);
          setProgress(done, g.fens.length);
          $('analyse').textContent = `Analyse… ${done}/${g.fens.length}`;
          if (current && current.ply < positions.length && current.mainline) show(current);
        },
        () => token !== analysisToken,
      );
    } finally {
      for (const h of helpers) h.destroy();
    }
    if (result) cachePut(gameId(g), toFiche(g, pgn, result.positions, depth));
  }
  if (token !== analysisToken) return; // une autre partie a été chargée entre-temps
  analysing = false;
  $<HTMLButtonElement>('analyse').disabled = false;
  setProgress(1, 1);
  if (result) finishAnalysis(result);
}

/** Affiche une analyse terminée (calculée à l'instant ou relue depuis une fiche). */
function finishAnalysis(result: GameAnalysis) {
  applyAnalysis(result.positions, result.moves, result.depth);
  analysis = result;
  $('analyse').textContent = `Réanalyser (profondeur ${result.depth})`;
  renderReport();
  renderPlayers();
  if (current) show(current);
}

/** Ouvre une partie enregistrée, déjà analysée, éventuellement à un coup donné. */
async function openFiche(f: Fiche, ply?: number, view: View = 'partie') {
  const keep = puzzle;
  load(f.pgn, profileName, view);
  puzzle = keep;
  await loadBook();
  if (!game || !root) return;
  finishAnalysis(reviewGame(game, f.positions, f.depth));
  if (ply !== undefined) show(mainline(root)[Math.min(ply, game.moves.length)]);
}

// ---------------------------------------------------------------------------
// Bonus : livre d'ouvertures, moments clés, Elo, mode « Réessayer »
// ---------------------------------------------------------------------------

/** Coup de livre : la position et toutes celles d'avant sont dans la base d'ouvertures. */
function isBookNode(node: TreeNode): boolean {
  for (let n: TreeNode | undefined = node; n?.parent; n = n.parent) {
    if (!openingName(n.fen)) return false;
  }
  return !!node.parent;
}

/** Nom de l'ouverture jouée : la dernière position de la partie trouvée dans la base. */
function showOpening() {
  if (!root) return;
  let name: string | undefined;
  for (const n of mainline(root)) name = openingName(n.fen) ?? name;
  $('opening').textContent = name ?? '';
}

/** Boutons « Erreur » : erreurs, ratés et gaffes (les imprécisions sont trop nombreuses pour sauter de l'une à l'autre). */
const KEY_MOMENTS: Classification[] = ['miss', 'mistake', 'blunder'];

function jumpKeyMoment(dir: 1 | -1) {
  if (!root || !current) return;
  let from = current;
  while (!from.mainline && from.parent) from = from.parent;
  const keys = mainline(root).filter((n) => n.review && KEY_MOMENTS.includes(n.review.classification));
  const target = dir === 1 ? keys.find((n) => n.ply > from.ply) : keys.reverse().find((n) => n.ply < from.ply);
  if (target) show(target);
}

/**
 * Estimation (très approximative) du niveau à partir de la précision :
 * interpolation sur des repères grossiers, à prendre comme un ordre de grandeur.
 */
function estimateElo(accuracy: number): number {
  const pts: [number, number][] = [
    [40, 400],
    [60, 800],
    [70, 1100],
    [80, 1500],
    [85, 1800],
    [90, 2100],
    [95, 2500],
    [98, 2800],
  ];
  if (accuracy <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [a0, e0] = pts[i - 1];
    const [a1, e1] = pts[i];
    if (accuracy <= a1) return Math.round((e0 + ((accuracy - a0) / (a1 - a0)) * (e1 - e0)) / 50) * 50;
  }
  return pts.at(-1)![1];
}

/**
 * Exercice en cours : retrouver un meilleur coup là où le joueur s'est trompé.
 * Chaque exercice est un coup fautif (partie + numéro de demi-coup), éventuellement d'une autre partie.
 */
let puzzle: {
  queue: { id: string; ply: number }[];
  index: number;
  state: 'try' | 'wrong' | 'solved' | 'shown';
  tried?: string;
  /** Page où se déroule l'exercice (vue d'une partie ou page Problèmes). */
  view: View;
  /** Résultat déjà compté pour cet exercice (seul le premier essai compte). */
  recorded?: boolean;
  /** Problèmes aléatoires : on ne dit ni le coup joué ni le type d'erreur. */
  blind?: boolean;
  /** Suite à trouver (coups UCI, le joueur commence) et position dans cette suite. */
  line: string[];
  step: number;
  /** Coup donné par « Solution ». */
  solution?: string;
} | null = null;

const BAD: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

/** Le coup fautif de l'exercice en cours (dans la partie affichée). */
const puzzleTarget = () => mainline(root!)[puzzle!.queue[puzzle!.index].ply];

/** Affiche l'exercice courant, en ouvrant sa partie si ce n'est pas celle affichée. */
async function showPuzzle() {
  if (!puzzle) return;
  const item = puzzle.queue[puzzle.index];
  if (!game || gameId(game) !== item.id) {
    const f = await cacheGet<Fiche>(item.id);
    if (!f) return;
    await openFiche(f, undefined, puzzle.view);
  }
  const target = puzzleTarget();
  const color = target.move!.color === 'w' ? 'white' : 'black';
  if (board.state.orientation !== color) $('flip').click();
  puzzle.line = puzzleLine(target.parent!);
  puzzle.step = 0;
  show(target.parent!);
}

export function startPuzzleQueue(queue: { id: string; ply: number }[], view: View = 'partie', blind = false) {
  if (!queue.length) return false;
  puzzle = { queue, index: 0, state: 'try', view, blind, line: [], step: 0 };
  showView(view);
  showPuzzle();
  return true;
}

function startPuzzles(color: 'w' | 'b') {
  if (!root || !game) return;
  const id = gameId(game);
  const queue = mainline(root)
    .filter(
      (n) =>
        n.move?.color === color &&
        n.review &&
        BAD.includes(n.review.classification) &&
        n.parent?.eval &&
        puzzlePosition(n.parent.eval, color === 'w'),
    )
    .map((n) => ({ id, ply: n.ply }));
  if (!startPuzzleQueue(queue)) $('report-msg').textContent = 'Aucune erreur à retravailler pour ce camp (seules celles où il n\'y avait qu\'un bon coup comptent).';
}

/** Les coups acceptés : le meilleur, et ceux presque aussi bons selon le moteur. */
function goodAnswers(position: TreeNode): string[] {
  const lines = position.eval?.lines ?? [];
  if (!lines[0]) return [];
  const white = position.ply % 2 === 0;
  const pov = (w: number) => (white ? w : 100 - w);
  const best = pov(winPercent(lines[0]));
  return lines.filter((l) => best - pov(winPercent(l)) < 2).map((l) => l.pv[0]);
}

/** Exercice résolu (ou solution affichée) : l'échiquier redevient libre et les coups sont analysés. */
const puzzleFree = () => !!puzzle && (puzzle.state === 'solved' || puzzle.state === 'shown');

/**
 * La suite à trouver, comme sur Lichess : un mat court en entier, sinon la ligne du moteur
 * tant qu'elle reste forcée (prise ou échec d'un côté ou de l'autre), 3 coups du joueur au plus.
 * Elle se termine toujours par un coup du joueur.
 */
function puzzleLine(position: TreeNode): string[] {
  const best = position.eval?.lines[0];
  if (!best?.pv.length) return [];
  const me = position.ply % 2 === 0 ? 'w' : 'b';
  const mate = mateFor(best, me);
  if (mate && mate <= 3 && best.pv.length >= 2 * mate - 1) return best.pv.slice(0, 2 * mate - 1);
  const moves = playLine(position.fen, best.pv, 6);
  const forcing = (m: Move) => !!m.captured || /[+#]/.test(m.san);
  let end = 1;
  // i : réponse de l'adversaire, i + 1 : coup suivant du joueur.
  for (let i = 1; i + 1 < moves.length && end < 5; i += 2) {
    if (!forcing(moves[i - 1]) && !forcing(moves[i])) break;
    end = i + 2;
  }
  return best.pv.slice(0, end);
}

// Tests en développement seulement : lire l'exercice en cours depuis la console (retiré du site compilé).
if (import.meta.env.DEV) Object.assign(window, { __puzzle: () => puzzle });

/** Compte le résultat de l'exercice (seul le premier essai compte). */
function recordPuzzle(ok: boolean) {
  if (!puzzle || puzzle.recorded) return;
  const item = puzzle.queue[puzzle.index];
  recordExo(item.id, item.ply, ok);
  puzzle.recorded = true;
}

function puzzleMove(orig: Key, dest: Key) {
  if (!puzzle || !current) return;
  const p = puzzle;
  const node = current;
  const chess = new Chess(node.fen);
  const piece = chess.get(orig as Square);
  const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : '';
  let san: string;
  try {
    san = chess.move({ from: orig, to: dest, promotion: promo || undefined }).san;
  } catch {
    return show(node);
  }
  const uci = orig + dest + promo;
  // Au premier coup, un coup presque aussi bon que celui du moteur est accepté (et termine l'exercice).
  const alternative = p.step === 0 && uci !== p.line[0] && goodAnswers(node).includes(uci);
  const ok = uci === p.line[p.step] || alternative || chess.isCheckmate();
  p.tried = san;
  if (!ok) {
    p.state = 'wrong';
    recordPuzzle(false);
    renderPuzzle();
    setTimeout(() => puzzle === p && show(node), 700);
    return;
  }
  const child = playMove(node, orig, dest, promo || undefined)!;
  renderMoves();
  p.step++;
  if (alternative || chess.isCheckmate() || p.step >= p.line.length) {
    p.state = 'solved';
    recordPuzzle(true);
    show(child);
    return;
  }
  p.state = 'try';
  show(child);
  // L'adversaire répond avec la suite du moteur.
  setTimeout(() => {
    if (puzzle !== p || current !== child) return;
    const u = p.line[p.step];
    const reply = playMove(child, u.slice(0, 2), u.slice(2, 4), u[4]);
    if (!reply) return;
    p.step++;
    renderMoves();
    show(reply);
  }, 450);
}

function renderPuzzle() {
  if (!puzzle || !current) return;
  const p = puzzle;
  const box = $('review');
  const target = puzzleTarget();
  const total = Math.ceil(p.line.length / 2);
  const done = Math.floor(p.step / 2);
  const expected = p.line[p.step];
  const expectedSan = expected ? uciToSan(current.fen, [expected])[0] : '';
  box.hidden = false;
  box.className = 'review puzzle';
  const n = `${p.index + 1}/${p.queue.length}`;
  const side = target.move!.color === 'w' ? 'les Blancs' : 'les Noirs';
  const length = total > 1 ? ` (${total} coups à trouver)` : '';
  const free = ' Tu peux maintenant jouer les coups que tu veux : ils sont analysés.';
  const msg = {
    try:
      p.step > 0
        ? `Bien ! Continue : coup ${done + 1} sur ${total}.`
        : p.blind
          ? `Problème ${n} — Les ${side.slice(4)} jouent : trouve le meilleur coup${length}.`
          : `Exercice ${n} — Dans la partie, ${side} ont joué ${target.move!.san} (${LABELS[target.review!.classification].name.toLowerCase()}). Trouve mieux${length} !`,
    wrong: `${p.tried} n'est pas le bon coup. Réessaie.`,
    solved: (total > 1 && p.step > 1 ? 'Bravo ! Tu as trouvé toute la séquence.' : `Bravo ! ${p.tried} était le bon coup.`) + free,
    shown: `La solution était ${expectedSan || p.solution} (flèche verte).` + free,
  }[p.state];
  box.innerHTML = '';
  box.append(Object.assign(document.createElement('div'), { className: 'review-title', textContent: msg }));
  const bar = document.createElement('div');
  bar.className = 'puzzle-bar';
  const button = (label: string, fn: () => void) => {
    const b = Object.assign(document.createElement('button'), { textContent: label });
    b.onclick = fn;
    bar.append(b);
  };
  if (p.state === 'try' || p.state === 'wrong') {
    button('Solution', () => {
      p.state = 'shown';
      p.solution = expectedSan;
      recordPuzzle(false);
      renderPuzzle();
      board.setAutoShapes([{ orig: expected.slice(0, 2) as Key, dest: expected.slice(2, 4) as Key, brush: 'green' }]);
    });
  }
  if (p.index + 1 < p.queue.length) {
    button('Suivant', () => {
      p.index++;
      p.state = 'try';
      p.recorded = false;
      showPuzzle();
    });
  }
  button('Arrêter', () => {
    const fromProblems = p.view === 'problemes';
    puzzle = null;
    if (fromProblems) showView('profil');
    else show(target);
  });
  box.append(bar);
  if (p.view === 'problemes') renderProblems();
}

// ---------------------------------------------------------------------------
// Import depuis chess.com / Lichess
// ---------------------------------------------------------------------------

async function searchOnline() {
  const user = $<HTMLInputElement>('online-user').value.trim();
  const site = $<HTMLSelectElement>('online-site').value;
  const list = $('online-games');
  const status = $('online-status');
  if (!user) return;
  list.innerHTML = '';
  status.textContent = 'Recherche…';
  try {
    const games = site === 'lichess' ? await fetchLichess(user) : await fetchChessCom(user);
    status.textContent = games.length ? `${games.length} dernières parties :` : 'Aucune partie trouvée.';
    for (const g of games) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = 'online-game';
      b.innerHTML = `${esc(g.white)} – ${esc(g.black)} &nbsp;${resultBadge(g.result, g.white, g.black, user)} &nbsp;·&nbsp; ${esc(g.speed)} &nbsp;·&nbsp; ${g.date.toLocaleDateString('fr-FR')}`;
      b.onclick = () => {
        $<HTMLTextAreaElement>('pgn').value = g.pgn;
        load(g.pgn, user);
      };
      li.append(b);
      list.append(li);
    }
  } catch (e) {
    status.textContent = `Impossible de récupérer les parties : ${(e as Error).message}.`;
  }
}

// ---------------------------------------------------------------------------
// Profil du joueur
// ---------------------------------------------------------------------------

/** Profondeur de l'analyse en lot : 3 à 4 fois plus rapide que 16, suffisant pour repérer les erreurs. */
const PROFILE_DEPTH = MOBILE ? 10 : 12;
const USER_KEY = 'profil-pseudo';
let profileRunning = false;
let profileStop = false;
/** Exemples cliquables de la synthèse affichée (index = attribut data-ex). */
let profileExamples: MistakeRecord[] = [];
export let profileCauses: ProfileStats['causes'] = [];
/** Toutes les erreurs du profil (cadence affichée), pour les problèmes aléatoires. */
export let profileMistakes: MistakeRecord[] = [];

export type View ='accueil' | 'profil' | 'partie' | 'problemes' | 'ouvertures';

export function showView(view: View) {
  $('view-accueil').hidden = view !== 'accueil';
  $('layout').hidden = view === 'accueil';
  $('view-profil').hidden = view !== 'profil';
  $('view-analyse').hidden = !['partie', 'problemes', 'ouvertures'].includes(view);
  // Échiquier de nouveau visible : on redessine (flèches gardées pendant qu'il était caché).
  if (!$('view-analyse').hidden) board.redrawAll();
  // On quitte un exercice ou un entraînement en changeant de page.
  if (puzzle && view !== puzzle.view) puzzle = null;
  if (view !== 'ouvertures') stopTraining();
  $('go-profile').hidden = view === 'accueil';
  document.body.dataset.view = view;
  // Téléphone : sur une partie, la liste se replie pour garder l'échiquier en haut.
  if (matchMedia('(max-width: 760px)').matches) $<HTMLDetailsElement>('games-panel').open = view === 'profil';
  if (view === 'profil') refreshProfile();
  if (view === 'accueil') $<HTMLInputElement>('home-user').value = profileName;
}

/** Noms des joueurs autour de l'échiquier (en bas : le camp vu de face), avec leur précision une fois analysé. */
function renderPlayers() {
  const h = game?.headers ?? {};
  const line = (c: 'white' | 'black') => {
    const name = (c === 'white' ? h.White : h.Black) || (c === 'white' ? 'Blancs' : 'Noirs');
    const elo = c === 'white' ? h.WhiteElo : h.BlackElo;
    const acc = analysis && !analysing ? (c === 'white' ? analysis.accuracy.white : analysis.accuracy.black) : undefined;
    return (
      `<span class="dot ${c}"></span><b>${esc(name)}</b>` +
      (elo ? ` <span class="muted">${esc(elo)}</span>` : '') +
      (acc !== undefined ? `<span class="acc" title="Précision">${acc.toFixed(1)}</span>` : '')
    );
  };
  const bottom = board.state.orientation;
  $('player-bottom').innerHTML = line(bottom);
  $('player-top').innerHTML = line(bottom === 'white' ? 'black' : 'white');
}

const importDialog = () => $<HTMLDialogElement>('import-dialog');

/** Pseudo chess.com du profil (retenu dans le navigateur). */
export let profileName = '';
const profileUser = () => profileName;

function saveUser(user: string) {
  profileName = user;
  try {
    localStorage.setItem(USER_KEY, user);
  } catch {
    /* stockage indisponible : il faudra retaper le pseudo */
  }
}

// ---------------------------------------------------------------------------
// Liste des dernières parties (colonne de gauche, commune au profil et à la partie)
// ---------------------------------------------------------------------------

/** Dernières parties chess.com du profil (les plus récentes d'abord). */
let listGames: OnlineGame[] = [];
/** Précision du joueur dans chaque partie analysée, par identifiant de partie. */
let accById = new Map<string, number>();

/** Identifiant d'une partie chess.com d'après son PGN (le même que gameId). */
const linkOf = (pgn: string) => pgn.match(/\[Link "([^"]+)"\]/)?.[1] ?? '';

/** Les parties sont gardées 1 h dans le navigateur pour ne pas interroger chess.com à chaque visite. */
async function loadGames(user: string, force = false): Promise<OnlineGame[]> {
  const key = `parties:${user.toLowerCase()}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!force && cached && Date.now() - cached.at < 3600_000) {
      return cached.games.map((g: OnlineGame) => ({ ...g, date: new Date(g.date) }));
    }
  } catch {
    /* cache illisible : on recharge */
  }
  const games = await fetchChessCom(user, 50);
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), games }));
  } catch {
    /* stockage plein : tant pis pour le cache */
  }
  return games;
}

/** Résultat d'une partie du point de vue du joueur du profil. */
function resultFor(g: OnlineGame): 'win' | 'loss' | 'draw' {
  if (g.result === '½-½') return 'draw';
  const white = g.white.toLowerCase() === profileName.toLowerCase();
  return (g.result === '1-0') === white ? 'win' : 'loss';
}

function renderGamesList() {
  const u = profileName.toLowerCase();
  const cur = game ? gameId(game) : '';
  $('games-list').innerHTML = listGames
    .map((g, i) => {
      const white = g.white.toLowerCase() === u;
      const opp = white ? g.black : g.white;
      const oppElo = white ? g.blackElo : g.whiteElo;
      const id = linkOf(g.pgn);
      const acc = accById.get(id);
      const res = resultFor(g);
      return `<li><button class="game-row ${id && id === cur ? 'current' : ''}" data-gi="${i}" title="${RESULT_LABEL[res]}">
        <span class="res ${res}"></span>
        <span class="gr-main"><b>${esc(opp)}</b>${oppElo ? ` <span class="muted">${oppElo}</span>` : ''}
          <span class="muted gr-sub">${g.date.toLocaleDateString('fr-FR')} · ${SPEEDS[g.speed] ?? esc(g.speed)}</span></span>
        <span class="gr-acc" title="Précision">${acc !== undefined ? acc.toFixed(0) : '—'}</span></button></li>`;
    })
    .join('');
}
const RESULT_LABEL = { win: 'Victoire', loss: 'Défaite', draw: 'Nulle' };

$('games-list').addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-gi]');
  if (!b) return;
  openListGame(listGames[Number(b.dataset.gi)]);
});

/** Ouvre une partie de la liste : déjà analysée si possible, sinon telle quelle. */
async function openListGame(g: OnlineGame) {
  const f = await cacheGet<Fiche>(linkOf(g.pgn));
  if (f) await openFiche(f);
  else load(g.pgn);
}

// ---------------------------------------------------------------------------
// Page profil
// ---------------------------------------------------------------------------

async function refreshProfile() {
  const user = profileName;
  if (!user) return showView('accueil');
  $('profile-name').textContent = user;
  await loadBook();
  if (!listGames.length) $('games-status').textContent = 'Chargement des parties…';
  try {
    listGames = await loadGames(user);
    $('games-status').textContent = listGames.length ? '' : 'Aucune partie trouvée sur chess.com.';
  } catch (e) {
    $('games-status').textContent = `Impossible de récupérer les parties : ${(e as Error).message}.`;
  }
  chessStats = await loadChessStats(user).catch(() => null);
  const summaries = await loadProfile(user);
  accById = new Map(summaries.map((s) => [s.id, s.accuracy]));
  renderGamesList();
  // Une synthèse par cadence : on ne mélange pas bullet et rapide.
  const counts = SPEED_ORDER.map((sp) => [sp, listGames.filter((g) => g.speed === sp).length] as const).filter(([, n]) => n);
  if (!counts.some(([sp]) => sp === profileSpeed)) profileSpeed = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'blitz';
  renderProfile(
    profileStats(summaries.filter((g) => g.speed === profileSpeed), profileMinLoss),
    counts,
    listGames.filter((g) => g.speed === profileSpeed),
  );
}

// ---------------------------------------------------------------------------
// Statistiques en plus : adversaires, fins de partie, toutes les cadences
// ---------------------------------------------------------------------------

/** Statistiques chess.com par cadence (Elo, meilleur Elo, bilan), gardées 1 h comme la liste. */
let chessStats: { speeds: Record<string, SpeedStats>; puzzleBest?: number } | null = null;

async function loadChessStats(user: string) {
  const key = `stats:${user.toLowerCase()}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (cached && Date.now() - cached.at < 3600_000) return cached.stats;
  } catch {
    /* cache illisible : on recharge */
  }
  const stats = await fetchChessComStats(user);
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), stats }));
  } catch {
    /* stockage plein */
  }
  return stats;
}

/** « 30 V · 2 N · 3 D » en vert / gris / rouge. */
const vnd = (win: number, draw: number, loss: number, sep = ' · ', bare = false) =>
  [
    ['win', win, 'V'],
    ['draw', draw, 'N'],
    ['loss', loss, 'D'],
  ]
    .map(([c, n, l]) => `<span class="t-${c}">${(n as number).toLocaleString('fr-FR')}${bare ? '' : ` ${l}`}</span>`)
    .join(sep);

/** Résultat d'une partie (« 1-0 », « ½-½ »…) coloré du point de vue de `who` (sinon neutre). */
function resultBadge(result: string, white: string, black: string, who: string): string {
  const w = who.toLowerCase();
  const side = white.toLowerCase() === w ? 'w' : black.toLowerCase() === w ? 'b' : '';
  const draw = result.startsWith('½') || result === '1/2-1/2';
  const res = !side ? '' : draw ? 'draw' : (result === '1-0') === (side === 'w') ? 'win' : 'loss';
  return `<span class="${res ? `t-${res}` : ''}">${esc(result)}</span>`;
}

const fact = (label: string, value: string, title = '') =>
  `<div class="fact" ${title ? `title="${title}"` : ''}><div class="muted">${label}</div><div class="fact-v">${value}</div></div>`;

/** Adversaires et séries, sur les dernières parties seulement (les anciennes faussent le tableau). */
function opponentCard(list: OnlineGame[]): string {
  const u = profileName.toLowerCase();
  const rows = list
    .map((g) => {
      const white = g.white.toLowerCase() === u;
      return { g, white, opp: white ? g.black : g.white, elo: (white ? g.blackElo : g.whiteElo) ?? 0, res: resultFor(g) };
    })
    .filter((r) => r.elo);
  if (!rows.length) return '';
  const link = (r: (typeof rows)[number]) =>
    `<button class="link" data-open-gi="${listGames.indexOf(r.g)}">${esc(r.opp)} (${r.elo})</button> <span class="muted">${shortDate(r.g.date)}</span>`;
  const wins = rows.filter((r) => r.res === 'win');
  const losses = rows.filter((r) => r.res === 'loss').length;
  const best = wins.reduce<(typeof rows)[number] | undefined>((a, r) => (!a || r.elo > a.elo ? r : a), undefined);
  const avg = Math.round(rows.reduce((a, r) => a + r.elo, 0) / rows.length);
  const perf = Math.round(avg + (400 * (wins.length - losses)) / rows.length);
  // Séries : la liste va de la plus récente à la plus ancienne.
  let streak = 0;
  while (streak < rows.length && rows[streak].res === rows[0].res) streak++;
  const streakLabel = { win: 'victoire', loss: 'défaite', draw: 'nulle' }[rows[0].res];
  let longest = 0;
  let run = 0;
  for (const r of rows) {
    run = r.res === 'win' ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const scoreOf = (white: boolean) => {
    const rs = rows.filter((r) => r.white === white);
    return rs.length ? `${pct((100 * rs.reduce((a, r) => a + (r.res === 'win' ? 1 : r.res === 'draw' ? 0.5 : 0), 0)) / rs.length)} <span class="muted">(${rs.length})</span>` : '—';
  };
  return `<section class="card"><h2>Adversaires</h2>
    <p class="muted">Sur tes ${rows.length} dernières parties en ${SPEEDS[profileSpeed].toLowerCase()}.</p>
    <div class="facts-grid">
      ${fact('Victoire contre le plus fort', best ? link(best) : '—', "Ta victoire contre l'adversaire qui avait l'Elo le plus élevé")}
      ${fact('Elo moyen des adversaires', String(avg))}
      ${fact('Performance', String(perf), 'Estimation : Elo moyen des adversaires + 400 × (victoires − défaites) / parties')}
      ${fact('Série en cours', `<span class="t-${rows[0].res}">${streak} ${streakLabel}${streak > 1 ? 's' : ''}</span>`)}
      ${fact('Plus longue série de victoires', String(longest))}
      ${fact('Score avec les Blancs', scoreOf(true))}
      ${fact('Score avec les Noirs', scoreOf(false))}
    </div></section>`;
}

/** Comment se terminent les parties (d'après l'en-tête Termination de chess.com). */
const END_REASONS: [RegExp, string][] = [
  [/checkmate/i, 'mat'],
  [/resignation/i, 'abandon'],
  [/insufficient/i, 'matériel insuffisant'],
  [/on time|timeout/i, 'temps'],
  [/abandoned/i, 'partie quittée'],
  [/agreement/i, 'accord'],
  [/repetition/i, 'répétition'],
  [/stalemate/i, 'pat'],
  [/50/, 'règle des 50 coups'],
];

function endingsCard(list: OnlineGame[]): string {
  if (!list.length) return '';
  const reasonOf = (pgn: string) => {
    const t = pgn.match(/\[Termination "([^"]+)"\]/)?.[1] ?? '';
    return END_REASONS.find(([re]) => re.test(t))?.[1] ?? 'autre';
  };
  const line = (res: 'win' | 'loss' | 'draw', label: string) => {
    const gs = list.filter((g) => resultFor(g) === res);
    if (!gs.length) return '';
    const counts = [...groupCount(gs.map((g) => reasonOf(g.pgn)))].sort((a, b) => b[1] - a[1]);
    return `<tr><td><span class="res-dot ${res}"></span>${label} <span class="muted">(${gs.length})</span></td>
      <td>${counts.map(([r, c]) => `${r} ${pct((100 * c) / gs.length)}`).join(' · ')}</td></tr>`;
  };
  return `<section class="card"><h2>Fins de partie</h2>
    <table class="stats">${line('win', 'Victoires')}${line('loss', 'Défaites')}${line('draw', 'Nulles')}</table></section>`;
}

/** Toutes les cadences, sur tout l'historique du compte chess.com. */
function speedsCard(): string {
  if (!chessStats) return '';
  const rows = SPEED_ORDER.filter((sp) => chessStats!.speeds[sp]).map((sp) => {
    const s = chessStats!.speeds[sp];
    const n = s.win + s.loss + s.draw;
    const best = s.best ? `${s.best}${s.bestDate ? ` <span class="muted">${new Date(s.bestDate).toLocaleDateString('fr-FR')}</span>` : ''}` : '—';
    return `<tr class="${sp === profileSpeed ? 'current' : ''}"><td>${SPEEDS[sp]}</td><td>${s.rating ?? '—'}</td><td>${best}</td>
      <td>${n.toLocaleString('fr-FR')}</td><td>${vnd(s.win, s.draw, s.loss, ' / ', true)}</td><td>${n ? pct((100 * (s.win + s.draw / 2)) / n) : '—'}</td></tr>`;
  });
  if (!rows.length) return '';
  return `<section class="card"><h2>Toutes les cadences</h2>
    <p class="muted">Sur tout ton historique chess.com.${chessStats.puzzleBest ? ` Meilleur classement en problèmes : ${chessStats.puzzleBest}.` : ''}</p>
    <table class="stats"><tr><th>Cadence</th><th>Elo</th><th>Meilleur</th><th>Parties</th><th>V / N / D</th><th>Score</th></tr>${rows.join('')}</table></section>`;
}

/** Seuil de la synthèse : perte minimale (points de chances de gain) pour qu'une erreur compte. */
let profileMinLoss = 0;
const LOSS_FILTERS: [number, string][] = [
  [0, 'Toutes (imprécisions comprises)'],
  [THRESHOLDS.inaccuracy, `Erreurs et gaffes (≥ ${THRESHOLDS.inaccuracy} pts)`],
  [THRESHOLDS.mistake, `Gaffes seulement (≥ ${THRESHOLDS.mistake} pts)`],
];

const SPEED_ORDER = ['rapid', 'blitz', 'bullet', 'daily'];
const SPEEDS: Record<string, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', daily: 'Par jour' };
/** Cadence affichée dans la synthèse du profil. */
let profileSpeed = '';

/**
 * Courbe avec ses axes : en ordonnée, les valeurs (max, milieu, min) ; en abscisse, la date
 * de la première, de la partie du milieu et de la dernière partie.
 */
function sparkline(values: number[], dates: string[], cls: string, fmt: (v: number) => string, yTitle: string): string {
  if (values.length < 2) return '<p class="muted">Pas encore assez de parties pour tracer une courbe.</p>';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  // Marges de 4 en haut et en bas : les graduations tombent sur y = 4, 30 et 56.
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 200},${56 - ((v - lo) / span) * 52}`).join(' ');
  const mid = Math.floor((values.length - 1) / 2);
  return `<div class="chart">
      <div class="y-title">${yTitle}</div><div></div>
      <div class="y-axis"><span>${fmt(hi)}</span><span>${fmt((hi + lo) / 2)}</span><span>${fmt(lo)}</span></div>
      <svg class="spark ${cls}" viewBox="0 0 200 60" preserveAspectRatio="none">
        <line class="grid" x1="0" x2="200" y1="4" y2="4" /><line class="grid" x1="0" x2="200" y1="30" y2="30" /><line class="grid" x1="0" x2="200" y1="56" y2="56" />
        <polyline points="${pts}" /></svg>
      <div></div>
      <div class="x-axis"><span>${dates[0]}</span><span>${dates[mid]}</span><span>${dates.at(-1)}</span></div>
      <div></div><div class="x-title">Parties (de la plus ancienne à la plus récente) · dernière : ${fmt(values.at(-1)!)}</div>
    </div>`;
}

/** "2026.11.23 18:04:12" ou Date → "23/11". */
const shortDate = (d: Date | string) =>
  typeof d === 'string' ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

function renderProfile(s: ProfileStats, counts: (readonly [string, number])[], list: OnlineGame[]) {
  const n = s.games.length;
  const u = profileName.toLowerCase();
  const speedButtons =
    counts.length > 1
      ? `<div class="speed-bar">${counts
          .map(([sp, c]) => `<button data-speed="${sp}" class="${sp === profileSpeed ? 'active' : ''}">${SPEEDS[sp]} (${c})</button>`)
          .join('')}</div>`
      : '';

  // Milieu : les statistiques à lire.
  const chrono = [...list].reverse();
  const eloGames = chrono.filter((g) => (g.white.toLowerCase() === u ? g.whiteElo : g.blackElo));
  const elos = eloGames.map((g) => (g.white.toLowerCase() === u ? g.whiteElo : g.blackElo)!);
  const rec = { win: 0, draw: 0, loss: 0 };
  for (const g of list) rec[resultFor(g)]++;
  const kpi = (label: string, value: string, sub = '') =>
    `<div class="kpi"><div class="muted">${label}</div><div class="kpi-v">${value}</div>${sub ? `<div class="muted kpi-s">${sub}</div>` : ''}</div>`;
  const byColor = (c: 'w' | 'b') => (s.games.some((g) => g.color === c) ? s.accuracy[c].toFixed(1) : '—');
  const blunders = s.games.flatMap((g) => g.mistakes).filter((m) => m.classification === 'blunder').length;
  const eloDiff = elos.length >= 2 ? elos.at(-1)! - elos[0] : 0;
  const accGames = [...s.games].sort((a, b) => a.date.localeCompare(b.date));
  const accs = accGames.map((g) => g.accuracy);
  const row = (cells: (string | number)[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  $('profile-main').innerHTML = `
    ${speedButtons}
    <div class="kpis">
      ${kpi('Précision', n ? s.accuracy.all.toFixed(1) : '—', n ? `Blancs ${byColor('w')} · Noirs ${byColor('b')}` : 'aucune partie analysée')}
      ${kpi('Elo', elos.length ? String(elos.at(-1)) : '—', elos.length >= 2 ? `${eloDiff >= 0 ? '+' : ''}${eloDiff} sur ${elos.length} parties` : '')}
      ${kpi('Bilan', list.length ? pct((100 * (rec.win + rec.draw / 2)) / list.length) : '—', vnd(rec.win, rec.draw, rec.loss))}
      ${kpi('Gaffes par partie', n ? (blunders / n).toFixed(1) : '—', `${n} partie${n > 1 ? 's' : ''} analysée${n > 1 ? 's' : ''} sur ${list.length}`)}
    </div>
    <div class="chart-row">
    <section class="card"><h2>Elo — ${SPEEDS[profileSpeed]}</h2>${sparkline(elos, eloGames.map((g) => shortDate(g.date)), 'elo', (v) => String(Math.round(v)), 'Elo')}</section>
    <section class="card"><h2>Précision par partie</h2>${
      n
        ? sparkline(accs, accGames.map((g) => shortDate(g.date)), 'acc-line', (v) => v.toFixed(1), 'Précision (%)')
        : '<p class="muted">Analyse tes parties pour voir ta précision.</p>'
    }</section>
    </div>
    ${opponentCard(list)}
    ${endingsCard(list)}
    ${speedsCard()}
    <section class="card">
      <h2>Ouvertures les plus jouées</h2>
      ${
        s.openings.length
          ? `<table class="stats"><tr><th>Ouverture</th><th>Parties</th><th>Points</th><th>Précision</th></tr>
             ${s.openings.slice(0, 6).map((o) => row([esc(o.name), o.games, pct(o.score), o.accuracy.toFixed(1)])).join('')}</table>`
          : '<p class="muted">Analyse tes parties pour voir tes ouvertures.</p>'
      }
    </section>
    ${s.strengths.length ? `<section class="card"><h2>Points forts</h2><ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}`;

  // Droite : ce qu'on peut travailler (cartes cliquables).
  profileExamples = [];
  profileCauses = s.causes;
  profileMistakes = s.games.flatMap((g) => g.mistakes);
  const example = (m: MistakeRecord) => {
    profileExamples.push(m);
    const what = m.san ? `coup ${Math.ceil(m.ply / 2)} : ${esc(m.san)}` : `position gagnante au coup ${Math.ceil(m.ply / 2)}`;
    return `<li><button class="link" data-ex="${profileExamples.length - 1}">contre ${esc(m.opponent)} · ${what}</button></li>`;
  };
  // Problèmes : seulement les erreurs commises là où il n'y avait qu'un bon coup.
  const trainButton = (c: ProfileStats['causes'][number], i: number, cls = '') => {
    const k = c.examples.filter((m) => m.onlyMove).length;
    return k ? `<button class="${cls}" data-train="${i}">S'entraîner (${k})</button>` : '';
  };
  // « Erreur de position » est la catégorie fourre-tout : on préfère une cause précise.
  const top = s.causes.find((c) => c.tag !== 'gache' && c.tag !== 'position') ?? s.causes.find((c) => c.tag !== 'gache');
  const PHASE_IN: Record<string, string> = { ouverture: 'ouverture', milieu: 'milieu de partie', finale: 'finale' };
  let weak = '';
  if (top && top.tag !== 'gache') {
    const phases = [...groupCount(top.examples.map((m) => m.phase))].sort((a, b) => b[1] - a[1]);
    weak = `<section class="card weak">
      <div class="weak-k">Ton point faible n°1</div><div class="weak-t">${TAGS[top.tag]}</div>
      <div class="muted">${pct((100 * top.count) / s.totalMistakes)} de tes erreurs · surtout en ${PHASE_IN[phases[0][0]]}</div>
      ${trainButton(top, s.causes.indexOf(top), 'primary')}</section>`;
  }
  const causes = s.causes
    .map((c, i) => {
      const label = c.tag === 'gache' ? 'Avantage gâché' : TAGS[c.tag];
      const share = c.tag === 'gache' ? `${pct((100 * c.count) / n)} des parties` : pct((100 * c.count) / s.totalMistakes);
      const train = c.tag === 'gache' ? '' : trainButton(c, i);
      return `<details class="cause-card"><summary><span>${label}</span><span class="muted">${share}</span></summary>
        ${train}<ul class="examples">${c.examples.slice(-8).reverse().map(example).join('')}</ul></details>`;
    })
    .join('');
  const lossSelect = `<label class="muted" title="Variation minimale de la barre d'évaluation pour qu'une erreur soit retenue">Erreurs retenues
      <select id="profile-minloss">${LOSS_FILTERS.map(
        ([v, l]) => `<option value="${v}" ${v === profileMinLoss ? 'selected' : ''}>${l}</option>`,
      ).join('')}</select></label>`;
  const exos = s.causes.filter((c) => c.tag !== 'gache').reduce((a, c) => a + c.count, 0);
  const navCards = `<button class="card nav-card" data-goto="ouvertures"><b>Ouvertures</b>
      <span class="muted">${s.openings[0] ? `Ta plus jouée : ${esc(s.openings[0].name.slice(s.openings[0].name.indexOf(' ') + 1))}` : 'Catalogue et entraînement'}</span></button>`;
  const probCard = n
    ? `<button class="card nav-card" data-goto="problemes"><b>Problèmes</b><span class="muted">${exos} exercices tirés de tes erreurs</span></button>`
    : '';
  $('profile-side').innerHTML = n
    ? `<h2 class="side-title">À travailler</h2>${probCard}${navCards}${weak}${lossSelect}<div class="cause-list">${causes}</div>`
    : `<h2 class="side-title">À travailler</h2>${navCards}<section class="card"><p>Analyse tes parties pour découvrir tes erreurs les plus fréquentes.</p>
       <button class="primary" data-run>Analyser toutes les parties</button></section>`;
}

$('view-profil').addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.id !== 'profile-minloss') return;
  profileMinLoss = Number(t.value);
  refreshProfile();
});
$('view-profil').addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  const sp = t.closest<HTMLElement>('[data-speed]');
  if (sp) {
    profileSpeed = sp.dataset.speed!;
    refreshProfile();
    return;
  }
  if (t.closest('[data-run]')) return runProfile();
  const og = t.closest<HTMLElement>('[data-open-gi]');
  if (og) return openListGame(listGames[Number(og.dataset.openGi)]);
  const ex = t.closest<HTMLElement>('[data-ex]');
  if (ex) {
    const m = profileExamples[Number(ex.dataset.ex)];
    const f = await cacheGet<Fiche>(m.id);
    if (f) await openFiche(f, m.ply);
    return;
  }
  const train = t.closest<HTMLElement>('[data-train]');
  if (train) return openProblems(Number(train.dataset.train));
  const goto = t.closest<HTMLElement>('[data-goto]');
  if (goto?.dataset.goto === 'ouvertures') return openOpenings();
  if (goto?.dataset.goto === 'problemes') return openRandomProblems();
});

async function runProfile() {
  const user = profileUser();
  if (!user || profileRunning) return;
  profileRunning = true;
  profileStop = false;
  $('profile-run').hidden = true;
  $('profile-stop').hidden = false;
  const status = $('profile-status');
  const engines = Math.max(1, Number($<HTMLInputElement>('profile-engines').value) || 1);
  status.textContent = 'Récupération des parties sur chess.com…';
  $('profile-progress').hidden = false;
  // Garde l'écran allumé : un navigateur mobile suspend la page quand l'écran s'éteint.
  const wakeLock = await navigator.wakeLock?.request('screen').catch(() => undefined);
  try {
    await loadBook();
    const res = await analyseProfile(
      user,
      Number($<HTMLSelectElement>('profile-count').value),
      $<HTMLSelectElement>('profile-speed').value,
      engines,
      PROFILE_DEPTH,
      (done, total) => {
        $('profile-progress-fill').style.width = `${total ? (100 * done) / total : 100}%`;
        status.textContent = `Analyse : ${done}/${total} parties (${engines} moteur${engines > 1 ? 's' : ''}, profondeur ${PROFILE_DEPTH})…`;
        if (done % 5 === 0) refreshProfile();
      },
      () => profileStop,
    );
    status.textContent = profileStop
      ? 'En pause. Les parties terminées sont enregistrées : relance pour continuer.'
      : `Terminé : ${res.total} parties (${res.skipped} étaient déjà analysées).`;
  } catch (e) {
    status.textContent = `Impossible d'analyser le profil : ${(e as Error).message}.`;
  } finally {
    wakeLock?.release();
    profileRunning = false;
    $('profile-run').hidden = false;
    $('profile-stop').hidden = true;
    $('profile-progress').hidden = true;
    refreshProfile();
  }
}

async function exportFile() {
  const user = profileUser();
  const blob = await exportProfile(user);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analyses-echecs-${user || 'sans-pseudo'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Restaure un fichier d'analyses ; sur l'accueil, ouvre ensuite le profil enregistré dans le fichier. */
async function importFile(file: File) {
  let msg: string;
  try {
    const r = await importProfile(await file.text());
    if (!profileName && r.username) saveUser(r.username);
    msg =
      `Analyses restaurées : ${r.added} partie${r.added > 1 ? 's' : ''} ajoutée${r.added > 1 ? 's' : ''}, ${r.kept} déjà présente${r.kept > 1 ? 's' : ''}` +
      (r.invalid ? `, ${r.invalid} ignorée${r.invalid > 1 ? 's' : ''} (illisibles)` : '') +
      '.';
  } catch (e) {
    msg = `Restauration impossible : ${(e as Error).message}.`;
  }
  $('profile-status').textContent = msg;
  $('home-status').textContent = msg;
  if (profileName) showView('profil');
}

// ---------------------------------------------------------------------------
// Chargement et navigation
// ---------------------------------------------------------------------------

/**
 * Charge une partie et ouvre sa vue. `pov` : le joueur à mettre en bas de l'échiquier
 * (le profil par défaut, ou le pseudo recherché à l'import), qu'il ait les Blancs ou les Noirs.
 */
export function load(pgn: string, pov = profileName, view: View = 'partie') {
  let g: Game;
  try {
    g = parsePgn(pgn);
  } catch (e) {
    $('error').textContent = 'PGN invalide : ' + (e as Error).message;
    return;
  }
  analysisToken++; // annule une éventuelle analyse en cours
  analysing = false;
  engine.stop();
  $<HTMLButtonElement>('analyse').disabled = false;
  $('analyse').textContent = 'Analyser la partie';
  setProgress(1, 1);
  $('error').textContent = '';
  game = g;
  currentPgn = pgn;
  root = buildTree(g);
  analysis = null;
  puzzle = null;
  $('opening').textContent = '';
  // Partie déjà analysée : on la réaffiche tout de suite, sans moteur.
  loadBook().then(async () => {
    showOpening();
    const f = await cacheGet<Fiche>(gameId(g));
    if (f && game === g && !analysis && !analysing && f.positions.length === g.fens.length) {
      finishAnalysis(reviewGame(g, f.positions, f.depth));
    }
  });
  const h = g.headers;
  $('game-info').innerHTML = h.White
    ? `${esc(h.White)} – ${esc(h.Black)}${h.Result && h.Result !== '*' ? ` (${resultBadge(h.Result, h.White, h.Black ?? '', pov)})` : ''}`
    : '';
  const orientation = pov && h.Black?.toLowerCase() === pov.toLowerCase() ? 'black' : 'white';
  board.set({ orientation });
  $('evalbar').classList.toggle('flipped', orientation === 'black');
  importDialog().close();
  showView(view);
  renderGamesList();
  renderPlayers();
  renderReport();
  renderMoves();
  show(root);
}

export const go = {
  prev: () => current?.parent && show(current.parent),
  next: () => current?.children[0] && show(current.children[0]),
  first: () => root && show(root),
  last: () => {
    let n = current;
    while (n?.children[0]) n = n.children[0];
    if (n) show(n);
  },
  /** Quitte la variante : revient à la position de la partie d'où elle part. */
  backToGame: () => {
    let n: TreeNode | undefined = current ?? undefined;
    while (n && !n.mainline) n = n.parent;
    if (n) show(n);
  },
};

$('load').onclick = () => load($<HTMLTextAreaElement>('pgn').value);
$('go-profile').onclick = () => showView(profileName ? 'profil' : 'accueil');
$('change-profile').onclick = () => showView('accueil');
$('home-import').onclick = $('profile-open-import').onclick = () => importDialog().showModal();
$('home-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = $<HTMLInputElement>('home-user').value.trim();
  if (!user) return;
  if (user.toLowerCase() !== profileName.toLowerCase()) listGames = [];
  saveUser(user);
  showView('profil');
});
$('home-restore').onclick = $('profile-restore').onclick = () => $('restore-file').click();
$<HTMLInputElement>('restore-file').onchange = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) importFile(input.files[0]);
  input.value = '';
};
$('profile-run').onclick = runProfile;
$('profile-stop').onclick = () => {
  profileStop = true;
  $('profile-status').textContent = 'Mise en pause après la position en cours…';
};
$('profile-export').onclick = exportFile;
$<HTMLInputElement>('profile-engines').value = String(ENGINES);

// Version installée / hors ligne (pas en développement : le cache gênerait le rechargement à chaud).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
$('analyse').onclick = runAnalysis;
$('first').onclick = go.first;
$('prev').onclick = go.prev;
$('next').onclick = go.next;
$('last').onclick = go.last;
$('flip').onclick = () => {
  board.toggleOrientation();
  $('evalbar').classList.toggle('flipped', board.state.orientation === 'black');
  renderPlayers();
};
$('engine-on').onchange = () => current && updateEngine(current);
$('key-prev').onclick = () => jumpKeyMoment(-1);
$('key-next').onclick = () => jumpKeyMoment(1);
$('online-search').onclick = searchOnline;
$('online-user').addEventListener('keydown', (e) => e.key === 'Enter' && searchOnline());

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
  const actions: Record<string, () => void> = {
    ArrowLeft: go.prev,
    ArrowRight: go.next,
    ArrowUp: go.backToGame,
    Home: go.first,
    End: go.last,
  };
  if (actions[e.key]) {
    e.preventDefault();
    actions[e.key]();
  }
});

// Démarrage : l'accueil la première fois, ensuite directement le profil.
try {
  profileName = localStorage.getItem(USER_KEY) ?? '';
} catch {
  /* stockage indisponible : accueil */
}
showView(profileName ? 'profil' : 'accueil');
