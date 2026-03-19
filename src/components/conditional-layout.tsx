"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { AppHeader } from "@/components/ui/app-header";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";

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
  const isPublicNonAdminNonAuth = !isAdminRoute && !isAuthRoute;

  // Auth pages (/auth, /admin/auth) and admin onboarding keep minimalist layout.
  if (isAuthRoute || isAdminAuthRoute || isAdminOnboardingRoute) {
    return <>{children}</>;
  }

  // Public pages (non-admin, non-auth): render landing header and footer.
  if (isPublicNonAdminNonAuth) {
    return (
      <>
        <LandingHeader />
        {children}
        <LandingFooter />
      </>
    );
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
