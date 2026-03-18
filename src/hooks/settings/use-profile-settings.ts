"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

type JsonResponse<T> = T & { error?: string; error_code?: string };

type ProfilePreferences = {
  theme?: "light" | "dark";
  language?: "es" | "en";
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
};

export type ProfileSettings = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  preferences: ProfilePreferences | null;
  onboarding_completed: boolean;
  updated_at: string | null;
};

export type UpdateProfileInput = {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: ProfilePreferences;
  onboardingCompleted?: boolean;
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

async function fetchProfile(): Promise<ProfileSettings> {
  const data = await requestJson<{ profile: ProfileSettings }>(
    "/api/settings/profile",
  );
  return data.profile;
}

async function updateProfile(input: UpdateProfileInput) {
  return requestJson<{ ok: boolean }>("/api/settings/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function updateEmail(email: string) {
  return requestJson<{ ok: boolean; message?: string }>(
    "/api/settings/profile/email",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
}

export interface UseProfileSettingsOptions {
  enabled?: boolean;
  initialData?: ProfileSettings;
}

export function useProfileSettings(options: UseProfileSettingsOptions = {}) {
  const { enabled = true, initialData } = options;

  return useQuery({
    queryKey: ["settings", "profile"],
    queryFn: fetchProfile,
    enabled,
    initialData,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateProfileSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      toast.success("Perfil actualizado");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el perfil", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUpdateProfileEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEmail,
    onSuccess: async (result) => {
      toast.success("Solicitud de cambio de email enviada", {
        description:
          result.message ??
          "Revisa tu correo nuevo para confirmar el cambio. Luego vuelve a iniciar sesión si es necesario.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    },
    onError: (error) => {
      toast.error("No se pudo enviar la solicitud de cambio de email", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}
