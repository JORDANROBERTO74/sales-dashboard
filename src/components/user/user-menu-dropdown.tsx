"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { useSignOut } from "@/hooks/auth/use-sign-out";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type UserMenuData = {
  name: string;
  email: string;
  avatar: string;
};

export function getUserInitials(name: string, email: string): string {
  if (name && name !== "Usuario") {
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "US";
}

type UserMenuDropdownProps = {
  user: UserMenuData;
  trigger: React.ReactElement;
  onNavigate?: () => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
};

export function UserMenuDropdown({
  user,
  trigger,
  onNavigate,
  align = "end",
  side = "right",
  contentClassName,
}: UserMenuDropdownProps) {
  const initials = getUserInitials(user.name, user.email);
  const {
    signOut,
    isPending: isLoggingOut,
    error: logoutError,
  } = useSignOut({
    redirectTo: "/",
    refresh: true,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className={contentClassName ?? "min-w-56 rounded-lg p-1"}
        side={side}
        align={align}
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/admin/settings/profile"
            className="flex items-center cursor-pointer"
            onClick={onNavigate}
          >
            <User className="mr-2 h-4 w-4" />
            Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/admin/settings"
            className="flex items-center cursor-pointer"
            onClick={onNavigate}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configuración
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={isLoggingOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
        </DropdownMenuItem>
        {logoutError && (
          <DropdownMenuItem disabled className="text-destructive text-xs">
            Error al cerrar sesión
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
