import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateEmailSchema = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const parsed = updateEmailSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email inválido", error_code: "INVALID_EMAIL_PAYLOAD" },
      { status: 400 }
    );
  }

  const nextEmail = parsed.data.email.toLowerCase();
  if (user.email?.toLowerCase() === nextEmail) {
    return NextResponse.json(
      {
        error: "El email nuevo debe ser diferente al actual",
        error_code: "EMAIL_SAME_AS_CURRENT",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.auth.updateUser({
    email: nextEmail,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "EMAIL_UPDATE_REQUEST_FAILED" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Se envió la confirmación al nuevo correo. Debes confirmar para completar el cambio.",
    },
    { status: 200 }
  );
}
