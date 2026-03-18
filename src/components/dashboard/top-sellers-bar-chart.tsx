"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatUsdFromCents } from "@/lib/transactions/formatters";
import type { DashboardTopSeller } from "@/types/dashboard";

const chartConfig = {
  period_commission_cents: {
    label: "Comision del periodo",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

type TopSellersBarChartProps = {
  sellers: DashboardTopSeller[];
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-BO").format(value);
}

function shortenLabel(value: string, maxLength = 10): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function TopSellersBarChart({ sellers }: TopSellersBarChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const chartData = sellers.map((seller) => ({
    seller_label: seller.full_name?.trim() || seller.email || "Sin nombre",
    seller_label_short: shortenLabel(seller.full_name?.trim() || seller.email || "Sin nombre", 8),
    period_commission_cents: seller.period_commission_cents,
    period_transactions_count: seller.period_transactions_count,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[160px] w-full">
      <BarChart
        accessibilityLayer
        layout="vertical"
        data={chartData}
        margin={{
          left: isMobile ? 8 : -20,
          right: isMobile ? 16 : 8,
          top: 8,
          bottom: 8,
        }}
      >
        <XAxis type="number" dataKey="period_commission_cents" hide />
        <YAxis
          type="category"
          dataKey="seller_label"
          width={110}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value) => shortenLabel(String(value))}
          hide={isMobile}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => {
                const payload = (item.payload ?? {}) as {
                  seller_label?: string;
                  period_transactions_count?: number;
                };

                return (
                  <div className="grid gap-0.5">
                    <p className="font-medium">{payload.seller_label ?? "Seller"}</p>
                    <p>{formatUsdFromCents(Number(value))}</p>
                    <p className="text-muted-foreground">
                      Transacciones: {formatNumber(Number(payload.period_transactions_count ?? 0))}
                    </p>
                  </div>
                );
              }}
            />
          }
        />
        <Bar
          dataKey="period_commission_cents"
          fill="var(--color-period_commission_cents)"
          radius={5}
        >
          {isMobile ? (
            <LabelList
              dataKey="seller_label_short"
              position="insideLeft"
              offset={8}
              className="fill-background"
              fontSize={11}
            />
          ) : null}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

