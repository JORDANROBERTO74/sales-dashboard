import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { TransactionsPanel } from "@/components/transactions/transactions-panel";
import { SyncTransactionsButton } from "@/components/transactions/sync-transactions-button";

const TRANSACTIONS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

export default async function AdminTransactionsVascruzPage() {
  await requireAnyRole(TRANSACTIONS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9">
              <Link href="/admin/transactions" aria-label="Volver a transacciones">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-xl md:text-2xl font-bold">Transacciones - Vascruz</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Revisa transacciones, asigna ventas a sellers y sincroniza datos desde Stripe.
          </p>
        </div>
        <SyncTransactionsButton accountExternalId="acct_vascruz" />
      </div>
      <TransactionsPanel accountExternalId="acct_vascruz" accountRouteSegment="vascruz" />
    </div>
  );
}
