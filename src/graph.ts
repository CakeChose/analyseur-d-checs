import type { Classification } from './analysis';

const W = 600;
const H = 120;
const SVG = 'http://www.w3.org/2000/svg';

/** Classifications marquées d'un point coloré sur la courbe. */
const MARKED: Partial<Record<Classification, string>> = {
  brilliant: 'var(--c-brilliant)',
  great: 'var(--c-great)',
  inaccuracy: 'var(--c-inaccuracy)',
  mistake: 'var(--c-mistake)',
  miss: 'var(--c-miss)',
  blunder: 'var(--c-blunder)',
};

/**
 * Dessine la courbe de probabilité de gain des Blancs (une valeur par position)
 * dans `container`. Un clic choisit la position la plus proche.
 */
export function drawGraph(
  container: HTMLElement,
  wins: number[],
  classes: (Classification | undefined)[],
  current: number,
  onSelect: (ply: number) => void,
) {
  container.innerHTML = '';
  if (wins.length < 2) return;
  const n = wins.length - 1;
  const x = (i: number) => (i / n) * W;
  const y = (w: number) => H - (w / 100) * H;

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('graph-svg');

  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svg.append(e);
    return e;
  };

  // Zone blanche = avantage des Blancs (sous la courbe).
  const pts = wins.map((w, i) => `${x(i)},${y(w)}`).join(' ');
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'graph-black' });
  el('polygon', { points: `0,${H} ${pts} ${W},${H}`, class: 'graph-white' });
  el('line', { x1: 0, y1: H / 2, x2: W, y2: H / 2, class: 'graph-mid' });
  el('line', { x1: x(current), y1: 0, x2: x(current), y2: H, class: 'graph-cursor' });

  classes.forEach((c, i) => {
    const color = c && MARKED[c];
    if (color) el('circle', { cx: x(i + 1), cy: y(wins[i + 1]), r: 4, fill: color, class: 'graph-dot' });
  });

  svg.addEventListener('click', (e) => {
    const r = svg.getBoundingClientRect();
    onSelect(Math.round(((e.clientX - r.left) / r.width) * n));
  });
  container.append(svg);
}
