"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSyncStripeTransactions } from "@/hooks/transactions/use-transactions";
import { useUser } from "@/hooks/auth/use-user";

type SyncTransactionsButtonProps = {
  accountExternalId?: string;
};

export function SyncTransactionsButton({
  accountExternalId,
}: SyncTransactionsButtonProps) {
  const { data: user } = useUser();
  const syncMutation = useSyncStripeTransactions(accountExternalId);
  const isAdminLike = user?.role === "owner" || user?.role === "admin";

  return (
    <>
      {isAdminLike ? <Button
        className="w-full sm:w-auto"
        variant="outline"
        onClick={() => syncMutation.mutate(undefined)}
        disabled={syncMutation.isPending || !isAdminLike}
      >
        {syncMutation.isPending ? (
          <span className="inline-flex items-center gap-2">
            <Spinner />
            Sincronizando...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <RefreshCcw className="size-4" />
            Sincronizar Stripe
          </span>
        )}
      </Button> : null}
    </>
  );
}
