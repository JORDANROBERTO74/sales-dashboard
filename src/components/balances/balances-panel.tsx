"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutsCreateDialog } from "@/components/payouts/payouts-create-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useUserScope } from "@/hooks/auth/use-user-scope";
import { useBalances } from "@/hooks/balances/use-balances";
import {
  useCreatePayout,
  usePayouts,
  usePayoutSellerPaymentMethods,
} from "@/hooks/payouts/use-payouts";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { formatDateTime, formatUsdFromCents } from "@/lib/transactions/formatters";
import type { BalancesFilters } from "@/types/balances";
import type { PayoutStatus } from "@/types/payouts";

type BalancesPanelProps = {
  accountExternalId: string;
  accountLabel: string;
};

export function BalancesPanel({ accountExternalId, accountLabel }: BalancesPanelProps) {
  const { isAdminLike: canUseAdminFilters, isSeller, sellerId, canRunScopedQueries } =
    useUserScope();
  const canCreatePayout = canUseAdminFilters || isSeller;
  const currentUserId = sellerId;
  const sourceTab = accountExternalId === "acct_vascruz" ? "vascruz" : "jnode";
  const createMutation = useCreatePayout();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSellerId, setCreateSellerId] = useState("");
  const [draftFilters, setDraftFilters] = useState<BalancesFilters>({
    page: 1,
    pageSize: 20,
    q: "",
    sellerUserId: "all",
    accountExternalId,
  } as BalancesFilters);
  const [filters, setFilters] = useState<BalancesFilters>({
    page: 1,
    pageSize: 20,
    q: "",
    accountExternalId,
  });

  useEffect(() => {
    setDraftFilters((current) => ({
      ...current,
      sellerUserId: canUseAdminFilters ? "all" : currentUserId || current.sellerUserId,
    }));
  }, [canUseAdminFilters, currentUserId]);

  useEffect(() => {
    if (canUseAdminFilters) return;
    setCreateSellerId(currentUserId ?? "");
  }, [canUseAdminFilters, currentUserId]);

  const canRunBalancesQuery =
    canRunScopedQueries &&
    (!isSeller || (Boolean(currentUserId) && filters.sellerUserId === currentUserId));
  const isWaitingForScope = !canRunBalancesQuery;

  const balancesQuery = useBalances(filters, { enabled: canRunBalancesQuery });
  const payoutsQuery = usePayouts({
    page: 1,
    pageSize: 5,
    accountExternalId,
    sellerUserId: canUseAdminFilters ? undefined : currentUserId ?? undefined,
  }, { enabled: canRunScopedQueries });
  const data = balancesQuery.data;
  const latestPayouts = payoutsQuery.data?.rows ?? [];
  const selectedCreateSellerId = canUseAdminFilters
    ? (createSellerId || undefined)
    : (currentUserId ?? undefined);
  const createBalanceQuery = useBalances(
    {
      page: 1,
      pageSize: 1,
      accountExternalId,
      sellerUserId: selectedCreateSellerId,
    },
    {
      enabled: canCreatePayout && Boolean(selectedCreateSellerId) && canRunScopedQueries,
    },
  );
  const createAvailableForPayoutCents =
    createBalanceQuery.data?.kpis.available_for_payout_cents ?? 0;
  const createPaymentMethodsQuery = usePayoutSellerPaymentMethods(
    selectedCreateSellerId,
    canCreatePayout && canRunScopedQueries,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((current) => {
        const next: BalancesFilters = {
          ...current,
          page: 1,
          q: canUseAdminFilters ? (draftFilters.q?.trim() ?? "") : "",
          accountExternalId,
          sellerUserId:
            canUseAdminFilters
              ? draftFilters.sellerUserId && draftFilters.sellerUserId !== "all"
                ? draftFilters.sellerUserId
                : undefined
              : currentUserId ?? undefined,
        };

        const didChange =
          current.page !== next.page ||
          current.q !== next.q ||
          current.accountExternalId !== next.accountExternalId ||
          current.sellerUserId !== next.sellerUserId;

        return didChange ? next : current;
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [accountExternalId, canUseAdminFilters, currentUserId, draftFilters]);

  const activeFilters = useMemo(() => {
    const chips: string[] = [];
    if (canUseAdminFilters && filters.q?.trim()) chips.push(`Buscar: ${filters.q.trim()}`);
    if (canUseAdminFilters && filters.sellerUserId) {
      const seller = data?.seller_options.find((item) => item.id === filters.sellerUserId);
      chips.push(`Seller: ${seller?.full_name || seller?.email || filters.sellerUserId}`);
    }
    return chips;
  }, [canUseAdminFilters, filters, data?.seller_options]);

  const getPayoutBadgeVariant = (status: PayoutStatus) => {
    if (status === "completed") return "success";
    if (status === "pending") return "warning";
    if (status === "rejected") return "destructive";
    return "outline";
  };

  const getPayoutStatusLabel = (status: PayoutStatus) => {
    if (status === "completed") return "Completado";
    if (status === "pending") return "Pendiente";
    if (status === "cancelled") return "Cancelado";
    return "Rechazado";
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-transparent py-0 shadow-none rounded-none md:rounded-xl md:border md:bg-card md:py-6 md:shadow-sm">
        <CardHeader className="px-0 md:px-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Saldos {accountLabel}</CardTitle>
              <CardDescription>
                Cuenta {accountExternalId}.
              </CardDescription>
            </div>
            {canCreatePayout ? (
              <PayoutsCreateDialog
                open={isCreateOpen}
                onOpenChange={(open) => {
                  setIsCreateOpen(open);
                  if (!open && canUseAdminFilters) setCreateSellerId("");
                }}
                accountLabel={accountLabel}
                accountExternalId={accountExternalId}
                sellers={data?.seller_options ?? []}
                canManage={canUseAdminFilters}
                selectedSellerId={selectedCreateSellerId}
                onSelectedSellerIdChange={setCreateSellerId}
                availableForPayoutCents={createAvailableForPayoutCents}
                isAvailableBalanceLoading={createBalanceQuery.isLoading}
                isAvailableBalanceError={createBalanceQuery.isError}
                paymentMethods={createPaymentMethodsQuery.data?.methods ?? []}
                isPaymentMethodsLoading={createPaymentMethodsQuery.isLoading}
                isPaymentMethodsError={createPaymentMethodsQuery.isError}
                isPending={createMutation.isPending}
                triggerLabel="Retirar"
                onSubmit={(payload) => {
                  createMutation.mutate(payload, {
                    onSuccess: () => {
                      setIsCreateOpen(false);
                      if (canUseAdminFilters) setCreateSellerId("");
                      void balancesQuery.refetch();
                      void payoutsQuery.refetch();
                      void createBalanceQuery.refetch();
                    },
                  });
                }}
              />
            ) : null}
          </div>

          {canUseAdminFilters ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="balances-seller">Seller</Label>
                <Select
                  value={draftFilters.sellerUserId || "all"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({ ...current, sellerUserId: value }))
                  }
                >
                  <SelectTrigger className="w-full" id="balances-seller">
                    <SelectValue placeholder="Todos los sellers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los sellers</SelectItem>
                    {(data?.seller_options ?? []).map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.full_name || seller.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="balances-search">Buscar</Label>
                <Input
                  id="balances-search"
                  placeholder="Seller, email o cuenta"
                  value={draftFilters.q ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, q: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4 px-0 md:px-6">
          {isWaitingForScope || balancesQuery.isLoading ? (
            <SettingsSectionSkeleton rows={6} compact showHeader={false} />
          ) : balancesQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(balancesQuery.error)}
              onRetry={() => {
                void balancesQuery.refetch();
              }}
            />
          ) : !data ? (
            <SettingsEmptyState
              title="No se pudieron cargar los saldos."
              description="Intenta recargar la sección."
            />
          ) : (
            <>
              <div className="space-y-3">
                <Card>
                  <CardHeader className="space-y-1">
                    <CardDescription>Saldo disponible para retiro</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatUsdFromCents(data.kpis.available_for_payout_cents)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      La información principal para saber cuánto se puede retirar ahora.
                    </p>
                  </CardContent>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Saldo entrante</p>
                    <p className="text-lg font-semibold">
                      {formatUsdFromCents(data.kpis.pending_earned_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fondos que aun se espera que se acrediten al saldo de Stripe.
                    </p>
                  </div>
                  <div className="rounded-md border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Saldo disponible</p>
                    <p className="text-lg font-semibold">
                      {formatUsdFromCents(data.kpis.available_earned_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fondos ya acreditados en el saldo de Stripe.
                    </p>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex flex-row items-center justify-between gap-3">
                      <CardTitle className="text-base">Ultimos 5 retiros</CardTitle>

                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={{
                            pathname: "/admin/balances/payouts",
                            query: { tab: sourceTab },
                          }}
                        >
                          Ver mas
                        </Link>
                      </Button>
                    </div>
                    <CardDescription>
                      Historial reciente de retiros en la cuenta {accountLabel}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {payoutsQuery.isLoading ? (
                      <SettingsSectionSkeleton rows={3} compact showHeader={false} />
                    ) : payoutsQuery.isError ? (
                      <SettingsErrorState
                        message={getSettingsErrorMessage(payoutsQuery.error)}
                        onRetry={() => {
                          void payoutsQuery.refetch();
                        }}
                      />
                    ) : latestPayouts.length === 0 ? (
                      <SettingsEmptyState
                        title="Sin retiros recientes."
                        description="No hay retiros registrados para este criterio."
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {latestPayouts.map((payout) => (
                          <Link key={payout.id} href={`/admin/payouts/${payout.id}`}>
                            <article className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/30">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {payout.seller_name || payout.seller_email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(payout.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getPayoutBadgeVariant(payout.status)}>
                                  {getPayoutStatusLabel(payout.status)}
                                </Badge>
                                <span className="text-sm font-semibold">
                                  {formatUsdFromCents(payout.amount)}
                                </span>
                              </div>
                            </article>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
