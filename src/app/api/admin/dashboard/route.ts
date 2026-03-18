import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DashboardAccountBreakdown,
  DashboardAccountOption,
  DashboardKpis,
  DashboardResponse,
  DashboardTopSeller,
} from "@/types/dashboard";

const querySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  periodPreset: z.enum(["always"]).optional(),
  accountExternalId: z
    .string()
    .trim()
    .max(100)
    .regex(/^acct_.+$/)
    .optional(),
});

type DateRange = {
  fromIso: string | null;
  toIso: string | null;
  fromDate: string | null;
  toDate: string | null;
  preset: "last_30_days" | "custom" | "always";
};

type AccountSummaryAccumulator = DashboardAccountBreakdown;

type SellerAccumulator = {
  user_id: string;
  full_name: string | null;
  email: string;
  current_commission_rate: number;
  period_commission_cents: number;
  period_transactions_count: number;
  total_earned_cents: number;
  available_for_payout_cents: number;
  pending_payouts_cents: number;
};

function toStartOfDayIso(dateValue: string): string | null {
  const parsed = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toEndOfDayIso(dateValue: string): string | null {
  const parsed = new Date(`${dateValue}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildDateRange(
  from?: string,
  to?: string,
  periodPreset?: "always",
): DateRange | null {
  if (periodPreset === "always") {
    return {
      fromIso: null,
      toIso: null,
      fromDate: null,
      toDate: null,
      preset: "always",
    };
  }

  if (from && to) {
    const fromIso = toStartOfDayIso(from);
    const toIso = toEndOfDayIso(to);
    if (!fromIso || !toIso) return null;
    if (new Date(fromIso).getTime() > new Date(toIso).getTime()) return null;
    return {
      fromIso,
      toIso,
      fromDate: from,
      toDate: to,
      preset: "custom",
    };
  }

  const now = new Date();
  const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);

  return {
    fromIso: `${toDateOnlyString(fromDate)}T00:00:00.000Z`,
    toIso: `${toDateOnlyString(toDate)}T23:59:59.999Z`,
    fromDate: toDateOnlyString(fromDate),
    toDate: toDateOnlyString(toDate),
    preset: "last_30_days",
  };
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0) || 0;
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

  const range = buildDateRange(
    parsed.data.from,
    parsed.data.to,
    parsed.data.periodPreset,
  );
  if (!range) {
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
      { error: accountOptionsError.message, error_code: "ACCOUNTS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const accountOptions: DashboardAccountOption[] = (accountOptionsData ?? []).map(
    (row) => ({
      id: row.id as string,
      external_id: row.stripe_account_external_id as string,
      display_name: row.display_name as string,
    }),
  );

  let selectedAccountId: string | null = null;
  if (parsed.data.accountExternalId) {
    const matched = accountOptions.find(
      (item) => item.external_id === parsed.data.accountExternalId,
    );
    if (!matched) {
      return NextResponse.json(
        { error: "Cuenta Stripe no encontrada", error_code: "INVALID_STRIPE_ACCOUNT" },
        { status: 400 },
      );
    }
    selectedAccountId = matched.id;
  }

  let transactionsQuery = supabase.from("stripe_transactions").select(`
      id,
      stripe_account_id,
      amount,
      stripe_fee,
      net_amount,
      stripe_created_at,
      created_at,
      stripe_accounts:stripe_account_id (
        id,
        stripe_account_external_id,
        display_name
      ),
      transaction_assignments (
        id,
        user_id,
        commission_amount
      )
    `);

  if (range.fromIso && range.toIso) {
    transactionsQuery = transactionsQuery
      .gte("stripe_created_at", range.fromIso)
      .lte("stripe_created_at", range.toIso);
  }

  if (selectedAccountId) {
    transactionsQuery = transactionsQuery.eq("stripe_account_id", selectedAccountId);
  }

  const { data: transactionsData, error: transactionsError } =
    await transactionsQuery;

  if (transactionsError) {
    return NextResponse.json(
      { error: transactionsError.message, error_code: "TRANSACTIONS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  let payoutsQuery = supabase
    .from("seller_payouts")
    .select("status, amount, stripe_account_id, created_at");

  if (range.fromIso && range.toIso) {
    payoutsQuery = payoutsQuery
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso);
  }

  if (selectedAccountId) {
    payoutsQuery = payoutsQuery.eq("stripe_account_id", selectedAccountId);
  }

  const { data: payoutsData, error: payoutsError } = await payoutsQuery;

  if (payoutsError) {
    return NextResponse.json(
      { error: payoutsError.message, error_code: "PAYOUTS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  let periodSellerQuery = supabase.from("transaction_assignments").select(`
      user_id,
      commission_amount,
      users:user_id (
        id,
        full_name,
        email,
        commission_rate
      ),
      stripe_transactions!inner (
        stripe_account_id,
        stripe_created_at
      )
    `);

  if (range.fromIso && range.toIso) {
    periodSellerQuery = periodSellerQuery
      .gte("stripe_transactions.stripe_created_at", range.fromIso)
      .lte("stripe_transactions.stripe_created_at", range.toIso);
  }

  if (selectedAccountId) {
    periodSellerQuery = periodSellerQuery.eq(
      "stripe_transactions.stripe_account_id",
      selectedAccountId,
    );
  }

  const { data: periodSellerData, error: periodSellerError } =
    await periodSellerQuery;

  if (periodSellerError) {
    return NextResponse.json(
      { error: periodSellerError.message, error_code: "SELLER_PERIOD_FETCH_FAILED" },
      { status: 500 },
    );
  }

  let balancesQuery = supabase.from("seller_balances_by_account").select(`
      user_id,
      full_name,
      email,
      current_commission_rate,
      total_earned,
      available_for_payout,
      pending_payouts,
      stripe_account_id
    `);

  if (selectedAccountId) {
    balancesQuery = balancesQuery.eq("stripe_account_id", selectedAccountId);
  }

  const { data: balancesData, error: balancesError } = await balancesQuery;
  if (balancesError) {
    return NextResponse.json(
      { error: balancesError.message, error_code: "SELLER_BALANCES_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const kpis: DashboardKpis = {
    gross_amount_cents: 0,
    stripe_fee_cents: 0,
    net_amount_cents: 0,
    transactions_count: 0,
    assigned_commission_cents: 0,
    unassigned_transactions_count: 0,
    completed_payouts_cents: 0,
    pending_payouts_cents: 0,
  };

  const accountBreakdownMap = new Map<string, AccountSummaryAccumulator>();
  const accountDailyGrossMap = new Map<string, Map<string, number>>();

  for (const tx of transactionsData ?? []) {
    const stripeAccountId = tx.stripe_account_id as string;
    const amount = toNumber(tx.amount);
    const stripeFee = toNumber(tx.stripe_fee);
    const netAmount = toNumber(tx.net_amount);
    const dateValue = String(tx.stripe_created_at ?? tx.created_at ?? "");
    const dateOnly = dateValue ? dateValue.slice(0, 10) : "";
    const assignment = firstItem(
      tx.transaction_assignments as
        | { id?: string; commission_amount?: number }[]
        | { id?: string; commission_amount?: number }
        | null
        | undefined,
    );
    const accountInfo = firstItem(
      tx.stripe_accounts as
        | {
            id?: string;
            stripe_account_external_id?: string;
            display_name?: string;
          }[]
        | {
            id?: string;
            stripe_account_external_id?: string;
            display_name?: string;
          }
        | null
        | undefined,
    );

    kpis.gross_amount_cents += amount;
    kpis.stripe_fee_cents += stripeFee;
    kpis.net_amount_cents += netAmount;
    kpis.transactions_count += 1;

    const hasAssignment = Boolean(assignment?.id);
    if (hasAssignment) {
      kpis.assigned_commission_cents += toNumber(assignment?.commission_amount);
    } else {
      kpis.unassigned_transactions_count += 1;
    }

    if (dateOnly) {
      const accountDailyMap =
        accountDailyGrossMap.get(stripeAccountId) ?? new Map<string, number>();
      accountDailyMap.set(dateOnly, (accountDailyMap.get(dateOnly) ?? 0) + amount);
      accountDailyGrossMap.set(stripeAccountId, accountDailyMap);
    }

    const existing = accountBreakdownMap.get(stripeAccountId);
    if (existing) {
      existing.gross_amount_cents += amount;
      existing.stripe_fee_cents += stripeFee;
      existing.net_amount_cents += netAmount;
      existing.transactions_count += 1;
      if (hasAssignment) {
        existing.assigned_commission_cents += toNumber(
          assignment?.commission_amount,
        );
      } else {
        existing.unassigned_transactions_count += 1;
      }
      continue;
    }

    accountBreakdownMap.set(stripeAccountId, {
      stripe_account_id: stripeAccountId,
      stripe_account_external_id:
        accountInfo?.stripe_account_external_id ?? "acct_unknown",
      stripe_account_display_name: accountInfo?.display_name ?? "Cuenta sin nombre",
      gross_amount_cents: amount,
      stripe_fee_cents: stripeFee,
      net_amount_cents: netAmount,
      transactions_count: 1,
      assigned_commission_cents: hasAssignment
        ? toNumber(assignment?.commission_amount)
        : 0,
      unassigned_transactions_count: hasAssignment ? 0 : 1,
      completed_payouts_cents: 0,
      pending_payouts_cents: 0,
      daily_gross_series: [],
    });
  }

  if (selectedAccountId && !accountBreakdownMap.has(selectedAccountId)) {
    const selectedAccount = accountOptions.find((account) => account.id === selectedAccountId);
    accountBreakdownMap.set(selectedAccountId, {
      stripe_account_id: selectedAccountId,
      stripe_account_external_id: selectedAccount?.external_id ?? "acct_unknown",
      stripe_account_display_name: selectedAccount?.display_name ?? "Cuenta sin nombre",
      gross_amount_cents: 0,
      stripe_fee_cents: 0,
      net_amount_cents: 0,
      transactions_count: 0,
      assigned_commission_cents: 0,
      unassigned_transactions_count: 0,
      completed_payouts_cents: 0,
      pending_payouts_cents: 0,
      daily_gross_series: [],
    });
  }

  for (const payout of payoutsData ?? []) {
    const amount = toNumber(payout.amount);
    const status = String(payout.status ?? "");
    const stripeAccountId = String(payout.stripe_account_id ?? "");

    if (stripeAccountId) {
      const account = accountBreakdownMap.get(stripeAccountId);
      if (account) {
        if (status === "completed") {
          account.completed_payouts_cents += amount;
        } else if (status === "pending") {
          account.pending_payouts_cents += amount;
        }
      }
    }

    if (status === "completed") {
      kpis.completed_payouts_cents += amount;
      continue;
    }
    if (status === "pending") {
      kpis.pending_payouts_cents += amount;
    }
  }

  const sellerMap = new Map<string, SellerAccumulator>();

  for (const row of periodSellerData ?? []) {
    const userId = row.user_id as string;
    const user = firstItem(
      row.users as
        | {
            id?: string;
            full_name?: string | null;
            email?: string;
            commission_rate?: number | null;
          }[]
        | {
            id?: string;
            full_name?: string | null;
            email?: string;
            commission_rate?: number | null;
          }
        | null
        | undefined,
    );
    const base = sellerMap.get(userId) ?? {
      user_id: userId,
      full_name: user?.full_name ?? null,
      email: user?.email ?? "",
      current_commission_rate: toNumber(user?.commission_rate),
      period_commission_cents: 0,
      period_transactions_count: 0,
      total_earned_cents: 0,
      available_for_payout_cents: 0,
      pending_payouts_cents: 0,
    };
    base.period_commission_cents += toNumber(row.commission_amount);
    base.period_transactions_count += 1;
    sellerMap.set(userId, base);
  }

  for (const row of balancesData ?? []) {
    const userId = row.user_id as string;
    const base = sellerMap.get(userId) ?? {
      user_id: userId,
      full_name: (row.full_name as string | null) ?? null,
      email: (row.email as string) ?? "",
      current_commission_rate: toNumber(row.current_commission_rate),
      period_commission_cents: 0,
      period_transactions_count: 0,
      total_earned_cents: 0,
      available_for_payout_cents: 0,
      pending_payouts_cents: 0,
    };
    base.total_earned_cents += toNumber(row.total_earned);
    base.available_for_payout_cents += toNumber(row.available_for_payout);
    base.pending_payouts_cents += toNumber(row.pending_payouts);
    sellerMap.set(userId, base);
  }

  const accounts = Array.from(accountBreakdownMap.values()).sort(
    (a, b) => b.net_amount_cents - a.net_amount_cents,
  );

  for (const account of accounts) {
    const dailyMap = accountDailyGrossMap.get(account.stripe_account_id);
    account.daily_gross_series = dailyMap
      ? Array.from(dailyMap.entries())
          .map(([date, grossAmountCents]) => ({
            date,
            gross_amount_cents: grossAmountCents,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
  }

  const topSellers: DashboardTopSeller[] = Array.from(sellerMap.values())
    .filter((seller) => seller.period_transactions_count > 0 || seller.total_earned_cents > 0)
    .sort((a, b) => {
      if (b.period_commission_cents !== a.period_commission_cents) {
        return b.period_commission_cents - a.period_commission_cents;
      }
      return b.total_earned_cents - a.total_earned_cents;
    })
    .slice(0, 15);

  const payload: DashboardResponse = {
    generated_at: new Date().toISOString(),
    period: {
      from: range.fromDate,
      to: range.toDate,
      preset: range.preset,
    },
    selected_account_external_id: parsed.data.accountExternalId ?? null,
    account_options: accountOptions,
    kpis,
    accounts,
    top_sellers: topSellers,
  };

  return NextResponse.json(payload, { status: 200 });
}
