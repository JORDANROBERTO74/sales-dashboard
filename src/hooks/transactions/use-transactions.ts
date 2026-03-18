"use client";

import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { normalizeStripeStatusFilter } from "@/lib/transactions/statuses";
import type {
  TransactionDetailResponse,
  TransactionsFilters,
  TransactionsListResponse,
} from "@/types/transactions";

type JsonResponse<T> = T & { error?: string; error_code?: string };

type SyncResponse = {
  ok: boolean;
  scope?: "single" | "all";
  requestedAccountExternalId?: string;
  synced: number;
  skipped: number;
};

export type AssignTransactionPayload = {
  transactionId: string;
  sellerUserId: string;
  notes?: string;
};

export type UnassignTransactionPayload = {
  transactionId: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as JsonResponse<T>;
  if (!response.ok) {
    if (data.error_code) {
      throw new Error(`${data.error_code}::${data.error || "Error de servidor"}`);
    }
    throw new Error(data.error || "Error de servidor");
  }
  return data;
}

function buildQueryString(filters: TransactionsFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (filters.accountExternalId?.trim()) {
    params.set("accountExternalId", filters.accountExternalId.trim());
  }
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status?.trim()) {
    params.set("status", normalizeStripeStatusFilter(filters.status));
  }
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.assignment && filters.assignment !== "all") {
    params.set("assignment", filters.assignment);
  }
  if (filters.periodPreset === "always") {
    params.set("periodPreset", "always");
  } else {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }

  return params.toString();
}

async function fetchTransactions(filters: TransactionsFilters, page: number, pageSize: number) {
  const query = buildQueryString(filters, page, pageSize);
  return requestJson<TransactionsListResponse>(`/api/admin/transactions?${query}`);
}

async function fetchTransactionDetail(transactionId: string) {
  return requestJson<TransactionDetailResponse>(`/api/admin/transactions/${transactionId}`);
}

type UseTransactionsOptions = {
  refetchIntervalMs?: number;
};

async function assignTransaction(payload: AssignTransactionPayload) {
  return requestJson<{ ok: boolean; assignmentId: string }>(
    `/api/admin/transactions/${payload.transactionId}/assign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerUserId: payload.sellerUserId,
        notes: payload.notes?.trim() || undefined,
      }),
    }
  );
}

async function unassignTransaction(payload: UnassignTransactionPayload) {
  return requestJson<{ ok: boolean; assignmentId: string }>(
    `/api/admin/transactions/${payload.transactionId}/assign`,
    { method: "DELETE" }
  );
}

async function syncStripeTransactions(accountExternalId?: string) {
  if (!accountExternalId) {
    return requestJson<SyncResponse>("/api/stripe/sync", { method: "POST" });
  }

  return requestJson<SyncResponse>("/api/stripe/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountExternalId }),
  });
}

export function useInfiniteTransactions(
  filters: TransactionsFilters,
  pageSize: number,
  options?: UseTransactionsOptions
) {
  return useInfiniteQuery({
    queryKey: ["admin", "transactions", "infinite", filters, pageSize],
    queryFn: ({ pageParam }) => fetchTransactions(filters, pageParam as number, pageSize),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
    refetchIntervalInBackground: false,
  });
}

export const useTransactions = useInfiniteTransactions;

export function useTransactionDetail(transactionId?: string) {
  return useQuery({
    queryKey: ["admin", "transactions", "detail", transactionId],
    queryFn: () => fetchTransactionDetail(transactionId as string),
    enabled: Boolean(transactionId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useAssignTransaction() {
  const queryClient = useQueryClient();
  const pendingMutations = useMutationState({
    filters: { mutationKey: ["admin", "transactions", "assign"], status: "pending" },
    select: (mutation) => mutation.state.variables as AssignTransactionPayload | undefined,
  });

  const pendingTransactionIds = useMemo(() => {
    return new Set(
      pendingMutations
        .map((item) => item?.transactionId)
        .filter((value): value is string => Boolean(value))
    );
  }, [pendingMutations]);

  const mutation = useMutation({
    mutationKey: ["admin", "transactions", "assign"],
    mutationFn: assignTransaction,
    onSuccess: async () => {
      toast.success("Transacción asignada correctamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] });
    },
    onError: (error) => {
      toast.error("No se pudo asignar la transacción", {
        description: getSettingsErrorMessage(error),
      });
    },
  });

  return {
    ...mutation,
    pendingTransactionIds,
    isPendingForTransaction: (transactionId: string) => pendingTransactionIds.has(transactionId),
  };
}

export function useUnassignTransaction() {
  const queryClient = useQueryClient();
  const pendingMutations = useMutationState({
    filters: { mutationKey: ["admin", "transactions", "unassign"], status: "pending" },
    select: (mutation) => mutation.state.variables as UnassignTransactionPayload | undefined,
  });

  const pendingTransactionIds = useMemo(() => {
    return new Set(
      pendingMutations
        .map((item) => item?.transactionId)
        .filter((value): value is string => Boolean(value))
    );
  }, [pendingMutations]);

  const mutation = useMutation({
    mutationKey: ["admin", "transactions", "unassign"],
    mutationFn: unassignTransaction,
    onSuccess: async () => {
      toast.success("Transacción desasignada correctamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] });
    },
    onError: (error) => {
      toast.error("No se pudo desasignar la transacción", {
        description: getSettingsErrorMessage(error),
      });
    },
  });

  return {
    ...mutation,
    pendingTransactionIds,
    isPendingForTransaction: (transactionId: string) => pendingTransactionIds.has(transactionId),
  };
}

export function useSyncStripeTransactions(defaultAccountExternalId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountExternalId?: string) =>
      syncStripeTransactions(accountExternalId ?? defaultAccountExternalId),
    onSuccess: async (result) => {
      toast.success("Sincronización completada", {
        description: `Sincronizadas: ${result.synced} | Omitidas: ${result.skipped}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] });
    },
    onError: (error) => {
      toast.error("No se pudo sincronizar Stripe", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}
