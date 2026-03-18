"use client";

import { useQuery } from "@tanstack/react-query";
import { getLast30DaysRange } from "@/lib/dashboard/defaults";
import type { DashboardFilters, DashboardResponse } from "@/types/dashboard";

type JsonResponse<T> = T & { error?: string; error_code?: string };

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as JsonResponse<T>;
  if (!response.ok) {
    if (data.error_code) {
      throw new Error(`${data.error_code}::${data.error || "Error de servidor"}`);
    }
    throw new Error(data.error || "Error de servidor");
  }
  return data;
}

function buildQueryString(filters?: DashboardFilters): string {
  const params = new URLSearchParams();

  if (filters?.periodPreset === "always") {
    params.set("periodPreset", "always");
    if (filters?.accountExternalId?.trim()) {
      params.set("accountExternalId", filters.accountExternalId.trim());
    }
    return params.toString();
  }

  const defaults = getLast30DaysRange();
  const hasCustomRange = Boolean(filters?.from?.trim() && filters?.to?.trim());
  const from = hasCustomRange ? (filters?.from as string).trim() : defaults.from;
  const to = hasCustomRange ? (filters?.to as string).trim() : defaults.to;
  params.set("from", from);
  params.set("to", to);

  if (filters?.accountExternalId?.trim()) {
    params.set("accountExternalId", filters.accountExternalId.trim());
  }

  return params.toString();
}

async function fetchDashboard(filters?: DashboardFilters) {
  const query = buildQueryString(filters);
  return requestJson<DashboardResponse>(`/api/admin/dashboard?${query}`);
}

export function useDashboard(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ["admin", "dashboard", filters],
    queryFn: () => fetchDashboard(filters),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
