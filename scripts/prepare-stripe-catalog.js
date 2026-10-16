import Stripe from "stripe";
import { writeFile, mkdir } from "node:fs/promises";
import { getSchoolDonationProduct } from "../stripe-school-products.js";
import { getRecurringDonationProduct } from "../stripe-donations.js";
import { SCHOOL_DEFAULTS } from "../school-store.js";

process.loadEnvFile();
const mode = process.env.STRIPE_MODE || "test";
if (!["test", "live"].includes(mode) || !process.env.STRIPE_SECRET_KEY?.startsWith(`sk_${mode}_`)) {
  throw new Error("Configure the Stripe secret key for the selected mode first.");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
const account = await stripe.accounts.retrieve();
const catalog = [{ fund: "general_support", name: "Mission support for Logan Doyle",
  schedules: ["one-time", "monthly", "bi-weekly"], productId: await getRecurringDonationProduct(stripe) }];
for (const school of SCHOOL_DEFAULTS) catalog.push({ fund: school.id, name: school.name,
  schedules: ["one-time"], productId: await getSchoolDonationProduct(stripe, school.id) });
await mkdir(".local", { recursive: true });
await writeFile(`.local/stripe-catalog-${mode}.json`, JSON.stringify({ accountId: account.id, mode, catalog }, null, 2));
console.log(JSON.stringify({ mode, accountId: account.id, catalog }, null, 2));
