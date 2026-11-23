import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { parsePgn, uciToSan, type Game } from './game';
import { Engine, formatScore } from './engine';
import {
  analyseGame,
  evaluatePosition,
  LABELS,
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
import { winPercent } from './winprob';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const board = Chessground($('board'), {
  coordinates: true,
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
});
const engine = new Engine();
const LIVE_DEPTH = 18;

let game: Game | null = null;
let root: TreeNode | null = null;
let current: TreeNode | null = null;
let analysis: GameAnalysis | null = null;
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
  document.querySelector('.moves .current')?.scrollIntoView({ block: 'nearest' });
  renderReview(node);
  renderGraph();
  updateEngine(node);
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
        ${rows}
      </tbody>
    </table>`;
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
  const key = `d${depth}:${g.fens[0]}:${g.moves.map((m) => m.san).join(' ')}`;
  analysing = true;
  $<HTMLButtonElement>('analyse').disabled = true;
  engine.stop();
  clearEngine();

  let result: GameAnalysis | null;
  const cached = await cacheGet<PositionEval[]>(key);
  if (cached && cached.length === g.fens.length) {
    result = reviewGame(g, cached, depth);
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
    if (result) cachePut(key, result.positions);
  }
  if (token !== analysisToken) return; // une autre partie a été chargée entre-temps
  analysing = false;
  $<HTMLButtonElement>('analyse').disabled = false;
  $('analyse').textContent = 'Réanalyser';
  setProgress(1, 1);
  if (!result) return;
  applyAnalysis(result.positions, result.moves, depth);
  analysis = result;
  renderReport();
  if (current) show(current);
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
  root = buildTree(g);
  analysis = null;
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
