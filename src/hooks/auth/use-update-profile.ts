"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import type { UserProfile } from "@/lib/auth/require-user";

/**
 * Data for updating user profile
 */
export type UpdateProfileData = Partial<
  Omit<
    UserProfile,
    "id" | "auth_user_id" | "email" | "created_at" | "updated_at"
  >
> & {
  id: string;
};

/**
 * Updates the current user's profile
 */
async function updateUserProfile(data: UpdateProfileData): Promise<void> {
  const supabase = createClient();
  const { id, ...updates } = data;

  const { error } = await supabase.from("users").update(updates).eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * React hook to update the current user's profile.
 * Uses React Query's useMutation for state management.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      logAuthError(error, "useUpdateProfile");
    },
  });

  return {
    updateProfile: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}



