import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

const inviteSchema = z
  .object({
    email: z.string().trim().email().max(320),
    roleId: z.string().uuid(),
  })
  .strict();

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }

    const match = (data.users ?? []).find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) {
      return match.id;
    }

    if (!data.users || data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

function mapInviteInsertError(message: string): {
  status: number;
  error_code: string;
  error: string;
} {
  const lower = message.toLowerCase();

  if (lower.includes("solo un owner puede invitar con el rol owner")) {
    return {
      status: 403,
      error_code: "OWNER_ROLE_INVITE_FORBIDDEN",
      error: message,
    };
  }
  if (lower.includes("límite de invitaciones excedido")) {
    return {
      status: 429,
      error_code: "INVITATION_RATE_LIMIT_EXCEEDED",
      error: message,
    };
  }
  if (lower.includes("último owner activo")) {
    return {
      status: 409,
      error_code: "LAST_OWNER_REINVITE_BLOCKED",
      error: message,
    };
  }
  if (lower.includes("ya existe en el sistema")) {
    return {
      status: 409,
      error_code: "USER_ALREADY_EXISTS",
      error: message,
    };
  }

  return {
    status: 400,
    error_code: "INVITATION_CREATE_FAILED",
    error: message,
  };
}

function getInviteRedirectTo(request: NextRequest): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();

    if (forwardedProto && forwardedHost) {
      return `${forwardedProto}://${forwardedHost}/auth/invite-password`;
    }

    console.warn(
      "[Invite] NEXT_PUBLIC_SITE_URL no está definido y no hay x-forwarded headers. Se usará request origin.",
    );
    return `${request.nextUrl.origin}/auth/invite-password`;
  }

  try {
    const origin = new URL(siteUrl).origin;
    return `${origin}/auth/invite-password`;
  } catch {
    console.warn(
      "[Invite] NEXT_PUBLIC_SITE_URL es inválido. Se usará el origin de la request.",
    );
    return `${request.nextUrl.origin}/auth/invite-password`;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status },
    );
  }

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_INVITE_PAYLOAD" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const supabase = await createClient();

  const { data: existingPendingInvite } = await supabase
    .from("invitations")
    .select("id, role_id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (
    existingPendingInvite &&
    existingPendingInvite.role_id === parsed.data.roleId
  ) {
    return NextResponse.json(
      {
        ok: true,
        warning: "Ya existe una invitación pendiente para este email y rol.",
        error_code: "INVITATION_ALREADY_PENDING",
      },
      { status: 200 },
    );
  }

  const { data: existingProfile } = await supabase
    .from("users")
    .select("id, onboarding_completed")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile && !existingProfile.onboarding_completed) {
    try {
      const authUserId = await findAuthUserIdByEmail(email);
      if (authUserId) {
        const admin = createAdminClient();
        const { error: deleteAuthError } =
          await admin.auth.admin.deleteUser(authUserId);
        if (deleteAuthError) {
          return NextResponse.json(
            {
              error:
                "No se pudo limpiar el usuario previo en Auth para re-invitar.",
              error_code: "AUTH_USER_DELETE_FAILED",
            },
            { status: 409 },
          );
        }
      }
    } catch {
      return NextResponse.json(
        {
          error: "No se pudo validar el estado de Auth para la re-invitación.",
          error_code: "AUTH_USER_LOOKUP_FAILED",
        },
        { status: 500 },
      );
    }
  }

  const { error: insertError } = await supabase.from("invitations").insert({
    email,
    role_id: parsed.data.roleId,
    invited_by: auth.profileId,
  });

  if (insertError) {
    const mapped = mapInviteInsertError(insertError.message);
    return NextResponse.json(mapped, { status: mapped.status });
  }

  try {
    const admin = createAdminClient();
    const redirectTo = getInviteRedirectTo(request);
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
      },
    );

    if (inviteError) {
      return NextResponse.json(
        {
          ok: true,
          warning:
            "La invitación se creó, pero no se pudo enviar el email automáticamente.",
          error_code: "INVITATION_EMAIL_NOT_SENT",
        },
        { status: 200 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        ok: true,
        warning:
          "La invitación se creó, pero no se pudo enviar el email automáticamente.",
        error_code: "INVITATION_EMAIL_NOT_SENT",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
