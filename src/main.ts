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
import { explainMove } from './explain';
import { getApiKey, rephrase, setApiKey } from './llm';
import { loadBook, openingName } from './openings';
import { fetchChessCom, fetchLichess } from './import';

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

  // Explication : faits vérifiés (couche 1), puis reformulation par Claude (couche 2, optionnelle).
  const facts = explainMove(node);
  if (!facts.length) return;
  const ul = document.createElement('ul');
  ul.className = 'facts';
  for (const f of facts) ul.append(Object.assign(document.createElement('li'), { textContent: f }));
  box.append(ul);
  if (!getApiKey()) return;
  const out = document.createElement('p');
  out.className = 'llm';
  const btn = document.createElement('button');
  btn.className = 'llm-btn';
  btn.textContent = 'Expliquer avec Claude';
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Claude réfléchit…';
    try {
      out.textContent = await rephrase(node.move!.san, LABELS[r.classification].name, facts);
      btn.remove();
    } catch (e) {
      out.textContent = `Explication indisponible : ${(e as Error).message}.`;
      btn.disabled = false;
      btn.textContent = 'Réessayer';
    }
  };
  box.append(btn, out);
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
  moves.forEach((m, i) => {
    nodes[i + 1].review = m;
    if (isBookNode(nodes[i + 1])) m.classification = 'book';
  });
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
  await loadBook();

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

/** Exercice en cours : retrouver un meilleur coup là où le joueur s'est trompé. */
let puzzle: { queue: TreeNode[]; index: number; state: 'try' | 'wrong' | 'solved' | 'shown'; tried?: string } | null =
  null;

const BAD: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

function startPuzzles(color: 'w' | 'b') {
  if (!root) return;
  const queue = mainline(root).filter(
    (n) => n.move?.color === color && n.review && BAD.includes(n.review.classification) && n.parent?.eval?.lines[0],
  );
  if (!queue.length) {
    $('report-msg').textContent = 'Aucune erreur à retravailler pour ce camp.';
    return;
  }
  puzzle = { queue, index: 0, state: 'try' };
  if (board.state.orientation !== (color === 'w' ? 'white' : 'black')) $('flip').click();
  show(queue[0].parent!);
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
  const target = puzzle.queue[puzzle.index];
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
  const target = puzzle.queue[puzzle.index];
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
      show(puzzle!.queue[puzzle!.index].parent!);
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
  puzzle = null;
  $('opening').textContent = '';
  loadBook().then(showOpening);
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
$('key-prev').onclick = () => jumpKeyMoment(-1);
$('key-next').onclick = () => jumpKeyMoment(1);
$('online-search').onclick = searchOnline;
$('online-user').addEventListener('keydown', (e) => e.key === 'Enter' && searchOnline());

// Clé API Claude (optionnelle), gardée dans ce navigateur uniquement.
const keyInput = $<HTMLInputElement>('api-key');
const keyStatus = () => ($('api-key-status').textContent = getApiKey() ? 'Clé enregistrée.' : 'Aucune clé.');
keyStatus();
$('api-key-save').onclick = () => {
  setApiKey(keyInput.value.trim());
  keyInput.value = '';
  keyStatus();
  if (current) renderReview(current);
};
$('api-key-clear').onclick = () => {
  setApiKey('');
  keyStatus();
  if (current) renderReview(current);
};

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
