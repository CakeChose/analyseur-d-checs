// ---------------------------------------------------------------------------
// Page Ouvertures : mes ouvertures, catalogue, ligne choisie, entraînement
// ---------------------------------------------------------------------------

import type { Key } from '@lichess-org/chessground/types';
import { Chess, type Square } from 'chess.js';
import { loadCatalogue, openingName, type CatalogueLine } from './openings';
import { loadProfile } from './profile';
import { playMove } from './tree';
import { $, esc, pct } from './ui';
// shortcut: import circulaire avec main.ts (échiquier, partie affichée) ; sans danger tant que ce
// fichier n'utilise ces noms que dans des fonctions. Passer par un module d'état si ça grossit.
import { board, choosePromotion, current, go, load, profileName, renderMoves, root, show } from './main';

/** Ligne du catalogue affichée (null : la liste des ouvertures). */
let openingLine: CatalogueLine | null = null;
let openingQuery = '';
/** Ouvertures de tes parties analysées, les plus jouées d'abord. */
let myOpenings: { name: string; color: 'w' | 'b'; games: number; score: number }[] = [];
/** Entraînement sur une ligne : le site joue l'adversaire, il faut retrouver les coups de la ligne. */
export let training: { moves: string[]; color: 'w' | 'b'; index: number; errors: number } | null = null;

export function stopTraining() {
  training = null;
  document.body.classList.remove('training');
}

const shortName = (name: string) => (name.includes(':') ? name.slice(name.indexOf(':') + 1).trim() : name);
const linePgn = (moves: string) =>
  moves
    .split(' ')
    .map((m, i) => (i % 2 ? m : `${i / 2 + 1}. ${m}`))
    .join(' ');

export async function openOpenings() {
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
  stopTraining();
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
export function renderBookMoves() {
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
    stopTraining();
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
    stopTraining();
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

export async function trainingMove(orig: Key, dest: Key) {
  const t = training!;
  const node = current!;
  const promo = await choosePromotion(node.fen, orig, dest);
  if (promo === null || training !== t || current !== node) return show(current!);
  let san = '';
  try {
    san = new Chess(node.fen).move({ from: orig, to: dest, promotion: promo || undefined }).san;
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
