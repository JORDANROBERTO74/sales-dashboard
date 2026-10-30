import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const TRANSACTIONS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

export default async function AdminTransactionsPage() {
  await requireAnyRole(TRANSACTIONS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("stripe_accounts")
    .select("stripe_account_external_id, display_name, is_active")
    .eq("is_active", true)
    .order("display_name");

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold">Transacciones</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona la cuenta Stripe que quieres gestionar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(accounts ?? []).map((account) => (
          <Card key={account.stripe_account_external_id}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle>{account.display_name}</CardTitle>
              </div>
              <CardDescription>
                Ver transacciones de la cuenta Stripe {account.display_name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Link href={`/admin/transactions/${account.stripe_account_external_id}`}>
                  Ir a {account.display_name}
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
