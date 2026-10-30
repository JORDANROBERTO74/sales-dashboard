"use client";

import { useState } from "react";
import { BalancesPanel } from "@/components/balances/balances-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStripeAccounts } from "@/hooks/stripe/use-stripe-accounts";

export function BalancesTabs() {
  const { accounts, loading } = useStripeAccounts();
  const [tab, setTab] = useState<string>(
    accounts[0]?.stripe_account_external_id ?? "",
  );

  if (loading) {
    return <div className="p-4">Cargando cuentas Stripe...</div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">
        No hay cuentas Stripe configuradas. Agrega una desde Configuracion.
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        {accounts.map((account) => (
          <TabsTrigger
            key={account.stripe_account_external_id}
            value={account.stripe_account_external_id}
          >
            {account.display_name}
          </TabsTrigger>
        ))}
      </TabsList>
      {accounts.map((account) => (
        <TabsContent
          key={account.stripe_account_external_id}
          value={account.stripe_account_external_id}
        >
          <BalancesPanel
            accountExternalId={account.stripe_account_external_id}
            accountLabel={account.display_name}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
