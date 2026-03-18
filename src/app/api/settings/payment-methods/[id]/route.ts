import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const paymentMethodPatchSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    tutorialUrl: z.string().trim().url().or(z.literal("")).nullable().optional(),
    qrImageUrl: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "ID de método inválido", error_code: "INVALID_PAYMENT_METHOD_ID" },
      { status: 400 }
    );
  }

  const parsed = paymentMethodPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_PAYMENT_METHOD_PATCH_PAYLOAD" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = {};
  if (typeof body.isEnabled === "boolean") updates.is_enabled = body.isEnabled;
  if (typeof body.isDefault === "boolean") updates.is_default = body.isDefault;
  if (typeof body.tutorialUrl === "string" || body.tutorialUrl === null) {
    updates.tutorial_url = body.tutorialUrl?.trim() || null;
  }
  if (typeof body.qrImageUrl === "string" || body.qrImageUrl === null) {
    updates.qr_image_url = body.qrImageUrl?.trim() || null;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { error: "No hay cambios para actualizar", error_code: "NO_PAYMENT_METHOD_CHANGES" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  // Scope explícito para settings: self-service (solo métodos del usuario autenticado).
  const { data, error } = await supabase
    .from("seller_payment_methods")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.profileId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYMENT_METHOD_UPDATE_FAILED" },
      { status: 400 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Método no encontrado", error_code: "PAYMENT_METHOD_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "ID de método inválido", error_code: "INVALID_PAYMENT_METHOD_ID" },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  // Scope explícito para settings: self-service (solo métodos del usuario autenticado).
  const { data, error } = await supabase
    .from("seller_payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.profileId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYMENT_METHOD_DELETE_FAILED" },
      { status: 400 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Método no encontrado", error_code: "PAYMENT_METHOD_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
