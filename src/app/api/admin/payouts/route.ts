import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PayoutTransactionSnapshotItem } from "@/lib/payouts/payout-transaction-snapshot";
import {
  TRANSACTION_STATUS_PAYOUT_PENDING,
  TRANSACTION_STATUS_RETIRABLE,
  isTransactionStatusRetirableForPayout,
} from "@/lib/transactions/transaction-status";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import type { PayoutMethod, PayoutRow, PayoutStatus } from "@/types/payouts";

const PAYOUT_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
] as const;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  accountExternalId: z.string().trim().max(100).optional(),
  sellerUserId: z.string().uuid().optional(),
  status: z.enum(["pending", "completed", "cancelled", "rejected"]).optional(),
  method: z.enum(["binance", "airtm", "bank_qr"]).optional(),
  q: z.string().trim().max(80).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  periodPreset: z.enum(["always"]).optional(),
});

const createSchema = z.object({
  userId: z.string().uuid(),
  accountExternalId: z.string().trim().max(100),
  stripeTransactionIds: z.array(z.string().uuid()).min(1).max(200),
  paymentMethodId: z.string().uuid(),
  platformFee: z.coerce.number().int().min(0).optional(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

type PayoutQueryRow = {
  id?: string;
  user_id?: string;
  transactions?: unknown;
  stripe_account_id?: string;
  amount?: number | null;
  currency?: string | null;
  payout_method?: string | null;
  platform_fee?: number | null;
  received_amount?: number | null;
  exchange_rate_bob?: number | string | null;
  status?: string | null;
  reference?: string | null;
  notes?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
  users?:
    | {
        full_name?: string | null;
        email?: string;
        phone?: string | null;
      }
    | Array<{
        full_name?: string | null;
        email?: string;
        phone?: string | null;
      }>
    | null;
  stripe_accounts?:
    | {
        stripe_account_external_id?: string;
        display_name?: string;
      }
    | Array<{
        stripe_account_external_id?: string;
        display_name?: string;
      }>
    | null;
};

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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

function parseNullableFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPayoutRow(row: PayoutQueryRow): PayoutRow {
  const user = firstItem(row.users);
  const account = firstItem(row.stripe_accounts);
  const transactions = Array.isArray(row.transactions)
    ? (row.transactions as PayoutTransactionSnapshotItem[])
    : undefined;
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    seller_name: user?.full_name ?? null,
    seller_email: String(user?.email ?? ""),
    seller_phone: user?.phone ?? null,
    stripe_account_id: String(row.stripe_account_id ?? ""),
    stripe_account_external_id: String(
      account?.stripe_account_external_id ?? "",
    ),
    stripe_account_display_name: String(
      account?.display_name ?? "Cuenta sin nombre",
    ),
    amount: Number(row.amount ?? 0),
    currency: "usd",
    payout_method: (row.payout_method ?? "binance") as PayoutMethod,
    platform_fee: Number(row.platform_fee ?? 0),
    received_amount: Number(row.received_amount ?? 0),
    exchange_rate_bob: parseNullableFiniteNumber(row.exchange_rate_bob),
    status: (row.status ?? "pending") as PayoutStatus,
    reference: row.reference ?? null,
    notes: row.notes ?? null,
    paid_at: row.paid_at ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    transactions,
  };
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
    status,
    method,
    q,
    from,
    to,
    periodPreset,
  } = parsed.data;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const supabase = createAdminClient();

  const fromIso =
    periodPreset === "always" || !from ? null : parseDateStart(from);
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

  let stripeAccountIdFilter: string | null = null;
  if (accountExternalId) {
    const { data: accountData, error: accountError } = await supabase
      .from("stripe_accounts")
      .select("id")
      .eq("stripe_account_external_id", accountExternalId)
      .maybeSingle();
    if (accountError) {
      return NextResponse.json(
        {
          error: accountError.message,
          error_code: "STRIPE_ACCOUNT_LOOKUP_FAILED",
        },
        { status: 500 },
      );
    }
    if (!accountData?.id) {
      return NextResponse.json(
        {
          error: "Cuenta Stripe no encontrada",
          error_code: "INVALID_STRIPE_ACCOUNT",
        },
        { status: 400 },
      );
    }
    stripeAccountIdFilter = accountData.id;
  }

  let query = supabase
    .from("seller_payouts")
    .select(
      `
      id,
      user_id,
      stripe_account_id,
      amount,
      currency,
      payout_method,
      platform_fee,
      received_amount,
      exchange_rate_bob,
      status,
      reference,
      notes,
      paid_at,
      created_at,
      updated_at,
      users:user_id (
        full_name,
        email,
        phone
      ),
      stripe_accounts:stripe_account_id (
        stripe_account_external_id,
        display_name
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(start, end);

  if (auth.role === UserRole.SELLER) {
    query = query.eq("user_id", auth.profileId);
  }
  if (stripeAccountIdFilter) {
    query = query.eq("stripe_account_id", stripeAccountIdFilter);
  }
  if (sellerUserId) {
    query = query.eq("user_id", sellerUserId);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (method) {
    query = query.eq("payout_method", method);
  }
  if (fromIso) {
    query = query.gte("created_at", fromIso);
  }
  if (toIso) {
    query = query.lte("created_at", toIso);
  }
  if (q?.trim()) {
    query = query.ilike("reference", `%${q.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYOUTS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const { data: sellersData, error: sellersError } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
      roles:role_id!inner (
        role_name
      )
    `,
    )
    .eq("is_active", true)
    .eq("onboarding_completed", true)
    .in("roles.role_name", [...PAYOUT_ALLOWED_ROLES])
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });
  if (sellersError) {
    return NextResponse.json(
      { error: sellersError.message, error_code: "SELLERS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  const { data: accountOptionsData, error: accountOptionsError } =
    await supabase
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

  const rows = (data ?? []).map((row) => toPayoutRow(row as PayoutQueryRow));
  const total = count ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return NextResponse.json(
    {
      rows,
      sellers: (sellersData ?? []).map((seller) => ({
        id: seller.id as string,
        full_name: (seller.full_name as string | null) ?? null,
        email: seller.email as string,
      })),
      account_options: (accountOptionsData ?? []).map((account) => ({
        id: account.id as string,
        external_id: account.stripe_account_external_id as string,
        display_name: account.display_name as string,
      })),
      total,
      page,
      pageSize,
      totalPages,
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
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

  const json = (await request.json()) as unknown;
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_PAYOUT_PAYLOAD" },
      { status: 400 },
    );
  }

  const {
    userId,
    accountExternalId,
    stripeTransactionIds,
    paymentMethodId,
    platformFee,
    reference,
    notes,
  } = parsed.data;
  const normalizedPlatformFee = platformFee ?? 0;
  const uniqueTxIds = [...new Set(stripeTransactionIds)];
  if (uniqueTxIds.length !== stripeTransactionIds.length) {
    return NextResponse.json(
      {
        error: "No repitas transacciones en la selección",
        error_code: "DUPLICATE_TRANSACTION_IDS",
      },
      { status: 400 },
    );
  }

  if (auth.role === UserRole.SELLER && userId !== auth.profileId) {
    return NextResponse.json(
      {
        error: "Acceso denegado para crear retiros de otros sellers",
        error_code: "FORBIDDEN_SCOPE",
      },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data: accountData, error: accountError } = await supabase
    .from("stripe_accounts")
    .select("id, requires_funds_available, admin_only_payouts")
    .eq("stripe_account_external_id", accountExternalId)
    .maybeSingle();
  if (accountError) {
    return NextResponse.json(
      {
        error: accountError.message,
        error_code: "STRIPE_ACCOUNT_LOOKUP_FAILED",
      },
      { status: 500 },
    );
  }
  if (!accountData?.id) {
    return NextResponse.json(
      {
        error: "Cuenta Stripe no encontrada",
        error_code: "INVALID_STRIPE_ACCOUNT",
      },
      { status: 400 },
    );
  }

  if (
    accountData.admin_only_payouts &&
    auth.role !== UserRole.OWNER &&
    auth.role !== UserRole.ADMIN
  ) {
    return NextResponse.json(
      {
        error: "Solo owners y admins pueden realizar retiros en esta cuenta",
        error_code: "ACCOUNT_PAYOUT_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if (auth.role === UserRole.SELLER && userId !== auth.profileId) {
    return NextResponse.json(
      {
        error: "Acceso denegado para crear retiros de otros sellers",
        error_code: "FORBIDDEN_SCOPE",
      },
      { status: 403 },
    );
  }

  const { data: payoutUserData, error: payoutUserError } = await supabase
    .from("users")
    .select(
      `
      id,
      is_active,
      roles:role_id!inner (
        role_name
      )
    `,
    )
    .eq("id", userId)
    .eq("is_active", true)
    .in("roles.role_name", [...PAYOUT_ALLOWED_ROLES])
    .maybeSingle();
  if (payoutUserError) {
    return NextResponse.json(
      {
        error: payoutUserError.message,
        error_code: "PAYOUT_USER_LOOKUP_FAILED",
      },
      { status: 500 },
    );
  }
  if (!payoutUserData?.id) {
    return NextResponse.json(
      {
        error: "Usuario inválido, inactivo o sin rol permitido",
        error_code: "INVALID_PAYOUT_USER",
      },
      { status: 400 },
    );
  }

  const { data: paymentMethodData, error: paymentMethodError } = await supabase
    .from("seller_payment_methods")
    .select("id, method_type, is_enabled")
    .eq("id", paymentMethodId)
    .eq("user_id", userId)
    .maybeSingle();
  if (paymentMethodError) {
    return NextResponse.json(
      {
        error: paymentMethodError.message,
        error_code: "PAYMENT_METHOD_LOOKUP_FAILED",
      },
      { status: 500 },
    );
  }
  if (!paymentMethodData?.id) {
    return NextResponse.json(
      {
        error: "Método de pago inválido para el seller seleccionado",
        error_code: "INVALID_PAYMENT_METHOD",
      },
      { status: 400 },
    );
  }
  if (!paymentMethodData.is_enabled) {
    return NextResponse.json(
      {
        error: "El método de pago seleccionado está deshabilitado",
        error_code: "PAYMENT_METHOD_DISABLED",
      },
      { status: 400 },
    );
  }

  const requiresFunds = accountData.requires_funds_available;
  const admin = createAdminClient();

  const { data: txRows, error: txFetchError } = await admin
    .from("stripe_transactions")
    .select(
      `
      id,
      stripe_id,
      stripe_created_at,
      customer_name,
      transaction_status,
      funds_available_at,
      stripe_account_id,
      transaction_assignments!inner (
        id,
        user_id,
        commission_amount
      )
    `,
    )
    .in("id", uniqueTxIds);

  if (txFetchError) {
    return NextResponse.json(
      { error: txFetchError.message, error_code: "PAYOUT_TX_FETCH_FAILED" },
      { status: 500 },
    );
  }

  if (!txRows || txRows.length !== uniqueTxIds.length) {
    return NextResponse.json(
      {
        error: "Alguna transacción no existe o no tiene asignación válida",
        error_code: "INVALID_PAYOUT_TRANSACTION_SELECTION",
      },
      { status: 400 },
    );
  }

  const snapshot: PayoutTransactionSnapshotItem[] = [];
  let computedAmount = 0;

  for (const raw of txRows) {
    const row = raw as {
      id: string;
      stripe_id: string;
      stripe_created_at: string | null;
      customer_name: string | null;
      transaction_status: string | null;
      funds_available_at: string | null;
      stripe_account_id: string;
      transaction_assignments:
        | { id: string; user_id: string; commission_amount: number }
        | Array<{ id: string; user_id: string; commission_amount: number }>;
    };

    if (row.stripe_account_id !== accountData.id) {
      return NextResponse.json(
        {
          error:
            "Todas las transacciones deben pertenecer a la cuenta Stripe del retiro",
          error_code: "PAYOUT_TX_ACCOUNT_MISMATCH",
        },
        { status: 400 },
      );
    }

    const assignment = Array.isArray(row.transaction_assignments)
      ? row.transaction_assignments[0]
      : row.transaction_assignments;
    if (!assignment || assignment.user_id !== userId) {
      return NextResponse.json(
        {
          error: "La comisión debe estar asignada al usuario del retiro",
          error_code: "PAYOUT_TX_ASSIGNMENT_MISMATCH",
        },
        { status: 400 },
      );
    }

    if (!isTransactionStatusRetirableForPayout(row.transaction_status)) {
      return NextResponse.json(
        {
          error: "Alguna transacción ya no está disponible para retiro",
          error_code: "PAYOUT_TX_NOT_RETIRABLE",
        },
        { status: 409 },
      );
    }

    if (requiresFunds) {
      if (!row.funds_available_at) {
        return NextResponse.json(
          {
            error:
              "Solo se pueden retirar comisiones con fondos ya liberados en Stripe",
            error_code: "PAYOUT_TX_FUNDS_NOT_AVAILABLE",
          },
          { status: 400 },
        );
      }
      const t = new Date(row.funds_available_at).getTime();
      if (Number.isNaN(t) || t > Date.now()) {
        return NextResponse.json(
          {
            error:
              "Solo se pueden retirar comisiones con fondos ya liberados en Stripe",
            error_code: "PAYOUT_TX_FUNDS_NOT_AVAILABLE",
          },
          { status: 400 },
        );
      }
    }

    const commission = Number(assignment.commission_amount ?? 0);
    if (!Number.isFinite(commission) || commission <= 0) {
      return NextResponse.json(
        {
          error: "Comisión inválida en una de las transacciones",
          error_code: "INVALID_COMMISSION_AMOUNT",
        },
        { status: 400 },
      );
    }

    computedAmount += commission;
    snapshot.push({
      transaction_id: row.id,
      stripe_id: row.stripe_id,
      assignment_id: assignment.id,
      commission_amount: commission,
      stripe_created_at: row.stripe_created_at,
      customer_name: row.customer_name,
    });
  }

  if (computedAmount <= 0) {
    return NextResponse.json(
      {
        error: "El monto total del retiro debe ser mayor a cero",
        error_code: "INVALID_PAYOUT_AMOUNT",
      },
      { status: 400 },
    );
  }

  if (normalizedPlatformFee > computedAmount) {
    return NextResponse.json(
      {
        error: "El fee de plataforma no puede ser mayor al monto del retiro",
        error_code: "INVALID_PLATFORM_FEE",
      },
      { status: 400 },
    );
  }

  // NULL y '' son equivalentes para “retirable”; .eq('', '') no matchea NULL en Postgres.
  const retirableForLockFilter = `transaction_status.is.null,transaction_status.eq.${TRANSACTION_STATUS_RETIRABLE}`;
  const { data: lockedRows, error: lockError } = await admin
    .from("stripe_transactions")
    .update({ transaction_status: TRANSACTION_STATUS_PAYOUT_PENDING })
    .in("id", uniqueTxIds)
    .or(retirableForLockFilter)
    .select("id");

  if (lockError) {
    return NextResponse.json(
      { error: lockError.message, error_code: "PAYOUT_TX_LOCK_FAILED" },
      { status: 500 },
    );
  }

  if (!lockedRows || lockedRows.length !== uniqueTxIds.length) {
    return NextResponse.json(
      {
        error:
          "No se pudieron reservar todas las transacciones (posible conflicto concurrente)",
        error_code: "PAYOUT_TX_LOCK_CONFLICT",
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("seller_payouts")
    .insert({
      user_id: userId,
      stripe_account_id: accountData.id,
      amount: computedAmount,
      payout_method: paymentMethodData.method_type as PayoutMethod,
      platform_fee: normalizedPlatformFee,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
      created_by: auth.profileId,
      transactions: snapshot,
    })
    .select(
      `
      id,
      user_id,
      transactions,
      stripe_account_id,
      amount,
      currency,
      payout_method,
      platform_fee,
      received_amount,
      exchange_rate_bob,
      status,
      reference,
      notes,
      paid_at,
      created_at,
      updated_at,
      users:user_id (
        full_name,
        email,
        phone
      ),
      stripe_accounts:stripe_account_id (
        stripe_account_external_id,
        display_name
      )
    `,
    )
    .single();

  if (error) {
    await admin
      .from("stripe_transactions")
      .update({ transaction_status: TRANSACTION_STATUS_RETIRABLE })
      .in("id", uniqueTxIds);
    return NextResponse.json(
      { error: error.message, error_code: "PAYOUT_CREATE_FAILED" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { row: toPayoutRow(data as PayoutQueryRow) },
    { status: 200 },
  );
}
