import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeAccounts } from "@/lib/stripe/client";
import {
  mapStripeEventToTransaction,
  upsertStripeTransaction,
} from "@/lib/stripe/transactions";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const configuredAccounts = getStripeAccounts();
  if (!signature || configuredAccounts.length === 0) {
    return NextResponse.json(
      { error: "Missing webhook signature or account configuration" },
      { status: 400 }
    );
  }

  const payload = await request.text();
  let event: Stripe.Event | null = null;
  let matchedAccount = null as (typeof configuredAccounts)[number] | null;

  for (const account of configuredAccounts) {
    try {
      event = account.client.webhooks.constructEvent(
        payload,
        signature,
        account.webhookSecret
      );
      matchedAccount = account;
      break;
    } catch {
      // keep trying the next configured secret
    }
  }

  if (!event || !matchedAccount) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    const transaction = await mapStripeEventToTransaction(
      event,
      matchedAccount.client
    );
    if (transaction) {
      await upsertStripeTransaction(transaction, matchedAccount.externalId);
    }

    return NextResponse.json(
      { received: true, account: matchedAccount.externalId },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
