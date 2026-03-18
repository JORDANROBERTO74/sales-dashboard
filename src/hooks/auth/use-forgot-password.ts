"use client";

import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage, logAuthError } from "@/lib/auth/errors";
import { toast } from "sonner";

/**
 * Options for useForgotPassword hook
 */
export interface UseForgotPasswordOptions {
  /**
   * Redirect URL for password reset email
   * @default "${window.location.origin}/auth/update-password"
   */
  redirectTo?: string;
}

/**
 * Forgot password data
 */
export interface ForgotPasswordData {
  email: string;
}

function resolveResetRedirectTo(customRedirectTo?: string): string {
  const targetPath = "/auth/update-password";
  const baseOrigin = window.location.origin;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (customRedirectTo?.trim()) {
    const trimmed = customRedirectTo.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) {
      return `${baseOrigin}${trimmed}`;
    }
  }

  if (configuredSiteUrl) {
    try {
      const origin = new URL(configuredSiteUrl).origin;
      return `${origin}${targetPath}`;
    } catch {
      // Ignore invalid env value and fallback to current origin.
    }
  }

  return `${baseOrigin}${targetPath}`;
}

/**
 * Sends a password reset email to the user
 * @param data - Forgot password data (email)
 * @param options - Additional options
 * @returns Promise that resolves when email is sent
 */
async function sendPasswordResetEmail(
  data: ForgotPasswordData,
  options: UseForgotPasswordOptions = {}
): Promise<void> {
  const redirectTo = resolveResetRedirectTo(options.redirectTo);
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo,
  });

  if (error) {
    throw error;
  }
}

/**
 * React hook to handle password reset email with loading and error states.
 * Uses React Query's useMutation for state management.
 *
 * @param options - Configuration options for password reset behavior
 * @returns Mutation object with sendPasswordReset function, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function ForgotPasswordForm() {
 *   const { sendPasswordReset, isPending, errorMessage } = useForgotPassword();
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault();
 *     sendPasswordReset({
 *       email: "user@example.com",
 *     });
 *   };
 *
 *   return (
 *     <Button onClick={handleSubmit} disabled={isPending}>
 *       {isPending ? "Enviando..." : "Enviar email"}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useForgotPassword(options: UseForgotPasswordOptions = {}) {
  const mutation = useMutation({
    mutationFn: (data: ForgotPasswordData) =>
      sendPasswordResetEmail(data, options),
    onSuccess: () => {
      // Show success toast
      toast.success("Email enviado", {
        description: "Revisa tu correo para restablecer tu contraseña",
      });
    },
    onError: (error) => {
      let errorMessage = getErrorMessage(error);
      if (
        error instanceof Error &&
        /redirect|allow.?list|not allowed|invalid.*url/i.test(error.message)
      ) {
        errorMessage =
          "No se pudo enviar el enlace de recuperación por configuración de URL de redirección. Contacta al administrador.";
      }

      toast.error("Error al enviar email", {
        description: errorMessage,
      });
      // Log error (only logs unexpected/critical errors in production)
      logAuthError(error, "useForgotPassword");
    },
  });

  return {
    /**
     * Send password reset email function
     */
    sendPasswordReset: (data: ForgotPasswordData) => mutation.mutate(data),
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
