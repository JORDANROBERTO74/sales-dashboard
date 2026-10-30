"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import type { DateRangeShortcutPreset } from "@/components/shared/date-range-filter";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { useDashboard } from "@/hooks/dashboard/use-dashboard";
import { getLast30DaysRange } from "@/lib/dashboard/defaults";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { formatUsdFromCents } from "@/lib/transactions/formatters";
import type { DashboardFilters } from "@/types/dashboard";
type DateRange = { from: Date | undefined; to: Date | undefined };
import { AccountGrossLineChart } from "@/components/dashboard/account-gross-line-chart";
import { TopSellersBarChart } from "@/components/dashboard/top-sellers-bar-chart";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-BO").format(value);
}

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

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
};

function KpiCard({ title, value, description }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPanel() {
  const defaults = useMemo(() => getLast30DaysRange(), []);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [selectedDateShortcut, setSelectedDateShortcut] = useState<DateRangeShortcutPreset | "">(
    "",
  );
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>({
    from: defaults.from,
    to: defaults.to,
  });
  const [filters, setFilters] = useState<DashboardFilters>({
    from: defaults.from,
    to: defaults.to,
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    fromDraftDatesToRange(defaults.from, defaults.to),
  );

  const dashboardQuery = useDashboard({
    from: filters.from,
    to: filters.to,
    periodPreset: filters.periodPreset,
  });

  const data = dashboardQuery.data;
  const activeFilters = useMemo(() => {
    const items: string[] = [];
    if (filters.periodPreset === "always") items.push("Periodo: Siempre");
    if (filters.from) items.push(`Desde: ${filters.from}`);
    if (filters.to) items.push(`Hasta: ${filters.to}`);
    return items;
  }, [filters.from, filters.to, filters.periodPreset]);

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
      setFilters((current) => ({
        ...current,
        from,
        to,
        periodPreset: undefined,
      }));
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
      setFilters((current) => ({
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
    setFilters((current) => ({
      ...current,
      from,
      to,
      periodPreset: undefined,
    }));
    setIsDateRangeOpen(false);
  };

  useEffect(() => {
    setDateRange(fromDraftDatesToRange(draftFilters.from, draftFilters.to));
  }, [draftFilters.from, draftFilters.to]);

  const periodBadgeLabel =
    data?.period.preset === "last_30_days"
      ? "Periodo: Ultimos 30 dias"
      : data?.period.preset === "always"
        ? "Periodo: Siempre"
        : "Periodo: Personalizado";

  const accountsForDisplay = useMemo(() => {
    if (!data) return [];
    if (data.accounts.length > 0) return data.accounts;

    return data.account_options.map((account) => ({
      stripe_account_id: account.id,
      stripe_account_external_id: account.external_id,
      stripe_account_display_name: account.display_name,
      gross_amount_cents: 0,
      stripe_fee_cents: 0,
      net_amount_cents: 0,
      transactions_count: 0,
      assigned_commission_cents: 0,
      unassigned_transactions_count: 0,
      completed_payouts_cents: 0,
      pending_payouts_cents: 0,
      daily_gross_series: [],
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold">Dashboard operativo</h1>
          <p className="text-sm text-muted-foreground">
            Vista consolidada de KPIs, cuentas Stripe y rendimiento por seller.
          </p>
        </div>
        <div className="w-full sm:w-auto space-y-2">
          <Label className="sr-only" htmlFor="dashboard-date-range">
            Rango de fechas
          </Label>
          <DateRangeFilter
            id="dashboard-date-range"
            open={isDateRangeOpen}
            onOpenChange={setIsDateRangeOpen}
            range={dateRange}
            onSelectRange={handleDateRangeChange}
            selectedPreset={selectedDateShortcut}
            onSelectPreset={handleDateShortcutChange}
            buttonClassName="sm:w-[300px]"
            onClear={() => {
              setSelectedDateShortcut("");
              const nextDefaults = getLast30DaysRange();
              const nextRange = fromDraftDatesToRange(nextDefaults.from, nextDefaults.to);
              setDateRange(nextRange);
              setDraftFilters((current) => ({
                ...current,
                from: nextDefaults.from,
                to: nextDefaults.to,
                periodPreset: undefined,
              }));
              setFilters((current) => ({
                ...current,
                from: nextDefaults.from,
                to: nextDefaults.to,
                periodPreset: undefined,
              }));
              setIsDateRangeOpen(false);
            }}
          />
        </div>
      </div>

      <Card className="border-0 bg-transparent py-0 shadow-none rounded-none md:rounded-xl md:border md:bg-card md:py-6 md:shadow-sm">
        <CardHeader className="px-0 md:px-6">
          <div aria-live="polite" className="sr-only">
            {dashboardQuery.isFetching
              ? "Actualizando KPIs del dashboard"
              : "Dashboard operativo actualizado"}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{periodBadgeLabel}</Badge>
            {activeFilters.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0 md:px-6">
          {dashboardQuery.isLoading ? (
            <SettingsSectionSkeleton rows={6} compact showHeader={false} />
          ) : dashboardQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(dashboardQuery.error)}
              onRetry={() => {
                void dashboardQuery.refetch();
              }}
            />
          ) : !data ? (
            <SettingsEmptyState
              title="No se pudo construir el dashboard."
              description="Intenta ajustar el rango o recargar."
            />
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">KPIs por cuenta Stripe</h2>
                {accountsForDisplay.length === 0 ? null : (
                  <div className="space-y-4">
                    {accountsForDisplay.map((account) => (
                      <Card key={account.stripe_account_id}>
                        <CardHeader className="space-y-1">
                          <CardTitle>{account.stripe_account_display_name}</CardTitle>
                          <CardDescription>{account.stripe_account_external_id}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-3">
                            <KpiCard
                              title="Ingresos brutos"
                              value={formatUsdFromCents(account.gross_amount_cents)}
                              description="Suma total de montos procesados."
                            />
                            <KpiCard
                              title="Ingresos netos"
                              value={formatUsdFromCents(account.net_amount_cents)}
                              description="Monto neto despues de fees Stripe."
                            />
                            <KpiCard
                              title="Transacciones"
                              value={formatNumber(account.transactions_count)}
                              description="Cantidad total en el rango seleccionado."
                            />
                          </div>
                          <div className="mt-6">
                            <p className="mb-2 text-sm font-medium">Evolución de ingresos brutos</p>
                            {account.daily_gross_series.length === 0 ? (
                              <SettingsEmptyState
                                title="Sin datos para graficar."
                                description="No hay transacciones en el rango seleccionado."
                              />
                            ) : (
                              <AccountGrossLineChart data={account.daily_gross_series} />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Top sellers</h2>
                {data.top_sellers.length === 0 ||
                data.top_sellers.every(
                  (seller) => seller.period_commission_cents <= 0,
                ) ? (
                  <SettingsEmptyState
                    title="Sin datos para graficar."
                    description="No hay ganancias por seller en el rango seleccionado."
                  />
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <TopSellersBarChart sellers={data.top_sellers} />
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
