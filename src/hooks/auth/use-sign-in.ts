"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/utils/redirect";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import { toast } from "sonner";

/**
 * Options for useSignIn hook
 */
export interface UseSignInOptions {
  /**
   * Redirect to this URL after successful sign in
   * If not provided, will use redirectTo from query params or default to "/" (tienda)
   * @default undefined (uses query param or "/")
   */
  redirectTo?: string;
  /**
   * Whether to refresh the router after sign in
   * @default true
   */
  refresh?: boolean;
  /**
   * Whether to use redirectTo from query params
   * @default true
   */
  useQueryRedirect?: boolean;
}

/**
 * Sign in data
 */
export interface SignInData {
  email: string;
  password: string;
}

function matchesRouteOrSubpath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Signs in a user
 * @param data - Sign in data (email, password)
 * @returns Promise that resolves when sign in is complete
 */
async function signInUser(data: SignInData): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    throw error;
  }
}

/**
 * React hook to handle user sign in with loading and error states.
 * Uses React Query's useMutation for state management.
 *
 * @param options - Configuration options for sign in behavior
 * @returns Mutation object with signIn function, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function LoginForm() {
 *   const { signIn, isPending, errorMessage } = useSignIn();
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault();
 *     signIn({
 *       email: "user@example.com",
 *       password: "password123",
 *     });
 *   };
 *
 *   return (
 *     <Button onClick={handleSubmit} disabled={isPending}>
 *       {isPending ? "Logging in..." : "Login"}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useSignIn(options: UseSignInOptions = {}) {
  const {
    redirectTo: defaultRedirectTo,
    refresh = true,
    useQueryRedirect = true,
  } = options;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: signInUser,
    onSuccess: () => {
      // Show success toast
      toast.success("Sesión iniciada", {
        description: "Bienvenido de vuelta",
      });

      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.removeQueries({ queryKey: ["user"] });

      // Get redirect path: query param > defaultRedirectTo > "/" (tienda)
      const inferredDefaultRedirect = matchesRouteOrSubpath(
        pathname,
        "/admin/auth"
      )
        ? "/admin/dashboard"
        : "/";
      const fallbackRedirect = defaultRedirectTo || inferredDefaultRedirect;

      let redirectPath = "/";
      if (useQueryRedirect) {
        const queryRedirect = searchParams.get("redirectTo");
        redirectPath = getSafeRedirectPath(queryRedirect, fallbackRedirect);
      } else if (defaultRedirectTo) {
        redirectPath = getSafeRedirectPath(defaultRedirectTo, "/");
      } else {
        redirectPath = fallbackRedirect;
      }

      // Redirect after successful sign in
      router.push(redirectPath);
      if (refresh) {
        router.refresh(); // Refresh to ensure middleware picks up the new session
      }
    },
    onError: (error) => {
      // Show error toast with user-friendly message
      const errorMessage = getErrorMessage(error);
      toast.error("Error al iniciar sesión", {
        description: errorMessage,
      });
      // Log error (only logs unexpected/critical errors in production)
      logAuthError(error, "useSignIn");
    },
  });

  return {
    /**
     * Sign in function
     */
    signIn: (data: SignInData) => mutation.mutate(data),
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
