import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export default async function AdminDashboardPage() {
  await requireAnyRole(
    [
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.SELLER,
      UserRole.ANALYST,
      UserRole.VIEWER,
    ],
    {
      redirectTo: "/auth/login",
      unauthorizedRedirectTo: "/auth/unauthorized",
    }
  );

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <DashboardPanel />
    </div>
  );
}







