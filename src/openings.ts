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

/** "C00 French Defense" si la position est une position de livre connue. */
export function openingName(fen: string): string | undefined {
  return book?.[key(fen)];
}
