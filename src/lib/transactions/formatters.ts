export function safeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(cents) / 100);
}

/** Monto en BOB a partir de centavos USD recibidos y tipo de cambio BOB por 1 USD. */
export function formatPayoutBobAmount(
  receivedAmountCents: number,
  exchangeRateBob: number | null | undefined,
): string {
  if (
    exchangeRateBob == null ||
    !Number.isFinite(exchangeRateBob) ||
    exchangeRateBob <= 0
  ) {
    return "—";
  }
  const bob = (safeNumber(receivedAmountCents) * safeNumber(exchangeRateBob)) / 100;
  if (!Number.isFinite(bob)) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bob);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case "payment_intent":
      return "Payment Intent";
    case "charge":
      return "Charge";
    case "checkout_session":
      return "Checkout";
    case "invoice":
      return "Invoice";
    case "subscription":
      return "Subscription";
    default:
      return type;
  }
}
