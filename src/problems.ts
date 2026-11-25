// ---------------------------------------------------------------------------
// Page Problèmes : exercices tirés de tes erreurs, par type ou au hasard, avec suivi de réussite
// ---------------------------------------------------------------------------

import { TAGS } from './profile';
import { $, groupCount } from './ui';
// shortcut: import circulaire avec main.ts (état partagé : profil, exercice en cours) ; sans danger tant
// que ce fichier n'utilise ces noms que dans des fonctions. Passer par un module d'état si ça grossit.
import { profileCauses, profileMistakes, profileName, showView, startPuzzleQueue } from './main';

/**
 * Suivi de chaque problème (« partie#demi-coup ») : réussites, ratés, et réussites d'affilée
 * (`run`, remis à zéro par un raté). Gardé dans le navigateur.
 */
type ExoStats = Record<string, { ok: number; ko: number; run?: number }>;
/** Score global : réussis, ratés, série en cours, meilleure série. */
type ExoScore = { ok: number; ko: number; streak: number; best: number };
const exoKey = () => `exos:${profileName.toLowerCase()}`;
const scoreKey = () => `exos-score:${profileName.toLowerCase()}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : le suivi ne sera pas gardé */
  }
}
const exoStats = () => readJson<ExoStats>(exoKey(), {});
const exoScore = () => readJson<ExoScore>(scoreKey(), { ok: 0, ko: 0, streak: 0, best: 0 });

/** Seul le premier essai d'un problème compte (voir puzzleMove). */
export function recordExo(id: string, ply: number, ok: boolean) {
  const s = exoStats();
  const e = (s[`${id}#${ply}`] ??= { ok: 0, ko: 0, run: 0 });
  // Anciennes entrées sans `run` : on le déduit (que des réussites → autant d'affilée).
  e.run ??= e.ko ? 0 : e.ok;
  if (ok) {
    e.ok++;
    e.run++;
  } else {
    e.ko++;
    e.run = 0;
  }
  writeJson(exoKey(), s);
  const sc = exoScore();
  if (ok) {
    sc.ok++;
    sc.streak++;
    sc.best = Math.max(sc.best, sc.streak);
  } else {
    sc.ko++;
    sc.streak = 0;
  }
  writeJson(scoreKey(), sc);
}

/** Les 5 états d'un problème : jamais essayé, raté, réussi 1, 2 ou 3 fois d'affilée (validé). */
type ExoStatus = 'new' | 'failed' | 'run1' | 'run2' | 'done';
const STATUS_LABEL: Record<ExoStatus, string> = {
  new: 'Jamais essayé',
  failed: 'Raté',
  run1: 'Réussi 1 fois',
  run2: 'Réussi 2 fois de suite',
  done: 'Validé (3 fois de suite)',
};
const STATUSES = Object.keys(STATUS_LABEL) as ExoStatus[];

function exoStatus(stats: ExoStats, m: { id: string; ply: number }): ExoStatus {
  const e = stats[`${m.id}#${m.ply}`];
  if (!e) return 'new';
  const run = e.run ?? (e.ko ? 0 : e.ok);
  return run >= 3 ? 'done' : run === 2 ? 'run2' : run === 1 ? 'run1' : 'failed';
}

/** Cause travaillée (index dans profileCauses), ou -2 pour les problèmes aléatoires. */
let problemCause = -1;

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** Problèmes d'un type d'erreur : les jamais réussis d'abord ; les validés ne sont plus proposés. */
export function openProblems(i: number) {
  const c = profileCauses[i];
  if (!c) return;
  problemCause = i;
  const stats = exoStats();
  const rank: Record<ExoStatus, number> = { new: 0, failed: 0, run1: 1, run2: 2, done: 3 };
  const queue = [...c.examples]
    .reverse()
    .filter((m) => exoStatus(stats, m) !== 'done')
    .sort((a, b) => rank[exoStatus(stats, a)] - rank[exoStatus(stats, b)])
    .map((m) => ({ id: m.id, ply: m.ply }));
  if (!startPuzzleQueue(queue, 'problemes')) showView('problemes');
  renderProblems();
}

/** Problèmes au hasard parmi les erreurs, ratés et gaffes (pas les imprécisions), sans dire le type. */
export function openRandomProblems() {
  problemCause = -2;
  const stats = exoStats();
  const seen = new Set<string>();
  const pool = profileMistakes.filter((m) => {
    const k = `${m.id}#${m.ply}`;
    if (m.classification === 'inaccuracy' || seen.has(k) || exoStatus(stats, m) === 'done') return false;
    seen.add(k);
    return true;
  });
  if (startPuzzleQueue(shuffle(pool).map((m) => ({ id: m.id, ply: m.ply })), 'problemes', true)) renderProblems();
  else {
    showView('problemes');
    renderProblems();
  }
}

/** Petite barre des états (gris, rouge, verts) d'un ensemble de problèmes. */
function statusBar(items: { id: string; ply: number }[], stats: ExoStats): string {
  const counts = groupCount(items.map((m) => exoStatus(stats, m)));
  return `<span class="st-bar">${STATUSES.map((st) => {
    const n = counts.get(st) ?? 0;
    return n ? `<span class="st-${st}" style="flex:${n}" title="${STATUS_LABEL[st]} : ${n}"></span>` : '';
  }).join('')}</span>`;
}

export function renderProblems() {
  const stats = exoStats();
  const sc = exoScore();
  const randomPool = profileMistakes.filter((m) => m.classification !== 'inaccuracy');
  const keys = new Set(randomPool.map((m) => `${m.id}#${m.ply}`));
  const unique = [...keys].map((k) => ({ id: k.slice(0, k.lastIndexOf('#')), ply: Number(k.slice(k.lastIndexOf('#') + 1)) }));
  const counts = groupCount(unique.map((m) => exoStatus(stats, m)));
  const left = unique.length - (counts.get('done') ?? 0);
  const rows = profileCauses
    .map((c, i) => {
      if (c.tag === 'gache') return '';
      const done = c.examples.filter((m) => exoStatus(stats, m) === 'done').length;
      return `<button class="op-row prob-row ${i === problemCause ? 'current' : ''}" data-ptag="${i}">
        <span class="op-name">${TAGS[c.tag]}</span>${statusBar(c.examples, stats)}
        <span class="muted" title="Problèmes validés">${done}/${c.count}</span></button>`;
    })
    .join('');
  $('side-problems').innerHTML = `<h2>Problèmes</h2>
    <div class="score-grid">
      <div><div class="muted">Réussis</div><b class="t-win">${sc.ok}</b></div>
      <div><div class="muted">Ratés</div><b class="t-loss">${sc.ko}</b></div>
      <div><div class="muted">Série</div><b>${sc.streak}</b></div>
      <div><div class="muted">Meilleure série</div><b>${sc.best}</b></div>
    </div>
    <button class="primary ${problemCause === -2 ? 'active' : ''}" data-random>Problèmes aléatoires (${left})</button>
    <p class="muted">Au hasard parmi tes erreurs et gaffes, sans indice : trouve le meilleur coup.
      Un problème réussi 3 fois de suite est validé et n'est plus proposé.</p>
    <div class="st-legend">${STATUSES.map((st) => `<span><i class="st-${st}"></i>${STATUS_LABEL[st]} <b>${counts.get(st) ?? 0}</b></span>`).join('')}</div>
    <h3>Par type d'erreur</h3>
    <div class="op-list">${rows}</div>`;
}

$('side-problems').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-random]')) return openRandomProblems();
  const b = t.closest<HTMLElement>('[data-ptag]');
  if (b) openProblems(Number(b.dataset.ptag));
});
