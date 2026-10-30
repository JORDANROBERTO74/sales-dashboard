import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import {
  TRANSACTION_STATUS_PAYOUT_PENDING,
  TRANSACTION_STATUS_RETIRABLE,
  TRANSACTION_STATUS_WITHDRAWN,
} from "@/lib/transactions/transaction-status";
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
  /** all: todas las transacciones asignadas al seller; withdrawable: solo elegibles (legacy). */
  scope: z.enum(["all", "withdrawable"]).default("all"),
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

function payoutEligibility(
  requiresFundsAvailable: boolean,
  transactionStatus: string | null | undefined,
  fundsAvailableAt: string | null | undefined,
  commission: number,
): { eligible: boolean; reason: string | null } {
  if (!Number.isFinite(commission) || commission <= 0) {
    return { eligible: false, reason: "Sin comisión asignada" };
  }
  const status = transactionStatus ?? "";
  if (status !== TRANSACTION_STATUS_RETIRABLE) {
    if (status === TRANSACTION_STATUS_PAYOUT_PENDING) {
      return { eligible: false, reason: "En retiro pendiente" };
    }
    if (status === TRANSACTION_STATUS_WITHDRAWN) {
      return { eligible: false, reason: "Ya retirada" };
    }
    if (status.length > 0) {
      return { eligible: false, reason: "Estado no retirable" };
    }
  }
  if (requiresFundsAvailable) {
    if (!fundsAvailableAt) {
      return { eligible: false, reason: "Fondos aún no liberados" };
    }
    const t = new Date(fundsAvailableAt).getTime();
    if (Number.isNaN(t) || t > Date.now()) {
      return { eligible: false, reason: "Fondos aún no liberados" };
    }
  }
  return { eligible: true, reason: null };
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

  const { sellerUserId, accountExternalId, page, pageSize, scope } = parsed.data;

  if (auth.role === UserRole.SELLER && sellerUserId !== auth.profileId) {
    return NextResponse.json(
      { error: "No puedes consultar retiros de otro usuario", error_code: "FORBIDDEN_SCOPE" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  const { data: accountData, error: accountError } = await supabase
    .from("stripe_accounts")
    .select("id, stripe_account_external_id, requires_funds_available")
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

  const requiresFundsAvailable = accountData?.requires_funds_available ?? true;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const listAllAssigned = scope === "all";

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
    .order("stripe_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (listAllAssigned) {
    // Excluir solo 'withdrawn' sin perder NULL ni '': (NOT eq withdrawn) OR (IS NULL).
    query = query.or(
      `transaction_status.not.eq.${TRANSACTION_STATUS_WITHDRAWN},transaction_status.is.null`,
    );
  } else {
    query = query.eq("transaction_status", "");
    if (requiresFundsAvailable) {
      query = query.not("funds_available_at", "is", null).lte("funds_available_at", new Date().toISOString());
    }
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
    const assignment = firstAssignment(row.transaction_assignments);
    if (!assignment?.id || assignment.user_id !== sellerUserId) continue;
    if ((row.transaction_status ?? "") === TRANSACTION_STATUS_WITHDRAWN) continue;
    const commission = Number(assignment.commission_amount ?? 0);
    const { eligible, reason } = payoutEligibility(
      requiresFundsAvailable,
      row.transaction_status,
      row.funds_available_at,
      commission,
    );

    if (!listAllAssigned) {
      if (!eligible) continue;
    }

    rows.push({
      id: row.id,
      stripe_id: row.stripe_id,
      stripe_created_at: row.stripe_created_at,
      customer_name: row.customer_name,
      commission_amount: commission,
      assignment_id: assignment.id,
      eligible_for_payout: eligible,
      ineligibility_reason: reason,
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
