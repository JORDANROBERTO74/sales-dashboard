import Stripe from "stripe";

export type StripeAccountName = "A" | "B";

export type StripeAccountConfig = {
  name: StripeAccountName;
  externalId: string;
  secretKey: string;
  webhookSecret: string;
  client: Stripe;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function buildStripeAccountConfig(name: StripeAccountName): StripeAccountConfig {
  const externalId = requiredEnv(`STRIPE_ACCOUNT_${name}_EXTERNAL_ID`);
  const secretKey = requiredEnv(`STRIPE_ACCOUNT_${name}_SECRET_KEY`);
  const webhookSecret = requiredEnv(`STRIPE_ACCOUNT_${name}_WEBHOOK_SECRET`);

  return {
    name,
    externalId,
    secretKey,
    webhookSecret,
    client: new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    }),
  };
}

const stripeAccounts: StripeAccountConfig[] = [
  buildStripeAccountConfig("A"),
  buildStripeAccountConfig("B"),
];

export function getStripeAccounts(): StripeAccountConfig[] {
  return stripeAccounts;
}

export function getStripeClientsByAccount(): Record<string, Stripe> {
  return Object.fromEntries(stripeAccounts.map((account) => [account.externalId, account.client]));
}

export function getStripeAccountByExternalId(
  externalId: string
): StripeAccountConfig | null {
  return stripeAccounts.find((account) => account.externalId === externalId) ?? null;
}

export function getStripeClientByExternalId(externalId: string): Stripe {
  const account = getStripeAccountByExternalId(externalId);
  if (!account) {
    throw new Error(`Stripe account not configured for external id: ${externalId}`);
  }
  return account.client;
}

export function getStripeAccountByWebhookSecret(
  webhookSecret: string
): StripeAccountConfig | null {
  return (
    stripeAccounts.find((account) => account.webhookSecret === webhookSecret) ?? null
  );
}
