import {
  formatDateTime,
  formatUsdFromCents,
} from "@/lib/transactions/formatters";
import type { PayoutMethod, PayoutStatus } from "@/types/payouts";

export const WHATSAPP_PAYOUT_PHONE = "59178154345";

type BuildWhatsAppPayoutUrlInput = {
  payoutId?: string;
  status?: PayoutStatus;
  accountDisplayName?: string | null;
  accountExternalId: string;
  sellerName?: string | null;
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  sellerUserId: string;
  amountCents: number;
  platformFeeCents?: number;
  receivedAmountCents?: number;
  payoutMethodLabel: string;
  payoutMethod?: PayoutMethod;
  exchangeRateBob?: number | null;
  reference?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  updatedAt?: string | null;
};

function cleanValue(value?: string | null): string {
  return value?.trim() ?? "";
}

function normalizeWhatsAppPhone(value?: string | null): string {
  return cleanValue(value).replace(/\D/g, "");
}

function formatBobAmount(value: number): string {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function buildWhatsAppPayoutUrl(
  input: BuildWhatsAppPayoutUrlInput,
): string {
  const lines: string[] = [];
  const payoutId = cleanValue(input.payoutId);
  const status = cleanValue(input.status);
  const accountDisplayName = cleanValue(input.accountDisplayName);
  const accountExternalId = cleanValue(input.accountExternalId);
  const sellerName = cleanValue(input.sellerName);
  const sellerEmail = cleanValue(input.sellerEmail);
  const sellerPhone = normalizeWhatsAppPhone(input.sellerPhone);
  const createdAt = cleanValue(input.createdAt);
  const paidAt = cleanValue(input.paidAt);
  const isCompleted = input.status === "completed";
  const isBankQr = input.payoutMethod === "bank_qr";
  const amountLabel = formatUsdFromCents(input.amountCents);
  const platformFeeLabel = formatUsdFromCents(input.platformFeeCents ?? 0);
  const receivedAmountLabel = formatUsdFromCents(
    input.receivedAmountCents ?? 0,
  );
  const methodLabel = cleanValue(input.payoutMethodLabel) || "N/D";
  const stateLabel =
    status === "completed"
      ? "Completado"
      : status === "pending"
        ? "Pendiente"
        : status === "cancelled"
          ? "Cancelado"
          : status === "rejected"
            ? "Rechazado"
            : "N/D";

  lines.push("*DETALLE DE RETIRO*");
  lines.push("");

  if (payoutId) lines.push(`ID: ${payoutId}`);
  lines.push(`Estado: *${stateLabel}*`);

  lines.push(`Creado: ${createdAt ? formatDateTime(createdAt) : "—"}`);
  lines.push(`Pagado: ${paidAt ? formatDateTime(paidAt) : "—"}`);

  if (accountDisplayName && accountExternalId) {
    lines.push(`Cuenta: ${accountDisplayName} (${accountExternalId})`);
  } else if (accountDisplayName) {
    lines.push(`Cuenta: ${accountDisplayName}`);
  } else if (accountExternalId) {
    lines.push(`Cuenta: ${accountExternalId}`);
  }

  if (sellerName && sellerEmail) {
    lines.push(`Usuario: ${sellerName} (${sellerEmail})`);
  } else if (sellerName) {
    lines.push(`Usuario: ${sellerName}`);
  } else if (sellerEmail) {
    lines.push(`Usuario: ${sellerEmail}`);
  } else {
    lines.push(`Usuario ID: ${input.sellerUserId}`);
  }

  lines.push(`Metodo: ${methodLabel}`);
  lines.push(`Monto solicitado: *${amountLabel}*`);

  if (isCompleted) {
    lines.push(`Fee plataforma: ${platformFeeLabel}`);
    lines.push(`Monto neto recibido: *${receivedAmountLabel}*`);
    if (isBankQr) {
      const exchangeRate = input.exchangeRateBob ?? null;
      if (exchangeRate && exchangeRate > 0) {
        const receivedAmountBob =
          ((input.receivedAmountCents ?? 0) / 100) * exchangeRate;
        lines.push(`Tipo de cambio BOB: *${exchangeRate}*`);
        lines.push(
          `Monto recibido (BOB): *${formatBobAmount(receivedAmountBob)}*`,
        );
      } else {
        lines.push("Tipo de cambio BOB: *No registrado*");
      }
    }
  }

  const params = new URLSearchParams();
  params.set("text", lines.join("\n"));

  const targetPhone = input.status === "pending" ? WHATSAPP_PAYOUT_PHONE : sellerPhone;
  return `https://wa.me/${targetPhone}?${params.toString()}`;
}
