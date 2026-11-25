// Petits utilitaires d'affichage partagés par les pages.

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const pct = (x: number) => `${Math.round(x)} %`;

/** Nombre d'occurrences de chaque valeur. */
export function groupCount(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}
