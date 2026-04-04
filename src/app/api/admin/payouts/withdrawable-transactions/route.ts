import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import type { WithdrawableTransactionRow } from "@/types/payouts";
const querySchema = z.object({
  sellerUserId: z.string().uuid(),
  accountExternalId: z
    .string()
    .trim()
    .max(100)
    .regex(/^acct_.+$/),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

type AssignmentInner = {
  id?: string;
  user_id?: string;
  commission_amount?: number;
};

function firstAssignment(value: AssignmentInner | AssignmentInner[] | null | undefined): AssignmentInner | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyRole([
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.SELLER,
  ]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status },
    );
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", error_code: "INVALID_WITHDRAWABLE_QUERY" },
      { status: 400 },
    );
  }

  const { sellerUserId, accountExternalId, page, pageSize } = parsed.data;

  if (auth.role === UserRole.SELLER && sellerUserId !== auth.profileId) {
    return NextResponse.json(
      { error: "No puedes consultar retiros de otro usuario", error_code: "FORBIDDEN_SCOPE" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  const { data: accountData, error: accountError } = await supabase
    .from("stripe_accounts")
    .select("id, stripe_account_external_id")
    .eq("stripe_account_external_id", accountExternalId)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json(
      { error: accountError.message, error_code: "STRIPE_ACCOUNT_LOOKUP_FAILED" },
      { status: 500 },
    );
  }
  if (!accountData?.id) {
    return NextResponse.json(
      { error: "Cuenta Stripe no encontrada", error_code: "INVALID_STRIPE_ACCOUNT" },
      { status: 400 },
    );
  }

  const isVascruz = accountExternalId === "acct_vascruz";
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("stripe_transactions")
    .select(
      `
      id,
      stripe_id,
      stripe_created_at,
      customer_name,
      transaction_status,
      funds_available_at,
      transaction_assignments!inner (
        id,
        user_id,
        commission_amount
      )
    `,
      { count: "exact" },
    )
    .eq("stripe_account_id", accountData.id)
    .eq("transaction_assignments.user_id", sellerUserId)
    .eq("transaction_status", "")
    .order("stripe_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (!isVascruz) {
    query = query.not("funds_available_at", "is", null).lte("funds_available_at", new Date().toISOString());
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "WITHDRAWABLE_TX_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const rows: WithdrawableTransactionRow[] = [];
  for (const raw of data ?? []) {
    const row = raw as {
      id: string;
      stripe_id: string;
      stripe_created_at: string | null;
      customer_name: string | null;
      transaction_status: string | null;
      funds_available_at: string | null;
      transaction_assignments: AssignmentInner | AssignmentInner[];
    };
    if (!isVascruz) {
      if (!row.funds_available_at) continue;
      const t = new Date(row.funds_available_at).getTime();
      if (Number.isNaN(t) || t > Date.now()) continue;
    }
    const assignment = firstAssignment(row.transaction_assignments);
    if (!assignment?.id || assignment.user_id !== sellerUserId) continue;
    const commission = Number(assignment.commission_amount ?? 0);
    if (commission <= 0) continue;
    rows.push({
      id: row.id,
      stripe_id: row.stripe_id,
      stripe_created_at: row.stripe_created_at,
      customer_name: row.customer_name,
      commission_amount: commission,
      assignment_id: assignment.id,
    });
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return NextResponse.json(
    {
      rows,
      total,
      page,
      pageSize,
      totalPages,
    },
    { status: 200 },
  );
}
