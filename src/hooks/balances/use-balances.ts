"use client";

import { useQuery } from "@tanstack/react-query";
import type { BalancesFilters, BalancesResponse } from "@/types/balances";

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

function buildQueryString(filters: BalancesFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));

  if (filters.accountExternalId?.trim()) {
    params.set("accountExternalId", filters.accountExternalId.trim());
  }
  if (filters.sellerUserId?.trim()) {
    params.set("sellerUserId", filters.sellerUserId.trim());
  }
  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.periodPreset === "always") {
    params.set("periodPreset", "always");
  } else {
    if (filters.from?.trim()) params.set("from", filters.from.trim());
    if (filters.to?.trim()) params.set("to", filters.to.trim());
  }

  return params.toString();
}

async function fetchBalances(filters: BalancesFilters) {
  const query = buildQueryString(filters);
  return requestJson<BalancesResponse>(`/api/admin/balances?${query}`);
}

type UseBalancesOptions = {
  enabled?: boolean;
};

export function useBalances(filters: BalancesFilters, options?: UseBalancesOptions) {
  return useQuery({
    queryKey: ["admin", "balances", filters],
    queryFn: () => fetchBalances(filters),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
