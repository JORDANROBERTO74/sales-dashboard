"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { GalleryVerticalEnd, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

// Route to display name mapping
const routeLabels: Record<string, string> = {
  "": "Dashboard",
  // Admin routes
  admin: "Administración",
  products: "Productos",
  categories: "Categorías",
  orders: "Órdenes",
  transactions: "Transacciones",
  payouts: "Retiros",
  balances: "Saldo",
  branches: "Sucursales",
  inventory: "Inventario",
  configuration: "Configuración",
  jnode: "JNode",
  vascruz: "Vascruz",
  details: "Detalles",
  // Settings
  settings: "Configuración",
  profile: "Mi perfil",
  team: "Equipo",
  "payment-methods": "Métodos de pago",
  new: "Nuevo",
  edit: "Editar",
};

function looksLikeUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    segment
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  // Determine context (admin or ecommerce)
  const isAdminRoute = pathname.startsWith("/admin");

  // Don't show header on auth pages (clients and admin) or public ecommerce pages
  const isAuthPage = pathname.startsWith("/auth");
  const isAdminAuthPage = pathname.startsWith("/admin/auth");
  const isPublicEcommercePage = pathname === "/" || !isAdminRoute;

  if (isAuthPage || isAdminAuthPage || isPublicEcommercePage) {
    return null;
  }

  // Generate breadcrumbs automatically from route
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbs: Array<{ label: string; href?: string }> = [];
  const breadcrumbSegments = pathname === "/" ? [] : (isAdminRoute ? segments.slice(1) : segments);

  const isPayoutDetailRoute =
    isAdminRoute &&
    breadcrumbSegments.length === 2 &&
    breadcrumbSegments[0] === "payouts" &&
    looksLikeUuid(breadcrumbSegments[1] ?? "");

  if (isPayoutDetailRoute) {
    breadcrumbs.push(
      { label: routeLabels.balances, href: "/admin/balances" },
      { label: routeLabels.payouts, href: "/admin/balances/payouts" },
      { label: breadcrumbSegments[1] as string },
    );
  } else {
    let currentPath = isAdminRoute ? "/admin" : "";
    breadcrumbSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      // Last element should not have href
      if (index === breadcrumbSegments.length - 1) {
        breadcrumbs.push({ label });
      } else {
        breadcrumbs.push({ label, href: currentPath });
      }
    });
  }

  // Desktop-only breadcrumb collapsing rules
  const MAX_VISIBLE_ITEMS = 4;
  const shouldCollapse = breadcrumbs.length > MAX_VISIBLE_ITEMS;

  // Determine which items to show
  let visibleBreadcrumbs: Array<{
    label: string;
    href?: string;
    isEllipsis?: boolean;
  }> = [];

  if (shouldCollapse) {
    const first = breadcrumbs[0];
    const last = breadcrumbs[breadcrumbs.length - 1];
    const secondToLast = breadcrumbs[breadcrumbs.length - 2];

    // Desktop: first, ellipsis, second-to-last (if different), last
    if (secondToLast && secondToLast.href !== first.href) {
      visibleBreadcrumbs = [
        first, // First element
        { label: "...", isEllipsis: true }, // Ellipsis
        secondToLast, // Second to last
        last, // Last (current page)
      ];
    } else {
      // If second-to-last equals first, show only first, ellipsis, last
      visibleBreadcrumbs = [
        first, // First element
        { label: "...", isEllipsis: true }, // Ellipsis
        last, // Last (current page)
      ];
    }
  } else {
    // Show all if few items
    visibleBreadcrumbs = breadcrumbs;
  }

  if (pathname === "/") {
    visibleBreadcrumbs = [{ label: "Dashboard" }];
  }

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 shrink-0 items-center border-b bg-background px-4 md:sticky md:z-10 md:gap-2 md:transition-[width,height] md:ease-linear md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center justify-between md:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
            <GalleryVerticalEnd className="size-4" />
          </div>
          <span className="truncate font-semibold text-sm">J-Node Sales</span>
        </Link>
        <Button variant="ghost" size="icon" className="size-9" onClick={toggleSidebar}>
          <Menu className="size-5" />
          <span className="sr-only">Abrir menú lateral</span>
        </Button>
      </div>

      <div className="hidden w-full items-center gap-2 md:flex">
        <SidebarTrigger className="-ml-1" />
        <div className="h-6">
          <Separator orientation="vertical" className="mr-2 h-6" />
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {visibleBreadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.isEllipsis ? (
                    <BreadcrumbEllipsis />
                  ) : item.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < visibleBreadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
