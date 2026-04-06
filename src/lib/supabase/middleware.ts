import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "@/lib/utils";
import { isValidRedirectPath, getSafeRedirectPath } from "@/lib/utils/redirect";

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/sign-up",
  "/auth/error",
  "/auth/sign-up-success",
  "/auth/unauthorized",
  "/api/auth/confirm",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/invite-password",
  "/auth/reset-password",
];

/**
 * Ecommerce public routes (no require authentication)
 */
const ECOMMERCE_PUBLIC_ROUTES = [
  "/", // Home/Landing
  "/payment-methods",
  "/services",
  "/branches",
  "/contact",
  "/cart",
  "/checkout",
  "/search",
  "/offers",
  "/new-arrivals",
  // Note: /product and /categories are handled by regex below for dynamic routes
  // but if we want the list pages to be public:
  "/categories",
];

/**
 * Admin routes (require authentication)
 */
const ADMIN_ROUTES = ["/admin"];

const ADMIN_ALLOWED_ROLES = new Set([
  "owner",
  "admin",
  "seller",
  "analyst",
  "viewer",
]);

/**
 * Checks if a pathname is a public route (auth or ecommerce)
 */
function isPublicRoute(pathname: string): boolean {
  // Exact match for root path
  if (pathname === "/") return true;

  // Check if it's an auth route
  if (PUBLIC_ROUTES.some((route) => matchesRouteOrSubpath(pathname, route))) {
    return true;
  }

  // Check if it's an ecommerce public route
  if (
    ECOMMERCE_PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return true;
  }

  // Check if it's a dynamic product route (e.g., /product/[id])
  if (pathname.match(/^\/product\/[^/]+$/)) {
    return true;
  }

  // Check if it's a dynamic category route (e.g., /categories/[slug])
  if (pathname.match(/^\/categories\/[^/]+$/)) {
    return true;
  }

  return false;
}

/**
 * Checks if a pathname is an admin route
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => matchesRouteOrSubpath(pathname, route));
}

function matchesRouteOrSubpath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function getPathWithSearch(pathname: string, search: string): string {
  return `${pathname}${search ?? ""}`;
}

function normalizeBusinessRole(role: unknown): string | null {
  if (typeof role !== "string") return null;
  const normalizedRole = role.trim().toLowerCase();
  if (!normalizedRole || normalizedRole === "authenticated") return null;
  return ADMIN_ALLOWED_ROLES.has(normalizedRole) ? normalizedRole : null;
}

function getClaimRole(
  claims: Record<string, unknown> | null | undefined,
): string | null {
  if (!claims) return null;

  const appMetadata = claims.app_metadata;
  const appMetadataRole =
    appMetadata && typeof appMetadata === "object" && "role" in appMetadata
      ? (appMetadata as { role?: unknown }).role
      : null;

  // Prefer app_metadata.role for business auth decisions.
  const metadataBusinessRole = normalizeBusinessRole(appMetadataRole);
  if (metadataBusinessRole) {
    return metadataBusinessRole;
  }

  // Fallback to top-level claims.role only if it maps to a business role.
  return normalizeBusinessRole(claims.role);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicRoute(pathname);

  // Validate environment variables
  // In production, this should fail if env vars are missing
  if (!hasEnvVars) {
    if (process.env.NODE_ENV === "production") {
      console.error("Missing Supabase environment variables in production!");
      // In production, return error response instead of bypassing
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
    // In development: if protected route and no env vars, still redirect to login
    // This ensures protection works even without Supabase configured
    if (!isPublic) {
      console.warn(
        "[Middleware] ⚠️  Supabase env vars missing - redirecting protected route to login",
      );
      const url = request.nextUrl.clone();
      // Admin and private routes use the shared auth login.
      url.pathname = "/auth/login";
      const redirectPath = getPathWithSearch(pathname, request.nextUrl.search);
      if (isValidRedirectPath(redirectPath)) {
        url.searchParams.set("redirectTo", redirectPath);
      }
      return NextResponse.redirect(url);
    }
    // Allow public routes through even without env vars
    return supabaseResponse;
  }

  // At this point, we know env vars exist, but TypeScript doesn't know
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Double-check (should never happen if hasEnvVars is correct, but TypeScript safety)
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing!");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  try {
    const { data, error: claimsError } = await supabase.auth.getClaims();
    const user = data?.claims;

    // If there's an error getting claims, treat as unauthenticated
    if (claimsError) {
      console.error("[Middleware] Error getting claims:", claimsError.message);
      // Continue to check if route needs protection
    }

    // Check if route requires authentication.
    const requiresAuth = isAdminRoute(pathname);

    // Redirect unauthenticated users to login (only for protected routes)
    if (!user && !isPublic && requiresAuth) {
      const url = request.nextUrl.clone();

      // Admin and private routes use the shared auth login.
      url.pathname = "/auth/login";

      // Save the original URL as a query parameter for post-login redirect
      // Only save if it's a valid internal path
      const redirectPath = getPathWithSearch(pathname, request.nextUrl.search);
      if (isValidRedirectPath(redirectPath)) {
        url.searchParams.set("redirectTo", redirectPath);
      }

      const redirectResponse = NextResponse.redirect(url);

      // IMPORTANT: Copy cookies from supabaseResponse to maintain session sync
      // This ensures Supabase session cookies are preserved during redirect
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectResponse;
    }

    // Middleware-level admin gate (best-effort): enforce only when role is present in claims.
    // Definitive authorization must still be checked server-side in admin pages/components.
    if (user && isAdminRoute(pathname)) {
      const claimRole = getClaimRole(user as Record<string, unknown>);

      if (claimRole && !ADMIN_ALLOWED_ROLES.has(claimRole)) {
        const unauthorizedUrl = request.nextUrl.clone();
        unauthorizedUrl.pathname = "/auth/unauthorized";
        unauthorizedUrl.searchParams.delete("redirectTo");
        const unauthorizedResponse = NextResponse.redirect(unauthorizedUrl);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          unauthorizedResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return unauthorizedResponse;
      }
    }

    // Check onboarding status for authenticated users
    if (user && pathname !== "/admin/onboarding" && !isPublic) {
      const { data: profile } = await supabase
        .from("users")
        .select("onboarding_completed")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profile && !profile.onboarding_completed) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = "/admin/onboarding";
        const redirectResponse = NextResponse.redirect(onboardingUrl);
        // Copy cookies to maintain session sync
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
    }

    // Redirect authenticated users away from auth pages (except error and unauthorized)
    if (
      user &&
      matchesRouteOrSubpath(pathname, "/auth") &&
      !pathname.includes("/error") &&
      !pathname.includes("/unauthorized") &&
      pathname !== "/auth/update-password" &&
      pathname !== "/auth/invite-password" &&
      pathname !== "/auth/reset-password"
    ) {
      const redirectToParam = request.nextUrl.searchParams.get("redirectTo");

      // Validate redirectTo to prevent open redirect vulnerabilities
      // Default redirect based on context
      const defaultRedirect =
        redirectToParam && isAdminRoute(redirectToParam)
          ? "/admin/dashboard"
          : "/";

      const redirectTo = getSafeRedirectPath(redirectToParam, defaultRedirect);

      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.delete("redirectTo");

      const redirectResponse = NextResponse.redirect(url);

      // Copy cookies to maintain session sync
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectResponse;
    }
  } catch (error) {
    // Log error but don't break the request flow
    // This allows the request to continue even if auth check fails
    console.error("[Middleware] Error checking authentication:", error);

    // If it's a public route, allow it through
    const errorPathname = request.nextUrl.pathname;
    const isPublic = isPublicRoute(errorPathname);
    const requiresAuth = isAdminRoute(errorPathname);

    if (!isPublic && requiresAuth) {
      // For protected routes, redirect to appropriate login on error
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      const redirectPath = getPathWithSearch(
        errorPathname,
        request.nextUrl.search,
      );
      if (isValidRedirectPath(redirectPath)) {
        url.searchParams.set("redirectTo", redirectPath);
      }
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
