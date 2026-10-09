const recurringProductMetadata = {
  integration: "logan_missions",
  purpose: "recurring_donations",
};

async function getRecurringDonationProduct(stripe) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((item) =>
    item.metadata?.integration === recurringProductMetadata.integration &&
    item.metadata?.purpose === recurringProductMetadata.purpose
  );
  if (!product) {
    product = await stripe.products.create({
      name: "Mission support for Logan Doyle",
      description: "Recurring missionary support",
      metadata: recurringProductMetadata,
    }, { idempotencyKey: "logan-missions-recurring-product-v1" });
  }
  return product.id;
}

export async function createRecurringDonationSubscription(stripe, {
  amountInCents,
  email,
  mode,
  requestId,
  schedule,
}) {
  const productId = await getRecurringDonationProduct(stripe);
  const customer = await stripe.customers.create({
    email,
    metadata: { integration: `elements_${mode}` },
  }, { idempotencyKey: `donation-customer-${requestId}` });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{
      price_data: {
        currency: "usd",
        product: productId,
        unit_amount: amountInCents,
        recurring: schedule === "monthly"
          ? { interval: "month" }
          : { interval: "week", interval_count: 2 },
      },
    }],
    collection_method: "charge_automatically",
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: {
      donation_schedule: schedule,
      integration: `elements_${mode}`,
    },
    expand: ["latest_invoice.confirmation_secret"],
  }, { idempotencyKey: `donation-subscription-${requestId}` });
  const latestInvoice = subscription.latest_invoice;
  const clientSecret = latestInvoice &&
    typeof latestInvoice === "object" &&
    latestInvoice.confirmation_secret?.client_secret;
  if (typeof clientSecret !== "string") {
    throw new Error("Stripe did not return the subscription invoice client secret.");
  }

  return {
    clientSecret,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  };
}
