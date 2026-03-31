import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import { isStripeTransactionAssignmentFrozen } from "@/lib/transactions/assignment-cutoff";

const assignSchema = z.object({
  sellerUserId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

function assignmentLockedForTransactionResponse() {
  return NextResponse.json(
    {
      error:
        "Esta transacción no admite cambios de asignación (fecha de creación anterior al corte).",
      error_code: "ASSIGNMENT_LOCKED_LEGACY_TRANSACTION",
    },
    { status: 403 }
  );
}

function getRoleName(
  roles: { role_name?: string }[] | { role_name?: string } | null | undefined
): string | null {
  if (!roles) return null;
  if (Array.isArray(roles)) return roles[0]?.role_name ?? null;
  return roles.role_name ?? null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
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

  const parsed = assignSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_ASSIGNMENT_PAYLOAD" },
      { status: 400 }
    );
  }

  const { sellerUserId, notes } = parsed.data;
  const effectiveSellerUserId = auth.role === UserRole.SELLER ? auth.profileId : sellerUserId;
  if (!effectiveSellerUserId) {
    return NextResponse.json(
      { error: "Responsable requerido", error_code: "ASSIGNEE_REQUIRED" },
      { status: 400 }
    );
  }
  const supabase = await createClient();

  const { data: transaction, error: txError } = await supabase
    .from("stripe_transactions")
    .select("id, stripe_created_at")
    .eq("id", transactionId)
    .maybeSingle();

  if (txError) {
    return NextResponse.json(
      { error: txError.message, error_code: "TRANSACTION_FETCH_FAILED" },
      { status: 500 }
    );
  }
  if (!transaction) {
    return NextResponse.json(
      { error: "Transacción no encontrada", error_code: "TRANSACTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (
    isStripeTransactionAssignmentFrozen(
      (transaction as { stripe_created_at?: string | null }).stripe_created_at ?? null
    )
  ) {
    return assignmentLockedForTransactionResponse();
  }

  const { data: existingAssignment, error: existingError } = await supabase
    .from("transaction_assignments")
    .select("id")
    .eq("stripe_transaction_id", transactionId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message, error_code: "ASSIGNMENT_CHECK_FAILED" },
      { status: 500 }
    );
  }
  if (existingAssignment) {
    return NextResponse.json(
      {
        error: "La transacción ya está asignada a un responsable.",
        error_code: "TRANSACTION_ALREADY_ASSIGNED",
      },
      { status: 409 }
    );
  }

  const { data: seller, error: sellerError } = await supabase
    .from("users")
    .select(
      `
      id,
      is_active,
      onboarding_completed,
      roles:role_id (
        role_name
      )
    `
    )
    .eq("id", effectiveSellerUserId)
    .maybeSingle();

  if (sellerError) {
    return NextResponse.json(
      { error: sellerError.message, error_code: "SELLER_FETCH_FAILED" },
      { status: 500 }
    );
  }
  if (!seller) {
    return NextResponse.json(
      { error: "Usuario a asignar no encontrado", error_code: "ASSIGNEE_NOT_FOUND" },
      { status: 404 }
    );
  }

  const sellerRole = getRoleName(
    (seller as { roles?: { role_name?: string }[] | { role_name?: string } | null }).roles
  );

  if (!(seller as { is_active?: boolean }).is_active) {
    return NextResponse.json(
      {
        error: "El usuario no está activo para recibir asignaciones.",
        error_code: "INACTIVE_ASSIGNEE",
      },
      { status: 400 }
    );
  }
  if (sellerRole !== "seller" && sellerRole !== "admin" && sellerRole !== "owner") {
    return NextResponse.json(
      {
        error: "Solo se puede asignar a usuarios seller, admin u owner.",
        error_code: "INVALID_ASSIGNEE_ROLE",
      },
      { status: 400 }
    );
  }
  if (
    sellerRole === "seller" &&
    !(seller as { onboarding_completed?: boolean }).onboarding_completed
  ) {
    return NextResponse.json(
      {
        error: "El seller debe tener onboarding completo para recibir asignaciones.",
        error_code: "SELLER_ONBOARDING_REQUIRED",
      },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("transaction_assignments")
    .insert({
      stripe_transaction_id: transactionId,
      user_id: effectiveSellerUserId,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertError) {
    const duplicate =
      insertError.code === "23505" ||
      insertError.message.toLowerCase().includes("duplicate key");
    if (duplicate) {
      return NextResponse.json(
        {
          error: "La transacción ya fue asignada por otro proceso.",
          error_code: "TRANSACTION_ALREADY_ASSIGNED",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertError.message, error_code: "ASSIGNMENT_CREATE_FAILED" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, assignmentId: inserted.id }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
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

  const supabase = await createClient();

  const { data: transaction, error: txError } = await supabase
    .from("stripe_transactions")
    .select("id, stripe_created_at")
    .eq("id", transactionId)
    .maybeSingle();

  if (txError) {
    return NextResponse.json(
      { error: txError.message, error_code: "TRANSACTION_FETCH_FAILED" },
      { status: 500 }
    );
  }
  if (!transaction) {
    return NextResponse.json(
      { error: "Transacción no encontrada", error_code: "TRANSACTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (
    isStripeTransactionAssignmentFrozen(
      (transaction as { stripe_created_at?: string | null }).stripe_created_at ?? null
    )
  ) {
    return assignmentLockedForTransactionResponse();
  }

  const { data: existingAssignment, error: existingError } = await supabase
    .from("transaction_assignments")
    .select("id,user_id")
    .eq("stripe_transaction_id", transactionId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message, error_code: "ASSIGNMENT_CHECK_FAILED" },
      { status: 500 }
    );
  }
  if (!existingAssignment) {
    return NextResponse.json(
      {
        error: "La transacción no tiene asignación activa.",
        error_code: "ASSIGNMENT_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  if (auth.role === UserRole.SELLER && existingAssignment.user_id !== auth.profileId) {
    return NextResponse.json(
      {
        error: "No tienes permisos para desasignar esta transacción.",
        error_code: "FORBIDDEN_ASSIGNMENT_SCOPE",
      },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("transaction_assignments")
    .delete()
    .eq("id", existingAssignment.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message, error_code: "ASSIGNMENT_DELETE_FAILED" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, assignmentId: existingAssignment.id }, { status: 200 });
}
