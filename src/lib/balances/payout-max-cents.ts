import type { BalancesKpis } from "@/types/balances";

/** Tope para el diálogo de retiro: Vascruz usa total ganado menos pagos; otras cuentas, saldo liberado. */
export function payoutDialogMaxCents(
  accountExternalId: string,
  kpis: BalancesKpis | undefined,
): number {
  if (!kpis) return 0;
  if (accountExternalId === "acct_vascruz") {
    return Math.max(
      0,
      kpis.total_earned_cents - kpis.total_paid_cents - kpis.pending_payouts_cents,
    );
  }
  return kpis.available_for_payout_cents;
}
