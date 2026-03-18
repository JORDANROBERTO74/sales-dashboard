import { createClient } from "@/lib/supabase/server";
import { logAuthError, AuthErrors } from "@/lib/auth/errors";
import { cache } from "react";

export type Claims = {
  email?: string;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

// Single-tenant: no organization membership in this project

export type UserProfile = {
  id: string; // UUID from public.users.id
  auth_user_id: string; // Reference to auth.users.id
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  preferences?: Record<string, unknown>;
  role?: string | null; // 'owner' | 'admin' | 'seller' | 'analyst' | 'viewer'
  role_id?: string | null;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
};

function normalizeRole(role: unknown): string | null {
  return typeof role === "string" && role.trim().length > 0
    ? role.trim().toLowerCase()
    : null;
}

/**
 * Fetches the authenticated user's claims from JWT (auth.users).
 * Returns null if no user is authenticated.
 */
export async function getUser(): Promise<Claims | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      logAuthError(error, "getUser");
      return null;
    }

    if (!data?.claims) return null;

    return data.claims as Claims;
  } catch (error) {
    logAuthError(error, "getUser");
    return null;
  }
}

/**
 * Fetches the user profile from public.users table by user ID.
 * Combines auth data with profile data. Returns null if no user.
 *
 * @throws {Error} If database query fails or user ID mismatch is detected
 */
async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      if (authError && authError.name !== "AuthSessionMissingError") {
        logAuthError(authError, "getUserProfile");
      }
      return null;
    }

    // Get profile from public.users table with role
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
      .eq("auth_user_id", user.id)
      .maybeSingle();

    // Handle database errors
    if (profileError) {
      logAuthError(profileError, "getUserProfile");
      // Return basic profile from auth metadata if DB query fails
      return {
        id: user.id, // Use auth user ID as fallback
        auth_user_id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name as string | undefined,
        avatar_url: user.user_metadata?.avatar_url as string | undefined,
      };
    }

    // If no profile exists in DB, return basic profile from auth metadata
    if (!profile) {
      return {
        id: user.id, // Use auth user ID as fallback
        auth_user_id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name as string | undefined,
        avatar_url: user.user_metadata?.avatar_url as string | undefined,
      };
    }

    // Validate ID consistency
    if (profile.auth_user_id !== user.id) {
      logAuthError(
        AuthErrors.databaseError(
          `User ID mismatch: auth.id=${user.id}, profile.auth_user_id=${profile.auth_user_id}`,
        ),
        "getUserProfile",
      );
    }

    // Return complete profile with role
    const profileRole = (
      profile as {
        roles?: { role_name?: string }[] | { role_name?: string } | null;
      }
    ).roles
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
      (user.app_metadata as { role?: unknown })?.role,
    );

    return {
      id: profile.id,
      auth_user_id: user.id,
      email: user.email || profile.email,
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
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AuthSessionMissingError"
    ) {
      return null;
    }
    logAuthError(error, "getUserProfile");
    return null;
  }
}

/**
 * Request-scoped memoized profile loader.
 * Prevents duplicate auth/profile queries when layout + page guards
 * request the same user data during a single server render.
 */
export const getCachedUserProfile = cache(fetchUserProfile);

export async function getUserProfile(): Promise<UserProfile | null> {
  return getCachedUserProfile();
}

/**
 * Creates a user profile in public.users table.
 * Checks if profile already exists before creating.
 *
 * @param userId - The authenticated user's ID from auth.users
 * @param email - The user's email address
 * @param data - Optional additional profile data
 * @returns The created profile, existing profile if already exists, or null on error
 * @throws {Error} If database operation fails critically
 */
export async function createUserProfile(
  userId: string,
  email: string,
  data?: Partial<UserProfile>,
): Promise<UserProfile | null> {
  const supabase = await createClient();

  // Check if profile already exists by auth_user_id
  const { data: existingProfile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (existingProfile) {
    // Profile already exists, return it instead of creating duplicate
    return existingProfile;
  }

  // Validate that userId exists in auth.users before creating profile
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.id !== userId) {
    logAuthError(
      AuthErrors.unauthenticated(
        "Cannot create profile: User not authenticated or ID mismatch",
      ),
      "createUserProfile",
    );
    return null;
  }

  // Create new profile with auth_user_id
  const { data: profile, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: userId,
      email,
      ...data,
    })
    .select()
    .single();

  if (error) {
    logAuthError(
      AuthErrors.databaseError("Error creating user profile", error),
      "createUserProfile",
    );
    // Handle specific error cases
    if (error.code === "23505") {
      // Unique constraint violation - profile was created by another request
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();
      return profile || null;
    }
    return null;
  }

  return profile || null;
}
