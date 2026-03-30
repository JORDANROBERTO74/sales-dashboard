"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useTransactionDetail } from "@/hooks/transactions/use-transactions";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import {
  formatDateTime,
  formatUsdFromCents,
  getTransactionTypeLabel,
} from "@/lib/transactions/formatters";

type TransactionDetailProps = {
  transactionId: string;
};

export function TransactionDetail({ transactionId }: TransactionDetailProps) {
  const transactionQuery = useTransactionDetail(transactionId);

  if (transactionQuery.isLoading) {
    return <SettingsSectionSkeleton rows={3} showActions={false} showBadge compact />;
  }

  if (transactionQuery.isError) {
    return (
      <SettingsErrorState
        message={getSettingsErrorMessage(transactionQuery.error)}
        onRetry={() => {
          void transactionQuery.refetch();
        }}
      />
    );
  }

  if (!transactionQuery.data?.row) {
    return (
      <SettingsEmptyState
        title="No se encontró la transacción."
        description="Verifica el enlace o vuelve al listado de transacciones."
      />
    );
  }

  const row = transactionQuery.data.row;
  const isFundsAvailable = (() => {
    if (!row.funds_available_at) return false;
    const availableAt = new Date(row.funds_available_at);
    if (Number.isNaN(availableAt.getTime())) return false;
    return availableAt.getTime() <= Date.now();
  })();
  const assignedSellerLabel = row.assignment?.seller?.full_name || row.assignment?.seller?.email || "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base break-all">{row.stripe_id}</CardTitle>
          <CardDescription>{getTransactionTypeLabel(row.transaction_type)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.stripe_status}</Badge>
            <Badge variant={isFundsAvailable ? "default" : "secondary"}>
              {isFundsAvailable ? "Fondos disponibles" : "Fondos retenidos"}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="font-medium">{formatUsdFromCents(row.amount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Fee</p>
              <p className="font-medium">{formatUsdFromCents(row.stripe_fee)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Neto</p>
              <p className="font-medium">{formatUsdFromCents(row.net_amount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la transacción</CardTitle>
          <CardDescription>Información técnica y operativa de Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Estado Stripe: </span>
            {row.stripe_status}
          </p>
          <p>
            <span className="text-muted-foreground">Moneda: </span>
            {row.currency.toUpperCase()}
          </p>
          <p>
            <span className="text-muted-foreground">Método de pago: </span>
            {row.payment_method_type || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Producto Stripe: </span>
            {row.stripe_product_id || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Creada en Stripe: </span>
            {formatDateTime(row.stripe_created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Fondos disponibles: </span>
            {formatDateTime(row.funds_available_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Registrada en sistema: </span>
            {formatDateTime(row.created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">ID interno: </span>
            {row.id}
          </p>
          <p>
            <span className="text-muted-foreground">Cliente: </span>
            {row.customer_name || "Sin nombre"}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {row.customer_email || "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación</CardTitle>
          <CardDescription>Estado de asignación comercial de esta transacción.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {row.assignment ? <Badge variant="secondary">Asignada</Badge> : <Badge variant="outline">Sin asignar</Badge>}
          </div>
          <p>
            <span className="text-muted-foreground">Seller asignado: </span>
            {assignedSellerLabel}
          </p>
          <p>
            <span className="text-muted-foreground">Comisión: </span>
            {row.assignment ? formatUsdFromCents(row.assignment.commission_amount) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Asignada el: </span>
            {row.assignment ? formatDateTime(row.assignment.assigned_at) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Notas: </span>
            {row.assignment?.notes || "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
