"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import type {
  PayoutDetailResponse,
  PayoutSellerPaymentMethodsResponse,
  PayoutStatus,
  PayoutsFilters,
  PayoutsListResponse,
  WithdrawableTransactionsResponse,
} from "@/types/payouts";

type JsonResponse<T> = T & { error?: string; error_code?: string };

export type CreatePayoutPayload = {
  userId: string;
  accountExternalId: string;
  stripeTransactionIds: string[];
  paymentMethodId: string;
  platformFee?: number;
  reference?: string;
  notes?: string;
};

export type UpdatePayoutPayload = {
  payoutId: string;
  status?: PayoutStatus;
  platformFee?: number;
  exchangeRateBob?: number;
  reference?: string;
  notes?: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as JsonResponse<T>;
  if (!response.ok) {
    if (data.error_code) {
      throw new Error(
        `${data.error_code}::${data.error || "Error de servidor"}`,
      );
    }
    throw new Error(data.error || "Error de servidor");
  }
  return data;
}

function buildQueryString(
  filters: PayoutsFilters,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (filters.accountExternalId?.trim()) {
    params.set("accountExternalId", filters.accountExternalId.trim());
  }
  if (filters.sellerUserId?.trim()) {
    params.set("sellerUserId", filters.sellerUserId.trim());
  }
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.method && filters.method !== "all") {
    params.set("method", filters.method);
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

async function fetchPayouts(filters: PayoutsFilters) {
  const query = buildQueryString(
    filters,
    filters.page ?? 1,
    filters.pageSize ?? 20,
  );
  return requestJson<PayoutsListResponse>(`/api/admin/payouts?${query}`);
}

async function fetchPayoutsPage(
  filters: PayoutsFilters,
  page: number,
  pageSize: number,
) {
  const query = buildQueryString(filters, page, pageSize);
  return requestJson<PayoutsListResponse>(`/api/admin/payouts?${query}`);
}

async function fetchPayoutDetail(payoutId: string) {
  return requestJson<PayoutDetailResponse>(`/api/admin/payouts/${payoutId}`);
}

async function createPayout(payload: CreatePayoutPayload) {
  return requestJson<{ row: PayoutDetailResponse["row"] }>(
    "/api/admin/payouts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

async function fetchSellerPaymentMethods(sellerUserId: string) {
  const query = new URLSearchParams({ sellerUserId }).toString();
  return requestJson<PayoutSellerPaymentMethodsResponse>(
    `/api/admin/payouts/payment-methods?${query}`,
  );
}

async function fetchWithdrawableTransactions(
  sellerUserId: string,
  accountExternalId: string,
  page = 1,
  pageSize = 100,
) {
  const params = new URLSearchParams({
    sellerUserId,
    accountExternalId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return requestJson<WithdrawableTransactionsResponse>(
    `/api/admin/payouts/withdrawable-transactions?${params.toString()}`,
  );
}

async function updatePayout(payload: UpdatePayoutPayload) {
  return requestJson<{ row: PayoutDetailResponse["row"] }>(
    `/api/admin/payouts/${payload.payoutId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: payload.status,
        platformFee: payload.platformFee,
        exchangeRateBob: payload.exchangeRateBob,
        reference: payload.reference,
        notes: payload.notes,
      }),
    },
  );
}

type UsePayoutsOptions = {
  enabled?: boolean;
};

type UseInfinitePayoutsOptions = {
  enabled?: boolean;
  refetchIntervalMs?: number;
};

export function usePayouts(
  filters: PayoutsFilters,
  options?: UsePayoutsOptions,
) {
  return useQuery({
    queryKey: ["admin", "payouts", filters],
    queryFn: () => fetchPayouts(filters),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useInfinitePayouts(
  filters: PayoutsFilters,
  pageSize: number,
  options?: UseInfinitePayoutsOptions,
) {
  return useInfiniteQuery({
    queryKey: ["admin", "payouts", "infinite", filters, pageSize],
    queryFn: ({ pageParam }) =>
      fetchPayoutsPage(filters, pageParam as number, pageSize),
    enabled: options?.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
    refetchIntervalInBackground: false,
  });
}

export function usePayoutDetail(payoutId?: string) {
  return useQuery({
    queryKey: ["admin", "payouts", "detail", payoutId],
    queryFn: () => fetchPayoutDetail(payoutId as string),
    enabled: Boolean(payoutId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePayoutSellerPaymentMethods(
  sellerUserId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["admin", "payouts", "seller-payment-methods", sellerUserId],
    queryFn: () => fetchSellerPaymentMethods(sellerUserId as string),
    enabled: enabled && Boolean(sellerUserId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

const DEFAULT_WITHDRAWABLE_PAGE_SIZE = 10;

export function useInfiniteWithdrawablePayoutTransactions(
  sellerUserId: string | undefined,
  accountExternalId: string,
  enabled: boolean,
  pageSize: number = DEFAULT_WITHDRAWABLE_PAGE_SIZE,
) {
  return useInfiniteQuery({
    queryKey: [
      "admin",
      "payouts",
      "withdrawable-transactions",
      "infinite",
      sellerUserId,
      accountExternalId,
      pageSize,
    ],
    queryFn: ({ pageParam }) =>
      fetchWithdrawableTransactions(
        sellerUserId as string,
        accountExternalId,
        pageParam as number,
        pageSize,
      ),
    enabled: Boolean(sellerUserId) && enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["admin", "payouts", "create"],
    mutationFn: createPayout,
    onSuccess: async () => {
      toast.success("Retiro registrado correctamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "balances"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "transactions"],
      });
    },
    onError: (error) => {
      toast.error("No se pudo registrar el retiro", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUpdatePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["admin", "payouts", "update"],
    mutationFn: updatePayout,
    onSuccess: async () => {
      toast.success("Retiro actualizado correctamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "balances"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "transactions"],
      });
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el retiro", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}
