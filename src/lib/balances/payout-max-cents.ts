import type { BalancesKpis } from "@/types/balances";

/** Tope para el diálogo de retiro: saldo disponible para payout según los KPIs de la cuenta. */
export function payoutDialogMaxCents(
  accountExternalId: string,
  kpis: BalancesKpis | undefined,
): number {
  if (!kpis) return 0;
  return kpis.available_for_payout_cents;
}
