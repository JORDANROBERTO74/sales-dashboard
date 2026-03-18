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
import type { SellerOption, StripeTransactionRow } from "@/types/transactions";

type TransactionCardProps = {
  row: StripeTransactionRow;
  accountRouteSegment: "jnode" | "vascruz";
  canViewCustomerData: boolean;
  canManageAssignment: boolean;
  isSeller: boolean;
  currentUserId?: string;
  sellers: SellerOption[];
};

function getRoleLabel(roleName: SellerOption["role_name"]): string {
  if (!roleName) return "Sin rol";
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

function compactStripeId(stripeId: string): string {
  if (stripeId.length <= 18) return stripeId;
  return `${stripeId.slice(0, 8)}...${stripeId.slice(-6)}`;
}

export function TransactionCard({
  row,
  accountRouteSegment,
  canViewCustomerData,
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

  const sellerLabel = useMemo(() => {
    const seller = row.assignment?.seller;
    if (!seller) return "—";
    const identity = seller.full_name ? seller.full_name : seller.email;
    return `${identity} (${getRoleLabel(seller.role_name)})`;
  }, [row.assignment?.seller]);
  const isFundsAvailable = useMemo(() => {
    if (!row.funds_available_at) return false;
    const availableAt = new Date(row.funds_available_at);
    if (Number.isNaN(availableAt.getTime())) return false;
    return availableAt.getTime() <= Date.now();
  }, [row.funds_available_at]);

  const handleUnassign = () => {
    if (!row.assignment) return;
    unassignMutation.mutate({ transactionId: row.id });
  };

  const handleAssign = () => {
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
        <Badge variant={isFundsAvailable ? "default" : "secondary"}>
          {isFundsAvailable ? "Disponible" : "Retenida"}
        </Badge>
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
          {canViewCustomerData ? row.customer_name || "Sin nombre" : "Oculto"}
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
        <div className="flex items-center justify-between gap-2">
          {row.assignment ? <Badge variant="secondary">Asignada</Badge> : <Badge variant="outline">Sin asignar</Badge>}
          <span className="text-xs text-muted-foreground truncate">{sellerLabel}</span>
        </div>
        {canManageAssignment ? (
          row.assignment ? (
            !canSellerOperate || (isSeller && row.assignment.user_id !== currentUserId) ? (
              <Button size="sm" className="w-full" variant="outline" disabled>
                Asignada
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full"
                    variant="outline"
                    disabled={isRowBusy || !canSellerOperate}
                    onClick={stopCardNavigation}
                  >
                    {isUnassigning ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Desasignando...
                      </span>
                    ) : (
                      "Desasignar"
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
              disabled={isRowBusy || !canSellerOperate}
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
        onSubmit={(payload) => {
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
