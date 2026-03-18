import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { TransactionDetailPageContent } from "@/components/transactions/transaction-detail-page-content";

type PageProps = {
  params: Promise<{ id: string }>;
};

const TRANSACTIONS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

export default async function AdminTransactionVascruzDetailPage({ params }: PageProps) {
  await requireAnyRole(TRANSACTIONS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const { id } = await params;

  return <TransactionDetailPageContent transactionId={id} backHref="/admin/transactions/vascruz" />;
}
