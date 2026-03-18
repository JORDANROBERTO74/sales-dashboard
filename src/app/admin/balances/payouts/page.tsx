import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PayoutsTabs } from "@/components/payouts/payouts-tabs";
import { Button } from "@/components/ui/button";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";

const PAYOUTS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

export default async function AdminBalancesPayoutsPage() {
  await requireAnyRole(PAYOUTS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/balances" aria-label="Volver a saldos">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Retiros</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gestiona retiros por cuenta Stripe y revisa su estado operativo.
        </p>
      </div>
      <PayoutsTabs />
    </div>
  );
}
