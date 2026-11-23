// Copie le moteur Stockfish (version "lite single-threaded") dans public/
// pour que Vite le serve tel quel. Lancé automatiquement après `npm install`.
import { copyFileSync, mkdirSync } from 'node:fs';

const src = 'node_modules/stockfish/bin/';
const dest = 'public/stockfish/';
mkdirSync(dest, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(src + f, dest + f);
}
console.log('Stockfish copié dans', dest);
