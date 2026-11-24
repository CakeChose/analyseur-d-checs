import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
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
import { loadBook, openingName } from './openings';
import { fetchChessCom, fetchLichess } from './import';

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
  if (puzzle) {
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
  if (current) show(current);
}

/** Ouvre une partie enregistrée, déjà analysée, éventuellement à un coup donné. */
async function openFiche(f: Fiche, ply?: number) {
  const keep = puzzle;
  load(f.pgn);
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

const KEY_MOMENTS: Classification[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder'];

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
    await openFiche(f);
  }
  const target = puzzleTarget();
  const color = target.move!.color === 'w' ? 'white' : 'black';
  if (board.state.orientation !== color) $('flip').click();
  show(target.parent!);
}

function startPuzzleQueue(queue: { id: string; ply: number }[]) {
  if (!queue.length) return false;
  puzzle = { queue, index: 0, state: 'try' };
  showView('analyse');
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
      board.setAutoShapes([{ orig: bestUci.slice(0, 2) as Key, dest: bestUci.slice(2, 4) as Key, brush: 'green' }]);
      renderPuzzle();
    });
  }
  if (puzzle.index + 1 < puzzle.queue.length) {
    button('Suivant', () => {
      puzzle!.index++;
      puzzle!.state = 'try';
      showPuzzle();
    });
  }
  button('Arrêter', () => {
    puzzle = null;
    show(target);
  });
  box.append(bar);
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
        load(g.pgn);
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

function showView(view: 'analyse' | 'profil') {
  $('view-analyse').hidden = view !== 'analyse';
  $('view-profil').hidden = view !== 'profil';
  $('tab-analyse').classList.toggle('active', view === 'analyse');
  $('tab-profil').classList.toggle('active', view === 'profil');
  if (view === 'profil') refreshProfile();
}

const profileUser = () => $<HTMLInputElement>('profile-user').value.trim();

function saveUser(user: string) {
  try {
    localStorage.setItem(USER_KEY, user);
  } catch {
    /* stockage indisponible : il faudra retaper le pseudo */
  }
}

async function refreshProfile() {
  const user = profileUser();
  const el = $('profile-summary');
  if (!user) {
    el.innerHTML = '<p class="muted">Indique ton pseudo chess.com pour voir ton profil.</p>';
    return;
  }
  await loadBook();
  const games = await loadProfile(user);
  if (!games.length) {
    el.innerHTML = `<p class="muted">Aucune partie analysée pour ${esc(user)}. Lance « Analyser mes parties ».</p>`;
    return;
  }
  // Une synthèse par cadence : on ne mélange pas bullet et rapide.
  const counts = SPEED_ORDER.map((sp) => [sp, games.filter((g) => g.speed === sp).length] as const).filter(([, n]) => n);
  if (!counts.some(([sp]) => sp === profileSpeed)) profileSpeed = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  renderProfile(profileStats(games.filter((g) => g.speed === profileSpeed), profileMinLoss), counts);
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

function renderProfile(s: ProfileStats, counts: (readonly [string, number])[]) {
  const speedButtons =
    counts.length > 1
      ? counts
          .map(([sp, n]) => `<button data-speed="${sp}" class="${sp === profileSpeed ? 'active' : ''}">${SPEEDS[sp]} (${n})</button>`)
          .join('')
      : '';
  const lossSelect = `<label class="muted" title="Variation minimale de la barre d'évaluation pour qu'une erreur soit retenue">Erreurs retenues
      <select id="profile-minloss">${LOSS_FILTERS.map(
        ([v, l]) => `<option value="${v}" ${v === profileMinLoss ? 'selected' : ''}>${l}</option>`,
      ).join('')}</select></label>`;
  const speedBar = `<div class="speed-bar">${speedButtons}<span class="spacer"></span>${lossSelect}</div>`;
  profileExamples = [];
  profileCauses = s.causes;
  const example = (m: MistakeRecord) => {
    profileExamples.push(m);
    const what = m.san ? `coup ${Math.ceil(m.ply / 2)} : ${esc(m.san)} (${LABELS[m.classification].name.toLowerCase()})` : `position gagnante au coup ${Math.ceil(m.ply / 2)}`;
    return `<li><button class="link" data-ex="${profileExamples.length - 1}">contre ${esc(m.opponent)} · ${what}</button></li>`;
  };
  const causes = s.causes
    .map((c, i) => {
      const label = c.tag === 'gache' ? 'Avantage gâché (position gagnante, partie non gagnée)' : TAGS[c.tag];
      const share = c.tag === 'gache' ? `${pct((100 * c.count) / s.games.length)} des parties` : `${pct((100 * c.count) / s.totalMistakes)} des erreurs`;
      const train = c.tag === 'gache' ? '' : `<button data-train="${i}">S'entraîner (${c.count} exercice${c.count > 1 ? 's' : ''})</button>`;
      return `<details class="cause"><summary><b>${label}</b> <span class="muted">— ${c.count} · ${share}</span></summary>
        ${train}<ul class="examples">${c.examples.slice(-10).reverse().map(example).join('')}</ul></details>`;
    })
    .join('');
  const row = (cells: (string | number)[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  $('profile-summary').innerHTML = `
    ${speedBar}
    <section class="card">
      <h2>Vue d'ensemble — ${SPEEDS[profileSpeed]}</h2>
      <p><b>${s.games.length}</b> parties analysées en ${SPEEDS[profileSpeed].toLowerCase()} · ${s.record.win} victoires, ${s.record.draw} nulles, ${s.record.loss} défaites</p>
      <table class="stats">
        <tr><th>Précision moyenne</th><th>avec les Blancs</th><th>avec les Noirs</th></tr>
        ${row([
          s.accuracy.all.toFixed(1),
          s.games.some((g) => g.color === 'w') ? s.accuracy.w.toFixed(1) : '—',
          s.games.some((g) => g.color === 'b') ? s.accuracy.b.toFixed(1) : '—',
        ])}
      </table>
    </section>
    <section class="card">
      <h2>Points forts</h2>
      ${s.strengths.length ? `<ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Pas encore assez de parties pour en dégager.</p>'}
    </section>
    <section class="card wide">
      <h2>Erreurs les plus fréquentes</h2>
      <p class="muted">${s.totalMistakes} erreurs retenues · ${LOSS_FILTERS.find(([v]) => v === profileMinLoss)![1]}. Une erreur peut avoir plusieurs causes.</p>
      ${causes}
    </section>
    <section class="card">
      <h2>Erreurs par phase de jeu</h2>
      <table class="stats">
        <tr><th>Phase</th><th>Coups joués</th><th>Erreurs</th><th>Pour 100 coups</th></tr>
        ${s.byPhase.map((p) => row([p.phase, p.moves, p.mistakes, p.per100.toFixed(1)])).join('')}
      </table>
    </section>
    <section class="card">
      <h2>Ouvertures</h2>
      <table class="stats">
        <tr><th>Ouverture</th><th>Parties</th><th>Points</th><th>Précision</th></tr>
        ${s.openings.map((o) => row([esc(o.name), o.games, pct(o.score), o.accuracy.toFixed(1)])).join('')}
      </table>
    </section>
    <section class="card">
      <h2>Évolution</h2>
      <table class="stats">
        <tr><th>Mois</th><th>Parties</th><th>Précision</th></tr>
        ${s.byMonth.map((m) => row([esc(m.month.replace('.', '-')), m.games, m.accuracy.toFixed(1)])).join('')}
      </table>
    </section>`;
}

$('profile-summary').addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.id !== 'profile-minloss') return;
  profileMinLoss = Number(t.value);
  refreshProfile();
});
$('profile-summary').addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  const sp = t.closest<HTMLElement>('[data-speed]');
  if (sp) {
    profileSpeed = sp.dataset.speed!;
    refreshProfile();
    return;
  }
  const ex = t.closest<HTMLElement>('[data-ex]');
  if (ex) {
    const m = profileExamples[Number(ex.dataset.ex)];
    const f = await cacheGet<Fiche>(m.id);
    if (!f) return;
    showView('analyse');
    await openFiche(f, m.ply);
    return;
  }
  const train = t.closest<HTMLElement>('[data-train]');
  if (train) startPuzzleQueue(profileCauses[Number(train.dataset.train)].examples.map((m) => ({ id: m.id, ply: m.ply })));
});

async function runProfile() {
  const user = profileUser();
  if (!user || profileRunning) return;
  saveUser(user);
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
  a.download = `profil-echecs-${user || 'sans-pseudo'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importFile(file: File) {
  const status = $('profile-status');
  try {
    const r = await importProfile(await file.text());
    if (!profileUser() && r.username) {
      $<HTMLInputElement>('profile-user').value = r.username;
      saveUser(r.username);
    }
    status.textContent =
      `Import : ${r.added} partie${r.added > 1 ? 's' : ''} ajoutée${r.added > 1 ? 's' : ''}, ${r.kept} déjà présente${r.kept > 1 ? 's' : ''}` +
      (r.invalid ? `, ${r.invalid} ignorée${r.invalid > 1 ? 's' : ''} (illisibles)` : '') +
      '.';
  } catch (e) {
    status.textContent = `Import impossible : ${(e as Error).message}.`;
  }
  refreshProfile();
}

// ---------------------------------------------------------------------------
// Chargement et navigation
// ---------------------------------------------------------------------------

function load(pgn: string) {
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
$('tab-analyse').onclick = () => showView('analyse');
$('tab-profil').onclick = () => showView('profil');
$('profile-run').onclick = runProfile;
$('profile-stop').onclick = () => {
  profileStop = true;
  $('profile-status').textContent = 'Mise en pause après la position en cours…';
};
$('profile-export').onclick = exportFile;
$<HTMLInputElement>('profile-import').onchange = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) importFile(input.files[0]);
  input.value = '';
};
$('profile-user').addEventListener('change', () => {
  saveUser(profileUser());
  refreshProfile();
});
try {
  $<HTMLInputElement>('profile-user').value = localStorage.getItem(USER_KEY) ?? '';
} catch {
  /* stockage indisponible */
}
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

// Partie d'exemple (Morphy, « partie de l'Opéra », 1858) pour tester tout de suite.
const exemple = `[White "Paul Morphy"]
[Black "Duc de Brunswick et comte Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
$<HTMLTextAreaElement>('pgn').value = exemple;
load(exemple);
