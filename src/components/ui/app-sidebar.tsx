"use client";

import {
  Wallet,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Store,
  Moon,
  Sun,
} from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { NavMain } from "@/components/ui/nav-main";
import { NavUser } from "@/components/ui/nav-user";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/auth/use-user";
import { getAdminNavForUser } from "@/lib/navigation/admin-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AppSidebarProps = React.ComponentProps<typeof Sidebar>;

const iconMap = {
  dashboard: LayoutDashboard,
  settings: Settings,
  transactions: ReceiptText,
  balances: Wallet,
} as const;

export function AppSidebar({ ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pathSegments = pathname.split("/");
  const pathLogin = pathSegments[1];
  const { setOpenMobile, state } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always call hooks at the top level (React rules)
  const { data: userProfile } = useUser();

  useEffect(() => {
    if (
      userProfile?.onboarding_completed === false &&
      pathname !== "/admin/onboarding"
    ) {
      router.replace("/admin/onboarding");
    }
  }, [userProfile?.onboarding_completed, pathname, router]);

  // Handler to close sidebar and navigate
  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  // Hide sidebar on auth pages (both /auth and /admin/auth) and ecommerce public pages
  // Show sidebar on admin pages.
  const isAdminAuthRoute = pathname.startsWith("/admin/auth");
  const isAdminRoute = pathname.startsWith("/admin");
  if (pathLogin === "auth" || isAdminAuthRoute || !isAdminRoute) {
    return null;
  }

  // Prepare user data with fallback
  const userData = {
    name:
      userProfile?.full_name || userProfile?.email?.split("@")[0] || "Usuario",
    email: userProfile?.email || "",
    avatar: userProfile?.avatar_url || "",
  };

  const navItems = getAdminNavForUser(userProfile ?? null);

  const itemsWithIcons = navItems.map((item) => ({
    ...item,
    icon: item.iconKey ? iconMap[item.iconKey] : undefined,
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center"
          onClick={handleLinkClick}
        >
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
            <Store className="size-4" />
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold text-sm">J-Node</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              Sales
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={itemsWithIcons} />
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-2">
        {mounted &&
          (state === "collapsed" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                  aria-label="Cambiar tema"
                >
                  {resolvedTheme === "light" ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {resolvedTheme === "light" ? "Tema oscuro" : "Tema claro"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Moon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium truncate">
                  Tema oscuro
                </span>
              </div>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
                aria-label="Cambiar tema"
              />
            </div>
          ))}
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
