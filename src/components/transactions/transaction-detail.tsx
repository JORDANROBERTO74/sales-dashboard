"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useUserScope } from "@/hooks/auth/use-user-scope";
import {
  useTransactionDetail,
  useUpdateTransactionStatus,
} from "@/hooks/transactions/use-transactions";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import {
  formatDateTime,
  formatUsdFromCents,
  getTransactionTypeLabel,
} from "@/lib/transactions/formatters";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CircleCheckIcon, Undo2Icon } from "lucide-react";
import { TRANSACTION_STATUS_PAID, TRANSACTION_STATUS_PAYOUT_PENDING } from "@/lib/transactions/transaction-status";

type TransactionDetailProps = {
  transactionId: string;
};

export function TransactionDetail({ transactionId }: TransactionDetailProps) {
  const transactionQuery = useTransactionDetail(transactionId);
  const updateStatusMutation = useUpdateTransactionStatus();
  const { isAdminLike } = useUserScope();
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [clearPaidDialogOpen, setClearPaidDialogOpen] = useState(false);

  const confirmMarkAsPaid = () => {
    updateStatusMutation.mutate(
      { transactionId, transactionStatus: TRANSACTION_STATUS_PAID },
      { onSuccess: () => setMarkPaidDialogOpen(false) }
    );
  };

  const confirmClearPaidStatus = () => {
    updateStatusMutation.mutate(
      { transactionId, transactionStatus: "" },
      { onSuccess: () => setClearPaidDialogOpen(false) }
    );
  };

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
  const isPaid = row.transaction_status === TRANSACTION_STATUS_PAID;
  const isPending = row.transaction_status === TRANSACTION_STATUS_PAYOUT_PENDING;
  const canManagePaidStatus = isAdminLike;

  const transactionStatusLabel = useMemo(() => {
    if (isPending) return "Pendiente";
    if (isPaid) return "Pagado";
    if (isFundsAvailable) return "Disponible";
    return "Retenida";
  }, [isPending, isPaid, isFundsAvailable]);

  const transactionStatusBadgeVariant = useMemo((): "default" | "secondary" | "warning" | "success" => {
    if (isPending) return "warning";
    if (isPaid) return "success";
    if (isFundsAvailable) return "default";
    return "secondary";
  }, [isPending, isPaid, isFundsAvailable]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base break-all">{row.stripe_id}</CardTitle>
          <CardDescription>{getTransactionTypeLabel(row.transaction_type)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={transactionStatusBadgeVariant}>{transactionStatusLabel}</Badge>
            </div>
            {canManagePaidStatus ? (
              !isPaid ? (
                <AlertDialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={updateStatusMutation.isPending}>
                      <span className="inline-flex items-center gap-2">
                        <CircleCheckIcon className="size-4" />
                        Marcar como pagado
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Marcar como pagado</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se actualizará el estado operativo de esta transacción a{" "}
                        <span className="font-medium">pagado</span>. ¿Continuar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={updateStatusMutation.isPending}>
                        Cancelar
                      </AlertDialogCancel>
                      <Button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={confirmMarkAsPaid}
                      >
                        {updateStatusMutation.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <Spinner />
                            Guardando...
                          </span>
                        ) : (
                          "Confirmar"
                        )}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog open={clearPaidDialogOpen} onOpenChange={setClearPaidDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={updateStatusMutation.isPending}>
                      <span className="inline-flex items-center gap-2">
                        <Undo2Icon className="size-4" />
                        Quitar marca de pagado
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Quitar marca de pagado</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borrará el estado operativo <span className="font-medium">pagado</span>. El
                        distintivo volverá a reflejar solo la disponibilidad de fondos (disponible /
                        retenido). ¿Continuar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={updateStatusMutation.isPending}>
                        Cancelar
                      </AlertDialogCancel>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updateStatusMutation.isPending}
                        onClick={confirmClearPaidStatus}
                      >
                        {updateStatusMutation.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <Spinner />
                            Guardando...
                          </span>
                        ) : (
                          "Quitar etiqueta"
                        )}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )
            ) : null}
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
