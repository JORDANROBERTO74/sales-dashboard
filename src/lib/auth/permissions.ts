import { UserProfile } from "@/lib/auth/require-user";

/**
 * User roles enum
 * Roles organized by hierarchy and responsibility
 */
export enum UserRole {
  OWNER = "owner",
  ADMIN = "admin",
  SELLER = "seller",
  ANALYST = "analyst",
  VIEWER = "viewer",
}

/**
 * Permission types
 * Permissions organized by functional area
 */
export enum Permission {
  // User management
  VIEW_USERS = "view_users",
  CREATE_USERS = "create_users",
  UPDATE_USERS = "update_users",
  DELETE_USERS = "delete_users",

  // Customer management
  VIEW_CUSTOMERS = "view_customers",
  UPDATE_CUSTOMERS = "update_customers",
  DELETE_CUSTOMERS = "delete_customers",

  // Product management
  VIEW_PRODUCTS = "view_products",
  CREATE_PRODUCTS = "create_products",
  UPDATE_PRODUCTS = "update_products",
  DELETE_PRODUCTS = "delete_products",
  MANAGE_PRODUCT_PRICES = "manage_product_prices", // Change prices

  // Category management
  VIEW_CATEGORIES = "view_categories",
  CREATE_CATEGORIES = "create_categories",
  UPDATE_CATEGORIES = "update_categories",
  DELETE_CATEGORIES = "delete_categories",

  // Order management
  VIEW_ORDERS = "view_orders",
  CREATE_ORDERS = "create_orders", // Create manual orders
  UPDATE_ORDERS = "update_orders",
  DELETE_ORDERS = "delete_orders",
  PROCESS_ORDERS = "process_orders", // Process/fulfill orders
  CANCEL_ORDERS = "cancel_orders", // Cancel orders
  REFUND_ORDERS = "refund_orders", // Refund orders

  // Inventory/Branches management
  VIEW_INVENTORY = "view_inventory",
  MANAGE_INVENTORY = "manage_inventory",
  VIEW_BRANCHES = "view_branches",
  MANAGE_BRANCHES = "manage_branches",

  // Settings management
  VIEW_SETTINGS = "view_settings",
  MANAGE_SETTINGS = "manage_settings",
  MANAGE_TEAM = "manage_team",

  // Marketing & Promotions
  VIEW_MARKETING = "view_marketing",
  MANAGE_MARKETING = "manage_marketing", // Coupons, promotions, campaigns
  MANAGE_COUPONS = "manage_coupons", // Coupon management

  // Reports & Analytics
  VIEW_ANALYTICS = "view_analytics",
  VIEW_REPORTS = "view_reports", // Financial and operational reports
  EXPORT_DATA = "export_data", // Export data (CSV, Excel, etc.)

  // Admin operations
  MANAGE_SYSTEM = "manage_system", // System configuration
  MANAGE_INTEGRATIONS = "manage_integrations", // Third-party integrations
  VIEW_LOGS = "view_logs", // View system logs
}

/**
 * Role-based permissions mapping
 * Permisos asignados según responsabilidades de cada rol
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.UPDATE_USERS,
    Permission.DELETE_USERS,
    Permission.VIEW_CUSTOMERS,
    Permission.UPDATE_CUSTOMERS,
    Permission.DELETE_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.UPDATE_PRODUCTS,
    Permission.DELETE_PRODUCTS,
    Permission.MANAGE_PRODUCT_PRICES,
    Permission.VIEW_CATEGORIES,
    Permission.CREATE_CATEGORIES,
    Permission.UPDATE_CATEGORIES,
    Permission.DELETE_CATEGORIES,
    Permission.VIEW_ORDERS,
    Permission.CREATE_ORDERS,
    Permission.UPDATE_ORDERS,
    Permission.DELETE_ORDERS,
    Permission.PROCESS_ORDERS,
    Permission.CANCEL_ORDERS,
    Permission.REFUND_ORDERS,
    Permission.VIEW_INVENTORY,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_BRANCHES,
    Permission.MANAGE_BRANCHES,
    Permission.VIEW_SETTINGS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_TEAM,
    Permission.VIEW_MARKETING,
    Permission.MANAGE_MARKETING,
    Permission.MANAGE_COUPONS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_INTEGRATIONS,
    Permission.VIEW_LOGS,
  ],
  [UserRole.SELLER]: [
    Permission.VIEW_CUSTOMERS,
    Permission.UPDATE_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.UPDATE_PRODUCTS,
    Permission.MANAGE_PRODUCT_PRICES,
    Permission.VIEW_CATEGORIES,
    Permission.CREATE_CATEGORIES,
    Permission.UPDATE_CATEGORIES,
    Permission.VIEW_ORDERS,
    Permission.CREATE_ORDERS,
    Permission.UPDATE_ORDERS,
    Permission.PROCESS_ORDERS,
    Permission.CANCEL_ORDERS,
    Permission.REFUND_ORDERS,
    Permission.VIEW_INVENTORY,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_BRANCHES,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
  ],
  [UserRole.ANALYST]: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_CATEGORIES,
    Permission.VIEW_ORDERS,
    Permission.VIEW_INVENTORY,
    Permission.VIEW_BRANCHES,
    Permission.VIEW_MARKETING,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_LOGS,
  ],
  [UserRole.VIEWER]: [
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_CATEGORIES,
    Permission.VIEW_ORDERS,
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_INVENTORY,
    Permission.VIEW_BRANCHES,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
  ],
};

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  return (Object.values(UserRole) as string[]).includes(normalized)
    ? (normalized as UserRole)
    : null;
}

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(
  user: UserProfile | null,
  permission: Permission
): boolean {
  if (!user) {
    return false;
  }

  const role = normalizeRole(user.role);
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];

  return permissions.includes(permission);
}

/**
 * Checks if a user has any of the specified permissions
 */
export function hasAnyPermission(
  user: UserProfile | null,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Checks if a user has all of the specified permissions
 */
export function hasAllPermissions(
  user: UserProfile | null,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Checks if a user has a specific role
 */
export function hasRole(user: UserProfile | null, role: UserRole): boolean {
  return normalizeRole(user?.role) === role;
}

/**
 * Checks if a user has any of the specified roles
 */
export function hasAnyRole(
  user: UserProfile | null,
  roles: UserRole[]
): boolean {
  const normalizedRole = normalizeRole(user?.role);
  return normalizedRole ? roles.includes(normalizedRole) : false;
}

/**
 * Gets all permissions for a user's role
 */
export function getUserPermissions(user: UserProfile | null): Permission[] {
  if (!user) {
    return [];
  }

  const role = normalizeRole(user.role);
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}
