import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/lib/auth/permissions";

export type ApiAuthResult =
  | { ok: true; authUserId: string; profileId: string; role: UserRole }
  | { ok: false; status: number; error: string };

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const lowered = role.trim().toLowerCase();
  return (Object.values(UserRole) as string[]).includes(lowered)
    ? (lowered as UserRole)
    : null;
}

export async function requireApiAnyRole(roles: UserRole[]): Promise<ApiAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      `
      id,
      roles:role_id (
        role_name
      )
    `
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const roleName = normalizeRole(
    (profile as { roles?: { role_name?: string }[] | { role_name?: string } | null }).roles
      ? Array.isArray(
          (profile as { roles: { role_name?: string }[] | { role_name?: string } }).roles
        )
        ? (profile as { roles: { role_name?: string }[] }).roles[0]?.role_name
        : (profile as { roles: { role_name?: string } }).roles.role_name
      : null
  );

  if (!roleName || !roles.includes(roleName)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, authUserId: user.id, profileId: profile.id, role: roleName };
}
