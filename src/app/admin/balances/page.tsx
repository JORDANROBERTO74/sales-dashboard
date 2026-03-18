import { BalancesTabs } from "@/components/balances/balances-tabs";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";

const BALANCES_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

export default async function AdminBalancesPage() {
  await requireAnyRole(BALANCES_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold">Saldo</h1>
        <p className="text-sm text-muted-foreground">
          Revisa saldos por cuenta Stripe y su disponibilidad para retiro.
        </p>
      </div>
      <BalancesTabs />
    </div>
  );
}
