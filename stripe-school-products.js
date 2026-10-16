import { SCHOOL_DEFAULTS } from "./school-store.js";

// One reusable Stripe Product per designated school keeps the dashboard catalog
// organized while each donor can still choose a different gift amount.
export async function getSchoolDonationProduct(stripe, schoolId) {
  const school = SCHOOL_DEFAULTS.find(item => item.id === schoolId);
  if (!school) throw new Error("Unknown school fund.");
  let startingAfter;
  do {
    const page = await stripe.products.list({ active: true, limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}) });
    const product = page.data.find(item => item.metadata?.integration === "logan_missions" &&
      item.metadata?.purpose === "school" && item.metadata?.school_id === school.id);
    if (product) return product.id;
    startingAfter = page.has_more && page.data.length ? page.data.at(-1).id : undefined;
  } while (startingAfter);
  const product = await stripe.products.create({
    name: school.name,
    description: `Designated ministry training fund for Logan Doyle — ${school.name}`,
    metadata: { integration: "logan_missions", purpose: "school", school_id: school.id },
  }, { idempotencyKey: `logan-missions-school-product-${school.id}-v1` });
  return product.id;
}
