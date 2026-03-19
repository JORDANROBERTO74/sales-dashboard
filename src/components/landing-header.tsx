"use client";

import Link from "next/link";
import { Building2, ChevronsUpDown } from "lucide-react";
import { useUser } from "@/hooks/auth/use-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  getUserInitials,
  UserMenuDropdown,
} from "@/components/user/user-menu-dropdown";

export function LandingHeader() {
  const { data: userProfile } = useUser();
  const userName =
    userProfile?.full_name || userProfile?.email?.split("@")[0] || "Usuario";
  const userEmail = userProfile?.email || "";
  const userAvatar = userProfile?.avatar_url || "";
  const userInitials = getUserInitials(userName, userEmail);
  const userTriggerButton = (
    <Button
      variant="ghost"
      type="button"
      aria-label="Abrir menú de usuario"
      className="h-full"
    >
      <Avatar className="size-8 rounded-lg">
        <AvatarImage src={userAvatar} alt={userName} />
        <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
      </Avatar>
      <div className="grid text-left text-sm leading-tight">
        <span className="max-w-[160px] truncate font-medium">{userName}</span>
        <span className="max-w-[160px] truncate text-xs text-muted-foreground">
          {userEmail}
        </span>
      </div>
      <ChevronsUpDown className="size-4 text-muted-foreground" />
    </Button>
  );

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Building2 className="size-4" />
          </div>
          <span className="hidden md:inline font-bold text-lg">J-Node Sales</span>
        </Link>

        {userProfile ? (
          <UserMenuDropdown
            user={{ name: userName, email: userEmail, avatar: userAvatar }}
            side="bottom"
            align="end"
            trigger={userTriggerButton}
          />
        ) : (
          <Button asChild size="sm">
            <Link href="/auth/login">Iniciar sesión</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
