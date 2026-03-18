import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";

const MAX_QR_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

function getFileExtension(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "png";
  return parts[parts.length - 1].toLowerCase();
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Debes enviar un archivo.", error_code: "MISSING_QR_FILE" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Solo se permiten PNG, JPG y WEBP.", error_code: "INVALID_QR_MIME" },
      { status: 400 }
    );
  }
  if (file.size > MAX_QR_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo permitido (2MB).", error_code: "QR_FILE_TOO_LARGE" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      {
        error: "Extensión inválida. Solo se permiten .png, .jpg, .jpeg y .webp.",
        error_code: "INVALID_QR_EXTENSION",
      },
      { status: 400 }
    );
  }
  // Scope explícito: este endpoint es self-service y guarda siempre en la carpeta del usuario autenticado.
  const path = `${auth.authUserId}/${Date.now()}.${extension}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("payment-qr")
    .upload(path, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "QR_UPLOAD_FAILED" },
      { status: 400 }
    );
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("payment-qr")
    .createSignedUrl(data.path, 3600);
  if (signedError) {
    return NextResponse.json(
      { error: signedError.message, error_code: "QR_SIGNED_URL_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      path: data.path,
      signedUrl: signedData.signedUrl,
    },
    { status: 200 }
  );
}
