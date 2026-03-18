import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import {
  isValidStripeStatusFilter,
  normalizeStripeStatusFilter,
} from "@/lib/transactions/statuses";
import type {
  SellerOption,
  StripeTransactionRow,
  TransactionAssignment,
} from "@/types/transactions";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  accountExternalId: z
    .string()
    .trim()
    .max(100)
    .regex(/^acct_.+$/)
    .optional(),
  q: z.string().trim().max(80).optional(),
  status: z.string().trim().max(50).optional(),
  type: z
    .enum(["payment_intent", "charge", "checkout_session", "invoice", "subscription", "all"])
    .default("all"),
  assignment: z.string().trim().max(60).default("all"),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  periodPreset: z.enum(["always"]).optional(),
});

const ASSIGNMENT_SELLER_PREFIX = "seller:";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AssignmentQueryFilter =
  | { kind: "all" }
  | { kind: "assigned" }
  | { kind: "unassigned" }
  | { kind: "seller"; sellerUserId: string };

function parseAssignmentFilter(raw: string): AssignmentQueryFilter | null {
  if (raw === "all") return { kind: "all" };
  if (raw === "assigned") return { kind: "assigned" };
  if (raw === "unassigned") return { kind: "unassigned" };
  if (raw.startsWith(ASSIGNMENT_SELLER_PREFIX)) {
    const sellerUserId = raw.slice(ASSIGNMENT_SELLER_PREFIX.length);
    if (!UUID_REGEX.test(sellerUserId)) return null;
    return { kind: "seller", sellerUserId };
  }
  return null;
}

function buildAssignmentsSelect(kind: AssignmentQueryFilter["kind"]): string {
  const relation = kind === "assigned" || kind === "seller"
    ? "transaction_assignments!inner"
    : "transaction_assignments";

  return `
      ${relation} (
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
    `;
}

function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function toDateStart(value: string): string | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toDateEnd(value: string): string | null {
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

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

function firstArrayItem<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getRoleName(
  roles: { role_name?: string }[] | { role_name?: string } | null | undefined
): string | null {
  if (!roles) return null;
  const value = Array.isArray(roles) ? roles[0]?.role_name : roles.role_name;
  return value ?? null;
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
      { status: auth.status }
    );
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", error_code: "INVALID_QUERY_PARAMS" },
      { status: 400 }
    );
  }

  const {
    page,
    pageSize,
    accountExternalId,
    q,
    status,
    type,
    assignment,
    from,
    to,
    periodPreset,
  } = parsed.data;
  const assignmentFilter = parseAssignmentFilter(assignment);
  if (!assignmentFilter) {
    return NextResponse.json(
      { error: "Filtro de asignación inválido", error_code: "INVALID_ASSIGNMENT_FILTER" },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();
  const canViewCustomerData = auth.role === UserRole.OWNER || auth.role === UserRole.ADMIN;
  const fromDate = periodPreset === "always" ? null : from ? toDateStart(from) : null;
  const toDate = periodPreset === "always" ? null : to ? toDateEnd(to) : null;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const statusFilter = status ? normalizeStripeStatusFilter(status) : "";
  let stripeAccountIdFilter: string | null = null;

  if (accountExternalId) {
    const { data: accountData, error: accountError } = await supabase
      .from("stripe_accounts")
      .select("id")
      .eq("stripe_account_external_id", accountExternalId)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json(
        { error: accountError.message, error_code: "STRIPE_ACCOUNT_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!accountData?.id) {
      return NextResponse.json(
        { error: "Cuenta Stripe no encontrada", error_code: "INVALID_STRIPE_ACCOUNT" },
        { status: 400 }
      );
    }

    stripeAccountIdFilter = accountData.id;
  }

  if (statusFilter && !isValidStripeStatusFilter(statusFilter)) {
    return NextResponse.json(
      { error: "Estado Stripe inválido", error_code: "INVALID_STATUS_FILTER" },
      { status: 400 }
    );
  }

  const customerSelectColumns = canViewCustomerData ? "customer_email, customer_name," : "";
  const assignmentsSelect = buildAssignmentsSelect(assignmentFilter.kind);

  let query = supabase
    .from("stripe_transactions")
    .select(
      `
      id,
      stripe_id,
      transaction_type,
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
      ${assignmentsSelect}
    `,
      { count: "exact" }
    )
    .order("stripe_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (type !== "all") {
    query = query.eq("transaction_type", type);
  }
  if (stripeAccountIdFilter) {
    query = query.eq("stripe_account_id", stripeAccountIdFilter);
  }
  if (statusFilter) {
    query = query.eq("stripe_status", statusFilter);
  }
  if (fromDate) {
    query = query.gte("stripe_created_at", fromDate);
  }
  if (toDate) {
    query = query.lte("stripe_created_at", toDate);
  }
  if (assignmentFilter.kind === "assigned") {
    // !inner in select already guarantees only rows with assignment.
  }
  if (assignmentFilter.kind === "unassigned") {
    query = query.is("transaction_assignments", null);
  }
  if (assignmentFilter.kind === "seller") {
    query = query.eq("transaction_assignments.user_id", assignmentFilter.sellerUserId);
  }
  if (q) {
    const safeQ = sanitizeSearchTerm(q);
    if (safeQ) {
      query = canViewCustomerData
        ? query.or(
            `stripe_id.ilike.%${safeQ}%,customer_email.ilike.%${safeQ}%,customer_name.ilike.%${safeQ}%`
          )
        : query.or(`stripe_id.ilike.%${safeQ}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "TRANSACTIONS_FETCH_FAILED" },
      { status: 500 }
    );
  }

  const { data: sellersData, error: sellersError } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
      commission_rate,
      roles:role_id!inner (
        role_name
      )
    `
    )
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });

  if (sellersError) {
    return NextResponse.json(
      { error: sellersError.message, error_code: "SELLERS_FETCH_FAILED" },
      { status: 500 }
    );
  }

  const transactionRows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const rows: StripeTransactionRow[] = transactionRows.map((row) => ({
    id: row.id as string,
    stripe_id: row.stripe_id as string,
    transaction_type: row.transaction_type as StripeTransactionRow["transaction_type"],
    stripe_status: row.stripe_status as string,
    amount: Number(row.amount ?? 0),
    currency: (row.currency as StripeTransactionRow["currency"]) ?? "usd",
    stripe_fee: Number(row.stripe_fee ?? 0),
    net_amount: Number(row.net_amount ?? 0),
    customer_email: canViewCustomerData ? ((row.customer_email as string | null) ?? null) : null,
    customer_name: canViewCustomerData ? ((row.customer_name as string | null) ?? null) : null,
    payment_method_type: (row.payment_method_type as string | null) ?? null,
    stripe_product_id: (row.stripe_product_id as string | null) ?? null,
    stripe_created_at: (row.stripe_created_at as string | null) ?? null,
    funds_available_at: (row.funds_available_at as string | null) ?? null,
    created_at: row.created_at as string,
    assignment: mapAssignment(row.transaction_assignments as AssignmentRaw),
  }));

  const sellers: SellerOption[] = (sellersData ?? []).map((seller) => ({
    id: seller.id as string,
    full_name: (seller.full_name as string | null) ?? null,
    email: seller.email as string,
    commission_rate: Number(seller.commission_rate ?? 0),
    role_name:
      getRoleName(
        (seller as { roles?: { role_name?: string }[] | { role_name?: string } | null }).roles
      ),
  }));

  const total = count ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return NextResponse.json(
    {
      rows,
      sellers,
      total,
      page,
      pageSize,
      totalPages,
      canViewCustomerData,
    },
    { status: 200 }
  );
}
