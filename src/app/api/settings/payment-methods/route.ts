import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireApiAnyRole } from "@/lib/auth/api-auth";
import { UserRole } from "@/lib/auth/permissions";
import { decryptPaymentFields, encryptPaymentFields } from "@/lib/payment-methods/crypto";

const nullableUrl = z.string().trim().url().or(z.literal("")).nullable().optional();

const basePaymentSchema = z.object({
  methodType: z.enum(["binance", "airtm", "bank_qr"]),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  tutorialUrl: nullableUrl,
});

const binanceSchema = basePaymentSchema
  .extend({
    methodType: z.literal("binance"),
    binanceId: z.string().trim().min(2),
    binanceQrImageUrl: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const airtmSchema = basePaymentSchema
  .extend({
    methodType: z.literal("airtm"),
    achAccountHolder: z.string().trim().min(2),
    achRoutingNumber: z.string().trim().min(5),
    achAccountNumber: z.string().trim().min(4),
    achBankName: z.string().trim().min(2),
    achAccountType: z.string().trim().min(2),
  })
  .strict();

const bankQrSchema = basePaymentSchema
  .extend({
    methodType: z.literal("bank_qr"),
    qrBankName: z.string().trim().min(2),
    qrAccountHolder: z.string().trim().min(2),
    qrCiNumber: z.string().trim().min(3),
    qrAccountNumber: z.string().trim().min(4),
    qrImageUrl: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const paymentMethodSchema = z.union([binanceSchema, airtmSchema, bankQrSchema]);

type PaymentMethodPayload = z.infer<typeof paymentMethodSchema>;

async function attachSignedQrUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ReturnType<typeof decryptPaymentFields>
) {
  const bankQrPath = typeof row.qr_image_url === "string" ? row.qr_image_url : null;
  if (row.method_type === "bank_qr" && bankQrPath) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("payment-qr")
      .createSignedUrl(bankQrPath, 3600);

    if (signedError) {
      return { ...row, qr_image_signed_url: null };
    }

    return { ...row, qr_image_signed_url: signedData.signedUrl };
  }

  const binanceQrPath =
    typeof row.binance_qr_image_url === "string" ? row.binance_qr_image_url : null;
  if (row.method_type === "binance" && binanceQrPath) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("payment-qr")
      .createSignedUrl(binanceQrPath, 3600);

    if (signedError) {
      return { ...row, binance_qr_image_signed_url: null };
    }

    return { ...row, binance_qr_image_signed_url: signedData.signedUrl };
  }

  return row;
}

function mapFieldsByMethod(payload: PaymentMethodPayload) {
  const base = {
    is_enabled: payload.isEnabled ?? true,
    is_default: payload.isDefault ?? false,
    tutorial_url: payload.tutorialUrl ?? null,
  };

  if (payload.methodType === "binance") {
    return {
      ...base,
      binance_id: payload.binanceId?.trim() ?? null,
      binance_qr_image_url: payload.binanceQrImageUrl?.trim() ?? null,
      ach_account_holder: null,
      ach_routing_number: null,
      ach_account_number: null,
      ach_bank_name: null,
      ach_account_type: null,
      qr_bank_name: null,
      qr_account_holder: null,
      qr_ci_number: null,
      qr_account_number: null,
      qr_image_url: null,
    };
  }

  if (payload.methodType === "airtm") {
    return {
      ...base,
      ach_account_holder: payload.achAccountHolder?.trim() ?? null,
      ach_routing_number: payload.achRoutingNumber?.trim() ?? null,
      ach_account_number: payload.achAccountNumber?.trim() ?? null,
      ach_bank_name: payload.achBankName?.trim() ?? null,
      ach_account_type: payload.achAccountType?.trim() ?? null,
      binance_id: null,
      binance_qr_image_url: null,
      qr_bank_name: null,
      qr_account_holder: null,
      qr_ci_number: null,
      qr_account_number: null,
      qr_image_url: null,
    };
  }

  return {
    ...base,
    qr_bank_name: payload.qrBankName?.trim() ?? null,
    qr_account_holder: payload.qrAccountHolder?.trim() ?? null,
    qr_ci_number: payload.qrCiNumber?.trim() ?? null,
    qr_account_number: payload.qrAccountNumber?.trim() ?? null,
    qr_image_url: payload.qrImageUrl?.trim() ?? null,
    binance_id: null,
    binance_qr_image_url: null,
    ach_account_holder: null,
    ach_routing_number: null,
    ach_account_number: null,
    ach_bank_name: null,
    ach_account_type: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }
  if (request.nextUrl.searchParams.has("userId")) {
    return NextResponse.json(
      {
        error: "Este endpoint en settings opera en alcance self-service.",
        error_code: "PAYMENT_METHODS_SCOPE_SELF_ONLY",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seller_payment_methods")
    .select("*")
    .eq("user_id", auth.profileId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYMENT_METHODS_FETCH_FAILED" },
      { status: 500 }
    );
  }

  const decryptedMethods = (data ?? []).map((row) => decryptPaymentFields(row));
  const methods = await Promise.all(
    decryptedMethods.map((row) => attachSignedQrUrls(supabase, row))
  );
  return NextResponse.json({ methods }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyRole([UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER]);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, error_code: "FORBIDDEN" },
      { status: auth.status }
    );
  }
  // Decisión explícita de producto para settings: self-service.
  // owner/admin/seller solo gestionan sus propios métodos en este endpoint.

  const parsed = paymentMethodSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", error_code: "INVALID_PAYMENT_METHOD_PAYLOAD" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const rawRecord = {
    user_id: auth.profileId,
    method_type: body.methodType,
    ...mapFieldsByMethod(body),
  };

  const record = encryptPaymentFields(rawRecord);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seller_payment_methods")
    .upsert(record, {
      onConflict: "user_id,method_type",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, error_code: "PAYMENT_METHOD_UPSERT_FAILED" },
      { status: 400 }
    );
  }

  const decryptedMethod = decryptPaymentFields(data);
  const methodWithSignedUrl = await attachSignedQrUrls(supabase, decryptedMethod);

  return NextResponse.json({ method: methodWithSignedUrl }, { status: 200 });
}
