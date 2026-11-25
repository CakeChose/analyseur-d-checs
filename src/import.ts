/**
 * Récupère les dernières parties d'un joueur via les API publiques
 * de chess.com et de Lichess (aucun compte nécessaire).
 */
export interface OnlineGame {
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  /** "1-0", "0-1" ou "½-½" */
  result: string;
  date: Date;
  /** bullet, blitz, rapid… */
  speed: string;
  /** Précision calculée par chess.com (seulement si la partie a été revue sur chess.com). */
  accuracies?: { white: number; black: number };
  pgn: string;
}

const MAX = 20;

/** Statistiques d'une cadence sur chess.com (toutes les parties du compte, pas seulement les récentes). */
export interface SpeedStats {
  rating?: number;
  best?: number;
  /** Date du meilleur Elo, en millisecondes. */
  bestDate?: number;
  /** Lien vers la partie où le meilleur Elo a été atteint. */
  bestGame?: string;
  /** Par jour : temps moyen par coup (secondes) et part des parties perdues au temps (%). */
  timePerMove?: number;
  timeoutPercent?: number;
  win: number;
  loss: number;
  draw: number;
}

/** Elo actuel, meilleur Elo et bilan par cadence, plus le meilleur classement en problèmes. */
export async function fetchChessComStats(user: string): Promise<{ speeds: Record<string, SpeedStats>; puzzleBest?: number }> {
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/stats`);
  if (!res.ok) throw new Error(`chess.com a répondu ${res.status}`);
  const d = await res.json();
  const speeds: Record<string, SpeedStats> = {};
  for (const sp of ['rapid', 'blitz', 'bullet', 'daily']) {
    const s = d[`chess_${sp}`];
    if (!s) continue;
    speeds[sp] = {
      rating: s.last?.rating,
      best: s.best?.rating,
      bestDate: s.best?.date ? s.best.date * 1000 : undefined,
      bestGame: typeof s.best?.game === 'string' && s.best.game.startsWith('https://www.chess.com/') ? s.best.game : undefined,
      timePerMove: s.record?.time_per_move,
      timeoutPercent: s.record?.timeout_percent,
      win: s.record?.win ?? 0,
      loss: s.record?.loss ?? 0,
      draw: s.record?.draw ?? 0,
    };
  }
  return { speeds, puzzleBest: d.tactics?.highest?.rating };
}

/**
 * Les `max` dernières parties chess.com du joueur ; avec `speeds`, les `max` dernières de chacune
 * de ces cadences (moins s'il n'y en a pas assez dans tout l'historique).
 */
export async function fetchChessCom(user: string, max = MAX, speeds?: string[]): Promise<OnlineGame[]> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`;
  const res = await fetch(`${base}/games/archives`);
  if (res.status === 404) throw new Error('joueur introuvable sur chess.com');
  if (!res.ok) throw new Error(`chess.com a répondu ${res.status}`);
  const { archives } = (await res.json()) as { archives: string[] };
  const games: OnlineGame[] = [];
  const left = new Map(speeds?.map((sp) => [sp, max]));
  const full = () => (speeds ? [...left.values()].every((n) => n <= 0) : games.length >= max);
  // Les archives sont mensuelles : on remonte depuis le mois le plus récent.
  for (const url of archives.slice().reverse()) {
    if (full()) break;
    const month = await fetch(url).then((r) => r.json());
    for (const g of (month.games ?? []).slice().reverse()) {
      if (!g.pgn || g.rules !== 'chess') continue;
      if (speeds) {
        if (!((left.get(g.time_class) ?? 0) > 0)) continue;
        left.set(g.time_class, left.get(g.time_class)! - 1);
      }
      const r = (x: string) => (x === 'win' ? 1 : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(x) ? 0.5 : 0);
      const w = r(g.white.result);
      games.push({
        white: g.white.username,
        black: g.black.username,
        whiteElo: g.white.rating,
        blackElo: g.black.rating,
        result: w === 1 ? '1-0' : w === 0.5 ? '½-½' : '0-1',
        date: new Date(g.end_time * 1000),
        speed: g.time_class,
        accuracies: g.accuracies,
        pgn: g.pgn,
      });
      if (full()) return games;
    }
  }
  return games;
}

export async function fetchLichess(user: string): Promise<OnlineGame[]> {
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${MAX}&pgnInJson=true&clocks=false&evals=false`,
    { headers: { Accept: 'application/x-ndjson' } },
  );
  if (res.status === 404) throw new Error('joueur introuvable sur Lichess');
  if (!res.ok) throw new Error(`Lichess a répondu ${res.status}`);
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((g) => g.variant === 'standard' && g.pgn)
    .map((g) => ({
      white: g.players.white.user?.name ?? 'Anonyme',
      black: g.players.black.user?.name ?? 'Anonyme',
      whiteElo: g.players.white.rating,
      blackElo: g.players.black.rating,
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½',
      date: new Date(g.createdAt),
      speed: g.speed,
      pgn: g.pgn,
    }));
}
