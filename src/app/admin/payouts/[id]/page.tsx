import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PayoutDetail } from "@/components/payouts/payout-detail";
import { Button } from "@/components/ui/button";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

const PAYOUT_DETAIL_ALLOWED_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER];

export default async function AdminPayoutDetailPage({ params }: PageProps) {
  await requireAnyRole(PAYOUT_DETAIL_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const { id } = await params;

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/balances/payouts" aria-label="Volver a retiros">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Detalle de retiro</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Revisa estado, montos y datos operativos de este payout.
        </p>
      </div>

      <PayoutDetail payoutId={id} />
    </div>
  );
}
