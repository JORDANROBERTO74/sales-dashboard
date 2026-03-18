import type { UserProfile } from "@/lib/auth/require-user";
import {
  Permission,
  UserRole,
  getUserPermissions,
  hasAnyRole,
} from "@/lib/auth/permissions";

export type AdminNavChildConfig = {
  key: string;
  title: string;
  url: string;
  requiredRoles?: UserRole[];
  requiredPermissions?: Permission[];
};

export type AdminNavItemConfig = {
  key: string;
  title: string;
  url: string;
  iconKey?: "dashboard" | "settings" | "transactions" | "balances";
  isActive?: boolean;
  requiredRoles?: UserRole[];
  requiredPermissions?: Permission[];
  items?: AdminNavChildConfig[];
};

export type AdminNavChild = {
  key: string;
  title: string;
  url: string;
};

export type AdminNavItem = {
  key: string;
  title: string;
  url: string;
  iconKey?: "dashboard" | "settings" | "transactions" | "balances";
  isActive?: boolean;
  items?: AdminNavChild[];
};

export const ADMIN_NAV_CONFIG: AdminNavItemConfig[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    url: "/admin/dashboard",
    iconKey: "dashboard",
    isActive: true,
  },
  {
    key: "transactions",
    title: "Transacciones",
    url: "#",
    iconKey: "transactions",
    items: [
      {
        key: "transactions-accounts",
        title: "Cuentas",
        url: "/admin/transactions",
      },
      {
        key: "transactions-jnode",
        title: "JNode",
        url: "/admin/transactions/jnode",
      },
      {
        key: "transactions-vascruz",
        title: "Vascruz",
        url: "/admin/transactions/vascruz",
      },
    ],
  },
  {
    key: "balances",
    title: "Saldo",
    url: "#",
    iconKey: "balances",
    items: [
      {
        key: "balances-general",
        title: "General",
        url: "/admin/balances",
      },
      {
        key: "balances-payouts",
        title: "Retiros",
        url: "/admin/balances/payouts",
      },
    ],
  },
  {
    key: "settings",
    title: "Configuración",
    url: "#",
    iconKey: "settings",
    items: [
      {
        key: "settings-general",
        title: "General",
        url: "/admin/settings",
      },
      {
        key: "settings-profile",
        title: "Perfil",
        url: "/admin/settings/profile",
      },
      {
        key: "settings-team",
        title: "Equipo",
        url: "/admin/settings/team",
        requiredRoles: [UserRole.OWNER, UserRole.ADMIN],
      },
      {
        key: "settings-payment-methods",
        title: "Métodos de pago",
        url: "/admin/settings/payment-methods",
        requiredRoles: [UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER],
      },
    ],
  },
];

function hasAccess(
  user: UserProfile | null,
  requiredRoles?: UserRole[],
  requiredPermissions?: Permission[],
): boolean {
  if (!requiredRoles?.length && !requiredPermissions?.length) {
    return true;
  }

  if (!user) {
    return false;
  }

  const roleAllowed = requiredRoles?.length
    ? hasAnyRole(
        {
          ...user,
          role: (user.role as UserRole | null) ?? null,
        },
        requiredRoles,
      )
    : true;

  const permissionAllowed = requiredPermissions?.length
    ? requiredPermissions.some((permission) =>
        getUserPermissions({
          ...user,
          role: (user.role as UserRole | null) ?? null,
        }).includes(permission),
      )
    : true;

  return roleAllowed && permissionAllowed;
}

export function getAdminNavForUser(user: UserProfile | null): AdminNavItem[] {
  return ADMIN_NAV_CONFIG.flatMap((item) => {
    if (!hasAccess(user, item.requiredRoles, item.requiredPermissions)) {
      return [];
    }

    const filteredChildren =
      item.items?.filter((child) =>
        hasAccess(user, child.requiredRoles, child.requiredPermissions),
      ) ?? [];

    const hasChildren = filteredChildren.length > 0;
    const isGroupOnly = item.url === "#";
    if (isGroupOnly && !hasChildren) {
      return [];
    }

    return [
      {
        key: item.key,
        title: item.title,
        url: item.url,
        iconKey: item.iconKey,
        isActive: item.isActive,
        items: hasChildren
          ? filteredChildren.map(({ key, title, url }) => ({ key, title, url }))
          : undefined,
      },
    ];
  });
}
