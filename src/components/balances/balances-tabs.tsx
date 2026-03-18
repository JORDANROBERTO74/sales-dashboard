"use client";

import { useState } from "react";
import { BalancesPanel } from "@/components/balances/balances-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BalanceAccountTab = "jnode" | "vascruz";

export function BalancesTabs() {
  const [tab, setTab] = useState<BalanceAccountTab>("jnode");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as BalanceAccountTab)}>
      <TabsList>
        <TabsTrigger value="jnode">General JNode</TabsTrigger>
        <TabsTrigger value="vascruz">General Vascruz</TabsTrigger>
      </TabsList>

      <TabsContent value="jnode">
        <BalancesPanel accountExternalId="acct_jnode" accountLabel="JNode" />
      </TabsContent>

      <TabsContent value="vascruz">
        <BalancesPanel accountExternalId="acct_vascruz" accountLabel="Vascruz" />
      </TabsContent>
    </Tabs>
  );
}
