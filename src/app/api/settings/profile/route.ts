import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  language: z.enum(["es", "en"]).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
});

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
    avatarUrl: z.string().trim().max(2048).url().or(z.literal("")).optional(),
    preferences: preferencesSchema.optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .strict();

type PreferencesShape = {
  theme?: string;
  language?: "es" | "en";
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
  [key: string]: unknown;
};

function normalizeOptionalString(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, auth_user_id, email, full_name, phone, avatar_url, onboarding_completed, preferences, updated_at",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Perfil no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      profile: {
        id: data.id as string,
        auth_user_id: data.auth_user_id as string,
        email: data.email as string,
        full_name: (data.full_name as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
        avatar_url: (data.avatar_url as string | null) ?? null,
        onboarding_completed: (data.onboarding_completed as boolean) ?? false,
        preferences:
          (data.preferences as {
            theme?: "light" | "dark";
            language?: "es" | "en";
            notifications?: { email?: boolean; push?: boolean };
          } | null) ?? null,
        updated_at: (data.updated_at as string | null) ?? null,
      },
    },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateProfileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_PROFILE_PAYLOAD" },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const updates: Record<string, unknown> = {};

  const normalizedFullName = normalizeOptionalString(payload.fullName);
  if (normalizedFullName !== undefined) {
    updates.full_name = normalizedFullName;
  }

  const normalizedPhone = normalizeOptionalString(payload.phone);
  if (normalizedPhone !== undefined) {
    updates.phone = normalizedPhone;
  }

  if (payload.avatarUrl !== undefined) {
    updates.avatar_url = payload.avatarUrl.trim() || null;
  }

  if (payload.preferences !== undefined) {
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("users")
      .select("preferences")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (currentProfileError) {
      return NextResponse.json(
        {
          error: currentProfileError.message,
          error_code: "PROFILE_READ_BEFORE_UPDATE_FAILED",
        },
        { status: 500 },
      );
    }

    const currentPreferences =
      ((currentProfile?.preferences as PreferencesShape | null) ??
        {}) as PreferencesShape;
    const currentNotifications = currentPreferences.notifications ?? {};

    updates.preferences = {
      ...currentPreferences,
      ...payload.preferences,
      notifications: payload.preferences.notifications
        ? {
            ...currentNotifications,
            ...payload.preferences.notifications,
          }
        : currentNotifications,
    };
  }

  // Handle onboarding completion
  if (payload.onboardingCompleted === true) {
    updates.onboarding_completed = true;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      {
        error: "No hay cambios para actualizar",
        error_code: "NO_PROFILE_CHANGES",
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("auth_user_id", user.id)
    .select("id, email")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PROFILE_UPDATE_FAILED" },
      { status: 400 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Perfil no encontrado", error_code: "PROFILE_NOT_FOUND" },
      { status: 404 },
    );
  }

  // If onboarding was completed, update invitation status
  if (payload.onboardingCompleted === true) {
    const normalizedEmail = data.email.trim().toLowerCase();
    try {
      const adminClient = createAdminClient();
      const { data: updatedInvitations, error: inviteError } = await adminClient
        .from("invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("email", normalizedEmail)
        .eq("status", "pending")
        .select("id");

      if (inviteError) {
        console.error("[Profile PATCH] Failed to mark invitation as accepted", {
          authUserId: user.id,
          email: normalizedEmail,
          error: inviteError.message,
        });
        // We don't fail the whole request since profile was updated
      } else if (!updatedInvitations || updatedInvitations.length === 0) {
        console.warn(
          "[Profile PATCH] No pending invitation found to mark as accepted",
          {
            authUserId: user.id,
            email: normalizedEmail,
          },
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[Profile PATCH] Invitation acceptance sync failed", {
        authUserId: user.id,
        email: normalizedEmail,
        error: errorMessage,
      });
      // We don't fail the whole request since profile was updated
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
