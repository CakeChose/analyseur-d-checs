// Construit src/data/openings.json à partir des fichiers TSV de
// https://github.com/lichess-org/chess-openings (domaine public, CC0).
// Usage : node scripts/build-openings.mjs <dossier contenant a.tsv … e.tsv>
// Résultat : { "<position sans compteurs>": "ECO Nom de l'ouverture" }
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const dir = process.argv[2];
if (!dir) throw new Error('Indique le dossier des fichiers TSV.');

const book = {};
/** Catalogue : [code ECO, nom, coups en notation SAN séparés par des espaces], trié par nom. */
const catalogue = [];
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(join(dir, `${f}.tsv`), 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    book[chess.fen().split(' ').slice(0, 4).join(' ')] = `${eco} ${name}`;
    catalogue.push([eco, name, chess.history().join(' ')]);
  }
}
catalogue.sort((a, b) => a[1].localeCompare(b[1]) || a[2].length - b[2].length);
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/openings.json', JSON.stringify(book));
writeFileSync('src/data/catalogue.json', JSON.stringify(catalogue));
console.log(Object.keys(book).length, 'positions d’ouverture,', catalogue.length, 'lignes au catalogue');
