"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutsCompleteDialog } from "@/components/payouts/payouts-complete-dialog";
import { PayoutsStatusDialog } from "@/components/payouts/payouts-status-dialog";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useUserScope } from "@/hooks/auth/use-user-scope";
import { usePayoutDetail, useUpdatePayout } from "@/hooks/payouts/use-payouts";
import { parsePayoutTransactionsJson } from "@/lib/payouts/payout-transaction-snapshot";
import { buildWhatsAppPayoutUrl } from "@/lib/payouts/whatsapp";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import {
  formatDateTime,
  formatPayoutBobAmount,
  formatUsdFromCents,
} from "@/lib/transactions/formatters";
import type { PayoutMethod, PayoutPaymentMethodDetail, PayoutStatus } from "@/types/payouts";
import WhatsAppIcon from "../ui/whatsAppIcon";

type PayoutDetailProps = {
  payoutId: string;
};

function statusBadgeVariant(status: PayoutStatus) {
  if (status === "completed") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "destructive";
  return "outline";
}

function statusLabel(status: PayoutStatus) {
  if (status === "completed") return "Completado";
  if (status === "pending") return "Pendiente";
  if (status === "cancelled") return "Cancelado";
  return "Rechazado";
}

function methodLabel(method: PayoutMethod) {
  if (method === "bank_qr") return "Bank QR";
  return method === "airtm" ? "Airtm" : "Binance";
}

function renderPaymentMethodFields(method: PayoutPaymentMethodDetail) {
  if (method.method_type === "binance") {
    return [
      { label: "ID de Binance", value: method.binance_id },
      { label: "Código QR Binance", value: method.binance_qr_image_signed_url || method.binance_qr_image_url },
    ];
  }

  if (method.method_type === "airtm") {
    return [
      { label: "Titular ACH", value: method.ach_account_holder },
      { label: "Routing ACH", value: method.ach_routing_number },
      { label: "Cuenta ACH", value: method.ach_account_number },
      { label: "Banco ACH", value: method.ach_bank_name },
      { label: "Tipo de cuenta ACH", value: method.ach_account_type },
    ];
  }

  return [
    { label: "Banco QR", value: method.qr_bank_name },
    { label: "Titular QR", value: method.qr_account_holder },
    { label: "CI QR", value: method.qr_ci_number },
    { label: "Cuenta QR", value: method.qr_account_number },
    { label: "Imagen QR", value: method.qr_image_signed_url || method.qr_image_url },
  ];
}

function isQrImageField(label: string) {
  return label === "Imagen QR" || label === "Código QR Binance";
}

export function PayoutDetail({ payoutId }: PayoutDetailProps) {
  const payoutQuery = usePayoutDetail(payoutId);
  const updateMutation = useUpdatePayout();
  const { isAdminLike, isSeller } = useUserScope();
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    status: "cancelled" | "rejected";
  }>({ open: false, status: "cancelled" });

  if (payoutQuery.isLoading) {
    return <SettingsSectionSkeleton rows={3} compact showBadge />;
  }

  if (payoutQuery.isError) {
    return (
      <SettingsErrorState
        message={getSettingsErrorMessage(payoutQuery.error)}
        onRetry={() => {
          void payoutQuery.refetch();
        }}
      />
    );
  }

  if (!payoutQuery.data?.row) {
    return (
      <SettingsEmptyState
        title="No se encontró el payout."
        description="Verifica el enlace o vuelve al listado de retiros."
      />
    );
  }

  const row = payoutQuery.data.row;
  const paymentMethod = payoutQuery.data.payment_method;
  const payoutSnapshot = parsePayoutTransactionsJson(row.transactions);
  const receivedAmountToDisplay = row.status === "pending" ? 0 : row.received_amount;
  const paymentMethodFields = paymentMethod ? renderPaymentMethodFields(paymentMethod) : [];
  const isPendingRow = row.status === "pending";
  const isVascruz = row.stripe_account_external_id === "acct_vascruz";
  const canComplete = isPendingRow && isAdminLike;
  const canCancel =
    isPendingRow && (isVascruz ? isAdminLike : isAdminLike || isSeller);
  const canReject = isPendingRow && isAdminLike;
  const hasSellerPhone = Boolean(row.seller_phone?.match(/\d/));
  const canSeeNotifyButton = isAdminLike || (isSeller && isPendingRow);
  const isNotifyDisabled = row.status !== "pending" && !hasSellerPhone;
  const whatsappUrl = buildWhatsAppPayoutUrl({
    payoutId: row.id,
    status: row.status,
    accountDisplayName: row.stripe_account_display_name,
    accountExternalId: row.stripe_account_external_id,
    sellerName: row.seller_name,
    sellerEmail: row.seller_email,
    sellerPhone: row.seller_phone,
    sellerUserId: row.user_id,
    amountCents: row.amount,
    platformFeeCents: row.platform_fee,
    receivedAmountCents: row.received_amount,
    payoutMethodLabel: methodLabel(row.payout_method),
    payoutMethod: row.payout_method,
    exchangeRateBob: row.exchange_rate_bob,
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    updatedAt: row.updated_at,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="font-mono text-base break-all">{row.id}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {canCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatusDialog({ open: true, status: "cancelled" })}
                  disabled={updateMutation.isPending}
                >
                  Cancelar payout
                </Button>
              ) : null}
              {canReject ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setStatusDialog({ open: true, status: "rejected" })}
                  disabled={updateMutation.isPending}
                >
                  Rechazar payout
                </Button>
              ) : null}
            </div>
          </div>
          <CardDescription>
            {row.seller_name || row.seller_email} - {row.stripe_account_display_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
              <Badge variant="outline">{methodLabel(row.payout_method)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSeeNotifyButton ? (
                <Button
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                  disabled={isNotifyDisabled}
                >
                  <WhatsAppIcon className="size-4" />
                  Notificar
                </Button>
              ) : null}
              {canComplete ? (
                <Button
                  onClick={() => setIsCompleteDialogOpen(true)}
                  disabled={updateMutation.isPending}
                >
                  Completar payout
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="font-medium">{formatUsdFromCents(row.amount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Fee plataforma</p>
              <p className="font-medium">{formatUsdFromCents(row.platform_fee)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Recibido</p>
              <p className="font-medium">{formatUsdFromCents(receivedAmountToDisplay)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del payout</CardTitle>
          <CardDescription>Información operativa y de trazabilidad del retiro.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Seller: </span>
            {row.seller_name || row.seller_email}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {row.seller_email}
          </p>
          <p>
            <span className="text-muted-foreground">Cuenta Stripe: </span>
            {row.stripe_account_display_name}
          </p>
          <p>
            <span className="text-muted-foreground">External ID: </span>
            {row.stripe_account_external_id}
          </p>
          <p>
            <span className="text-muted-foreground">Método: </span>
            {methodLabel(row.payout_method)}
          </p>
          {row.payout_method === "bank_qr" ? (
            <p>
              <span className="text-muted-foreground">Tipo de cambio BOB: </span>
              {row.exchange_rate_bob ?? "—"}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Moneda: </span>
            {row.currency.toUpperCase()}
          </p>
          {row.payout_method === "bank_qr" ? (
            <p>
              <span className="text-muted-foreground">Monto BOB: </span>
              {formatPayoutBobAmount(row.received_amount, row.exchange_rate_bob)}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Notas: </span>
            {row.notes || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Creado: </span>
            {formatDateTime(row.created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Pagado: </span>
            {formatDateTime(row.paid_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Actualizado: </span>
            {formatDateTime(row.updated_at)}
          </p>
        </CardContent>
      </Card>

      {payoutSnapshot.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Transacciones incluidas en el retiro</CardTitle>
            <CardDescription>Snapshot al crear el payout (comisión por transacción).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {payoutSnapshot.map((item) => (
                <li key={item.transaction_id} className="rounded-md border p-2">
                  <p className="font-mono text-xs">{item.stripe_id}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(item.stripe_created_at)} · {item.customer_name || "Sin nombre"} ·{" "}
                    {formatUsdFromCents(item.commission_amount)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Método de pago seleccionado</CardTitle>
          <CardDescription>
            Datos del método aplicado a este retiro al momento de su creación.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {!paymentMethod ? (
            <p className="text-muted-foreground sm:col-span-2">
              No se encontró información del método de pago para este payout.
            </p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">ID método: </span>
                {paymentMethod.id}
              </p>
              <p>
                <span className="text-muted-foreground">Tipo: </span>
                {methodLabel(paymentMethod.method_type)}
              </p>
              <p>
                <span className="text-muted-foreground">Habilitado: </span>
                {paymentMethod.is_enabled ? "Sí" : "No"}
              </p>
              <p>
                <span className="text-muted-foreground">Predeterminado: </span>
                {paymentMethod.is_default ? "Sí" : "No"}
              </p>
              <p>
                <span className="text-muted-foreground">Creado: </span>
                {formatDateTime(paymentMethod.created_at)}
              </p>
              <p>
                <span className="text-muted-foreground">Actualizado: </span>
                {formatDateTime(paymentMethod.updated_at)}
              </p>
              {paymentMethodFields.map((field) =>
                isQrImageField(field.label) ? (
                  <div key={field.label} className="space-y-2 sm:col-span-2">
                    <p>
                      <span className="text-muted-foreground">{field.label}: </span>
                    </p>
                    {field.value ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={field.value}
                          alt={field.label}
                          className="h-auto max-h-64 w-full max-w-xs rounded-md border object-contain"
                        />
                        <a
                          className="underline underline-offset-2 hover:text-foreground"
                          href={field.value}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir imagen en nueva pestaña
                        </a>
                      </div>
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                ) : (
                  <p key={field.label}>
                    <span className="text-muted-foreground">{field.label}: </span>
                    {field.value || "—"}
                  </p>
                ),
              )}
            </>
          )}
        </CardContent>
      </Card>
      <PayoutsCompleteDialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
        row={row}
        isPending={updateMutation.isPending}
        onSubmit={(payload) => {
          updateMutation.mutate(
            {
              payoutId: row.id,
              status: payload.status,
              platformFee: payload.platformFee,
              exchangeRateBob: payload.exchangeRateBob,
              reference: payload.reference,
              notes: payload.notes,
            },
            {
              onSuccess: () => {
                setIsCompleteDialogOpen(false);
              },
            },
          );
        }}
      />
      <PayoutsStatusDialog
        open={statusDialog.open}
        onOpenChange={(open) => setStatusDialog((current) => ({ ...current, open }))}
        status={statusDialog.status}
        isPending={updateMutation.isPending}
        onSubmit={(payload) => {
          updateMutation.mutate(
            {
              payoutId: row.id,
              status: payload.status,
            },
            {
              onSuccess: () => {
                setStatusDialog((current) => ({ ...current, open: false }));
              },
            },
          );
        }}
      />
    </div>
  );
}
