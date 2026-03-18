import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

export async function GET() {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      `
      id,
      email,
      status,
      expires_at,
      created_at,
      roles:role_id (
        role_name,
        display_name
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invitations = (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    status: row.status as string,
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
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

  return NextResponse.json({ invitations }, { status: 200 });
}
