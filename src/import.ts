/**
 * Récupère les dernières parties d'un joueur via les API publiques
 * de chess.com et de Lichess (aucun compte nécessaire).
 */
export interface OnlineGame {
  white: string;
  black: string;
  /** "1-0", "0-1" ou "½-½" */
  result: string;
  date: Date;
  /** bullet, blitz, rapid… */
  speed: string;
  pgn: string;
}

const MAX = 20;

/** Les `max` dernières parties chess.com du joueur, d'une cadence donnée si `speed` est fourni. */
export async function fetchChessCom(user: string, max = MAX, speed?: string): Promise<OnlineGame[]> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`;
  const res = await fetch(`${base}/games/archives`);
  if (res.status === 404) throw new Error('joueur introuvable sur chess.com');
  if (!res.ok) throw new Error(`chess.com a répondu ${res.status}`);
  const { archives } = (await res.json()) as { archives: string[] };
  const games: OnlineGame[] = [];
  // Les archives sont mensuelles : on remonte depuis le mois le plus récent.
  for (const url of archives.slice().reverse()) {
    const month = await fetch(url).then((r) => r.json());
    for (const g of (month.games ?? []).slice().reverse()) {
      if (!g.pgn || g.rules !== 'chess' || (speed && g.time_class !== speed)) continue;
      const r = (x: string) => (x === 'win' ? 1 : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(x) ? 0.5 : 0);
      const w = r(g.white.result);
      games.push({
        white: g.white.username,
        black: g.black.username,
        result: w === 1 ? '1-0' : w === 0.5 ? '½-½' : '0-1',
        date: new Date(g.end_time * 1000),
        speed: g.time_class,
        pgn: g.pgn,
      });
      if (games.length >= max) return games;
    }
    if (games.length >= max) break;
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
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½',
      date: new Date(g.createdAt),
      speed: g.speed,
      pgn: g.pgn,
    }));
}
