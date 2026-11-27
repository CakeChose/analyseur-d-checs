// Calibrage de la précision : compare notre précision à celle de chess.com sur les parties
// revues d'un joueur, puis cherche les réglages de la formule qui s'en rapprochent le plus.
//
//   node scripts/calibrate-accuracy.mjs <pseudo> [nombre de parties = 30] [profondeur = 16]
//
// (Derrière un proxy : NODE_USE_ENV_PROXY=1 node …)
// Les évaluations sont gardées dans scripts/.calibration-cache.json (relancer est instantané).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Chess } from 'chess.js';

const [user, nArg, dArg] = process.argv.slice(2);
if (!user) {
  console.error('Usage : node scripts/calibrate-accuracy.mjs <pseudo> [parties] [profondeur]');
  process.exit(1);
}
const N = Number(nArg ?? 30);
const DEPTH = Number(dArg ?? 16);
const CACHE = new URL('./.calibration-cache.json', import.meta.url);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// --- Parties revues sur chess.com (avec « accuracies ») -------------------------------------
async function reviewedGames() {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`;
  const { archives } = await fetch(`${base}/games/archives`).then((r) => r.json());
  const out = [];
  for (const url of archives.slice().reverse()) {
    const month = await fetch(url).then((r) => r.json());
    for (const g of (month.games ?? []).slice().reverse()) {
      if (g.rules === 'chess' && g.pgn && g.accuracies) out.push(g);
      if (out.length >= N) return out;
    }
  }
  return out;
}

// --- Stockfish (même moteur que le site : lite, un cœur par processus) ----------------------
class Engine {
  constructor() {
    this.p = spawn('node', ['node_modules/stockfish/bin/stockfish-19-lite-single.js']);
    this.buf = '';
    this.wait = null;
    this.p.stdout.on('data', (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.wait?.(line);
      }
    });
    this.send('uci');
  }
  send(s) {
    this.p.stdin.write(s + '\n');
  }
  /** Score du point de vue des Blancs : { cp } ou { mate }. */
  analyse(fen) {
    const white = fen.split(' ')[1] === 'w';
    return new Promise((resolve) => {
      let last = { cp: 0 };
      this.wait = (line) => {
        const m = line.match(/^info .*\bmultipv 1\b.*\bscore (cp|mate) (-?\d+)/) ?? line.match(/^info .*\bscore (cp|mate) (-?\d+)/);
        if (m && !line.includes('upperbound') && !line.includes('lowerbound')) {
          const v = Number(m[2]) * (white ? 1 : -1);
          last = m[1] === 'cp' ? { cp: v } : { mate: v };
        }
        if (line.startsWith('bestmove')) {
          this.wait = null;
          resolve(last);
        }
      };
      this.send(`position fen ${fen}`);
      this.send(`go depth ${DEPTH}`);
    });
  }
  quit() {
    this.send('quit');
  }
}

/** Probabilité de gain des Blancs (formule de src/winprob.ts). */
function win(s) {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, s.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Probabilités de gain des Blancs après chaque coup (positions terminales comprises). */
async function winsOf(g, engines) {
  const key = `${g.url}@${DEPTH}`;
  if (cache[key]) return cache[key];
  const chess = new Chess();
  chess.loadPgn(g.pgn);
  const sans = chess.history();
  const fens = [];
  const c = new Chess();
  fens.push(c.fen());
  for (const s of sans) {
    c.move(s);
    fens.push(c.fen());
  }
  const wins = new Array(fens.length);
  let next = 0;
  await Promise.all(
    engines.map(async (e) => {
      while (next < fens.length) {
        const i = next++;
        const pos = new Chess(fens[i]);
        if (pos.isCheckmate()) wins[i] = pos.turn() === 'b' ? 100 : 0;
        else if (pos.isDraw()) wins[i] = 50;
        else wins[i] = win(await e.analyse(fens[i]));
      }
    }),
  );
  cache[key] = wins;
  writeFileSync(CACHE, JSON.stringify(cache));
  return wins;
}

// --- Formule de précision (src/analysis.ts), avec ses réglages en paramètres ----------------
function moveAccuracy(loss, k) {
  const a = 103.1668 * Math.exp(-k * Math.max(0, loss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}
function stdDev(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}
function gameAccuracy(wins, { k, mix }) {
  const n = wins.length;
  if (n < 2) return { white: 100, black: 100 };
  const size = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const windows = [];
  for (let i = 0; i < size - 2; i++) windows.push(wins.slice(0, size));
  for (let i = 0; i + size <= n; i++) windows.push(wins.slice(i, i + size));
  const per = { white: [], black: [] };
  for (let i = 0; i < n - 1; i++) {
    const white = i % 2 === 0;
    const loss = white ? wins[i] - wins[i + 1] : wins[i + 1] - wins[i];
    const weight = Math.max(0.5, Math.min(12, stdDev(windows[Math.min(i, windows.length - 1)])));
    per[white ? 'white' : 'black'].push({ acc: moveAccuracy(loss, k), w: weight });
  }
  const combine = (xs) => {
    if (!xs.length) return 100;
    const weighted = xs.reduce((a, x) => a + x.acc * x.w, 0) / xs.reduce((a, x) => a + x.w, 0);
    const harmonic = xs.length / xs.reduce((a, x) => a + 1 / Math.max(x.acc, 1), 0);
    return mix * weighted + (1 - mix) * harmonic;
  };
  return { white: combine(per.white), black: combine(per.black) };
}

/** Écart moyen (absolu), biais moyen et écart maximal avec chess.com, sur les deux camps. */
function score(samples, params) {
  const diffs = samples.flatMap(({ wins, cc }) => {
    const a = gameAccuracy(wins, params);
    return [a.white - cc.white, a.black - cc.black];
  });
  const mae = diffs.reduce((a, d) => a + Math.abs(d), 0) / diffs.length;
  const bias = diffs.reduce((a, d) => a + d, 0) / diffs.length;
  const max = Math.max(...diffs.map(Math.abs));
  return { mae, bias, max };
}

// --- Programme ------------------------------------------------------------------------------
const games = await reviewedGames();
console.log(`${games.length} parties revues par chess.com trouvées pour ${user} (profondeur ${DEPTH}).`);
const engines = Array.from({ length: Math.max(1, cpus().length) }, () => new Engine());
const samples = [];
for (const [i, g] of games.entries()) {
  const wins = await winsOf(g, engines);
  samples.push({ wins, cc: g.accuracies, url: g.url });
  process.stdout.write(`\r  analysées : ${i + 1}/${games.length}`);
}
engines.forEach((e) => e.quit());
console.log('\n');

const CURRENT = { k: 0.04354, mix: 0.5 };
const fmt = (s) => `écart moyen ${s.mae.toFixed(2)} · biais ${s.bias >= 0 ? '+' : ''}${s.bias.toFixed(2)} · écart max ${s.max.toFixed(1)}`;
console.log('Formule actuelle  :', fmt(score(samples, CURRENT)));

let best = { ...CURRENT, s: score(samples, CURRENT) };
for (let k = 0.02; k <= 0.12; k += 0.001) {
  for (let mix = 0; mix <= 1.0001; mix += 0.05) {
    const s = score(samples, { k, mix });
    if (s.mae < best.s.mae) best = { k, mix, s };
  }
}
console.log(`Meilleurs réglages : k = ${best.k.toFixed(4)}, part de la moyenne pondérée = ${best.mix.toFixed(2)}`);
console.log('                   ', fmt(best.s));

console.log('\nDétail (chess.com → actuel → ajusté) :');
for (const { wins, cc, url } of samples) {
  const a = gameAccuracy(wins, CURRENT);
  const b = gameAccuracy(wins, best);
  const r = (x) => x.toFixed(1).padStart(5);
  console.log(`  B ${r(cc.white)} → ${r(a.white)} → ${r(b.white)}   N ${r(cc.black)} → ${r(a.black)} → ${r(b.black)}   ${url}`);
}
