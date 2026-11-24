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
  THRESHOLDS,
  reviewGame,
  reviewMove,
  type Classification,
  type GameAnalysis,
  type MoveReview,
  type PositionEval,
} from './analysis';
import { Chess, type Square } from 'chess.js';
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
import { explainMove } from './explain';
import { loadBook, loadCatalogue, openingName, type CatalogueLine } from './openings';
import { fetchChessCom, fetchChessComStats, fetchLichess, type OnlineGame, type SpeedStats } from './import';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const board = Chessground($('board'), {
  coordinates: true,
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
});
const engine = new Engine();
/** Téléphone ou tablette : moins de cœurs, ça chauffe → analyses moins profondes. */
const MOBILE = matchMedia('(pointer: coarse)').matches;
const LIVE_DEPTH = MOBILE ? 14 : 18;
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
let root: TreeNode | null = null;
let current: TreeNode | null = null;
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
  if (puzzle) return puzzleMove(orig, dest);
  const piece = new Chess(current.fen).get(orig as Square);
  const promoting = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1');
  const node = playMove(current, orig, dest, promoting ? 'q' : undefined);
  if (!node) return show(current);
  renderMoves();
  show(node);
}

function show(node: TreeNode) {
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
  board.setAutoShapes(shapes);
}

function clearEngine() {
  $('engine-lines').innerHTML = '';
  $('engine-status').textContent = '';
  board.setAutoShapes([]);
}

function updateEngine(node: TreeNode) {
  if (puzzle || training) {
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

function renderMoves() {
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
  if (puzzle) return renderPuzzle();
  const box = $('review');
  const r = node.review;
  if (!r || !node.move || !node.parent) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.className = `review c-${r.classification}`;
  const best = r.bestUci ? uciToSan(node.parent.fen, [r.bestUci])[0] : undefined;
  const showBest = best && best !== node.move.san && !['brilliant', 'great', 'best'].includes(r.classification);
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'review-title';
  title.textContent = `${LABELS[r.classification].symbol} ${node.move.san} ${VERDICT[r.classification]}`;
  const detail = document.createElement('div');
  detail.className = 'muted';
  detail.textContent =
    `Précision du coup : ${Math.round(r.accuracy)} %` +
    (r.loss >= 1 ? ` · chances de gain perdues : ${r.loss.toFixed(1)} pts` : '') +
    (showBest ? ` · meilleur coup : ${best}` : '');
  box.append(title, detail);

  // Explication : faits vérifiés par le moteur et les règles.
  const facts = explainMove(node);
  if (!facts.length) return;
  const ul = document.createElement('ul');
  ul.className = 'facts';
  for (const f of facts) ul.append(Object.assign(document.createElement('li'), { textContent: f }));
  box.append(ul);
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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

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
    result = await analyseGame(
      engine,
      g,
      depth,
      (positions, moves) => {
        applyAnalysis(positions, moves, depth);
        setProgress(positions.length, g.fens.length);
        $('analyse').textContent = `Analyse… ${positions.length}/${g.fens.length}`;
        if (current && current.ply < positions.length && current.mainline) show(current);
      },
      () => token !== analysisToken,
    );
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
  show(target.parent!);
}

function startPuzzleQueue(queue: { id: string; ply: number }[], view: View = 'partie') {
  if (!queue.length) return false;
  puzzle = { queue, index: 0, state: 'try', view };
  showView(view);
  showPuzzle();
  return true;
}

function startPuzzles(color: 'w' | 'b') {
  if (!root || !game) return;
  const id = gameId(game);
  const queue = mainline(root)
    .filter((n) => n.move?.color === color && n.review && BAD.includes(n.review.classification) && n.parent?.eval?.lines[0])
    .map((n) => ({ id, ply: n.ply }));
  if (!startPuzzleQueue(queue)) $('report-msg').textContent = 'Aucune erreur à retravailler pour ce camp.';
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

function puzzleMove(orig: Key, dest: Key) {
  if (!puzzle || !current) return;
  const target = puzzleTarget();
  const chess = new Chess(current.fen);
  const piece = chess.get(orig as Square);
  const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : '';
  const san = chess.move({ from: orig, to: dest, promotion: promo || undefined }).san;
  const ok = goodAnswers(target.parent!).includes(orig + dest + promo);
  puzzle.state = ok ? 'solved' : 'wrong';
  puzzle.tried = san;
  if (!puzzle.recorded) {
    const item = puzzle.queue[puzzle.index];
    recordExo(item.id, item.ply, ok);
    puzzle.recorded = true;
  }
  renderPuzzle();
  if (!ok) setTimeout(() => puzzle && show(target.parent!), 700);
  else board.set({ movable: { color: undefined } });
}

function renderPuzzle() {
  if (!puzzle) return;
  const box = $('review');
  const target = puzzleTarget();
  const position = target.parent!;
  const bestUci = position.eval!.lines[0].pv[0];
  const bestSan = uciToSan(position.fen, [bestUci])[0];
  box.hidden = false;
  box.className = 'review puzzle';
  const n = `${puzzle.index + 1}/${puzzle.queue.length}`;
  const side = target.move!.color === 'w' ? 'les Blancs' : 'les Noirs';
  const msg = {
    try: `Exercice ${n} — Dans la partie, ${side} ont joué ${target.move!.san} (${LABELS[target.review!.classification].name.toLowerCase()}). Trouve mieux !`,
    wrong: `${puzzle.tried} n'est pas le bon coup. Réessaie.`,
    solved: `Bravo ! ${puzzle.tried} était ${puzzle.tried === bestSan ? 'le meilleur coup' : 'un très bon coup'}.`,
    shown: `La solution était ${bestSan} (flèche verte).`,
  }[puzzle.state];
  box.innerHTML = '';
  box.append(Object.assign(document.createElement('div'), { className: 'review-title', textContent: msg }));
  const bar = document.createElement('div');
  bar.className = 'puzzle-bar';
  const button = (label: string, fn: () => void) => {
    const b = Object.assign(document.createElement('button'), { textContent: label });
    b.onclick = fn;
    bar.append(b);
  };
  if (puzzle.state === 'try' || puzzle.state === 'wrong') {
    button('Solution', () => {
      puzzle!.state = 'shown';
      if (!puzzle!.recorded) {
        const item = puzzle!.queue[puzzle!.index];
        recordExo(item.id, item.ply, false);
        puzzle!.recorded = true;
      }
      board.setAutoShapes([{ orig: bestUci.slice(0, 2) as Key, dest: bestUci.slice(2, 4) as Key, brush: 'green' }]);
      renderPuzzle();
    });
  }
  if (puzzle.index + 1 < puzzle.queue.length) {
    button('Suivant', () => {
      puzzle!.index++;
      puzzle!.state = 'try';
      puzzle!.recorded = false;
      showPuzzle();
    });
  }
  button('Arrêter', () => {
    const fromProblems = puzzle!.view === 'problemes';
    puzzle = null;
    if (fromProblems) showView('profil');
    else show(target);
  });
  box.append(bar);
  if (puzzle.view === 'problemes') renderProblems();
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
      b.textContent = `${g.white} – ${g.black}  ${g.result}  ·  ${g.speed}  ·  ${g.date.toLocaleDateString('fr-FR')}`;
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
let profileCauses: ProfileStats['causes'] = [];

type View = 'accueil' | 'profil' | 'partie' | 'problemes' | 'ouvertures';

function showView(view: View) {
  $('view-accueil').hidden = view !== 'accueil';
  $('layout').hidden = view === 'accueil';
  $('view-profil').hidden = view !== 'profil';
  $('view-analyse').hidden = !['partie', 'problemes', 'ouvertures'].includes(view);
  // On quitte un exercice ou un entraînement en changeant de page.
  if (puzzle && view !== puzzle.view) puzzle = null;
  if (view !== 'ouvertures') {
    training = null;
    document.body.classList.remove('training');
  }
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
let profileName = '';
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
  const strongest = rows.reduce((a, r) => (r.elo > a.elo ? r : a));
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
      ${fact('Adversaire le plus fort', link(strongest))}
      ${fact('Elo moyen des adversaires', String(avg))}
      ${fact('Performance', String(perf), 'Estimation : Elo moyen des adversaires + 400 × (victoires − défaites) / parties')}
      ${fact('Série en cours', `${streak} ${streakLabel}${streak > 1 ? 's' : ''}`)}
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
      <td>${n.toLocaleString('fr-FR')}</td><td>${[s.win, s.draw, s.loss].map((x) => x.toLocaleString('fr-FR')).join(' / ')}</td><td>${n ? pct((100 * (s.win + s.draw / 2)) / n) : '—'}</td></tr>`;
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

const pct = (x: number) => `${Math.round(x)} %`;
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
      ${kpi('Bilan', list.length ? pct((100 * (rec.win + rec.draw / 2)) / list.length) : '—', `${rec.win} V · ${rec.draw} N · ${rec.loss} D`)}
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
  const example = (m: MistakeRecord) => {
    profileExamples.push(m);
    const what = m.san ? `coup ${Math.ceil(m.ply / 2)} : ${esc(m.san)}` : `position gagnante au coup ${Math.ceil(m.ply / 2)}`;
    return `<li><button class="link" data-ex="${profileExamples.length - 1}">contre ${esc(m.opponent)} · ${what}</button></li>`;
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
      <button class="primary" data-train="${s.causes.indexOf(top)}">S'entraîner (${top.count})</button></section>`;
  }
  const causes = s.causes
    .map((c, i) => {
      const label = c.tag === 'gache' ? 'Avantage gâché' : TAGS[c.tag];
      const share = c.tag === 'gache' ? `${pct((100 * c.count) / n)} des parties` : pct((100 * c.count) / s.totalMistakes);
      const train = c.tag === 'gache' ? '' : `<button data-train="${i}">S'entraîner (${c.count})</button>`;
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

/** Nombre d'occurrences de chaque valeur. */
function groupCount(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
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
  if (goto?.dataset.goto === 'problemes') {
    const first = profileCauses.findIndex((c) => c.tag !== 'gache' && c.tag !== 'position');
    return openProblems(first >= 0 ? first : profileCauses.findIndex((c) => c.tag !== 'gache'));
  }
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
// Page Problèmes : exercices tirés de tes erreurs, par type, avec suivi de réussite
// ---------------------------------------------------------------------------

/** Résultats des exercices (« partie#demi-coup » → réussites / échecs), gardés dans le navigateur. */
type ExoStats = Record<string, { ok: number; ko: number }>;
const exoKey = () => `exos:${profileName.toLowerCase()}`;

function exoStats(): ExoStats {
  try {
    return JSON.parse(localStorage.getItem(exoKey()) ?? '{}');
  } catch {
    return {};
  }
}

function recordExo(id: string, ply: number, ok: boolean) {
  const s = exoStats();
  const e = (s[`${id}#${ply}`] ??= { ok: 0, ko: 0 });
  if (ok) e.ok++;
  else e.ko++;
  try {
    localStorage.setItem(exoKey(), JSON.stringify(s));
  } catch {
    /* stockage indisponible : le suivi ne sera pas gardé */
  }
}

/** Cause d'erreur travaillée sur la page Problèmes (index dans profileCauses). */
let problemCause = -1;

function openProblems(i: number) {
  const c = profileCauses[i];
  if (!c) return;
  problemCause = i;
  const stats = exoStats();
  const solved = (m: MistakeRecord) => (stats[`${m.id}#${m.ply}`]?.ok ?? 0) > 0;
  // Les exercices jamais réussis d'abord, les plus récents en tête.
  const queue = [...c.examples]
    .reverse()
    .sort((a, b) => Number(solved(a)) - Number(solved(b)))
    .map((m) => ({ id: m.id, ply: m.ply }));
  startPuzzleQueue(queue, 'problemes');
  renderProblems();
}

function renderProblems() {
  const stats = exoStats();
  const rows = profileCauses
    .map((c, i) => {
      if (c.tag === 'gache') return '';
      const solved = c.examples.filter((m) => (stats[`${m.id}#${m.ply}`]?.ok ?? 0) > 0).length;
      return `<button class="op-row ${i === problemCause ? 'current' : ''}" data-ptag="${i}">
        <span class="op-name">${TAGS[c.tag]}</span><span class="muted" title="Exercices réussis">${solved}/${c.count}</span></button>`;
    })
    .join('');
  $('side-problems').innerHTML = `<h2>Problèmes</h2>
    <p class="muted">Retrouve le bon coup là où tu t'es trompé. Le compteur indique les exercices réussis du premier coup.</p>
    <div class="op-list">${rows}</div>`;
}

$('side-problems').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ptag]');
  if (b) openProblems(Number(b.dataset.ptag));
});

// ---------------------------------------------------------------------------
// Page Ouvertures : mes ouvertures, catalogue, ligne choisie, entraînement
// ---------------------------------------------------------------------------

/** Ligne du catalogue affichée (null : la liste des ouvertures). */
let openingLine: CatalogueLine | null = null;
let openingQuery = '';
/** Ouvertures de tes parties analysées, les plus jouées d'abord. */
let myOpenings: { name: string; color: 'w' | 'b'; games: number; score: number }[] = [];
/** Entraînement sur une ligne : le site joue l'adversaire, il faut retrouver les coups de la ligne. */
let training: { moves: string[]; color: 'w' | 'b'; index: number; errors: number } | null = null;

const shortName = (name: string) => (name.includes(':') ? name.slice(name.indexOf(':') + 1).trim() : name);
const linePgn = (moves: string) =>
  moves
    .split(' ')
    .map((m, i) => (i % 2 ? m : `${i / 2 + 1}. ${m}`))
    .join(' ');

async function openOpenings() {
  openingLine = null;
  load('', '', 'ouvertures');
  const games = profileName ? await loadProfile(profileName) : [];
  const groups = new Map<string, { name: string; color: 'w' | 'b'; games: number; points: number }>();
  for (const g of games) {
    const k = `${g.opening}|${g.color}`;
    const e = groups.get(k) ?? { name: g.opening, color: g.color, games: 0, points: 0 };
    e.games++;
    e.points += g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0;
    groups.set(k, e);
  }
  myOpenings = [...groups.values()]
    .map((o) => ({ name: o.name, color: o.color, games: o.games, score: (100 * o.points) / o.games }))
    .sort((a, b) => b.games - a.games);
  renderOpenings();
}

const lineButton = (l: CatalogueLine, i: number, short: boolean) =>
  `<button class="op-row" data-line="${i}"><span class="muted op-eco">${l[0]}</span><span class="op-name">${esc(short ? shortName(l[1]) : l[1])}</span></button>`;

let families: Map<string, number[]> | null = null;

/** Le catalogue rangé par famille (« Sicilian Defense » → ses variantes). */
function familyIndex(cat: CatalogueLine[]): Map<string, number[]> {
  if (!families) {
    families = new Map();
    cat.forEach((l, i) => {
      const f = l[1].split(':')[0];
      families!.set(f, [...(families!.get(f) ?? []), i]);
    });
  }
  return families;
}

async function renderOpenings() {
  const el = $('side-openings');
  if (openingLine) return renderOpeningLine();
  const mine = myOpenings.length
    ? myOpenings
        .slice(0, 8)
        .map(
          (o, i) =>
            `<button class="op-row" data-mine="${i}"><span class="dot ${o.color === 'w' ? 'white' : 'black'}"></span>
             <span class="op-name">${esc(o.name.slice(o.name.indexOf(' ') + 1))}</span>
             <span class="muted">${o.games} · ${pct(o.score)}</span></button>`,
        )
        .join('')
    : '<p class="muted">Analyse tes parties pour voir tes ouvertures ici.</p>';
  el.innerHTML = `<h2>Ouvertures</h2>
    <h3>Mes ouvertures</h3><div class="op-list">${mine}</div>
    <h3>Toutes les ouvertures</h3>
    <input id="op-search" type="search" placeholder="Chercher : Najdorf, Caro-Kann, B90…" autocomplete="off" />
    <div class="op-list op-all"></div>`;
  $<HTMLInputElement>('op-search').value = openingQuery;
  await renderAllOpenings();
}

/** La liste « Toutes les ouvertures » : familles repliées, ou résultats de la recherche. */
async function renderAllOpenings() {
  const cat = await loadCatalogue();
  const list = document.querySelector('.op-all');
  if (!list) return;
  const q = openingQuery.trim().toLowerCase();
  if (q) {
    const hits = cat.flatMap((l, i) => (`${l[0]} ${l[1]}`.toLowerCase().includes(q) ? [i] : [])).slice(0, 60);
    list.innerHTML = hits.length ? hits.map((i) => lineButton(cat[i], i, false)).join('') : '<p class="muted">Aucune ouverture trouvée.</p>';
    return;
  }
  list.innerHTML = [...familyIndex(cat)]
    .map(([f, idx]) => `<details class="op-family"><summary>${esc(f)} <span class="muted">${idx.length}</span></summary><div class="op-vars" data-family="${esc(f)}"></div></details>`)
    .join('');
}

async function selectLine(i: number, color: 'w' | 'b' = 'w') {
  const cat = await loadCatalogue();
  openingLine = cat[i];
  training = null;
  document.body.classList.remove('training');
  load(linePgn(openingLine[2]), '', 'ouvertures');
  board.set({ orientation: color === 'w' ? 'white' : 'black' });
  $('evalbar').classList.toggle('flipped', color === 'b');
  go.last();
  renderOpenings();
}

function renderOpeningLine() {
  if (!openingLine) return;
  const [eco, name, moves] = openingLine;
  const mine = myOpenings.filter((o) => o.name === `${eco} ${name}`);
  $('side-openings').innerHTML = `<button class="link" data-back>‹ Toutes les ouvertures</button>
    <h2>${esc(name)}</h2>
    <div class="muted">${eco} · ${moves.split(' ').length} demi-coups de théorie</div>
    ${mine.map((o) => `<p>Jouée ${o.games} fois avec les ${o.color === 'w' ? 'Blancs' : 'Noirs'} · ${pct(o.score)} des points</p>`).join('')}
    <div class="train-bar">
      <button class="primary" data-train-color="w">S'entraîner avec les Blancs</button>
      <button data-train-color="b">avec les Noirs</button>
    </div>
    <p id="train-msg" class="train-msg"></p>
    <div class="no-training"><h3>Suites de théorie</h3><div id="book-moves" class="op-list"></div></div>`;
  renderBookMoves();
}

/** Coups de théorie depuis la position affichée : les coups légaux qui mènent à une position connue. */
function renderBookMoves() {
  const el = document.getElementById('book-moves');
  if (!el || !current) return;
  const items = new Chess(current.fen)
    .moves({ verbose: true })
    .flatMap((m) => {
      const name = openingName(m.after);
      return name ? [{ m, name }] : [];
    });
  el.innerHTML = items.length
    ? items
        .map(
          ({ m, name }) =>
            `<button class="op-row" data-book="${m.from}${m.to}${m.promotion ?? ''}"><b>${m.san}</b><span class="op-name muted">${esc(name.slice(name.indexOf(' ') + 1))}</span></button>`,
        )
        .join('')
    : '<p class="muted">Fin de la théorie connue ici : regarde les suites de Stockfish.</p>';
}

$('side-openings').addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id !== 'op-search') return;
  openingQuery = t.value;
  renderAllOpenings();
});

$('side-openings').addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-back]')) {
    openingLine = null;
    training = null;
    document.body.classList.remove('training');
    return renderOpenings();
  }
  // Une famille s'ouvre : on remplit ses variantes à ce moment-là (3 900 lignes en tout).
  const fam = t.closest('.op-family');
  if (t.closest('summary') && fam) {
    const vars = fam.querySelector<HTMLElement>('.op-vars')!;
    if (!vars.childElementCount) {
      const cat = await loadCatalogue();
      vars.innerHTML = familyIndex(cat).get(vars.dataset.family!)!.map((i) => lineButton(cat[i], i, true)).join('');
    }
    return;
  }
  const line = t.closest<HTMLElement>('[data-line]');
  if (line) return selectLine(Number(line.dataset.line));
  const mine = t.closest<HTMLElement>('[data-mine]');
  if (mine) {
    const o = myOpenings[Number(mine.dataset.mine)];
    const cat = await loadCatalogue();
    const i = cat.findIndex((l) => `${l[0]} ${l[1]}` === o.name);
    if (i >= 0) selectLine(i, o.color);
    return;
  }
  const book = t.closest<HTMLElement>('[data-book]');
  if (book && current) {
    const u = book.dataset.book!;
    const node = playMove(current, u.slice(0, 2), u.slice(2, 4), u[4]);
    if (node) {
      renderMoves();
      show(node);
    }
    return;
  }
  const tc = t.closest<HTMLElement>('[data-train-color]');
  if (tc) startTraining(tc.dataset.trainColor as 'w' | 'b');
});

function trainingMsg(text: string) {
  const el = document.getElementById('train-msg');
  if (el) el.textContent = text;
}

function startTraining(color: 'w' | 'b') {
  if (!openingLine || !root) return;
  training = { moves: openingLine[2].split(' '), color, index: 0, errors: 0 };
  document.body.classList.add('training');
  board.set({ orientation: color === 'w' ? 'white' : 'black' });
  $('evalbar').classList.toggle('flipped', color === 'b');
  show(root);
  trainingStep();
}

/** Tour suivant : le site joue le coup de l'adversaire, ou attend le tien. */
function trainingStep() {
  const t = training;
  if (!t || !current) return;
  if (t.index >= t.moves.length) {
    trainingMsg(`Ligne terminée ${t.errors ? `avec ${t.errors} erreur${t.errors > 1 ? 's' : ''}` : 'sans faute'} !`);
    training = null;
    document.body.classList.remove('training');
    show(current);
    return;
  }
  const turn = current.ply % 2 === 0 ? 'w' : 'b';
  if (turn !== t.color) {
    trainingMsg('L\'adversaire joue…');
    setTimeout(() => {
      if (training !== t || !current?.children[0]) return;
      t.index++;
      show(current.children[0]);
      trainingStep();
    }, 450);
  } else {
    trainingMsg(`À toi : trouve le coup de la ligne (${t.index + 1}/${t.moves.length}).`);
  }
}

function trainingMove(orig: Key, dest: Key) {
  const t = training!;
  const node = current!;
  const piece = new Chess(node.fen).get(orig as Square);
  const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : undefined;
  let san = '';
  try {
    san = new Chess(node.fen).move({ from: orig, to: dest, promotion: promo }).san;
  } catch {
    return show(node);
  }
  const next = node.children[0];
  if (san === t.moves[t.index] && next) {
    t.index++;
    show(next);
    return trainingStep();
  }
  t.errors++;
  trainingMsg(`${san} n'est pas le coup de la ligne : c'était ${t.moves[t.index]}. Rejoue-le.`);
  const hint = [{ orig: next.move!.from as Key, dest: next.move!.to as Key, brush: 'green' }];
  setTimeout(() => {
    if (training !== t) return;
    show(node);
    board.setAutoShapes(hint);
  }, 600);
}

// ---------------------------------------------------------------------------
// Chargement et navigation
// ---------------------------------------------------------------------------

/**
 * Charge une partie et ouvre sa vue. `pov` : le joueur à mettre en bas de l'échiquier
 * (le profil par défaut, ou le pseudo recherché à l'import), qu'il ait les Blancs ou les Noirs.
 */
function load(pgn: string, pov = profileName, view: View = 'partie') {
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
  $('game-info').textContent = h.White ? `${h.White} – ${h.Black}${h.Result ? ` (${h.Result})` : ''}` : '';
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

const go = {
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
// Un moteur par cœur, en laissant un cœur à la page (8 au plus par défaut, 2 sur téléphone).
$<HTMLInputElement>('profile-engines').value = String(Math.min(MOBILE ? 2 : 8, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)));

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
