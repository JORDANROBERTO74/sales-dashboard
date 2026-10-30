import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { TransactionDetailPageContent } from "@/components/transactions/transaction-detail-page-content";

const TRANSACTIONS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

type PageProps = {
  params: Promise<{ accountExternalId: string; id: string }>;
};

export default async function AdminTransactionAccountDetailPage({
  params,
}: PageProps) {
  await requireAnyRole(TRANSACTIONS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const { id, accountExternalId } = await params;

  return <TransactionDetailPageContent transactionId={id} backHref={`/admin/transactions/${accountExternalId}`} />;
}
