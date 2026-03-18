import type { StripeTransactionType } from "@/types/transactions";

const STATUS_FILTER_REGEX = /^[a-z0-9_]+$/;

const COMMON_STRIPE_STATUSES = [
  "succeeded",
  "paid",
  "complete",
  "processing",
  "pending",
  "requires_payment_method",
  "requires_action",
  "canceled",
  "failed",
] as const;

const STRIPE_STATUS_BY_TYPE: Record<StripeTransactionType, readonly string[]> = {
  payment_intent: [
    "succeeded",
    "processing",
    "requires_payment_method",
    "requires_confirmation",
    "requires_action",
    "requires_capture",
    "canceled",
  ],
  charge: ["succeeded", "pending", "failed"],
  checkout_session: ["open", "complete", "expired"],
  invoice: ["draft", "open", "paid", "void", "uncollectible"],
  subscription: ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"],
};

export function normalizeStripeStatusFilter(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 50);
}

export function isValidStripeStatusFilter(value: string): boolean {
  return value.length > 0 && value.length <= 50 && STATUS_FILTER_REGEX.test(value);
}

export function getSuggestedStripeStatuses(
  type: StripeTransactionType | "all" = "all"
): string[] {
  if (type === "all") {
    return [...COMMON_STRIPE_STATUSES];
  }

  const typeStatuses = STRIPE_STATUS_BY_TYPE[type];
  return Array.from(new Set([...COMMON_STRIPE_STATUSES, ...typeStatuses]));
}
