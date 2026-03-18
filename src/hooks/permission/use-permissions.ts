"use client";

import { useUser } from "@/hooks/auth/use-user";
import {
  Permission,
  UserRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  getUserPermissions,
} from "@/lib/auth/permissions";
import type { UserProfile } from "@/lib/auth/require-user";

/**
 * React hook to check user permissions and roles.
 * Uses the useUser hook to get the current user profile.
 *
 * @returns Object with permission and role checking functions
 *
 * @example
 * ```tsx
 * "use client"
 * function ProductsButton() {
 *   const { hasPermission } = usePermissions();
 *
 *   if (!hasPermission(Permission.VIEW_PRODUCTS)) {
 *     return null;
 *   }
 *
 *   return <Button>Ver Productos</Button>;
 * }
 * ```
 */
export function usePermissions() {
  const { data: user } = useUser();

  // Normalize undefined to null to match the expected type
  const normalizedUser: UserProfile | null = user ?? null;

  return {
    /**
     * Checks if the current user has a specific permission
     */
    hasPermission: (permission: Permission): boolean => {
      return hasPermission(normalizedUser, permission);
    },

    /**
     * Checks if the current user has any of the specified permissions
     */
    hasAnyPermission: (permissions: Permission[]): boolean => {
      return hasAnyPermission(normalizedUser, permissions);
    },

    /**
     * Checks if the current user has all of the specified permissions
     */
    hasAllPermissions: (permissions: Permission[]): boolean => {
      return hasAllPermissions(normalizedUser, permissions);
    },

    /**
     * Checks if the current user has a specific role
     */
    hasRole: (role: UserRole): boolean => {
      return hasRole(normalizedUser, role);
    },

    /**
     * Checks if the current user has any of the specified roles
     */
    hasAnyRole: (roles: UserRole[]): boolean => {
      return hasAnyRole(normalizedUser, roles);
    },

    /**
     * Gets all permissions for the current user's role
     */
    getUserPermissions: (): Permission[] => {
      return getUserPermissions(normalizedUser);
    },

    /**
     * Gets the current user profile
     */
    user: normalizedUser,
  };
}
