import { z } from "zod";

export const payoutTransactionSnapshotItemSchema = z.object({
  transaction_id: z.string().uuid(),
  stripe_id: z.string(),
  assignment_id: z.string().uuid(),
  commission_amount: z.number().int(),
  stripe_created_at: z.string().nullable(),
  customer_name: z.string().nullable(),
});

export type PayoutTransactionSnapshotItem = z.infer<typeof payoutTransactionSnapshotItemSchema>;

export function parsePayoutTransactionsJson(value: unknown): PayoutTransactionSnapshotItem[] {
  if (!Array.isArray(value)) return [];
  const out: PayoutTransactionSnapshotItem[] = [];
  for (const item of value) {
    const parsed = payoutTransactionSnapshotItemSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
