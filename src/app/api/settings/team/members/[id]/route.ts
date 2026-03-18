import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const memberPatchSchema = z
  .object({
    roleId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    commissionRate: z.number().min(0).max(100).optional(),
  })
  .strict();

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      avatar_url,
      is_active,
      onboarding_completed,
      commission_rate,
      role_id,
      roles:role_id (
        role_name,
        display_name
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const member = {
    id: data.id as string,
    full_name: (data.full_name as string | null) ?? null,
    email: data.email as string,
    phone: (data.phone as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    is_active: Boolean(data.is_active),
    onboarding_completed: Boolean(data.onboarding_completed),
    commission_rate: Number(data.commission_rate ?? 0),
    role_id: data.role_id as string,
    role_name:
      (data as { roles?: { role_name?: string }[] | { role_name?: string } }).roles &&
      Array.isArray((data as { roles?: { role_name?: string }[] }).roles)
        ? (data as { roles: { role_name?: string }[] }).roles[0]?.role_name ?? null
        : ((data as { roles?: { role_name?: string } }).roles?.role_name ?? null),
    role_display_name:
      (data as { roles?: { display_name?: string }[] | { display_name?: string } }).roles &&
      Array.isArray((data as { roles?: { display_name?: string }[] }).roles)
        ? (data as { roles: { display_name?: string }[] }).roles[0]?.display_name ?? null
        : ((data as { roles?: { display_name?: string } }).roles?.display_name ?? null),
  };

  return NextResponse.json({ member }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "ID de miembro inválido", error_code: "INVALID_MEMBER_ID" },
      { status: 400 }
    );
  }

  const parsed = memberPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_MEMBER_PATCH_PAYLOAD" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = {};
  if (body.roleId) {
    updates.role_id = body.roleId;
  }
  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }
  if (typeof body.commissionRate === "number") {
    updates.commission_rate = body.commissionRate;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { error: "No hay cambios para actualizar", error_code: "NO_MEMBER_CHANGES" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "MEMBER_UPDATE_FAILED" },
      { status: 400 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Miembro no encontrado", error_code: "MEMBER_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
