"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import { toast } from "sonner";

/**
 * Options for useSignUp hook
 */
export interface UseSignUpOptions {
  /**
   * Redirect to this URL after successful sign up
   * @default "/auth/sign-up-success"
   */
  redirectTo?: string;
  /**
   * Email redirect URL for email confirmation
   * This should point to your confirm route handler
   * @default "${window.location.origin}/api/auth/confirm?next=/"
   */
  emailRedirectTo?: string;
  /**
   * Whether to refresh the router after sign up
   * @default false
   */
  refresh?: boolean;
}

/**
 * Sign up data
 */
export interface SignUpData {
  email: string;
  password: string;
  repeatPassword: string;
}

/**
 * Signs up a new user
 * @param data - Sign up data (email, password, repeatPassword)
 * @param options - Additional options
 * @returns Promise that resolves when sign up is complete
 */
async function signUpUser(
  data: SignUpData,
  options: UseSignUpOptions = {}
): Promise<void> {
  const { emailRedirectTo } = options;

  // Validate passwords match
  if (data.password !== data.repeatPassword) {
    throw new Error("Las contraseñas no coinciden");
  }

  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo:
        emailRedirectTo || `${window.location.origin}/api/auth/confirm?next=/`,
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * React hook to handle user sign up with loading and error states.
 * Uses React Query's useMutation for state management.
 *
 * @param options - Configuration options for sign up behavior
 * @returns Mutation object with signUp function, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function SignUpForm() {
 *   const { signUp, isPending, error } = useSignUp({
 *     redirectTo: "/auth/sign-up-success",
 *   });
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault();
 *     signUp({
 *       email: "user@example.com",
 *       password: "password123",
 *       repeatPassword: "password123",
 *     });
 *   };
 *
 *   return (
 *     <Button onClick={handleSubmit} disabled={isPending}>
 *       {isPending ? "Creating account..." : "Sign up"}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useSignUp(options: UseSignUpOptions = {}) {
  const {
    redirectTo = "/auth/sign-up-success",
    emailRedirectTo,
    refresh = false,
  } = options;
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: SignUpData) => signUpUser(data, { emailRedirectTo }),
    onSuccess: () => {
      // Show success toast
      toast.success("Cuenta creada", {
        description: "Revisa tu email para confirmar tu cuenta",
      });

      // Invalidate user query to refresh user data if needed
      queryClient.invalidateQueries({ queryKey: ["user"] });

      // Redirect after successful sign up
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
      toast.error("Error al crear la cuenta", {
        description: errorMessage,
      });
      // Log error (only logs unexpected/critical errors in production)
      logAuthError(error, "useSignUp");
    },
  });

  return {
    /**
     * Sign up function
     */
    signUp: (data: SignUpData) => mutation.mutate(data),
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
