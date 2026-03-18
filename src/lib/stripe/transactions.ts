import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type StripeTransactionType =
  | "payment_intent"
  | "charge"
  | "checkout_session"
  | "invoice"
  | "subscription";

export type StripeTransactionPayload = {
  stripe_id: string;
  transaction_type: StripeTransactionType;
  stripe_status: string;
  amount: number;
  currency: "usd";
  stripe_fee: number;
  net_amount: number;
  stripe_customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  description: string | null;
  payment_method_type: string | null;
  stripe_product_id: string | null;
  stripe_created_at: string | null;
  funds_available_at: string | null;
  metadata: Record<string, unknown>;
};

export type StripeTransactionInsert = StripeTransactionPayload & {
  stripe_account_id: string;
};

type CustomerSnapshot = {
  id: string | null;
  email: string | null;
  name: string | null;
};

type LegacyInvoiceLinks = {
  charge?: string | Stripe.Charge | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

type MappingContext = {
  ingestionSource: "webhook" | "sync";
  eventType?: string;
  eventId?: string;
};

const USD = "usd";

function toIsoTimestamp(epochSeconds?: number | null): string | null {
  if (!epochSeconds) return null;
  return new Date(epochSeconds * 1000).toISOString();
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function extractProductIdFromUnknown(product: unknown): string | null {
  if (!product) return null;
  if (typeof product === "string" && product.startsWith("prod_")) return product;
  if (
    typeof product === "object" &&
    "id" in product &&
    typeof (product as { id?: unknown }).id === "string"
  ) {
    const id = (product as { id: string }).id;
    return id.startsWith("prod_") ? id : null;
  }
  return null;
}

function getProductIdFromMetadata(metadata: Record<string, unknown>): string | null {
  const direct = metadata.stripe_product_id ?? metadata.product_id;
  if (typeof direct !== "string") return null;
  return direct.startsWith("prod_") ? direct : null;
}

function withIngestionMetadata(
  metadata: Record<string, unknown>,
  context: MappingContext
): Record<string, unknown> {
  return {
    ...metadata,
    _ingestion: {
      source: context.ingestionSource,
      event_type: context.eventType ?? null,
      event_id: context.eventId ?? null,
      processed_at: new Date().toISOString(),
    },
  };
}

function isUsdCurrency(currency?: string | null): currency is "usd" {
  return (currency || "").toLowerCase() === USD;
}

async function fetchCustomerSnapshot(
  stripe: Stripe,
  customerId: string | null
): Promise<CustomerSnapshot> {
  if (!customerId) {
    return { id: null, email: null, name: null };
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return { id: customerId, email: null, name: null };
    }

    return {
      id: customer.id,
      email: customer.email || null,
      name: customer.name || null,
    };
  } catch {
    return { id: customerId, email: null, name: null };
  }
}

async function resolveBalanceTransactionFromCharge(
  stripe: Stripe,
  charge: Stripe.Charge | null
): Promise<Stripe.BalanceTransaction | null> {
  if (!charge || !charge.balance_transaction) return null;

  if (typeof charge.balance_transaction !== "string") {
    return charge.balance_transaction;
  }

  try {
    return await stripe.balanceTransactions.retrieve(charge.balance_transaction);
  } catch {
    return null;
  }
}

async function resolveChargeFromPaymentIntent(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent
): Promise<Stripe.Charge | null> {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;

  if (typeof latestCharge !== "string") {
    return latestCharge;
  }

  try {
    const charge = await stripe.charges.retrieve(latestCharge, {
      expand: ["balance_transaction"],
    });
    return charge;
  } catch {
    return null;
  }
}

async function resolveChargeFromPaymentIntentId(
  stripe: Stripe,
  paymentIntentId: string
): Promise<Stripe.Charge | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    return resolveChargeFromPaymentIntent(stripe, paymentIntent);
  } catch {
    return null;
  }
}

async function resolveChargeForInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<Stripe.Charge | null> {
  const links = invoice as Stripe.Invoice & LegacyInvoiceLinks;

  if (links.charge) {
    if (typeof links.charge !== "string") {
      return links.charge;
    }
    try {
      return await stripe.charges.retrieve(links.charge, {
        expand: ["balance_transaction"],
      });
    } catch {
      return null;
    }
  }

  if (links.payment_intent) {
    const paymentIntentId =
      typeof links.payment_intent === "string"
        ? links.payment_intent
        : links.payment_intent.id;
    return resolveChargeFromPaymentIntentId(stripe, paymentIntentId);
  }

  return null;
}

async function resolveProductIdFromCheckoutSession(
  stripe: Stripe,
  sessionId: string
): Promise<string | null> {
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 1,
      expand: ["data.price.product"],
    });
    const product = lineItems.data[0]?.price?.product;
    return extractProductIdFromUnknown(product);
  } catch {
    return null;
  }
}

async function resolveProductIdFromInvoice(
  stripe: Stripe,
  invoiceId: string
): Promise<string | null> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["lines.data.price.product"],
    });
    const firstLine = invoice.lines?.data?.[0] as
      | {
          price?: { product?: unknown };
          pricing?: { price_details?: { product?: unknown } };
        }
      | undefined;
    const product =
      firstLine?.price?.product ?? firstLine?.pricing?.price_details?.product;
    return extractProductIdFromUnknown(product);
  } catch {
    return null;
  }
}

async function resolveProductIdFromSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<string | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product"],
    });
    const product = subscription.items.data[0]?.price?.product;
    return extractProductIdFromUnknown(product);
  } catch {
    return null;
  }
}

function buildFinancialSnapshot(
  amount: number,
  balanceTransaction: Stripe.BalanceTransaction | null
) {
  const stripeFee = clampNonNegative(balanceTransaction?.fee ?? 0);
  const netAmount = clampNonNegative(
    balanceTransaction?.net ?? amount - stripeFee
  );
  const fundsAvailableAt = toIsoTimestamp(balanceTransaction?.available_on);

  return { stripeFee, netAmount, fundsAvailableAt };
}

async function mapChargeToTransaction(
  charge: Stripe.Charge,
  stripe: Stripe,
  context: MappingContext
): Promise<StripeTransactionPayload | null> {
  if (!isUsdCurrency(charge.currency)) return null;

  const balanceTransaction = await resolveBalanceTransactionFromCharge(
    stripe,
    charge
  );
  const financial = buildFinancialSnapshot(charge.amount, balanceTransaction);
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  const customer = await fetchCustomerSnapshot(stripe, customerId || null);

  const metadata = asRecord(charge.metadata);
  const linkedInvoiceId =
    typeof (charge as { invoice?: unknown }).invoice === "string"
      ? ((charge as { invoice?: string }).invoice ?? null)
      : null;
  const stripeProductId = linkedInvoiceId
    ? await resolveProductIdFromInvoice(stripe, linkedInvoiceId)
    : getProductIdFromMetadata(metadata);

  return {
    stripe_id: charge.id,
    transaction_type: "charge",
    stripe_status: charge.status || "unknown",
    amount: charge.amount,
    currency: "usd",
    stripe_fee: financial.stripeFee,
    net_amount: financial.netAmount,
    stripe_customer_id: customer.id,
    customer_email:
      charge.billing_details?.email || charge.receipt_email || customer.email,
    customer_name: charge.billing_details?.name || customer.name,
    description: charge.description || null,
    payment_method_type: charge.payment_method_details?.type || null,
    stripe_product_id: stripeProductId,
    stripe_created_at: toIsoTimestamp(charge.created),
    funds_available_at: financial.fundsAvailableAt,
    metadata: withIngestionMetadata(metadata, context),
  };
}

async function mapPaymentIntentToTransaction(
  paymentIntent: Stripe.PaymentIntent,
  stripe: Stripe,
  context: MappingContext
): Promise<StripeTransactionPayload | null> {
  if (!isUsdCurrency(paymentIntent.currency)) return null;

  const charge = await resolveChargeFromPaymentIntent(stripe, paymentIntent);
  const balanceTransaction = await resolveBalanceTransactionFromCharge(
    stripe,
    charge
  );
  const financial = buildFinancialSnapshot(paymentIntent.amount, balanceTransaction);
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;
  const customer = await fetchCustomerSnapshot(stripe, customerId || null);

  const metadata = asRecord(paymentIntent.metadata);
  const stripeProductId = getProductIdFromMetadata(metadata);

  return {
    stripe_id: paymentIntent.id,
    transaction_type: "payment_intent",
    stripe_status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: "usd",
    stripe_fee: financial.stripeFee,
    net_amount: financial.netAmount,
    stripe_customer_id: customer.id,
    customer_email: paymentIntent.receipt_email || customer.email,
    customer_name: paymentIntent.shipping?.name || customer.name,
    description: paymentIntent.description || null,
    payment_method_type:
      charge?.payment_method_details?.type ||
      paymentIntent.payment_method_types?.[0] ||
      null,
    stripe_product_id: stripeProductId,
    stripe_created_at: toIsoTimestamp(paymentIntent.created),
    funds_available_at: financial.fundsAvailableAt,
    metadata: withIngestionMetadata(metadata, context),
  };
}

async function mapCheckoutSessionToTransaction(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  context: MappingContext
): Promise<StripeTransactionPayload | null> {
  if (!isUsdCurrency(session.currency)) return null;

  const amount = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const charge = paymentIntentId
    ? await resolveChargeFromPaymentIntentId(stripe, paymentIntentId)
    : null;
  const balanceTransaction = await resolveBalanceTransactionFromCharge(
    stripe,
    charge
  );
  const financial = buildFinancialSnapshot(amount, balanceTransaction);
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const customer = await fetchCustomerSnapshot(stripe, customerId || null);

  const metadata = asRecord(session.metadata);
  const stripeProductId =
    (await resolveProductIdFromCheckoutSession(stripe, session.id)) ??
    getProductIdFromMetadata(metadata);

  return {
    stripe_id: session.id,
    transaction_type: "checkout_session",
    stripe_status: session.status || session.payment_status || "unknown",
    amount,
    currency: "usd",
    stripe_fee: financial.stripeFee,
    net_amount: financial.netAmount,
    stripe_customer_id: customer.id,
    customer_email: session.customer_details?.email || customer.email,
    customer_name: session.customer_details?.name || customer.name,
    description: session.client_reference_id || null,
    payment_method_type: charge?.payment_method_details?.type || null,
    stripe_product_id: stripeProductId,
    stripe_created_at: toIsoTimestamp(session.created),
    funds_available_at: financial.fundsAvailableAt,
    metadata: withIngestionMetadata(metadata, context),
  };
}

async function mapInvoiceToTransaction(
  invoice: Stripe.Invoice,
  stripe: Stripe,
  context: MappingContext
): Promise<StripeTransactionPayload | null> {
  if (!isUsdCurrency(invoice.currency)) return null;

  const amount = invoice.amount_paid || invoice.amount_due || 0;
  const charge = await resolveChargeForInvoice(stripe, invoice);
  const balanceTransaction = await resolveBalanceTransactionFromCharge(
    stripe,
    charge
  );
  const financial = buildFinancialSnapshot(amount, balanceTransaction);
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  const customer = await fetchCustomerSnapshot(stripe, customerId || null);

  const metadata = asRecord(invoice.metadata);
  const stripeProductId =
    (await resolveProductIdFromInvoice(stripe, invoice.id)) ??
    getProductIdFromMetadata(metadata);

  return {
    stripe_id: invoice.id,
    transaction_type: "invoice",
    stripe_status: invoice.status || "unknown",
    amount,
    currency: "usd",
    stripe_fee: financial.stripeFee,
    net_amount: financial.netAmount,
    stripe_customer_id: customer.id,
    customer_email: invoice.customer_email || customer.email,
    customer_name: customer.name,
    description: invoice.description || null,
    payment_method_type:
      charge?.payment_method_details?.type ||
      invoice.payment_settings?.payment_method_types?.[0] ||
      null,
    stripe_product_id: stripeProductId,
    stripe_created_at: toIsoTimestamp(invoice.created),
    funds_available_at: financial.fundsAvailableAt,
    metadata: withIngestionMetadata(metadata, context),
  };
}

async function mapSubscriptionToTransaction(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  context: MappingContext
): Promise<StripeTransactionPayload | null> {
  if (!isUsdCurrency(subscription.currency)) return null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const customer = await fetchCustomerSnapshot(stripe, customerId || null);

  const metadata = asRecord(subscription.metadata);
  const stripeProductId =
    (await resolveProductIdFromSubscription(stripe, subscription.id)) ??
    getProductIdFromMetadata(metadata);

  return {
    stripe_id: subscription.id,
    transaction_type: "subscription",
    stripe_status: subscription.status,
    amount: 0,
    currency: "usd",
    stripe_fee: 0,
    net_amount: 0,
    stripe_customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.name,
    description: subscription.description || null,
    payment_method_type:
      subscription.default_payment_method &&
      typeof subscription.default_payment_method !== "string"
        ? subscription.default_payment_method.type
        : null,
    stripe_product_id: stripeProductId,
    stripe_created_at: toIsoTimestamp(subscription.created),
    funds_available_at: null,
    metadata: withIngestionMetadata(metadata, context),
  };
}

export async function mapStripeEventToTransaction(
  event: Stripe.Event,
  stripe: Stripe
): Promise<StripeTransactionPayload | null> {
  const context: MappingContext = {
    ingestionSource: "webhook",
    eventType: event.type,
    eventId: event.id,
  };

  switch (event.type) {
    case "payment_intent.succeeded":
      return mapPaymentIntentToTransaction(
        event.data.object as Stripe.PaymentIntent,
        stripe,
        context
      );
    case "charge.succeeded":
      return mapChargeToTransaction(
        event.data.object as Stripe.Charge,
        stripe,
        context
      );
    case "checkout.session.completed":
      return mapCheckoutSessionToTransaction(
        event.data.object as Stripe.Checkout.Session,
        stripe,
        context
      );
    case "invoice.paid":
      return mapInvoiceToTransaction(
        event.data.object as Stripe.Invoice,
        stripe,
        context
      );
    case "customer.subscription.created":
      return mapSubscriptionToTransaction(
        event.data.object as Stripe.Subscription,
        stripe,
        context
      );
    default:
      return null;
  }
}

export async function mapPaymentIntentObjectToTransaction(
  paymentIntent: Stripe.PaymentIntent,
  stripe: Stripe
) {
  return mapPaymentIntentToTransaction(paymentIntent, stripe, {
    ingestionSource: "sync",
    eventType: "sync.payment_intent",
  });
}

const stripeAccountIdCache = new Map<string, string>();

async function resolveStripeAccountIdByExternalId(
  stripeAccountExternalId: string
): Promise<string> {
  const cached = stripeAccountIdCache.get(stripeAccountExternalId);
  if (cached) return cached;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stripe_accounts")
    .select("id")
    .eq("stripe_account_external_id", stripeAccountExternalId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to resolve stripe_account_id for ${stripeAccountExternalId}: ${error.message}`
    );
  }

  if (!data?.id) {
    throw new Error(
      `stripe_accounts mapping not found for external id: ${stripeAccountExternalId}`
    );
  }

  stripeAccountIdCache.set(stripeAccountExternalId, data.id);
  return data.id;
}

export async function upsertStripeTransaction(
  transaction: StripeTransactionPayload,
  stripeAccountExternalId: string
) {
  const supabase = createAdminClient();
  const stripeAccountId = await resolveStripeAccountIdByExternalId(
    stripeAccountExternalId
  );
  const transactionInsert: StripeTransactionInsert = {
    ...transaction,
    stripe_account_id: stripeAccountId,
    metadata: {
      ...transaction.metadata,
      _account: {
        external_id: stripeAccountExternalId,
      },
    },
  };

  const { error } = await supabase
    .from("stripe_transactions")
    .upsert(transactionInsert, { onConflict: "stripe_account_id,stripe_id" });

  if (error) {
    throw new Error(`Failed to upsert stripe transaction: ${error.message}`);
  }
}
