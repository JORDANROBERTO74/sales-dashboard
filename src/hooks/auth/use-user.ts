"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/auth/require-user";
import { logAuthError } from "@/lib/auth/errors";

function normalizeRole(role: unknown): string | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Fetches the user profile from public.users table by user ID.
 * Combines auth data with profile data. Returns null if no user.
 *
 * This is the client-side equivalent of getUserProfile() from lib/auth/require-user.ts
 */
async function fetchUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();

  try {
    // 1. Get authenticated user from auth.users
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    // Handle auth errors or missing user
    if (authError || !authUser) {
      // Don't log AuthSessionMissingError as it's expected when not logged in
      if (authError && authError.name !== "AuthSessionMissingError") {
        // Log error (only logs unexpected/critical errors in production)
        logAuthError(authError, "useUser");
      }
      return null;
    }

    // 2. Get profile from public.users table with role
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        `
        id,
        auth_user_id,
        email,
        full_name,
        avatar_url,
        phone,
        preferences,
        role_id,
        onboarding_completed,
        created_at,
        updated_at,
        roles:role_id (
          role_name
        )
      `,
      )
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    // Handle database errors
    if (profileError) {
      // Log error (database errors are always worth logging)
      logAuthError(profileError, "useUser:profile");
      // Return basic profile from auth metadata if DB query fails
      return {
        id: authUser.id, // Use auth user ID as fallback
        auth_user_id: authUser.id,
        email: authUser.email || "",
        full_name: authUser.user_metadata?.full_name as string | undefined,
        avatar_url: authUser.user_metadata?.avatar_url as string | undefined,
      };
    }

    // If no profile exists in DB, return basic profile from auth metadata
    if (!profile) {
      return {
        id: authUser.id, // Use auth user ID as fallback
        auth_user_id: authUser.id,
        email: authUser.email || "",
        full_name: authUser.user_metadata?.full_name as string | undefined,
        avatar_url: authUser.user_metadata?.avatar_url as string | undefined,
      };
    }

    // Validate ID consistency
    if (profile.auth_user_id !== authUser.id) {
      // Log ID mismatch (this is a data integrity issue, worth logging)
      logAuthError(
        new Error(
          `User ID mismatch: auth.id=${authUser.id}, profile.auth_user_id=${profile.auth_user_id}`,
        ),
        "useUser:validation",
      );
    }

    const profileRole =
      (profile as {
        roles?: { role_name?: string }[] | { role_name?: string } | null;
      }).roles
        ? ((Array.isArray(
            (
              profile as {
                roles: { role_name?: string }[] | { role_name?: string } | null;
              }
            ).roles,
          )
            ? (profile as { roles: { role_name?: string }[] }).roles[0]?.role_name
            : (profile as { roles: { role_name?: string } }).roles?.role_name) ??
          null)
        : null;
    const authRole = normalizeRole(
      (authUser.app_metadata as { role?: unknown })?.role,
    );

    // Combine auth and profile data with normalized role
    return {
      id: profile.id,
      auth_user_id: authUser.id,
      email: authUser.email || profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      phone: profile.phone,
      preferences: profile.preferences as Record<string, unknown> | undefined,
      role_id: profile.role_id as string | null,
      role: normalizeRole(profileRole) ?? authRole,
      onboarding_completed: profile.onboarding_completed as boolean,
      created_at: profile.created_at as string | undefined,
      updated_at: profile.updated_at as string | undefined,
    };
  } catch (error: unknown) {
    // Catch AuthSessionMissingError and other exceptions
    // This is expected when user is not authenticated
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AuthSessionMissingError"
    ) {
      // Expected error when no session exists - return null silently
      return null;
    }

    // Log unexpected errors (always log as these are truly unexpected)
    logAuthError(error, "useUser:unexpected");
    return null;
  }
}

/**
 * React hook to fetch user profile data.
 * Uses React Query for caching, refetching, and state management.
 *
 * @returns Query result with user profile data, loading state, and error state
 *
 * @example
 * ```tsx
 * "use client"
 * function ProfileCard() {
 *   const { data: user, isLoading, error } = useUser();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error />;
 *   if (!user) return <div>No autenticado</div>;
 *
 *   return <div>{user.full_name}</div>;
 * }
 * ```
 */
export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: fetchUserProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes - datos frescos por 5 minutos
    refetchOnWindowFocus: false, // No refetch al cambiar de ventana
    retry: (failureCount, error) => {
      // Don't retry on AuthSessionMissingError (expected when not logged in)
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AuthSessionMissingError"
      ) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
  });
}
