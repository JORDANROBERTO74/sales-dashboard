"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import type { DateRangeShortcutPreset } from "@/components/shared/date-range-filter";
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
import { TransactionCard } from "@/components/transactions/transaction-card";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import {
  useInfiniteTransactions,
} from "@/hooks/transactions/use-transactions";
import { useUser } from "@/hooks/auth/use-user";
import type { TransactionsFilters } from "@/types/transactions";
import type { DateRange } from "react-day-picker";

const PAGE_SIZE = 20;
const EMPTY_SELLERS: Array<{
  id: string;
  full_name: string | null;
  email: string;
  role_name: string | null;
}> = [];
type TransactionsPanelProps = {
  accountExternalId?: string;
  accountRouteSegment: "jnode" | "vascruz";
};

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
  return {
    from: fromDate,
    to: toDate,
  };
}

export function TransactionsPanel({ accountExternalId, accountRouteSegment }: TransactionsPanelProps) {
  const { data: user } = useUser();
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [selectedDateShortcut, setSelectedDateShortcut] = useState<DateRangeShortcutPreset | "">(
    "",
  );
  const [draftFilters, setDraftFilters] = useState<TransactionsFilters>({
    accountExternalId,
    q: "",
    status: "succeeded",
    type: "all",
    assignment: "all",
    from: "",
    to: "",
  });
  const [filters, setFilters] = useState<TransactionsFilters>({
    accountExternalId,
    q: "",
    status: "succeeded",
    type: "all",
    assignment: "all",
    from: "",
    to: "",
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    fromDraftDatesToRange(draftFilters.from, draftFilters.to)
  );

  const transactionsQuery = useInfiniteTransactions(filters, PAGE_SIZE);

  const pages = useMemo(() => transactionsQuery.data?.pages ?? [], [transactionsQuery.data]);
  const rows = pages.flatMap((pageData) => pageData.rows);
  const sellers = useMemo(
    () => {
      const allUsers = pages[0]?.sellers ?? EMPTY_SELLERS;
      return allUsers.filter((userOption) =>
        userOption.role_name ? ["owner", "admin", "seller"].includes(userOption.role_name) : false
      );
    },
    [pages]
  );
  const total = pages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;
  const isAdminLike = user?.role === "owner" || user?.role === "admin";
  const isSeller = user?.role === "seller";
  const canManageAssignment = isAdminLike || isSeller;
  const activeFilters = useMemo(() => {
    const items: string[] = [];
    if (filters.q?.trim()) items.push(`Buscar: ${filters.q.trim()}`);
    if (filters.assignment && filters.assignment !== "all") {
      if (filters.assignment === "assigned") {
        items.push("Asignación: Asignadas");
      } else if (filters.assignment === "unassigned") {
        items.push("Asignación: Sin asignar");
      } else if (filters.assignment.startsWith("seller:")) {
        const sellerId = filters.assignment.slice("seller:".length);
        const selectedSeller = sellers.find((seller) => seller.id === sellerId);
        const sellerLabel = selectedSeller?.full_name || selectedSeller?.email || "Responsable no encontrado";
        items.push(`Asignación: ${sellerLabel}`);
      }
    }
    if (filters.periodPreset === "always") {
      items.push("Periodo: Siempre");
    }
    if (filters.from) items.push(`Desde: ${filters.from}`);
    if (filters.to) items.push(`Hasta: ${filters.to}`);
    return items;
  }, [filters, sellers]);

  const handleDateRangeChange = (nextRange: DateRange | undefined) => {
    setSelectedDateShortcut("");
    setDateRange(nextRange);
    const from = toDateInputString(nextRange?.from);
    const to = toDateInputString(nextRange?.to);
    setDraftFilters((current) => ({
      ...current,
      from,
      to,
      periodPreset: undefined,
    }));
    const hasTwoDistinctDates =
      Boolean(nextRange?.from && nextRange?.to) && from !== to;
    if (hasTwoDistinctDates) {
      setIsDateRangeOpen(false);
    }
  };

  const handleDateShortcutChange = (
    preset: DateRangeShortcutPreset,
    nextRange: DateRange | undefined,
  ) => {
    setSelectedDateShortcut(preset);
    setDateRange(nextRange);

    if (preset === "always") {
      setDraftFilters((current) => ({
        ...current,
        from: "",
        to: "",
        periodPreset: "always",
      }));
      setIsDateRangeOpen(false);
      return;
    }

    const from = toDateInputString(nextRange?.from);
    const to = toDateInputString(nextRange?.to);
    setDraftFilters((current) => ({
      ...current,
      from,
      to,
      periodPreset: undefined,
    }));
    setIsDateRangeOpen(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(draftFilters.q?.trim() ?? "");
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [draftFilters.q]);

  useEffect(() => {
    setFilters({
      accountExternalId,
      q: debouncedSearch,
      status: "succeeded",
      type: "all",
      assignment: draftFilters.assignment ?? "all",
      from: draftFilters.from ?? "",
      to: draftFilters.to ?? "",
      periodPreset: draftFilters.periodPreset,
    });
  }, [
    accountExternalId,
    debouncedSearch,
    draftFilters.assignment,
    draftFilters.from,
    draftFilters.to,
    draftFilters.periodPreset,
  ]);

  useEffect(() => {
    setDateRange(fromDraftDatesToRange(draftFilters.from, draftFilters.to));
  }, [draftFilters.from, draftFilters.to]);

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
      { rootMargin: "200px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  ]);

  const resultsLabel = useMemo(() => {
    if (transactionsQuery.isLoading) return "Cargando transacciones...";
    return `${rows.length} de ${total} transacción${total === 1 ? "" : "es"} cargadas`;
  }, [rows.length, total, transactionsQuery.isLoading]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full">
            <CardTitle>Listado de transacciones</CardTitle>
            <div className="inline-flex items-center gap-2">
              <CardDescription>{resultsLabel}</CardDescription>
              {transactionsQuery.isFetching &&
                !transactionsQuery.isLoading &&
                !transactionsQuery.isFetchingNextPage ? (
                <Spinner />
              ) : null}
            </div>
          </div>
          <div className="w-full flex flex-col md:flex-row gap-2 items-center">
            <div className="space-y-2 w-full">
              <Label htmlFor="tx-assignment">Asignación</Label>
              <Select
                value={draftFilters.assignment ?? "all"}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    assignment: value as TransactionsFilters["assignment"],
                  }))
                }
              >
                <SelectTrigger className="w-full" id="tx-assignment" aria-label="Filtro de asignación">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="assigned">Asignadas</SelectItem>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={`seller:${seller.id}`}>
                      {`${seller.full_name || seller.email} (${seller.role_name ?? "sin rol"})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full">
              <Label htmlFor="tx-date-range">Rango de fechas</Label>
              <DateRangeFilter
                id="tx-date-range"
                open={isDateRangeOpen}
                onOpenChange={setIsDateRangeOpen}
                range={dateRange}
                onSelectRange={handleDateRangeChange}
                selectedPreset={selectedDateShortcut}
                onSelectPreset={handleDateShortcutChange}
                onClear={() => {
                  setSelectedDateShortcut("");
                  handleDateRangeChange(undefined);
                }}
                ariaLabel="Seleccionar rango de fechas para filtrar transacciones"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tx-search"
              className="pl-9"
              placeholder={"stripe_id, email o nombre"}
              value={draftFilters.q ?? ""}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, q: event.target.value }))
              }
            />
          </div>
          <div aria-live="polite" className="sr-only">
            {transactionsQuery.isFetchingNextPage
              ? "Cargando más transacciones"
              : !transactionsQuery.hasNextPage && rows.length > 0
                ? "Fin del listado de transacciones"
                : transactionsQuery.isFetching
                  ? "Actualizando listado de transacciones"
                  : resultsLabel}
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
          {transactionsQuery.isLoading ? (
            <SettingsSectionSkeleton rows={4} compact showBadge showActions buttonFullOnMobile />
          ) : transactionsQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(transactionsQuery.error)}
              onRetry={() => {
                void transactionsQuery.refetch();
              }}
            />
          ) : rows.length === 0 ? (
            <SettingsEmptyState
              title="No hay transacciones para los filtros actuales."
              description="Prueba otro rango de fechas o limpia los filtros."
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <TransactionCard
                    key={row.id}
                    row={row}
                    accountRouteSegment={accountRouteSegment}
                    canManageAssignment={canManageAssignment}
                    isSeller={isSeller}
                    currentUserId={user?.id}
                    sellers={sellers}
                  />
                ))}
              </div>


              <div ref={infiniteSentinelRef} className="h-1 w-full" />
              {transactionsQuery.isFetchingNextPage ? (
                <div className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Spinner />
                  Cargando más transacciones...
                </div>
              ) : null}
              {!transactionsQuery.hasNextPage ? (
                <p className="text-center text-sm text-muted-foreground">
                  No hay más transacciones.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
