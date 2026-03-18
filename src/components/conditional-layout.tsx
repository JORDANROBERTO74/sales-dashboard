"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { AppHeader } from "@/components/ui/app-header";

export function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminAuthRoute = pathname.startsWith("/admin/auth");
  const isAdminOnboardingRoute = pathname.startsWith("/admin/onboarding");
  const isAuthRoute = pathname.startsWith("/auth");

  // Auth pages (/auth, /admin/auth), onboarding, and ecommerce public pages: no sidebar/header
  if (isAuthRoute || isAdminAuthRoute || isAdminOnboardingRoute || !isAdminRoute) {
    return <>{children}</>;
  }

  // Admin pages: show sidebar and header.
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="pt-16 md:pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
