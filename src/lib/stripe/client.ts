import Stripe from "stripe";

export type StripeAccountConfig = {
  name: string;
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

function buildStripeAccountConfig(
  name: string,
  envPrefix: string,
): StripeAccountConfig {
  const externalId = requiredEnv(`${envPrefix}_EXTERNAL_ID`);
  const secretKey = requiredEnv(`${envPrefix}_SECRET_KEY`);
  const webhookSecret = requiredEnv(`${envPrefix}_WEBHOOK_SECRET`);

  return {
    name,
    externalId,
    secretKey,
    webhookSecret,
    client: new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    }),
  };
}

const stripeAccounts: StripeAccountConfig[] = [
  buildStripeAccountConfig("Account A", "STRIPE_ACCOUNT_A"),
  buildStripeAccountConfig("Account B", "STRIPE_ACCOUNT_B"),
];

export function getStripeAccounts(): StripeAccountConfig[] {
  return stripeAccounts;
}

export function getStripeClientsByAccount(): Record<string, Stripe> {
  return Object.fromEntries(
    stripeAccounts.map((account) => [account.externalId, account.client]),
  );
}

export function getStripeAccountByExternalId(
  externalId: string,
): StripeAccountConfig | null {
  return (
    stripeAccounts.find((account) => account.externalId === externalId) ?? null
  );
}

export function getStripeClientByExternalId(externalId: string): Stripe {
  const account = getStripeAccountByExternalId(externalId);
  if (!account) {
    throw new Error(
      `Stripe account not configured for external id: ${externalId}`,
    );
  }
  return account.client;
}

export function getStripeAccountByWebhookSecret(
  webhookSecret: string,
): StripeAccountConfig | null {
  return (
    stripeAccounts.find((account) => account.webhookSecret === webhookSecret) ??
    null
  );
}
