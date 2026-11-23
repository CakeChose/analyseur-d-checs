import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { parsePgn, type Game } from './game';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const board = Chessground($('board'), { viewOnly: true, coordinates: true });

let game: Game | null = null;
/** Nombre de coups joués dans la position affichée (0 = départ). */
let ply = 0;

function goTo(target: number) {
  if (!game) return;
  ply = Math.max(0, Math.min(target, game.moves.length));
  const last = ply > 0 ? game.moves[ply - 1] : undefined;
  board.set({
    fen: game.fens[ply],
    lastMove: last ? [last.from as Key, last.to as Key] : undefined,
    check: last ? last.san.includes('+') || last.san.includes('#') : false,
    turnColor: ply % 2 === 0 ? 'white' : 'black',
  });
  document.querySelectorAll('.moves .move').forEach((el) => {
    el.classList.toggle('current', Number((el as HTMLElement).dataset.ply) === ply);
  });
  document.querySelector('.moves .current')?.scrollIntoView({ block: 'nearest' });
}

function renderMoves(g: Game) {
  const list = $('moves');
  list.innerHTML = '';
  for (let i = 0; i < g.moves.length; i += 2) {
    const li = document.createElement('li');
    for (const p of [i + 1, i + 2]) {
      if (p > g.moves.length) break;
      const span = document.createElement('span');
      span.className = 'move';
      span.textContent = g.moves[p - 1].san;
      span.dataset.ply = String(p);
      span.onclick = () => goTo(p);
      li.append(span);
    }
    list.append(li);
  }
  const h = g.headers;
  $('game-info').textContent = h.White
    ? `${h.White} – ${h.Black}${h.Result ? ` (${h.Result})` : ''}`
    : '';
}

function load(pgn: string) {
  try {
    game = parsePgn(pgn);
  } catch (e) {
    $('error').textContent = 'PGN invalide : ' + (e as Error).message;
    return;
  }
  $('error').textContent = '';
  renderMoves(game);
  goTo(0);
}

$('load').onclick = () => load($<HTMLTextAreaElement>('pgn').value);
$('first').onclick = () => goTo(0);
$('prev').onclick = () => goTo(ply - 1);
$('next').onclick = () => goTo(ply + 1);
$('last').onclick = () => goTo(Infinity);
$('flip').onclick = () => board.toggleOrientation();

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement) return;
  const actions: Record<string, () => void> = {
    ArrowLeft: () => goTo(ply - 1),
    ArrowRight: () => goTo(ply + 1),
    Home: () => goTo(0),
    End: () => goTo(Infinity),
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
