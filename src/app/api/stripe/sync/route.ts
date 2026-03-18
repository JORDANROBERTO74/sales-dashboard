import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  getStripeAccountByExternalId,
  getStripeAccounts,
  type StripeAccountConfig,
} from "@/lib/stripe/client";
import {
  mapPaymentIntentObjectToTransaction,
  upsertStripeTransaction,
} from "@/lib/stripe/transactions";

type UserWithRole = {
  roles?: { role_name?: string }[] | { role_name?: string } | null;
};

type SyncRequestBody = {
  accountExternalId?: string;
};

function getRoleName(profile: UserWithRole | null): string | null {
  if (!profile?.roles) return null;
  if (Array.isArray(profile.roles)) {
    return profile.roles[0]?.role_name ?? null;
  }
  return profile.roles.role_name ?? null;
}

async function assertAdminOrOwner() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      `
      roles:role_id (
        role_name
      )
    `
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false as const, status: 500, error: profileError.message };
  }

  const roleName = getRoleName(profile as UserWithRole | null);
  if (roleName !== "admin" && roleName !== "owner") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const };
}

async function parseSyncRequestBody(
  request: Request
): Promise<{ ok: true; body: SyncRequestBody } | { ok: false; error: string }> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return { ok: true, body: {} };
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        error: "Invalid request body. Expected JSON object.",
      };
    }

    const accountExternalId = (parsed as { accountExternalId?: unknown })
      .accountExternalId;
    if (
      accountExternalId !== undefined &&
      typeof accountExternalId !== "string"
    ) {
      return {
        ok: false,
        error: "Invalid accountExternalId. Expected string.",
      };
    }

    return {
      ok: true,
      body: {
        accountExternalId: accountExternalId?.trim() || undefined,
      },
    };
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }
}

function getTargetAccounts(
  accountExternalId: string | undefined
):
  | { ok: true; accounts: StripeAccountConfig[]; scope: "single" | "all" }
  | { ok: false; error: string } {
  if (!accountExternalId) {
    return {
      ok: true,
      accounts: getStripeAccounts(),
      scope: "all",
    };
  }

  const account = getStripeAccountByExternalId(accountExternalId);
  if (!account) {
    return {
      ok: false,
      error: `Unknown or unconfigured accountExternalId: ${accountExternalId}`,
    };
  }

  return {
    ok: true,
    accounts: [account],
    scope: "single",
  };
}

export async function POST(request: Request) {
  const authorization = await assertAdminOrOwner();
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const parsedBody = await parseSyncRequestBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const requestedAccountExternalId = parsedBody.body.accountExternalId;
  const targetAccounts = getTargetAccounts(requestedAccountExternalId);
  if (!targetAccounts.ok) {
    return NextResponse.json({ error: targetAccounts.error }, { status: 400 });
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  const perAccount: Array<{
    externalId: string;
    synced: number;
    skipped: number;
    errors: number;
  }> = [];

  try {
    for (const account of targetAccounts.accounts) {
      let synced = 0;
      let skipped = 0;
      let errors = 0;
      let hasMore = true;
      let startingAfter: string | undefined = undefined;

      while (hasMore) {
        const page: Stripe.ApiList<Stripe.PaymentIntent> =
          await account.client.paymentIntents.list({
            limit: 100,
            starting_after: startingAfter,
            expand: ["data.latest_charge.balance_transaction"],
          });

        for (const paymentIntent of page.data) {
          if (paymentIntent.status !== "succeeded") {
            skipped += 1;
            continue;
          }

          try {
            const transaction = await mapPaymentIntentObjectToTransaction(
              paymentIntent,
              account.client
            );

            if (!transaction) {
              skipped += 1;
              continue;
            }

            await upsertStripeTransaction(transaction, account.externalId);
            synced += 1;
          } catch {
            errors += 1;
          }
        }

        const lastId: string | undefined = page.data.at(-1)?.id;
        hasMore = page.has_more && Boolean(lastId);
        startingAfter = lastId;
      }

      perAccount.push({
        externalId: account.externalId,
        synced,
        skipped,
        errors,
      });
      totalSynced += synced;
      totalSkipped += skipped;
    }

    return NextResponse.json(
      {
        ok: true,
        scope: targetAccounts.scope,
        requestedAccountExternalId,
        synced: totalSynced,
        skipped: totalSkipped,
        accounts: perAccount,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
