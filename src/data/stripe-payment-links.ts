/**
 * Payment Links de Stripe.
 * Esta plantilla no incluye enlaces reales. Reemplaza este array con los
 * Payment Links de tu propia cuenta de Stripe antes de desplegar en produccion.
 */

export type StripePaymentLinkItem = {
  id: string;
  name: string;
  url: string;
  /** Moneda principal mostrada en el checkout para este enlace. */
  currency: "usd" | "bob";
  createdAt: string;
  /** Monto en USD (0 si el precio listado es solo en BOB). */
  amountUsd: number;
  /** Monto en BOB cuando el precio no está en USD. */
  amountBob?: number;
  /** Valor usado para ordenar de menor a mayor en el listado. */
  sortAmount: number;
  /** Texto EN // ES con detalle del servicio. */
  description: string;
  billingNote?: string;
};

export const STRIPE_PAYMENT_LINKS_RAW: StripePaymentLinkItem[] = [];

export function formatUsdAmount(amountUsd: number): string {
  if (amountUsd <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amountUsd % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountUsd);
}

export function formatBobAmount(amountBob: number): string {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountBob);
}

/** Precio tal como debe mostrarse en la card. */
export function formatListedPrice(item: StripePaymentLinkItem): string {
  if (item.currency === "bob" && item.amountBob != null) {
    return formatBobAmount(item.amountBob);
  }
  return formatUsdAmount(item.amountUsd);
}

export function getActiveStripePaymentLinks(): StripePaymentLinkItem[] {
  return [...STRIPE_PAYMENT_LINKS_RAW].sort((a, b) => {
    if (a.sortAmount !== b.sortAmount) return a.sortAmount - b.sortAmount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** `true` si hay más de un link con el mismo nombre (mostrar fecha de referencia en la card). */
export function getDuplicateNameIds(
  items: StripePaymentLinkItem[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const item of items) {
    if ((counts.get(item.name) ?? 0) > 1) dup.add(item.id);
  }
  return dup;
}
