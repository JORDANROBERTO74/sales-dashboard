"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  formatDateTime,
  formatUsdFromCents,
  getTransactionTypeLabel,
} from "@/lib/transactions/formatters";
import {
  useAssignTransaction,
  useUnassignTransaction,
} from "@/hooks/transactions/use-transactions";
import { isStripeTransactionAssignmentFrozen } from "@/lib/transactions/assignment-cutoff";
import type { SellerOption, StripeTransactionRow } from "@/types/transactions";
import { TRANSACTION_STATUS_PAID, TRANSACTION_STATUS_PAYOUT_PENDING } from "@/lib/transactions/transaction-status";

type TransactionCardProps = {
  row: StripeTransactionRow;
  accountRouteSegment: "jnode" | "vascruz";
  canManageAssignment: boolean;
  isSeller: boolean;
  currentUserId?: string;
  sellers: SellerOption[];
};

function compactStripeId(stripeId: string): string {
  if (stripeId.length <= 18) return stripeId;
  return `${stripeId.slice(0, 8)}...${stripeId.slice(-6)}`;
}

export function TransactionCard({
  row,
  accountRouteSegment,
  canManageAssignment,
  isSeller,
  currentUserId,
  sellers,
}: TransactionCardProps) {
  const router = useRouter();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const assignMutation = useAssignTransaction();
  const unassignMutation = useUnassignTransaction();

  const isAssigning = assignMutation.isPendingForTransaction(row.id);
  const isUnassigning = unassignMutation.isPendingForTransaction(row.id);
  const isRowBusy = isAssigning || isUnassigning;
  const canSellerOperate = !isSeller || Boolean(currentUserId);
  const assignmentFrozen = useMemo(
    () => isStripeTransactionAssignmentFrozen(row.stripe_created_at),
    [row.stripe_created_at]
  );
  const canOperateAssignment = canManageAssignment && !assignmentFrozen;
  const isAssignmentCurrentUser = Boolean(currentUserId && row.assignment?.user_id === currentUserId);
  const canUnassign = canOperateAssignment && canSellerOperate && (!isSeller || isAssignmentCurrentUser);
  const isPaid = row.transaction_status === TRANSACTION_STATUS_PAID;
  const isPending = row.transaction_status === TRANSACTION_STATUS_PAYOUT_PENDING;

  const sellerLabel = useMemo(() => {
    const seller = row.assignment?.seller;
    if (!seller) return "—";
    const identity = seller.full_name ? seller.full_name : seller.email;
    return identity;
  }, [row.assignment?.seller]);
  const isFundsAvailable = useMemo(() => {
    if (!row.funds_available_at) return false;
    const availableAt = new Date(row.funds_available_at);
    if (Number.isNaN(availableAt.getTime())) return false;
    return availableAt.getTime() <= Date.now();
  }, [row.funds_available_at]);

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

  const handleUnassign = () => {
    if (!row.assignment) return;
    if (assignmentFrozen) return;
    unassignMutation.mutate({ transactionId: row.id });
  };

  const handleAssign = () => {
    if (assignmentFrozen) return;
    if (isSeller) {
      if (!currentUserId) return;
      assignMutation.mutate({
        transactionId: row.id,
        sellerUserId: currentUserId,
      });
      return;
    }
    setIsAssignDialogOpen(true);
  };

  const goToDetail = () => {
    router.push(`/admin/transactions/${accountRouteSegment}/${row.id}`);
  };

  const shouldSkipCardNavigation = (
    target: EventTarget | null,
    currentTarget?: EventTarget | null
  ): boolean => {
    if (!(target instanceof Node)) return true;
    if (currentTarget instanceof Node && !currentTarget.contains(target)) return true;
    return target instanceof Element && Boolean(target.closest('[data-stop-card-nav="true"]'));
  };

  const stopCardNavigation = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <article
      className="rounded-md border p-4 space-y-3 cursor-pointer transition-colors hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      onClick={(event) => {
        if (shouldSkipCardNavigation(event.target, event.currentTarget)) return;
        goToDetail();
      }}
      onKeyDown={(event) => {
        if (shouldSkipCardNavigation(event.target, event.currentTarget)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToDetail();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de transacción ${row.stripe_id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="font-mono text-xs truncate" title={row.stripe_id}>
            {compactStripeId(row.stripe_id)}
          </p>
          <p className="text-xs text-muted-foreground">{getTransactionTypeLabel(row.transaction_type)}</p>
        </div>
        <Badge variant={transactionStatusBadgeVariant}>{transactionStatusLabel}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Monto</p>
          <p className="font-medium">{formatUsdFromCents(row.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fee</p>
          <p className="font-medium">{formatUsdFromCents(row.stripe_fee)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Neto</p>
          <p className="font-medium">{formatUsdFromCents(row.net_amount)}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Cliente: </span>
          {row.customer_name || "Sin nombre"}
        </p>
        <p>
          <span className="text-muted-foreground">Creada: </span>
          {formatDateTime(row.stripe_created_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Fondos: </span>
          {formatDateTime(row.funds_available_at)}
        </p>
      </div>

      <div className="space-y-2" data-stop-card-nav="true">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">
            {row.assignment ? <Badge variant="secondary">Asignada</Badge> : <Badge variant="outline">Sin asignar</Badge>}
          </span>
          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 w-0 text-right">
            {sellerLabel}
          </span>
        </div>
        {canManageAssignment ? (
          row.assignment ? (
            !canSellerOperate || (isSeller && row.assignment.user_id !== currentUserId) ? (
              <Button size="sm" className="w-full" variant="outline" disabled>
                {assignmentFrozen ? "Asignación cerrada" : "Asignada"}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full"
                    variant="outline"
                    disabled={isRowBusy || !canUnassign}
                    onClick={stopCardNavigation}
                  >
                    {isUnassigning ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Desasignando...
                      </span>
                    ) : (
                      assignmentFrozen ? "Asignación cerrada" : "Desasignar"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-stop-card-nav="true">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desasignar transacción</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción quitará la asignación actual de la transacción{" "}
                      <span className="font-mono">{row.stripe_id}</span>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnassign} disabled={isUnassigning}>
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
              className="w-full"
              variant="outline"
              disabled={isRowBusy || !canOperateAssignment || !canSellerOperate}
              onClick={(event) => {
                stopCardNavigation(event);
                handleAssign();
              }}
            >
              {isAssigning ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Asignando...
                </span>
              ) : assignmentFrozen ? (
                "Asignación cerrada"
              ) : (
                "Asignar"
              )}
            </Button>
          )
        ) : null}
      </div>

      <AssignTransactionDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        transaction={row}
        sellers={sellers}
        isSubmitting={isAssigning}
        isAssignmentFrozen={assignmentFrozen}
        onSubmit={(payload) => {
          if (assignmentFrozen) return;
          assignMutation.mutate(payload, {
            onSuccess: () => {
              setIsAssignDialogOpen(false);
            },
          });
        }}
      />
    </article>
  );
}
