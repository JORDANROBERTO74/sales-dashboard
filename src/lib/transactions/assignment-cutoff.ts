export const TRANSACTION_ASSIGNMENT_CUTOFF_UTC_MS = Date.UTC(
  2026,
  2,
  29,
  0,
  0,
  0,
);

/**
 * Devuelve `true` si la hora actual (en UTC) ya está después del corte permitido.
 *
 * Corte: desde `2026-03-29T00:00:00.000Z` (es decir, "después del 28/03/2026 UTC").
 */
export function isPastTransactionAssignmentCutoff(
  nowMs: number = Date.now(),
): boolean {
  return nowMs >= TRANSACTION_ASSIGNMENT_CUTOFF_UTC_MS;
}
