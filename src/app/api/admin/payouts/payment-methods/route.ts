import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

const querySchema = z.object({
  sellerUserId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", error_code: "INVALID_QUERY_PARAMS" },
      { status: 400 },
    );
  }

  const { sellerUserId } = parsed.data;
  if (auth.role === UserRole.SELLER && auth.profileId !== sellerUserId) {
    return NextResponse.json(
      { error: "Acceso denegado", error_code: "FORBIDDEN_SCOPE" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seller_payment_methods")
    .select("id, method_type, is_default, is_enabled")
    .eq("user_id", sellerUserId)
    .eq("is_enabled", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYMENT_METHODS_FETCH_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      methods: (data ?? []).map((method) => ({
        id: method.id as string,
        method_type: method.method_type as "binance" | "airtm" | "bank_qr",
        is_default: Boolean(method.is_default),
        is_enabled: Boolean(method.is_enabled),
      })),
    },
    { status: 200 },
  );
}
