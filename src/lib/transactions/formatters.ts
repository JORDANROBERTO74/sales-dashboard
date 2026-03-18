function safeNumber(value: number): number {
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
