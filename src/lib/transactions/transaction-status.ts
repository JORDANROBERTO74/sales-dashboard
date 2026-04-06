/** Estados operativos en `stripe_transactions.transaction_status` para retiros y cobros. */

export const TRANSACTION_STATUS_RETIRABLE = "";
export const TRANSACTION_STATUS_PAYOUT_PENDING = "payout_pending";
export const TRANSACTION_STATUS_WITHDRAWN = "withdrawn";
export const TRANSACTION_STATUS_PAID = "withdrawn";

export function isTransactionStatusRetirableForPayout(
  value: string | null | undefined,
): boolean {
  const v = value ?? "";
  return v === TRANSACTION_STATUS_RETIRABLE;
}
