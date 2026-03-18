"use client";

import { useState } from "react";
import { PayoutsPanel } from "@/components/payouts/payouts-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PayoutAccountTab = "jnode" | "vascruz";

export function PayoutsTabs() {
  const [tab, setTab] = useState<PayoutAccountTab>("jnode");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as PayoutAccountTab)}>
      <TabsList>
        <TabsTrigger value="jnode">Retiros JNode</TabsTrigger>
        <TabsTrigger value="vascruz">Retiros Vascruz</TabsTrigger>
      </TabsList>

      <TabsContent value="jnode">
        <PayoutsPanel accountExternalId="acct_jnode" accountLabel="JNode" />
      </TabsContent>

      <TabsContent value="vascruz">
        <PayoutsPanel accountExternalId="acct_vascruz" accountLabel="Vascruz" />
      </TabsContent>
    </Tabs>
  );
}
