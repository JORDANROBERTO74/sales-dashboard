"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { AssignTransactionDialog } from "@/components/transactions/assign-transaction-dialog";
import {
  useAssignTransaction,
  useTransactionDetail,
  useUnassignTransaction,
} from "@/hooks/transactions/use-transactions";
import { useUser } from "@/hooks/auth/use-user";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { isBeforeAssignmentAccessDate } from "@/lib/transactions/assignment-access";
import {
  formatDateTime,
  formatUsdFromCents,
  getTransactionTypeLabel,
} from "@/lib/transactions/formatters";

type TransactionDetailProps = {
  transactionId: string;
};

export function TransactionDetail({ transactionId }: TransactionDetailProps) {
  const { data: user } = useUser();
  const transactionQuery = useTransactionDetail(transactionId);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const assignMutation = useAssignTransaction();
  const unassignMutation = useUnassignTransaction();

  if (transactionQuery.isLoading) {
    return (
      <SettingsSectionSkeleton rows={3} showActions={false} showBadge compact />
    );
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
  const sellers = (transactionQuery.data.sellers ?? []).filter((userOption) =>
    userOption.role_name
      ? ["owner", "admin", "seller"].includes(userOption.role_name)
      : false,
  );
  const canViewCustomerData = transactionQuery.data.canViewCustomerData;
  const isAdminLike = user?.role === "owner" || user?.role === "admin";
  const isSeller = user?.role === "seller";
  const canManageAssignment = isAdminLike || isSeller;
  const canSellerOperate = !isSeller || Boolean(user?.id);
  const isAssigning = assignMutation.isPendingForTransaction(row.id);
  const isUnassigning = unassignMutation.isPendingForTransaction(row.id);
  const isRowBusy = isAssigning || isUnassigning;
  const isBeforeAccessDate = isBeforeAssignmentAccessDate(
    row.stripe_created_at,
    row.created_at,
  );
  const isFundsAvailable = (() => {
    if (!row.funds_available_at) return false;
    const availableAt = new Date(row.funds_available_at);
    if (Number.isNaN(availableAt.getTime())) return false;
    return availableAt.getTime() <= Date.now();
  })();
  const assignedSellerLabel =
    row.assignment?.seller?.full_name || row.assignment?.seller?.email || "—";

  const handleAssign = () => {
    if (isBeforeAccessDate) return;
    if (isSeller) {
      if (!user?.id) return;
      assignMutation.mutate({
        transactionId: row.id,
        sellerUserId: user.id,
      });
      return;
    }
    setIsAssignDialogOpen(true);
  };

  const handleUnassign = () => {
    if (!row.assignment || isBeforeAccessDate) return;
    unassignMutation.mutate({ transactionId: row.id });
  };
  const assignmentAction = canManageAssignment ? (
    row.assignment ? (
      !canSellerOperate || (isSeller && row.assignment.user_id !== user?.id) ? (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          variant="outline"
          disabled
        >
          {isBeforeAccessDate ? "No accesible" : "Asignada"}
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              variant="outline"
              disabled={isRowBusy || !canSellerOperate || isBeforeAccessDate}
            >
              {isUnassigning ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Desasignando...
                </span>
              ) : isBeforeAccessDate ? (
                "No accesible"
              ) : (
                "Desasignar"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desasignar transacción</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción quitará la asignación actual de la transacción{" "}
                <span className="font-mono">{row.stripe_id}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUnassign}
                disabled={isUnassigning}
              >
                {isUnassigning ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Desasignando...
                  </span>
                ) : (
                  "Confirmar desasignación"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
    ) : (
      <Button
        size="sm"
        className="w-full sm:w-auto"
        variant="outline"
        disabled={isRowBusy || !canSellerOperate || isBeforeAccessDate}
        onClick={handleAssign}
      >
        {isAssigning ? (
          <span className="inline-flex items-center gap-2">
            <Spinner />
            Asignando...
          </span>
        ) : isBeforeAccessDate ? (
          "No accesible"
        ) : (
          "Asignar"
        )}
      </Button>
    )
  ) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="font-mono text-base break-all">
                {row.stripe_id}
              </CardTitle>
              <CardDescription>
                {getTransactionTypeLabel(row.transaction_type)}
              </CardDescription>
            </div>
            {assignmentAction}
          </div>
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
              <p className="font-medium">
                {formatUsdFromCents(row.stripe_fee)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Neto</p>
              <p className="font-medium">
                {formatUsdFromCents(row.net_amount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la transacción</CardTitle>
          <CardDescription>
            Información técnica y operativa de Stripe.
          </CardDescription>
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
            <span className="text-muted-foreground">
              Registrada en sistema:{" "}
            </span>
            {formatDateTime(row.created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">ID interno: </span>
            {row.id}
          </p>
          <p>
            <span className="text-muted-foreground">Cliente: </span>
            {canViewCustomerData ? row.customer_name || "Sin nombre" : "Oculto"}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {canViewCustomerData ? row.customer_email || "—" : "—"}
          </p>
        </CardContent>
      </Card>

      {row.assignment ? (
        <Card>
          <CardHeader>
            <CardTitle>Asignación</CardTitle>
            <CardDescription>
              Estado de asignación comercial de esta transacción.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Asignada</Badge>
            </div>
            <p>
              <span className="text-muted-foreground">Seller asignado: </span>
              {assignedSellerLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Comisión: </span>
              {row.assignment
                ? formatUsdFromCents(row.assignment.commission_amount)
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Asignada el: </span>
              {row.assignment
                ? formatDateTime(row.assignment.assigned_at)
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Notas: </span>
              {row.assignment?.notes || "—"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Asignación</CardTitle>
            <CardDescription>
              Estado de asignación comercial de esta transacción.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Sin asignar</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <AssignTransactionDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        transaction={row}
        sellers={sellers}
        isSubmitting={isAssigning}
        onSubmit={(payload) => {
          assignMutation.mutate(payload, {
            onSuccess: () => {
              setIsAssignDialogOpen(false);
            },
          });
        }}
      />
    </div>
  );
}
