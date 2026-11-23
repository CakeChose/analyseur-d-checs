import type { EngineLine } from './engine';

/**
 * Probabilité de gain des Blancs (0–100) à partir d'une évaluation.
 * Formule de Lichess : 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1).
 */
export function winPercent(line: Pick<EngineLine, 'cp' | 'mate'>): number {
  if (line.mate !== undefined) return line.mate > 0 ? 100 : line.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, line.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
