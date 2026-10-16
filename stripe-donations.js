const recurringProductMetadata = {
  integration: "logan_missions",
  purpose: "recurring_donations",
};

export async function getRecurringDonationProduct(stripe) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((item) =>
    item.metadata?.integration === recurringProductMetadata.integration &&
    item.metadata?.purpose === recurringProductMetadata.purpose
  );
  if (!product) {
    product = await stripe.products.create({
      name: "Mission support for Logan Doyle",
      description: "Mission support for Logan Doyle",
      metadata: recurringProductMetadata,
    }, { idempotencyKey: "logan-missions-recurring-product-v1" });
  }
  return product.id;
}

export async function createDonationCheckoutSession(stripe, {
  amountInCents,
  email,
  mode,
  requestId,
  schedule,
  siteOrigin,
}) {
  if (
    !stripe ||
    !Number.isSafeInteger(amountInCents) ||
    amountInCents < 500 ||
    amountInCents > 99999999 ||
    !["one-time", "monthly", "bi-weekly"].includes(schedule) ||
    !["test", "live"].includes(mode) ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    throw new Error("Invalid donation checkout details.");
  }

  let origin;
  try {
    origin = new URL(siteOrigin);
  } catch {
    throw new Error("A valid donation return URL is required.");
  }
  const isLocalHttp = origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    (origin.protocol !== "https:" && !isLocalHttp) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("A secure donation return URL is required.");
  }

  const productId = await getRecurringDonationProduct(stripe);
  const description = schedule === "one-time"
    ? "One-time mission support for Logan Doyle"
    : `${schedule === "monthly" ? "Monthly" : "Every-two-weeks"} mission support for Logan Doyle`;
  const metadata = {
    purpose: "general_support",
    donation_schedule: schedule,
    integration: `checkout_${mode}`,
  };
  const priceData = {
    currency: "usd",
    product: productId,
    unit_amount: amountInCents,
  };
  if (schedule === "monthly") {
    priceData.recurring = { interval: "month" };
  } else if (schedule === "bi-weekly") {
    priceData.recurring = { interval: "week", interval_count: 2 };
  }

  const sessionParams = {
    mode: schedule === "one-time" ? "payment" : "subscription",
    customer_email: email,
    line_items: [{ price_data: priceData, quantity: 1 }],
    success_url: new URL("/giving.html?donation=success", origin).toString(),
    cancel_url: new URL("/giving.html?donation=cancelled", origin).toString(),
    metadata,
  };

  if (schedule === "one-time") {
    sessionParams.payment_intent_data = {
      description,
      receipt_email: email,
      metadata,
    };
  } else {
    sessionParams.subscription_data = { metadata };
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `donation-checkout-${mode}-${requestId}`,
  });
  if (!session || typeof session.url !== "string") {
    throw new Error("Stripe did not return a Checkout URL.");
  }

  const checkoutUrl = new URL(session.url);
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
    throw new Error("Stripe returned an invalid Checkout URL.");
  }

  return { checkoutUrl: checkoutUrl.toString() };
}
