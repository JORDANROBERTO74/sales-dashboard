import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parsePayoutTransactionsJson } from "@/lib/payouts/payout-transaction-snapshot";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import { decryptPaymentFields } from "@/lib/payment-methods/crypto";
import type {
  PayoutMethod,
  PayoutPaymentMethodDetail,
  PayoutRow,
  PayoutStatus,
} from "@/types/payouts";
import type { PayoutTransactionSnapshotItem } from "@/lib/payouts/payout-transaction-snapshot";
import {
  TRANSACTION_STATUS_PAYOUT_PENDING,
  TRANSACTION_STATUS_RETIRABLE,
  TRANSACTION_STATUS_WITHDRAWN,
} from "@/lib/transactions/transaction-status";

const patchSchema = z
  .object({
    status: z.enum(["pending", "completed", "cancelled", "rejected"]).optional(),
    platformFee: z.coerce.number().int().min(0).optional(),
    exchangeRateBob: z.coerce.number().positive().optional(),
    reference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

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

type PaymentMethodQueryRow = {
  id?: string;
  user_id?: string;
  method_type?: string;
  is_enabled?: boolean | null;
  is_default?: boolean | null;
  tutorial_url?: string | null;
  binance_id?: string | null;
  binance_qr_image_url?: string | null;
  ach_account_holder?: string | null;
  ach_routing_number?: string | null;
  ach_account_number?: string | null;
  ach_bank_name?: string | null;
  ach_account_type?: string | null;
  qr_bank_name?: string | null;
  qr_account_holder?: string | null;
  qr_ci_number?: string | null;
  qr_account_number?: string | null;
  qr_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parseNullableFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasUpToSixDecimals(value: number): boolean {
  const rounded = Number(value.toFixed(6));
  return Math.abs(value - rounded) < 1e-12;
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
    stripe_account_external_id: String(account?.stripe_account_external_id ?? ""),
    stripe_account_display_name: String(account?.display_name ?? "Cuenta sin nombre"),
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

async function syncStripeTransactionsForPayoutStatus(
  transactionsJson: unknown,
  targetStatus: "completed" | "cancelled" | "rejected",
) {
  const items = parsePayoutTransactionsJson(transactionsJson);
  if (items.length === 0) return;

  const ids = items.map((item) => item.transaction_id);
  const admin = createAdminClient();

  if (targetStatus === "completed") {
    const { error } = await admin
      .from("stripe_transactions")
      .update({ transaction_status: TRANSACTION_STATUS_WITHDRAWN })
      .in("id", ids)
      .eq("transaction_status", TRANSACTION_STATUS_PAYOUT_PENDING);
    if (error) {
      console.error("syncStripeTransactionsForPayoutStatus completed:", error.message);
    }
    return;
  }

  const { error } = await admin
    .from("stripe_transactions")
    .update({ transaction_status: TRANSACTION_STATUS_RETIRABLE })
    .in("id", ids)
    .eq("transaction_status", TRANSACTION_STATUS_PAYOUT_PENDING);
  if (error) {
    console.error("syncStripeTransactionsForPayoutStatus cancel/reject:", error.message);
  }
}

function toPayoutPaymentMethodDetail(
  row: PaymentMethodQueryRow & {
    binance_qr_image_signed_url?: string | null;
    qr_image_signed_url?: string | null;
  },
): PayoutPaymentMethodDetail {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    method_type: (row.method_type ?? "binance") as PayoutMethod,
    is_enabled: Boolean(row.is_enabled),
    is_default: Boolean(row.is_default),
    tutorial_url: row.tutorial_url ?? null,
    binance_id: row.binance_id ?? null,
    binance_qr_image_url: row.binance_qr_image_url ?? null,
    binance_qr_image_signed_url: row.binance_qr_image_signed_url ?? null,
    ach_account_holder: row.ach_account_holder ?? null,
    ach_routing_number: row.ach_routing_number ?? null,
    ach_account_number: row.ach_account_number ?? null,
    ach_bank_name: row.ach_bank_name ?? null,
    ach_account_type: row.ach_account_type ?? null,
    qr_bank_name: row.qr_bank_name ?? null,
    qr_account_holder: row.qr_account_holder ?? null,
    qr_ci_number: row.qr_ci_number ?? null,
    qr_account_number: row.qr_account_number ?? null,
    qr_image_url: row.qr_image_url ?? null,
    qr_image_signed_url: row.qr_image_signed_url ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

const selectPayoutQuery = `
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
`;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "ID de payout inválido", error_code: "INVALID_PAYOUT_ID" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let query = supabase.from("seller_payouts").select(selectPayoutQuery).eq("id", id);
  if (auth.role === UserRole.SELLER) {
    query = query.eq("user_id", auth.profileId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYOUT_FETCH_FAILED" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Payout no encontrado", error_code: "PAYOUT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const payoutRow = toPayoutRow(data as PayoutQueryRow);
  const { data: paymentMethodData, error: paymentMethodError } = await supabase
    .from("seller_payment_methods")
    .select("*")
    .eq("user_id", payoutRow.user_id)
    .eq("method_type", payoutRow.payout_method)
    .maybeSingle();
  if (paymentMethodError) {
    return NextResponse.json(
      { error: paymentMethodError.message, error_code: "PAYMENT_METHOD_FETCH_FAILED" },
      { status: 500 },
    );
  }

  let paymentMethod: PayoutPaymentMethodDetail | null = null;
  if (paymentMethodData) {
    const decryptedMethod = decryptPaymentFields(
      paymentMethodData as PaymentMethodQueryRow,
    ) as PaymentMethodQueryRow;
    let binanceQrImageSignedUrl: string | null = null;
    let qrImageSignedUrl: string | null = null;
    if (decryptedMethod.method_type === "binance" && decryptedMethod.binance_qr_image_url) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("payment-qr")
        .createSignedUrl(decryptedMethod.binance_qr_image_url, 3600);
      if (!signedError) {
        binanceQrImageSignedUrl = signedData.signedUrl;
      }
    }
    if (decryptedMethod.method_type === "bank_qr" && decryptedMethod.qr_image_url) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("payment-qr")
        .createSignedUrl(decryptedMethod.qr_image_url, 3600);
      if (!signedError) {
        qrImageSignedUrl = signedData.signedUrl;
      }
    }
    paymentMethod = toPayoutPaymentMethodDetail({
      ...decryptedMethod,
      binance_qr_image_signed_url: binanceQrImageSignedUrl,
      qr_image_signed_url: qrImageSignedUrl,
    });
  }

  return NextResponse.json(
    { row: payoutRow, payment_method: paymentMethod },
    { status: 200 },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "ID de payout inválido", error_code: "INVALID_PAYOUT_ID" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_PAYOUT_PATCH_PAYLOAD" },
      { status: 400 },
    );
  }

  const changes = parsed.data;
  if (
    changes.exchangeRateBob !== undefined &&
    !hasUpToSixDecimals(changes.exchangeRateBob)
  ) {
    return NextResponse.json(
      {
        error: "El tipo de cambio BOB permite maximo 6 decimales",
        error_code: "INVALID_EXCHANGE_RATE_BOB_PRECISION",
      },
      { status: 400 },
    );
  }
  if (
    changes.status === undefined &&
    changes.platformFee === undefined &&
    changes.exchangeRateBob === undefined &&
    changes.reference === undefined &&
    changes.notes === undefined
  ) {
    return NextResponse.json(
      { error: "No hay cambios para actualizar", error_code: "NO_PAYOUT_CHANGES" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let currentPayoutQuery = supabase
    .from("seller_payouts")
    .select(
      "id, user_id, status, payout_method, transactions, stripe_accounts:stripe_account_id(stripe_account_external_id)",
    )
    .eq("id", id);
  if (auth.role === UserRole.SELLER) {
    currentPayoutQuery = currentPayoutQuery.eq("user_id", auth.profileId);
  }
  const { data: currentPayout, error: currentPayoutError } = await currentPayoutQuery.maybeSingle();
  if (currentPayoutError) {
    return NextResponse.json(
      { error: currentPayoutError.message, error_code: "PAYOUT_FETCH_FAILED" },
      { status: 500 },
    );
  }
  if (!currentPayout?.id) {
    return NextResponse.json(
      { error: "Payout no encontrado", error_code: "PAYOUT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const account = firstItem(
    (currentPayout as { stripe_accounts?: { stripe_account_external_id?: string } | { stripe_account_external_id?: string }[] })
      .stripe_accounts,
  );
  const stripeAccountExternalId = account?.stripe_account_external_id;

  if (
    stripeAccountExternalId === "acct_vascruz" &&
    auth.role !== UserRole.OWNER &&
    auth.role !== UserRole.ADMIN
  ) {
    return NextResponse.json(
      {
        error: "Solo owners y admins pueden gestionar retiros en la cuenta Vascruz",
        error_code: "VASCRUZ_PAYOUT_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if (changes.status !== undefined) {
    const currentStatus = (currentPayout.status ?? "pending") as PayoutStatus;
    const targetStatus = changes.status;
    if (currentStatus !== "pending") {
      return NextResponse.json(
        {
          error: "Solo se permiten cambios de estado en payouts pendientes",
          error_code: "INVALID_PAYOUT_STATUS_TRANSITION",
        },
        { status: 400 },
      );
    }
    if (auth.role === UserRole.SELLER && targetStatus !== "cancelled") {
      return NextResponse.json(
        {
          error: "Los sellers solo pueden cancelar payouts pendientes",
          error_code: "FORBIDDEN_STATUS_TRANSITION",
        },
        { status: 403 },
      );
    }
    if (
      (auth.role === UserRole.ADMIN || auth.role === UserRole.OWNER) &&
      !["completed", "cancelled", "rejected"].includes(targetStatus)
    ) {
      return NextResponse.json(
        {
          error: "Transición de estado no permitida para este rol",
          error_code: "FORBIDDEN_STATUS_TRANSITION",
        },
        { status: 403 },
      );
    }
    if (targetStatus === "completed" && currentPayout.payout_method === "bank_qr") {
      if (changes.exchangeRateBob === undefined) {
        return NextResponse.json(
          {
            error: "El tipo de cambio BOB es obligatorio para completar payouts Bank QR",
            error_code: "MISSING_EXCHANGE_RATE_BOB",
          },
          { status: 400 },
        );
      }
    }
  }

  if (
    changes.exchangeRateBob !== undefined &&
    currentPayout.payout_method !== "bank_qr"
  ) {
    return NextResponse.json(
      {
        error: "El tipo de cambio BOB solo aplica a payouts Bank QR",
        error_code: "INVALID_EXCHANGE_RATE_BOB_SCOPE",
      },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (changes.status !== undefined) updatePayload.status = changes.status;
  if (changes.platformFee !== undefined) updatePayload.platform_fee = changes.platformFee;
  if (changes.exchangeRateBob !== undefined) updatePayload.exchange_rate_bob = changes.exchangeRateBob;
  if (changes.reference !== undefined) updatePayload.reference = changes.reference || null;
  if (changes.notes !== undefined) updatePayload.notes = changes.notes || null;

  let query = supabase
    .from("seller_payouts")
    .update(updatePayload)
    .eq("id", id);
  if (auth.role === UserRole.SELLER) {
    query = query.eq("user_id", auth.profileId);
  }

  const { data, error } = await query.select(selectPayoutQuery).maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYOUT_UPDATE_FAILED" },
      { status: 400 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Payout no encontrado", error_code: "PAYOUT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const payoutStatusChange = changes.status;
  if (
    payoutStatusChange === "completed" ||
    payoutStatusChange === "cancelled" ||
    payoutStatusChange === "rejected"
  ) {
    await syncStripeTransactionsForPayoutStatus(
      (currentPayout as { transactions?: unknown }).transactions,
      payoutStatusChange,
    );
  }

  return NextResponse.json(
    { row: toPayoutRow(data as PayoutQueryRow) },
    { status: 200 },
  );
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "ID de payout inválido", error_code: "INVALID_PAYOUT_ID" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let query = supabase.from("seller_payouts").delete().eq("id", id);
  if (auth.role === UserRole.SELLER) {
    query = query.eq("user_id", auth.profileId);
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYOUT_DELETE_FAILED" },
      { status: 400 },
    );
  }
  if (!data?.id) {
    return NextResponse.json(
      { error: "Payout no encontrado", error_code: "PAYOUT_NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
