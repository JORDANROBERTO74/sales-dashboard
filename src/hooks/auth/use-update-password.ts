"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import { toast } from "sonner";

/**
 * Options for useUpdatePassword hook
 */
export interface UseUpdatePasswordOptions {
  /**
   * Redirect to this URL after successful password update
   * @default "/"
   */
  redirectTo?: string;
  /**
   * Whether to refresh the router after password update
   * @default true
   */
  refresh?: boolean;
}

/**
 * Update password data
 */
export interface UpdatePasswordData {
  password: string;
}

/**
 * Updates the user's password
 * @param data - Update password data (password)
 * @returns Promise that resolves when password is updated
 */
async function updateUserPassword(data: UpdatePasswordData): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({ password: data.password });

  if (error) {
    throw error;
  }
}

/**
 * React hook to handle password update with loading and error states.
 * Uses React Query's useMutation for state management.
 *
 * @param options - Configuration options for password update behavior
 * @returns Mutation object with updatePassword function, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function UpdatePasswordForm() {
 *   const { updatePassword, isPending, errorMessage } = useUpdatePassword({
 *     redirectTo: "/admin/dashboard",
 *   });
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault();
 *     updatePassword({
 *       password: "newPassword123",
 *     });
 *   };
 *
 *   return (
 *     <Button onClick={handleSubmit} disabled={isPending}>
 *       {isPending ? "Guardando..." : "Guardar contraseña"}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useUpdatePassword(options: UseUpdatePasswordOptions = {}) {
  const { redirectTo = "/", refresh = true } = options;
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: updateUserPassword,
    onSuccess: () => {
      // Show success toast
      toast.success("Contraseña actualizada", {
        description: "Tu contraseña ha sido actualizada correctamente",
      });

      // Redirect after successful password update
      if (redirectTo) {
        router.push(redirectTo);
        if (refresh) {
          router.refresh();
        }
      }
    },
    onError: (error) => {
      // Show error toast with user-friendly message
      const errorMessage = getErrorMessage(error);
      toast.error("Error al actualizar contraseña", {
        description: errorMessage,
      });
      // Log error (only logs unexpected/critical errors in production)
      logAuthError(error, "useUpdatePassword");
    },
  });

  return {
    /**
     * Update password function
     */
    updatePassword: (data: UpdatePasswordData) => mutation.mutate(data),
    /**
     * Loading state (isPending in React Query v5)
     */
    isPending: mutation.isPending,
    /**
     * Error state
     */
    error: mutation.error,
    /**
     * Error message (extracted from error)
     */
    errorMessage: mutation.error ? getErrorMessage(mutation.error) : null,
    /**
     * Whether the mutation is currently pending
     * @deprecated Use isPending instead (React Query v5)
     */
    isLoading: mutation.isPending,
    /**
     * Whether the mutation was successful
     */
    isSuccess: mutation.isSuccess,
    /**
     * Reset mutation state
     */
    reset: mutation.reset,
  };
}
