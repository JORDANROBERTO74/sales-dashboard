import { getUserProfile, UserProfile } from "@/lib/auth/require-user";
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  UserRole,
} from "@/lib/auth/permissions";
import { AuthErrors, logAuthError } from "@/lib/auth/errors";
import { redirect } from "next/navigation";

/**
 * Options for requireAuth middleware
 */
export interface RequireAuthOptions {
  /**
   * Redirect to this URL if user is not authenticated
   * @default "/auth/login"
   */
  redirectTo?: string;
  /**
   * Throw error instead of redirecting
   * @default false
   */
  throwOnUnauth?: boolean;
}

/**
 * Requires user authentication
 * Throws error or redirects if user is not authenticated
 */
export async function requireAuth(
  options: RequireAuthOptions = {},
): Promise<UserProfile> {
  const { redirectTo = "/auth/login", throwOnUnauth = false } = options;

  const user = await getUserProfile();

  if (!user) {
    const error = AuthErrors.unauthenticated();
    logAuthError(error, "requireAuth");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(redirectTo);
  }

  return user;
}

/**
 * Options for requirePermission middleware
 */
export interface RequirePermissionOptions extends RequireAuthOptions {
  /**
   * Redirect to this URL if user doesn't have permission
   * @default "/auth/unauthorized"
   */
  unauthorizedRedirectTo?: string;
}

/**
 * Requires user to have a specific permission
 */
export async function requirePermission(
  permission: Permission,
  options: RequirePermissionOptions = {},
): Promise<UserProfile> {
  const {
    redirectTo = "/auth/login",
    unauthorizedRedirectTo = "/auth/unauthorized",
    throwOnUnauth = false,
  } = options;

  const user = await requireAuth({ redirectTo, throwOnUnauth });

  if (!hasPermission(user, permission)) {
    const error = AuthErrors.unauthorized(
      `User does not have permission: ${permission}`,
    );
    logAuthError(error, "requirePermission");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(unauthorizedRedirectTo);
  }

  return user;
}

/**
 * Requires user to have any of the specified permissions
 */
export async function requireAnyPermission(
  permissions: Permission[],
  options: RequirePermissionOptions = {},
): Promise<UserProfile> {
  const {
    redirectTo = "/auth/login",
    unauthorizedRedirectTo = "/auth/unauthorized",
    throwOnUnauth = false,
  } = options;

  const user = await requireAuth({ redirectTo, throwOnUnauth });

  if (!hasAnyPermission(user, permissions)) {
    const error = AuthErrors.unauthorized(
      `User does not have any of the required permissions: ${permissions.join(
        ", ",
      )}`,
    );
    logAuthError(error, "requireAnyPermission");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(unauthorizedRedirectTo);
  }

  return user;
}

/**
 * Requires user to have all of the specified permissions
 */
export async function requireAllPermissions(
  permissions: Permission[],
  options: RequirePermissionOptions = {},
): Promise<UserProfile> {
  const {
    redirectTo = "/auth/login",
    unauthorizedRedirectTo = "/auth/unauthorized",
    throwOnUnauth = false,
  } = options;

  const user = await requireAuth({ redirectTo, throwOnUnauth });

  if (!hasAllPermissions(user, permissions)) {
    const error = AuthErrors.unauthorized(
      `User does not have all required permissions: ${permissions.join(", ")}`,
    );
    logAuthError(error, "requireAllPermissions");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(unauthorizedRedirectTo);
  }

  return user;
}

/**
 * Requires user to have a specific role
 */
export async function requireRole(
  role: UserRole,
  options: RequirePermissionOptions = {},
): Promise<UserProfile> {
  const {
    redirectTo = "/auth/login",
    unauthorizedRedirectTo = "/auth/unauthorized",
    throwOnUnauth = false,
  } = options;

  const user = await requireAuth({ redirectTo, throwOnUnauth });

  if (!hasRole(user, role)) {
    const error = AuthErrors.unauthorized(
      `User does not have required role: ${role}`,
    );
    logAuthError(error, "requireRole");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(unauthorizedRedirectTo);
  }

  return user;
}

/**
 * Requires user to have any of the specified roles
 */
export async function requireAnyRole(
  roles: UserRole[],
  options: RequirePermissionOptions = {},
): Promise<UserProfile> {
  const {
    redirectTo = "/auth/login",
    unauthorizedRedirectTo = "/auth/unauthorized",
    throwOnUnauth = false,
  } = options;

  const user = await requireAuth({ redirectTo, throwOnUnauth });

  if (!hasAnyRole(user, roles)) {
    const error = AuthErrors.unauthorized(
      `User does not have any of the required roles: ${roles.join(", ")}`,
    );
    logAuthError(error, "requireAnyRole");

    if (throwOnUnauth) {
      throw error;
    }

    redirect(unauthorizedRedirectTo);
  }

  return user;
}
