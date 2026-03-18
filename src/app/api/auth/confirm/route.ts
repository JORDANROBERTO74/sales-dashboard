import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/utils/redirect";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const redirectTo = getSafeRedirectPath(next, "/");

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL(
        "/auth/error?error=Enlace+de+confirmacion+invalido",
        request.url
      )
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/auth/error?error=No+se+pudo+verificar+el+email",
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
