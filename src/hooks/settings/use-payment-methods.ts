"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

export type PaymentMethodType = "binance" | "airtm" | "bank_qr";

export type SellerPaymentMethod = {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  is_enabled: boolean;
  is_default: boolean;
  tutorial_url: string | null;
  binance_id: string | null;
  binance_qr_image_url: string | null;
  binance_qr_image_signed_url?: string | null;
  ach_account_holder: string | null;
  ach_routing_number: string | null;
  ach_account_number: string | null;
  ach_bank_name: string | null;
  ach_account_type: string | null;
  qr_bank_name: string | null;
  qr_account_holder: string | null;
  qr_ci_number: string | null;
  qr_account_number: string | null;
  qr_image_url: string | null;
  qr_image_signed_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertPaymentMethodInput = {
  methodType: PaymentMethodType;
  isEnabled?: boolean;
  isDefault?: boolean;
  tutorialUrl?: string | null;
  binanceId?: string;
  binanceQrImageUrl?: string | null;
  achAccountHolder?: string;
  achRoutingNumber?: string;
  achAccountNumber?: string;
  achBankName?: string;
  achAccountType?: string;
  qrBankName?: string;
  qrAccountHolder?: string;
  qrCiNumber?: string;
  qrAccountNumber?: string;
  qrImageUrl?: string | null;
};

type JsonResponse<T> = T & { error?: string; error_code?: string };

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

async function fetchPaymentMethods(): Promise<SellerPaymentMethod[]> {
  const data = await requestJson<{ methods: SellerPaymentMethod[] }>(
    "/api/settings/payment-methods"
  );
  return data.methods ?? [];
}

async function upsertPaymentMethod(input: UpsertPaymentMethodInput) {
  const data = await requestJson<{ method: SellerPaymentMethod }>(
    "/api/settings/payment-methods",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  return data.method;
}

async function patchPaymentMethod(
  id: string,
  payload: {
    isEnabled?: boolean;
    isDefault?: boolean;
    tutorialUrl?: string | null;
    qrImageUrl?: string | null;
  }
) {
  return requestJson<{ ok: boolean }>(`/api/settings/payment-methods/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function deletePaymentMethod(id: string) {
  return requestJson<{ ok: boolean }>(`/api/settings/payment-methods/${id}`, {
    method: "DELETE",
  });
}

async function uploadPaymentQr(file: File): Promise<{ path: string; signedUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<{ path: string; signedUrl: string }>(
    "/api/settings/payment-methods/upload-qr",
    {
      method: "POST",
      body: formData,
    }
  );
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["settings", "payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertPaymentMethod,
    onSuccess: (savedMethod) => {
      queryClient.setQueryData<SellerPaymentMethod[]>(
        ["settings", "payment-methods"],
        (current = []) => {
          const existingIndex = current.findIndex(
            (method) =>
              method.id === savedMethod.id ||
              method.method_type === savedMethod.method_type
          );

          if (existingIndex === -1) {
            return [...current, savedMethod];
          }

          const next = [...current];
          next[existingIndex] = {
            ...next[existingIndex],
            ...savedMethod,
          };
          return next;
        }
      );
      toast.success("Método de pago guardado");
    },
    onError: (error) => {
      toast.error("No se pudo guardar el método", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patchPaymentMethod(id, { isDefault: true }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<SellerPaymentMethod[]>(
        ["settings", "payment-methods"],
        (current = []) =>
          current.map((method) => ({
            ...method,
            is_default: method.id === id,
          }))
      );
      toast.success("Método predeterminado actualizado");
    },
    onError: (error) => {
      toast.error("No se pudo marcar como predeterminado", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function usePatchPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof patchPaymentMethod>[1] }) =>
      patchPaymentMethod(id, payload),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<SellerPaymentMethod[]>(
        ["settings", "payment-methods"],
        (current = []) =>
          current.map((method) => {
            if (variables.payload.isDefault) {
              return { ...method, is_default: method.id === variables.id };
            }

            if (method.id !== variables.id) return method;

            return {
              ...method,
              is_enabled:
                typeof variables.payload.isEnabled === "boolean"
                  ? variables.payload.isEnabled
                  : method.is_enabled,
              tutorial_url:
                variables.payload.tutorialUrl !== undefined
                  ? variables.payload.tutorialUrl
                  : method.tutorial_url,
              qr_image_url:
                variables.payload.qrImageUrl !== undefined
                  ? variables.payload.qrImageUrl
                  : method.qr_image_url,
            };
          })
      );

      if (typeof variables.payload.isEnabled === "boolean") {
        toast.success(
          variables.payload.isEnabled ? "Método habilitado" : "Método inhabilitado"
        );
      } else {
        toast.success("Método actualizado");
      }
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el método", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: (_, id) => {
      queryClient.setQueryData<SellerPaymentMethod[]>(
        ["settings", "payment-methods"],
        (current = []) => current.filter((method) => method.id !== id)
      );
      toast.success("Método eliminado");
    },
    onError: (error) => {
      toast.error("No se pudo eliminar el método", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUploadPaymentQr() {
  return useMutation({
    mutationFn: uploadPaymentQr,
    onSuccess: () => {
      toast.success("Imagen QR subida");
    },
    onError: (error) => {
      toast.error("No se pudo subir la imagen QR", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}
