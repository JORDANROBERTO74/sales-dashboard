export const ASSIGNMENT_ACCESS_FROM_ISO = "2026-03-16T00:00:00Z";
export const ASSIGNMENT_ACCESS_FROM_TS = Date.parse(ASSIGNMENT_ACCESS_FROM_ISO);

export function isBeforeAssignmentAccessDate(
  stripeCreatedAt?: string | null,
  createdAt?: string | null
): boolean {
  const rawDate = stripeCreatedAt ?? createdAt;
  if (!rawDate) return true;
  const transactionDate = new Date(rawDate);
  if (Number.isNaN(transactionDate.getTime())) return true;
  return transactionDate.getTime() < ASSIGNMENT_ACCESS_FROM_TS;
}
