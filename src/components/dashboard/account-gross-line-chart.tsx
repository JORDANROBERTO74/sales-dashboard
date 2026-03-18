"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatUsdFromCents } from "@/lib/transactions/formatters";
import type { DashboardDailyGrossPoint } from "@/types/dashboard";

const chartConfig = {
  gross_amount_cents: {
    label: "Ingresos brutos",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function parseIsoDateToLocal(value: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatShortIsoDate(value: string, includeYear = false): string {
  const date = parseIsoDateToLocal(value);
  if (!date) return value;

  return date.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function formatLongIsoDate(value: string): string {
  const date = parseIsoDateToLocal(value);
  if (!date) return value;
  return date.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type AccountGrossLineChartProps = {
  data: DashboardDailyGrossPoint[];
};

function buildDesktopTicks(data: DashboardDailyGrossPoint[], maxLabels: number): string[] | undefined {
  if (data.length === 0) return undefined;

  const dates = data.map((point) => point.date).filter(Boolean);
  if (dates.length === 0) return undefined;
  if (dates.length <= maxLabels) return dates;

  const selected = new Set<string>();
  const lastIndex = dates.length - 1;

  for (let i = 0; i < maxLabels; i += 1) {
    const index = Math.round((i * lastIndex) / (maxLabels - 1));
    selected.add(dates[index] ?? dates[lastIndex]);
  }

  return dates.filter((date) => selected.has(date));
}

export function AccountGrossLineChart({ data }: AccountGrossLineChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const xAxisTicks = useMemo(() => {
    if (data.length === 0) return undefined;

    if (isMobile) {
      if (data.length === 1) return [data[0]?.date];

      const firstDate = data[0]?.date;
      const lastDate = data[data.length - 1]?.date;
      if (!firstDate || !lastDate) return undefined;
      return [firstDate, lastDate];
    }

    return buildDesktopTicks(data, 15);
  }, [data, isMobile]);

  const includeYearInXAxis = useMemo(() => {
    if (data.length < 2) return false;

    const firstDate = parseIsoDateToLocal(data[0]?.date ?? "");
    const lastDate = parseIsoDateToLocal(data[data.length - 1]?.date ?? "");
    if (!firstDate || !lastDate) return false;

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysInRange = Math.ceil((lastDate.getTime() - firstDate.getTime()) / msPerDay) + 1;
    const crossesYear = firstDate.getFullYear() !== lastDate.getFullYear();

    // Si el rango es amplio, mostramos anio para evitar ambiguedad visual.
    return crossesYear || daysInRange >= 180;
  }, [data]);

  return (
    <ChartContainer config={chartConfig} className="h-[160px] w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
          top: 8,
          bottom: 8,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          ticks={xAxisTicks}
          tickFormatter={(value) =>
            formatShortIsoDate(String(value), includeYearInXAxis)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatUsdFromCents(Number(value))}
              labelFormatter={(value) => formatLongIsoDate(String(value ?? ""))}
            />
          }
        />
        <Line
          dataKey="gross_amount_cents"
          type="monotone"
          stroke="var(--color-gross_amount_cents)"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

