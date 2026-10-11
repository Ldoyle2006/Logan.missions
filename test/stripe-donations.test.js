import test from "node:test";
import assert from "node:assert/strict";
import { createDonationCheckoutSession } from "../stripe-donations.js";

function createStripeStub() {
  const calls = {
    productsList: [],
    productsCreate: [],
    checkoutSessionsCreate: [],
  };
  const stripe = {
    products: {
      async list(params) {
        calls.productsList.push(params);
        return {
          data: [{
            id: "prod_mission_support",
            metadata: { integration: "logan_missions", purpose: "recurring_donations" },
          }],
        };
      },
      async create(params, options) {
        calls.productsCreate.push({ params, options });
        return { id: "prod_mission_support", ...params };
      },
    },
    checkout: {
      sessions: {
        async create(params, options) {
          calls.checkoutSessionsCreate.push({ params, options });
          return {
            id: "cs_test_donation",
            url: "https://checkout.stripe.com/c/pay/cs_test_donation",
          };
        },
      },
    },
  };
  return { calls, stripe };
}

const presetAmountsInCents = [2500, 5000, 7500, 10000, 25000, 50000];
const schedules = [
  ["one-time", "payment", undefined],
  ["monthly", "subscription", { interval: "month" }],
  ["bi-weekly", "subscription", { interval: "week", interval_count: 2 }],
];

for (const amountInCents of [...presetAmountsInCents, 1755]) {
  for (const [schedule, checkoutMode, recurring] of schedules) {
    test(`creates a ${schedule} Checkout Session for $${(amountInCents / 100).toFixed(2)}`, async () => {
      const { calls, stripe } = createStripeStub();
      const result = await createDonationCheckoutSession(stripe, {
        amountInCents,
        email: "donor@example.com",
        mode: "test",
        requestId: "00000000-0000-4000-8000-000000000001",
        schedule,
        siteOrigin: "https://missions.example",
      });

      const { params, options } = calls.checkoutSessionsCreate[0];
      assert.equal(params.mode, checkoutMode);
      assert.equal(params.customer_email, "donor@example.com");
      assert.equal(params.line_items[0].price_data.product, "prod_mission_support");
      assert.equal(params.line_items[0].price_data.unit_amount, amountInCents);
      assert.equal(params.line_items[0].price_data.currency, "usd");
      assert.equal(params.line_items[0].quantity, 1);
      assert.deepEqual(params.line_items[0].price_data.recurring, recurring);
      assert.equal(params.metadata.donation_schedule, schedule);
      assert.equal(params.metadata.integration, "checkout_test");
      assert.equal(params.success_url, "https://missions.example/giving.html?donation=success");
      assert.equal(params.cancel_url, "https://missions.example/giving.html?donation=cancelled");
      assert.equal(options.idempotencyKey, "donation-checkout-test-00000000-0000-4000-8000-000000000001");
      assert.equal(result.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_donation");

      if (schedule === "one-time") {
        assert.equal(params.payment_intent_data.receipt_email, "donor@example.com");
        assert.equal(params.payment_intent_data.metadata.donation_schedule, schedule);
        assert.equal(params.subscription_data, undefined);
      } else {
        assert.equal(params.subscription_data.metadata.donation_schedule, schedule);
        assert.equal(params.payment_intent_data, undefined);
      }
      assert.equal(calls.productsCreate.length, 0);
    });
  }
}

test("creates the reusable mission support product when one does not exist", async () => {
  const { calls, stripe } = createStripeStub();
  stripe.products.list = async (params) => {
    calls.productsList.push(params);
    return { data: [] };
  };

  await createDonationCheckoutSession(stripe, {
    amountInCents: 2500,
    email: "donor@example.com",
    mode: "test",
    requestId: "00000000-0000-4000-8000-000000000002",
    schedule: "one-time",
    siteOrigin: "http://localhost:3000",
  });

  assert.equal(calls.productsCreate.length, 1);
  assert.equal(calls.productsCreate[0].params.name, "Mission support for Logan Doyle");
  assert.equal(calls.productsCreate[0].options.idempotencyKey, "logan-missions-recurring-product-v1");
});

test("rejects invalid donation details before contacting Stripe", async () => {
  const { calls, stripe } = createStripeStub();

  await assert.rejects(
    createDonationCheckoutSession(stripe, {
      amountInCents: 499,
      email: "not-an-email",
      mode: "test",
      requestId: "invalid",
      schedule: "yearly",
      siteOrigin: "https://missions.example",
    }),
    /Invalid donation checkout details/,
  );
  assert.equal(calls.productsList.length, 0);
  assert.equal(calls.checkoutSessionsCreate.length, 0);
});

test("rejects non-HTTPS public return origins outside localhost", async () => {
  const { calls, stripe } = createStripeStub();

  await assert.rejects(
    createDonationCheckoutSession(stripe, {
      amountInCents: 2500,
      email: "donor@example.com",
      mode: "test",
      requestId: "00000000-0000-4000-8000-000000000003",
      schedule: "one-time",
      siteOrigin: "http://missions.example",
    }),
    /secure donation return URL/,
  );
  assert.equal(calls.productsList.length, 0);
});

test("rejects missing or non-Stripe Checkout URLs", async () => {
  const { stripe } = createStripeStub();
  stripe.checkout.sessions.create = async () => ({
    id: "cs_test_invalid",
    url: "https://example.com/pay",
  });

  await assert.rejects(
    createDonationCheckoutSession(stripe, {
      amountInCents: 2500,
      email: "donor@example.com",
      mode: "test",
      requestId: "00000000-0000-4000-8000-000000000004",
      schedule: "one-time",
      siteOrigin: "https://missions.example",
    }),
    /invalid Checkout URL/,
  );

  stripe.checkout.sessions.create = async () => ({ id: "cs_test_missing_url" });
  await assert.rejects(
    createDonationCheckoutSession(stripe, {
      amountInCents: 2500,
      email: "donor@example.com",
      mode: "test",
      requestId: "00000000-0000-4000-8000-000000000005",
      schedule: "one-time",
      siteOrigin: "https://missions.example",
    }),
    /did not return a Checkout URL/,
  );
});
