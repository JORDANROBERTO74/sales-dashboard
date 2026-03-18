import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import type { BalancesKpis, BalancesResponse, SellerBalanceRow } from "@/types/balances";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  accountExternalId: z.string().trim().max(100).optional(),
  sellerUserId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  periodPreset: z.enum(["always"]).optional(),
});

type BalanceRowRaw = {
  user_id?: string;
  full_name?: string | null;
  email?: string;
  stripe_account_id?: string;
  stripe_account_external_id?: string;
  stripe_account_display_name?: string;
  current_commission_rate?: number | null;
  total_earned?: number | null;
  available_earned?: number | null;
  pending_earned?: number | null;
  total_paid?: number | null;
  pending_payouts?: number | null;
  available_for_payout?: number | null;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function parseDateStart(value: string): string | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseDateEnd(value: string): string | null {
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyRole([
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.SELLER,
    UserRole.ANALYST,
    UserRole.VIEWER,
  ]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", error_code: "INVALID_QUERY_PARAMS" },
      { status: 400 },
    );
  }

  const {
    page,
    pageSize,
    accountExternalId,
    sellerUserId,
    q,
    from,
    to,
    periodPreset,
  } = parsed.data;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const fromIso = periodPreset === "always" || !from ? null : parseDateStart(from);
  const toIso = periodPreset === "always" || !to ? null : parseDateEnd(to);
  if ((from && !fromIso) || (to && !toIso)) {
    return NextResponse.json(
      { error: "Rango de fechas inválido", error_code: "INVALID_DATE_RANGE" },
      { status: 400 },
    );
  }
  if (
    fromIso &&
    toIso &&
    new Date(fromIso).getTime() > new Date(toIso).getTime()
  ) {
    return NextResponse.json(
      { error: "Rango de fechas inválido", error_code: "INVALID_DATE_RANGE" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: accountOptionsData, error: accountOptionsError } = await supabase
    .from("stripe_accounts")
    .select("id, stripe_account_external_id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (accountOptionsError) {
    return NextResponse.json(
      {
        error: accountOptionsError.message,
        error_code: "ACCOUNTS_FETCH_FAILED",
      },
      { status: 500 },
    );
  }

  const { data: sellerOptionsData, error: sellerOptionsError } = await supabase
    .from("users")
    .select(`
      id,
      full_name,
      email,
      roles:role_id!inner (
        role_name
      )
    `)
    .eq("is_active", true)
    .eq("onboarding_completed", true)
    .in("roles.role_name", ["seller", "admin", "owner"])
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });
  if (sellerOptionsError) {
    return NextResponse.json(
      {
        error: sellerOptionsError.message,
        error_code: "SELLERS_FETCH_FAILED",
      },
      { status: 500 },
    );
  }

  let balancesFullQuery = supabase.from("seller_balances_by_account").select(`
      user_id,
      full_name,
      email,
      stripe_account_id,
      stripe_account_external_id,
      stripe_account_display_name,
      current_commission_rate,
      total_earned,
      available_earned,
      pending_earned,
      total_paid,
      pending_payouts,
      available_for_payout
    `);

  if (auth.role === UserRole.SELLER) {
    balancesFullQuery = balancesFullQuery.eq("user_id", auth.profileId);
  }
  if (accountExternalId) {
    balancesFullQuery = balancesFullQuery.eq(
      "stripe_account_external_id",
      accountExternalId,
    );
  }
  if (sellerUserId) {
    balancesFullQuery = balancesFullQuery.eq("user_id", sellerUserId);
  }
  if (q?.trim()) {
    const safeQ = q.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
    if (safeQ) {
      balancesFullQuery = balancesFullQuery.or(
        `email.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%,stripe_account_display_name.ilike.%${safeQ}%,stripe_account_external_id.ilike.%${safeQ}%`,
      );
    }
  }

  const { data: fullRowsData, error: fullRowsError } = await balancesFullQuery;
  if (fullRowsError) {
    return NextResponse.json(
      { error: fullRowsError.message, error_code: "BALANCES_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const fullRows: SellerBalanceRow[] = (fullRowsData ?? []).map((row) => {
    const typed = row as BalanceRowRaw;
    return {
      user_id: String(typed.user_id ?? ""),
      full_name: typed.full_name ?? null,
      email: String(typed.email ?? ""),
      stripe_account_id: String(typed.stripe_account_id ?? ""),
      stripe_account_external_id: String(typed.stripe_account_external_id ?? ""),
      stripe_account_display_name: String(typed.stripe_account_display_name ?? ""),
      current_commission_rate: toNumber(typed.current_commission_rate),
      total_earned: toNumber(typed.total_earned),
      available_earned: toNumber(typed.available_earned),
      pending_earned: toNumber(typed.pending_earned),
      total_paid: toNumber(typed.total_paid),
      pending_payouts: toNumber(typed.pending_payouts),
      available_for_payout: toNumber(typed.available_for_payout),
    };
  });

  const kpis: BalancesKpis = {
    sellers_count: new Set(fullRows.map((row) => row.user_id)).size,
    total_earned_cents: fullRows.reduce((sum, row) => sum + row.total_earned, 0),
    available_earned_cents: fullRows.reduce(
      (sum, row) => sum + row.available_earned,
      0,
    ),
    pending_earned_cents: fullRows.reduce((sum, row) => sum + row.pending_earned, 0),
    total_paid_cents: fullRows.reduce((sum, row) => sum + row.total_paid, 0),
    pending_payouts_cents: fullRows.reduce(
      (sum, row) => sum + row.pending_payouts,
      0,
    ),
    available_for_payout_cents: fullRows.reduce(
      (sum, row) => sum + row.available_for_payout,
      0,
    ),
  };

  const sortedRows = [...fullRows].sort(
    (a, b) => b.available_for_payout - a.available_for_payout,
  );
  const rows = sortedRows.slice(start, end + 1);
  const total = fullRows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  const payload: BalancesResponse = {
    generated_at: new Date().toISOString(),
    period: {
      from: from ?? null,
      to: to ?? null,
      preset: periodPreset === "always" ? "always" : "custom",
    },
    account_options: (accountOptionsData ?? []).map((account) => ({
      id: account.id as string,
      external_id: account.stripe_account_external_id as string,
      display_name: account.display_name as string,
    })),
    seller_options: (sellerOptionsData ?? []).map((seller) => ({
      id: seller.id as string,
      full_name: (seller.full_name as string | null) ?? null,
      email: seller.email as string,
    })),
    kpis,
    rows,
    total,
    page,
    pageSize,
    totalPages,
  };

  return NextResponse.json(payload, { status: 200 });
}
