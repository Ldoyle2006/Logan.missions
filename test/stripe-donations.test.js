import test from "node:test";
import assert from "node:assert/strict";
import { createRecurringDonationSubscription } from "../stripe-donations.js";

function createStripeStub() {
  const calls = { productsList: [], productsCreate: [], customersCreate: [], subscriptionsCreate: [] };
  const stripe = {
    products: {
      async list(params) {
        calls.productsList.push(params);
        return { data: [] };
      },
      async create(params, options) {
        calls.productsCreate.push({ params, options });
        return { id: "prod_mission_support", ...params };
      },
    },
    customers: {
      async create(params, options) {
        calls.customersCreate.push({ params, options });
        return { id: "cus_test_donor" };
      },
    },
    subscriptions: {
      async create(params, options) {
        calls.subscriptionsCreate.push({ params, options });
        return {
          id: "sub_test_donation",
          status: "incomplete",
          latest_invoice: {
            confirmation_secret: { client_secret: "pi_test_secret_sample" },
          },
        };
      },
    },
  };
  return { calls, stripe };
}

for (const [schedule, amountInCents, recurring] of [
  ["monthly", 5000, { interval: "month" }],
  ["bi-weekly", 10000, { interval: "week", interval_count: 2 }],
]) {
  test(`creates an incomplete ${schedule} subscription with a confirmable invoice`, async () => {
    const { calls, stripe } = createStripeStub();
    const result = await createRecurringDonationSubscription(stripe, {
      amountInCents,
      email: "donor@example.com",
      mode: "test",
      requestId: "00000000-0000-4000-8000-000000000001",
      schedule,
    });

    const subscription = calls.subscriptionsCreate[0].params;
    assert.equal(calls.productsCreate[0].params.name, "Mission support for Logan Doyle");
    assert.equal(subscription.items[0].price_data.product, "prod_mission_support");
    assert.equal(subscription.items[0].price_data.unit_amount, amountInCents);
    assert.deepEqual(subscription.items[0].price_data.recurring, recurring);
    assert.equal(subscription.payment_behavior, "default_incomplete");
    assert.deepEqual(subscription.expand, ["latest_invoice.confirmation_secret"]);
    assert.equal(result.clientSecret, "pi_test_secret_sample");
    assert.equal(result.subscriptionId, "sub_test_donation");
    assert.equal(result.subscriptionStatus, "incomplete");
  });
}

test("reuses the existing recurring donations product", async () => {
  const { calls, stripe } = createStripeStub();
  stripe.products.list = async (params) => {
    calls.productsList.push(params);
    return {
      data: [{
        id: "prod_existing",
        metadata: { integration: "logan_missions", purpose: "recurring_donations" },
      }],
    };
  };
  await createRecurringDonationSubscription(stripe, {
    amountInCents: 2500,
    email: "donor@example.com",
    mode: "test",
    requestId: "00000000-0000-4000-8000-000000000002",
    schedule: "monthly",
  });

  assert.equal(calls.productsCreate.length, 0);
  assert.equal(calls.subscriptionsCreate[0].params.items[0].price_data.product, "prod_existing");
});

test("does not claim a subscription is payable without an invoice client secret", async () => {
  const { stripe } = createStripeStub();
  stripe.subscriptions.create = async () => ({
    id: "sub_test_donation",
    status: "incomplete",
    latest_invoice: { confirmation_secret: null },
  });

  await assert.rejects(
    createRecurringDonationSubscription(stripe, {
      amountInCents: 5000,
      email: "donor@example.com",
      mode: "test",
      requestId: "00000000-0000-4000-8000-000000000003",
      schedule: "monthly",
    }),
    /invoice client secret/,
  );
});
