"use client";

import type { RefObject } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatUsdFromCents } from "@/lib/transactions/formatters";
import type { PayoutMethod, PayoutRow, PayoutStatus } from "@/types/payouts";

type PayoutsListProps = {
  rows: PayoutRow[];
  canManage: boolean;
  isUpdating: boolean;
  onUpdateStatus: (payoutId: string, status: PayoutStatus) => void;
  infiniteSentinelRef: RefObject<HTMLDivElement>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
};

function compactId(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

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

export function PayoutsList({
  rows,
  infiniteSentinelRef,
  isFetchingNextPage,
  hasNextPage,
}: PayoutsListProps) {
  const router = useRouter();

  const shouldSkipCardNavigation = (
    target: EventTarget | null,
    currentTarget?: EventTarget | null,
  ): boolean => {
    if (!(target instanceof Node)) return true;
    if (currentTarget instanceof Node && !currentTarget.contains(target)) return true;
    return (
      target instanceof Element && Boolean(target.closest('[data-stop-card-nav="true"]'))
    );
  };

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isPending = row.status === "pending";
        const receivedAmountToDisplay = isPending ? 0 : row.received_amount;

        return (
          <article
            key={row.id}
            className="rounded-md border p-4 space-y-3 cursor-pointer transition-colors hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            onClick={(event) => {
              if (shouldSkipCardNavigation(event.target, event.currentTarget)) return;
              router.push(`/admin/payouts/${row.id}`);
            }}
            onKeyDown={(event) => {
              if (shouldSkipCardNavigation(event.target, event.currentTarget)) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/admin/payouts/${row.id}`);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Ver detalle de payout ${row.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-xs truncate" title={row.id}>
                  {compactId(row.id)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.seller_name || row.seller_email}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Monto</p>
                <p className="font-medium">{formatUsdFromCents(row.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fee plataforma</p>
                <p className="font-medium">{formatUsdFromCents(row.platform_fee)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Recibido</p>
                <p className="font-medium">{formatUsdFromCents(receivedAmountToDisplay)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Método</p>
                <p className="font-medium">{methodLabel(row.payout_method)}</p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <p>
                <span className="text-muted-foreground">Cuenta: </span>
                {row.stripe_account_display_name} ({row.stripe_account_external_id})
              </p>
              <p>
                <span className="text-muted-foreground">Creado: </span>
                {formatDateTime(row.created_at)}
              </p>
              <p>
                <span className="text-muted-foreground">Pagado: </span>
                {formatDateTime(row.paid_at)}
              </p>
            </div>
          </article>
        );
      })}
      <div ref={infiniteSentinelRef} className="h-1 w-full" />
      {isFetchingNextPage ? (
        <div className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Spinner />
          Cargando más retiros...
        </div>
      ) : null}
      {!hasNextPage ? (
        <p className="text-center text-sm text-muted-foreground">No hay más retiros.</p>
      ) : null}
    </div>
  );
}
