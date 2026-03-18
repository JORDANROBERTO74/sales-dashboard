import { UserRole } from "@/lib/auth/permissions";

export const SETTINGS_ADMIN_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];
export const SETTINGS_SELLER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
];
export const SETTINGS_ALL_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];
export const SETTINGS_ALLOWED_ROLES: UserRole[] = SETTINGS_ALL_ROLES;

export type SettingsNavItem = {
  key: string;
  title: string;
  href: string;
  requiredRoles: UserRole[];
  activeMatchPrefixes?: string[];
  children?: SettingsNavItem[];
};

export type SettingsSection = SettingsNavItem & {
  description: string;
  accessLabel: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: "profile",
    title: "Mi perfil",
    description: "Actualiza tus datos personales, preferencias y correo de acceso.",
    href: "/admin/settings/profile",
    requiredRoles: SETTINGS_ALL_ROLES,
    accessLabel: "Todos",
  },
  {
    key: "team",
    title: "Equipo",
    description: "Invita miembros y administra roles/estado del equipo.",
    href: "/admin/settings/team",
    requiredRoles: SETTINGS_ADMIN_ROLES,
    activeMatchPrefixes: ["/admin/settings/team/"],
    children: [
      {
        key: "team-members",
        title: "Miembros",
        href: "/admin/settings/team",
        requiredRoles: SETTINGS_ADMIN_ROLES,
        activeMatchPrefixes: ["/admin/settings/team/"],
      },
    ],
    accessLabel: "Admin",
  },
  {
    key: "payment-methods",
    title: "Métodos de pago",
    description: "Configura tus cuentas para recibir pagos de comisiones.",
    href: "/admin/settings/payment-methods",
    requiredRoles: SETTINGS_SELLER_ROLES,
    accessLabel: "Seller+",
  },
];
