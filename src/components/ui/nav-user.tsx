"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getUserInitials,
  UserMenuDropdown,
} from "@/components/user/user-menu-dropdown";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { setOpenMobile } = useSidebar();
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const initials = getUserInitials(user.name, user.email);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobileLayout(mq.matches);
    const onChange = () => setIsMobileLayout(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserMenuDropdown
          user={user}
          onNavigate={handleLinkClick}
          side={isMobileLayout ? "top" : "right"}
          align="end"
          contentClassName="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg p-1"
          trigger={
            <SidebarMenuButton
              size="lg"
              tooltip={{
                children: (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs opacity-80">{user.email}</span>
                  </div>
                ),
              }}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
