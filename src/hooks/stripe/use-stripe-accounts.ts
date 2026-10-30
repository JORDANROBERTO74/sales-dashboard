"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type StripeAccount = {
  stripe_account_external_id: string;
  display_name: string;
  is_active: boolean;
};

export function useStripeAccounts() {
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("stripe_accounts")
      .select("stripe_account_external_id, display_name, is_active")
      .eq("is_active", true)
      .order("display_name")
      .then(({ data, error }: { data: StripeAccount[] | null; error: unknown }) => {
        if (!error && data) {
          setAccounts(data);
        }
        setLoading(false);
      });
  }, []);

  return { accounts, loading };
}
