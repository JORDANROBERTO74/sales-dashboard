import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const roleId = request.nextUrl.searchParams.get("roleId");
  const status = request.nextUrl.searchParams.get("status");
  const q = request.nextUrl.searchParams.get("q");

  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
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
    .eq("onboarding_completed", true)
    .order("created_at", { ascending: false });

  if (roleId) {
    query = query.eq("role_id", roleId);
  }
  if (status === "active") {
    query = query.eq("is_active", true);
  }
  if (status === "inactive") {
    query = query.eq("is_active", false);
  }
  const safeQ = q ? sanitizeSearchTerm(q) : "";
  if (safeQ) {
    query = query.or(`email.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    email: row.email as string,
    is_active: Boolean(row.is_active),
    onboarding_completed: Boolean(row.onboarding_completed),
    commission_rate: Number(row.commission_rate ?? 0),
    role_id: row.role_id as string,
    role_name:
      (row as { roles?: { role_name?: string }[] | { role_name?: string } }).roles &&
      Array.isArray((row as { roles?: { role_name?: string }[] }).roles)
        ? (row as { roles: { role_name?: string }[] }).roles[0]?.role_name ?? null
        : ((row as { roles?: { role_name?: string } }).roles?.role_name ?? null),
    role_display_name:
      (row as { roles?: { display_name?: string }[] | { display_name?: string } }).roles &&
      Array.isArray((row as { roles?: { display_name?: string }[] }).roles)
        ? (row as { roles: { display_name?: string }[] }).roles[0]?.display_name ?? null
        : ((row as { roles?: { display_name?: string } }).roles?.display_name ?? null),
  }));

  return NextResponse.json({ members }, { status: 200 });
}
