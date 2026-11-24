/**
 * Base d'ouvertures (données Lichess, domaine public), chargée à la demande.
 * Clé : la position sans les compteurs de coups.
 */
let book: Record<string, string> | null = null;
let loading: Promise<void> | null = null;

export function loadBook(): Promise<void> {
  loading ??= import('./data/openings.json').then((m) => {
    book = m.default as Record<string, string>;
  });
  return loading;
}

const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Une ligne du catalogue : [code ECO, nom, coups SAN séparés par des espaces]. */
export type CatalogueLine = [string, string, string];
let catalogue: Promise<CatalogueLine[]> | null = null;

/** Le catalogue complet (~3 900 lignes), chargé seulement quand on ouvre la page Ouvertures. */
export function loadCatalogue(): Promise<CatalogueLine[]> {
  catalogue ??= import('./data/catalogue.json').then((m) => m.default as CatalogueLine[]);
  return catalogue;
}

/** "C00 French Defense" si la position est une position de livre connue. */
export function openingName(fen: string): string | undefined {
  return book?.[key(fen)];
}
