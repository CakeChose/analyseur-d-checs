/**
 * Pilote Stockfish (WASM, dans un Web Worker) via le protocole UCI.
 * Une seule recherche à la fois : lancer une nouvelle analyse arrête la précédente.
 */

export interface EngineLine {
  /** Rang de la ligne (1 = meilleur coup). */
  multipv: number;
  depth: number;
  /** Score du point de vue des Blancs : centipions, ou mat en N (positif = les Blancs matent). */
  cp?: number;
  mate?: number;
  /** Variante principale, coups au format UCI (e2e4, e7e8q…). */
  pv: string[];
}

export interface AnalyseOptions {
  depth: number;
  multipv: number;
  /** Appelé à chaque nouvelle info du moteur (lignes triées par rang). */
  onUpdate?: (lines: EngineLine[]) => void;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;

export class Engine {
  private worker = new Worker(ENGINE_URL);
  private listener: ((line: string) => void) | null = null;
  private ready: Promise<unknown>;
  /** Chaîne des recherches : chacune attend la fin de la précédente. */
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;

  constructor() {
    this.worker.onmessage = (e) => this.listener?.(String(e.data));
    this.ready = this.waitFor('uciok', () => this.send('uci')).then(() =>
      this.waitFor('readyok', () => this.send('isready')),
    );
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(prefix: string, start: () => void): Promise<string> {
    return new Promise((resolve) => {
      this.listener = (line) => {
        if (line.startsWith(prefix)) resolve(line);
      };
      start();
    });
  }

  /** Arrête la recherche en cours (s'il y en a une) et analyse `fen`. */
  analyse(fen: string, opts: AnalyseOptions): Promise<EngineLine[]> {
    const gen = ++this.generation;
    this.send('stop'); // termine vite la recherche en cours, qui libère la file
    const run = this.queue.then(async () => {
      await this.ready;
      if (gen !== this.generation) return []; // une analyse plus récente a été demandée
      return this.search(fen, opts, gen);
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private search(fen: string, opts: AnalyseOptions, gen: number): Promise<EngineLine[]> {
    const whiteToMove = fen.split(' ')[1] === 'w';
    const lines: EngineLine[] = [];
    return new Promise((resolve) => {
      this.listener = (msg) => {
        if (msg.startsWith('bestmove')) {
          resolve(lines.filter(Boolean));
          return;
        }
        const line = parseInfo(msg, whiteToMove);
        if (!line) return;
        // Ne garder que les infos de la profondeur la plus récente pour chaque rang.
        lines[line.multipv - 1] = line;
        if (gen === this.generation) opts.onUpdate?.(lines.filter(Boolean));
      };
      this.send(`setoption name MultiPV value ${opts.multipv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${opts.depth}`);
    });
  }

  stop() {
    this.generation++;
    this.send('stop');
  }

  destroy() {
    this.worker.terminate();
  }
}

/** Lit une ligne `info depth … multipv … score cp|mate … pv …`. */
function parseInfo(msg: string, whiteToMove: boolean): EngineLine | null {
  if (!msg.startsWith('info ') || !msg.includes(' pv ') || msg.includes(' bound ')) return null;
  const t = msg.split(' ');
  const num = (key: string) => {
    const i = t.indexOf(key);
    return i >= 0 ? Number(t[i + 1]) : undefined;
  };
  const sign = whiteToMove ? 1 : -1;
  const scoreAt = t.indexOf('score');
  const kind = t[scoreAt + 1];
  const value = Number(t[scoreAt + 2]) * sign;
  return {
    multipv: num('multipv') ?? 1,
    depth: num('depth') ?? 0,
    cp: kind === 'cp' ? value : undefined,
    mate: kind === 'mate' ? value : undefined,
    pv: t.slice(t.indexOf('pv') + 1),
  };
}

/** Texte lisible d'une évaluation : "+1.25", "-0.40", "M3", "-M2". */
export function formatScore(line: Pick<EngineLine, 'cp' | 'mate'>): string {
  if (line.mate !== undefined) {
    if (line.mate === 0) return '#';
    return (line.mate > 0 ? 'M' : '-M') + Math.abs(line.mate);
  }
  const p = (line.cp ?? 0) / 100;
  return (p > 0 ? '+' : '') + p.toFixed(2);
}
