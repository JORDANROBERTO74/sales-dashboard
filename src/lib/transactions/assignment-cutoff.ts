/**
 * Primer instante UTC en el que una transacción es elegible para asignación/desasignación
 * según `stripe_created_at`. Las filas con `stripe_created_at` estrictamente anterior a este
 * instante quedan congeladas (no se modifica la asignación).
 *
 * Incluye el 28/03/2026 desde las 00:00:00.000Z.
 */
export const TRANSACTION_ASSIGNMENT_MIN_STRIPE_CREATED_AT_UTC_MS = Date.UTC(
  2026,
  2,
  28,
  0,
  0,
  0,
);

/**
 * `true` si no se debe permitir cambiar la asignación de esta transacción.
 * `stripe_created_at` nulo, vacío o no parseable se trata como congelado.
 */
export function isStripeTransactionAssignmentFrozen(
  stripeCreatedAt: string | null,
): boolean {
  if (stripeCreatedAt == null || !String(stripeCreatedAt).trim()) {
    return true;
  }
  const createdMs = new Date(stripeCreatedAt).getTime();
  if (Number.isNaN(createdMs)) {
    return true;
  }
  return createdMs < TRANSACTION_ASSIGNMENT_MIN_STRIPE_CREATED_AT_UTC_MS;
}
