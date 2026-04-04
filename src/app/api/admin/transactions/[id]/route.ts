import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import type { StripeTransactionRow, TransactionAssignment } from "@/types/transactions";

type AssignmentUserRaw =
  | {
      id?: string;
      full_name?: string | null;
      email?: string;
      commission_rate?: number | null;
      roles?: { role_name?: string }[] | { role_name?: string } | null;
    }
  | Array<{
      id?: string;
      full_name?: string | null;
      email?: string;
      commission_rate?: number | null;
      roles?: { role_name?: string }[] | { role_name?: string } | null;
    }>
  | null
  | undefined;

type AssignmentRaw =
  | {
      id?: string;
      stripe_transaction_id?: string;
      user_id?: string;
      commission_amount?: number;
      assigned_at?: string;
      notes?: string | null;
      users?: AssignmentUserRaw;
    }
  | Array<{
      id?: string;
      stripe_transaction_id?: string;
      user_id?: string;
      commission_amount?: number;
      assigned_at?: string;
      notes?: string | null;
      users?: AssignmentUserRaw;
    }>
  | null
  | undefined;

type StripeTransactionQueryRaw = {
  id: string;
  stripe_id?: string;
  transaction_type?: StripeTransactionRow["transaction_type"];
  transaction_status?: string;
  stripe_status?: string;
  amount?: number | string | null;
  currency?: StripeTransactionRow["currency"] | null;
  stripe_fee?: number | string | null;
  net_amount?: number | string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  payment_method_type?: string | null;
  stripe_product_id?: string | null;
  stripe_created_at?: string | null;
  funds_available_at?: string | null;
  created_at: string;
  transaction_assignments?: AssignmentRaw;
};

function firstArrayItem<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getRoleName(
  roles: { role_name?: string }[] | { role_name?: string } | null | undefined
): "seller" | "admin" | "owner" | null {
  if (!roles) return null;
  const value = Array.isArray(roles) ? roles[0]?.role_name : roles.role_name;
  if (value === "seller" || value === "admin" || value === "owner") return value;
  return null;
}

function mapAssignment(value: AssignmentRaw): TransactionAssignment | null {
  const assignment = firstArrayItem(value);
  if (!assignment?.id || !assignment.user_id || !assignment.stripe_transaction_id) {
    return null;
  }

  const sellerRaw = firstArrayItem(assignment.users);
  const roleName = getRoleName(sellerRaw?.roles) ?? "seller";
  const seller = sellerRaw?.id
    ? {
        id: sellerRaw.id,
        full_name: sellerRaw.full_name ?? null,
        email: sellerRaw.email ?? "",
        commission_rate: Number(sellerRaw.commission_rate ?? 0),
        role_name: roleName,
      }
    : null;

  return {
    id: assignment.id,
    stripe_transaction_id: assignment.stripe_transaction_id,
    user_id: assignment.user_id,
    commission_amount: Number(assignment.commission_amount ?? 0),
    assigned_at: assignment.assigned_at ?? new Date().toISOString(),
    notes: assignment.notes ?? null,
    seller,
  };
}

function isStripeTransactionQueryRaw(value: unknown): value is StripeTransactionQueryRaw {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.created_at === "string";
}

const patchTransactionSchema = z.object({
  transaction_status: z.string().trim().max(50),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }

  const { id: transactionId } = await context.params;
  if (!transactionId) {
    return NextResponse.json(
      { error: "ID de transacción inválido", error_code: "INVALID_TRANSACTION_ID" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido", error_code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const parsed = patchTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_TRANSACTION_STATUS_PAYLOAD" },
      { status: 400 }
    );
  }

  const { transaction_status } = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stripe_transactions")
    .update({
      transaction_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "TRANSACTION_UPDATE_FAILED" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Transacción no encontrada", error_code: "TRANSACTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
      { status: auth.status }
    );
  }

  const { id: transactionId } = await context.params;
  if (!transactionId) {
    return NextResponse.json(
      { error: "ID de transacción inválido", error_code: "INVALID_TRANSACTION_ID" },
      { status: 400 }
    );
  }

  const canViewCustomerData = true;
  const customerSelectColumns = canViewCustomerData ? "customer_email, customer_name," : "";
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("stripe_transactions")
    .select(
      `
      id,
      stripe_id,
      transaction_type,
      transaction_status,
      stripe_status,
      amount,
      currency,
      stripe_fee,
      net_amount,
      ${customerSelectColumns}
      payment_method_type,
      stripe_product_id,
      stripe_created_at,
      funds_available_at,
      created_at,
      transaction_assignments (
        id,
        stripe_transaction_id,
        user_id,
        commission_amount,
        assigned_at,
        notes,
        users:user_id (
          id,
          full_name,
          email,
          commission_rate,
          roles:role_id (
            role_name
          )
        )
      )
    `
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "TRANSACTION_FETCH_FAILED" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Transacción no encontrada", error_code: "TRANSACTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!isStripeTransactionQueryRaw(data)) {
    return NextResponse.json(
      { error: "Formato de transacción inválido", error_code: "TRANSACTION_INVALID_FORMAT" },
      { status: 500 }
    );
  }

  const row: StripeTransactionRow = {
    id: data.id,
    stripe_id: data.stripe_id ?? "",
    transaction_type: (data.transaction_type ?? "charge") as StripeTransactionRow["transaction_type"],
    transaction_status: data.transaction_status ?? "",
    stripe_status: data.stripe_status ?? "",
    amount: Number(data.amount ?? 0),
    currency: (data.currency as StripeTransactionRow["currency"]) ?? "usd",
    stripe_fee: Number(data.stripe_fee ?? 0),
    net_amount: Number(data.net_amount ?? 0),
    customer_email: canViewCustomerData ? (data.customer_email ?? null) : null,
    customer_name: canViewCustomerData ? (data.customer_name ?? null) : null,
    payment_method_type: data.payment_method_type ?? null,
    stripe_product_id: data.stripe_product_id ?? null,
    stripe_created_at: data.stripe_created_at ?? null,
    funds_available_at: data.funds_available_at ?? null,
    created_at: data.created_at,
    assignment: mapAssignment(data.transaction_assignments),
  };

  return NextResponse.json(
    {
      row,
      canViewCustomerData,
    },
    { status: 200 }
  );
}
