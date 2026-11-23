import { defineConfig } from 'vite';

// Sur GitHub Pages, le site est servi sous /analyseur-d-checs/ ;
// en local (npm run dev), à la racine.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/analyseur-d-checs/' : '/',
});
