"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import { toast } from "sonner";

/**
 * Options for useSignOut hook
 */
export interface UseSignOutOptions {
  /**
   * Redirect to this URL after successful logout
   * @default "/"
   */
  redirectTo?: string;
  /**
   * Whether to refresh the router after logout
   * @default true
   */
  refresh?: boolean;
}

/**
 * Signs out the current user
 * @returns Promise that resolves when logout is complete
 */
async function signOutUser(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * React hook to handle user sign out with loading and error states.
 * Uses React Query's useMutation for state management.
 *
 * @param options - Configuration options for sign out behavior
 * @returns Mutation object with signOut function, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function LogoutButton() {
 *   const { signOut, isPending, error } = useSignOut({
 *     redirectTo: "/auth/login",
 *   });
 *
 *   return (
 *     <Button onClick={() => signOut()} disabled={isPending}>
 *       {isPending ? "Cerrando..." : "Cerrar Sesión"}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useSignOut(options: UseSignOutOptions = {}) {
  const { redirectTo = "/", refresh = true } = options;
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: signOutUser,
    onSuccess: () => {
      // Show success toast
      toast.success("Sesión cerrada", {
        description: "Has cerrado sesión correctamente",
      });

      // Invalidate and remove user query from cache
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.removeQueries({ queryKey: ["user"] });

      // Redirect after successful logout
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
      toast.error("Error al cerrar sesión", {
        description: errorMessage,
      });
      // Log error (always log sign-out errors as they're unexpected)
      // Sign-out should never fail, so any error is worth logging
      logAuthError(error, "useSignOut");
    },
  });

  return {
    /**
     * Sign out function
     */
    signOut: () => mutation.mutate(),
    /**
     * Loading state (isPending in React Query v5)
     */
    isPending: mutation.isPending,
    /**
     * Error state
     */
    error: mutation.error,
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
