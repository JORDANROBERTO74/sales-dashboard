"use client";

import { useEffect, useMemo, useRef, useState } from "react";
type DateRange = { from: Date | undefined; to: Date | undefined };
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutsCreateDialog } from "@/components/payouts/payouts-create-dialog";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import type { DateRangeShortcutPreset } from "@/components/shared/date-range-filter";
import { PayoutsList } from "@/components/payouts/payouts-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useUserScope } from "@/hooks/auth/use-user-scope";
import { useBalances } from "@/hooks/balances/use-balances";
import {
  useCreatePayout,
  useInfinitePayouts,
  usePayoutSellerPaymentMethods,
  useUpdatePayout,
} from "@/hooks/payouts/use-payouts";
import { payoutDialogMaxCents } from "@/lib/balances/payout-max-cents";
import { getLast30DaysRange } from "@/lib/dashboard/defaults";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import type { PayoutMethod, PayoutStatus, PayoutsFilters } from "@/types/payouts";

type PayoutsPanelProps = {
  accountExternalId: string;
  accountLabel: string;
};
const PAGE_SIZE = 20;
const EMPTY_SELLERS: Array<{ id: string; full_name: string | null; email: string }> = [];

function parseDateInputString(value: string): Date | undefined {
  if (!value) return undefined;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function toDateInputString(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDraftDatesToRange(fromValue?: string, toValue?: string): DateRange | undefined {
  const fromDate = parseDateInputString(fromValue ?? "");
  const toDate = parseDateInputString(toValue ?? "");
  if (!fromDate && !toDate) return undefined;
  return { from: fromDate, to: toDate };
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

export function PayoutsPanel({ accountExternalId, accountLabel }: PayoutsPanelProps) {
  const defaults = useMemo(() => getLast30DaysRange(), []);
  const {
    isAdminLike: canManage,
    sellerId,
    isSeller,
    canRunScopedQueries,
  } = useUserScope();
  const canCreatePayout = canManage || isSeller;
  const createMutation = useCreatePayout();
  const updateMutation = useUpdatePayout();
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSellerId, setCreateSellerId] = useState("");
  const [selectedDateShortcut, setSelectedDateShortcut] = useState<DateRangeShortcutPreset | "">(
    "",
  );
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    fromDraftDatesToRange(defaults.from, defaults.to),
  );
  const [draftFilters, setDraftFilters] = useState<PayoutsFilters>({
    accountExternalId,
    page: 1,
    pageSize: 20,
    status: "all",
    method: "all",
    from: defaults.from,
    to: defaults.to,
    q: "",
    sellerUserId: "all",
  });
  const [filters, setFilters] = useState<PayoutsFilters>({
    accountExternalId,
    page: 1,
    pageSize: PAGE_SIZE,
    status: "all",
    method: "all",
    from: defaults.from,
    to: defaults.to,
    q: "",
  });

  useEffect(() => {
    setDraftFilters((current) => ({
      ...current,
      sellerUserId: canManage ? "all" : sellerId || current.sellerUserId,
    }));
  }, [canManage, sellerId]);

  useEffect(() => {
    if (canManage) return;
    setCreateSellerId(sellerId ?? "");
  }, [canManage, sellerId]);

  const canRunPayoutsQuery =
    canRunScopedQueries &&
    (!isSeller || (Boolean(sellerId) && filters.sellerUserId === sellerId));
  const isWaitingForScope = !canRunPayoutsQuery;

  const payoutsQuery = useInfinitePayouts(filters, PAGE_SIZE, {
    enabled: canRunPayoutsQuery,
  });
  const pages = useMemo(() => payoutsQuery.data?.pages ?? [], [payoutsQuery.data]);
  const rows = pages.flatMap((pageData) => pageData.rows);
  const sellers = useMemo(() => pages[0]?.sellers ?? EMPTY_SELLERS, [pages]);
  const total = pages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = payoutsQuery;
  const selectedCreateSellerId = canManage ? (createSellerId || undefined) : (sellerId ?? undefined);
  const createBalanceQuery = useBalances(
    {
      page: 1,
      pageSize: 1,
      accountExternalId,
      sellerUserId: selectedCreateSellerId,
    },
    {
      enabled: Boolean(selectedCreateSellerId) && canRunScopedQueries,
    },
  );
  const createPayoutMaxCents = payoutDialogMaxCents(
    accountExternalId,
    createBalanceQuery.data?.kpis,
  );
  const createPaymentMethodsQuery = usePayoutSellerPaymentMethods(
    selectedCreateSellerId,
    canRunScopedQueries,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((current) => {
        const next: PayoutsFilters = {
          ...current,
          page: 1,
          q: draftFilters.q?.trim() ?? "",
          from: draftFilters.from,
          to: draftFilters.to,
          periodPreset: draftFilters.periodPreset,
          status: draftFilters.status ?? "all",
          method: draftFilters.method ?? "all",
          sellerUserId:
            canManage
              ? draftFilters.sellerUserId && draftFilters.sellerUserId !== "all"
                ? draftFilters.sellerUserId
                : undefined
              : sellerId ?? undefined,
        };

        const didChange =
          current.page !== next.page ||
          current.q !== next.q ||
          current.from !== next.from ||
          current.to !== next.to ||
          current.periodPreset !== next.periodPreset ||
          current.status !== next.status ||
          current.method !== next.method ||
          current.sellerUserId !== next.sellerUserId;

        return didChange ? next : current;
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [canManage, draftFilters, sellerId]);

  useEffect(() => {
    setDateRange(fromDraftDatesToRange(draftFilters.from, draftFilters.to));
  }, [draftFilters.from, draftFilters.to]);

  useEffect(() => {
    setFilters((current) =>
      current.accountExternalId === accountExternalId
        ? current
        : { ...current, accountExternalId }
    );
    setDraftFilters((current) =>
      current.accountExternalId === accountExternalId
        ? current
        : { ...current, accountExternalId }
    );
  }, [accountExternalId]);

  useEffect(() => {
    const target = infiniteSentinelRef.current;
    if (!target) return;
    if (!hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) return;
        if (!hasNextPage || isFetchingNextPage) return;
        void fetchNextPage();
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const activeFilters = useMemo(() => {
    const chips: string[] = [];
    if (filters.status && filters.status !== "all") {
      chips.push(`Estado: ${statusLabel(filters.status as PayoutStatus)}`);
    }
    if (filters.method && filters.method !== "all") {
      chips.push(`Método: ${methodLabel(filters.method as PayoutMethod)}`);
    }
    if (canManage && filters.sellerUserId) {
      const seller = sellers.find((item) => item.id === filters.sellerUserId);
      chips.push(`Usuario: ${seller?.full_name || seller?.email || filters.sellerUserId}`);
    }
    if (filters.q?.trim()) chips.push(`Buscar: ${filters.q.trim()}`);
    if (filters.periodPreset === "always") chips.push("Periodo: Siempre");
    if (filters.from) chips.push(`Desde: ${filters.from}`);
    if (filters.to) chips.push(`Hasta: ${filters.to}`);
    return chips;
  }, [canManage, filters, sellers]);

  const resultsLabel = useMemo(() => {
    if (payoutsQuery.isLoading || isWaitingForScope) return "Cargando retiros...";
    return `${rows.length} de ${total} retiro${total === 1 ? "" : "s"} cargados`;
  }, [isWaitingForScope, payoutsQuery.isLoading, rows.length, total]);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:items-center">
            <div className="space-y-2">
              <CardTitle>Retiros {accountLabel}</CardTitle>
              <CardDescription>
                Cuenta {accountExternalId}. Filtra y gestiona payouts por estado.
              </CardDescription>
            </div>
            {canCreatePayout ? (
              <PayoutsCreateDialog
                open={isCreateOpen}
                onOpenChange={(open) => {
                  setIsCreateOpen(open);
                  if (!open && canManage) setCreateSellerId("");
                }}
                accountLabel={accountLabel}
                accountExternalId={accountExternalId}
                sellers={sellers}
                canManage={canManage}
                selectedSellerId={selectedCreateSellerId}
                showTrigger={canCreatePayout}
                onSelectedSellerIdChange={setCreateSellerId}
                availableForPayoutCents={createPayoutMaxCents}
                isAvailableBalanceLoading={createBalanceQuery.isLoading}
                isAvailableBalanceError={createBalanceQuery.isError}
                paymentMethods={createPaymentMethodsQuery.data?.methods ?? []}
                isPaymentMethodsLoading={createPaymentMethodsQuery.isLoading}
                isPaymentMethodsError={createPaymentMethodsQuery.isError}
                isPending={createMutation.isPending}
                onSubmit={(payload) => {
                  createMutation.mutate(payload, {
                    onSuccess: () => {
                      setIsCreateOpen(false);
                      if (canManage) setCreateSellerId("");
                    },
                  });
                }}
              />
            ) : null}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{resultsLabel}</span>
            {payoutsQuery.isFetching &&
              !payoutsQuery.isLoading &&
              !payoutsQuery.isFetchingNextPage ? (
              <Spinner />
            ) : null}
          </div>
        </div>

        <div className={`grid gap-3 ${canManage ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div className="space-y-2">
            <Label htmlFor={`payout-status-${accountExternalId}`}>Estado</Label>
            <Select
              value={draftFilters.status ?? "all"}
              onValueChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: value as PayoutsFilters["status"],
                }))
              }
            >
              <SelectTrigger className="w-full" id={`payout-status-${accountExternalId}`}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="rejected">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`payout-method-${accountExternalId}`}>Método</Label>
            <Select
              value={draftFilters.method ?? "all"}
              onValueChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  method: value as PayoutsFilters["method"],
                }))
              }
            >
              <SelectTrigger className="w-full" id={`payout-method-${accountExternalId}`}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="airtm">Airtm</SelectItem>
                <SelectItem value="bank_qr">Bank QR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canManage ? (
            <div className="space-y-2">
              <Label htmlFor={`payout-seller-${accountExternalId}`}>Usuario</Label>
              <Select
                value={draftFilters.sellerUserId || "all"}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, sellerUserId: value }))
                }
              >
                <SelectTrigger className="w-full" id={`payout-seller-${accountExternalId}`}>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name || seller.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`payout-date-${accountExternalId}`}>Rango de fechas</Label>
            <DateRangeFilter
              id={`payout-date-${accountExternalId}`}
              open={isDateRangeOpen}
              onOpenChange={setIsDateRangeOpen}
              range={dateRange}
              onSelectRange={(nextRange) => {
                setSelectedDateShortcut("");
                setDateRange(nextRange);
                setDraftFilters((current) => ({
                  ...current,
                  from: toDateInputString(nextRange?.from),
                  to: toDateInputString(nextRange?.to),
                  periodPreset: undefined,
                }));
              }}
              selectedPreset={selectedDateShortcut}
              onSelectPreset={(preset, nextRange) => {
                setSelectedDateShortcut(preset);
                setDateRange(nextRange);
                if (preset === "always") {
                  setDraftFilters((current) => ({
                    ...current,
                    from: "",
                    to: "",
                    periodPreset: "always",
                  }));
                  return;
                }
                setDraftFilters((current) => ({
                  ...current,
                  from: toDateInputString(nextRange?.from),
                  to: toDateInputString(nextRange?.to),
                  periodPreset: undefined,
                }));
              }}
              onClear={() => {
                setSelectedDateShortcut("");
                const nextDefaults = getLast30DaysRange();
                setDateRange(fromDraftDatesToRange(nextDefaults.from, nextDefaults.to));
                setDraftFilters((current) => ({
                  ...current,
                  from: nextDefaults.from,
                  to: nextDefaults.to,
                  periodPreset: undefined,
                }));
                setIsDateRangeOpen(false);
              }}
              monthsToShow={1}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`payout-search-${accountExternalId}`}>Buscar por referencia</Label>
          <Input
            id={`payout-search-${accountExternalId}`}
            placeholder="Ej: transfer-2026-03-01"
            value={draftFilters.q ?? ""}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, q: event.target.value }))
            }
          />
        </div>

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

      <CardContent className="space-y-4">
        {isWaitingForScope || payoutsQuery.isLoading ? (
          <SettingsSectionSkeleton rows={4} compact showBadge />
        ) : payoutsQuery.isError ? (
          <SettingsErrorState
            message={getSettingsErrorMessage(payoutsQuery.error)}
            onRetry={() => {
              void payoutsQuery.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <SettingsEmptyState
            title="No hay retiros para los filtros actuales."
            description="Ajusta el estado, fecha o usuario para ver resultados."
          />
        ) : (
          <PayoutsList
            rows={rows}
            canManage={canManage}
            isUpdating={updateMutation.isPending}
            onUpdateStatus={(payoutId, status) => {
              updateMutation.mutate({ payoutId, status });
            }}
            infiniteSentinelRef={infiniteSentinelRef}
            isFetchingNextPage={payoutsQuery.isFetchingNextPage}
            hasNextPage={Boolean(payoutsQuery.hasNextPage)}
          />
        )}
      </CardContent>

    </Card>
  );
}
