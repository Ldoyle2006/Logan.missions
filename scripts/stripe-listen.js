import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const values = Object.fromEntries((await readFile(envPath, "utf8")).split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]] : [];
}));
if ((values.STRIPE_MODE || "test") !== "test" || !values.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("Configure a Stripe test secret key before starting local webhook forwarding.");
}
const site = new URL(values.PUBLIC_BASE_URL || "http://localhost:3000");
if (site.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)) {
  throw new Error("This development listener requires a local HTTP site origin.");
}
await mkdir(path.join(root, ".local"), { recursive: true });
const child = spawn(process.execPath, [path.join(root, "node_modules/@stripe/cli/bin/shim.js"),
  "--config", path.join(root, ".local/stripe-cli.toml"), "listen", "--skip-update", "--events-from", "@self",
  "--forward-to", `${site.origin}/api/stripe-webhook`, "--events",
  "payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.succeeded,charge.updated,charge.refunded,refund.created,refund.updated,refund.failed,invoice.paid,invoice.payment_failed,invoice.payment_action_required,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted"],
{ cwd: root, windowsHide: true, env: { ...process.env, STRIPE_API_KEY: values.STRIPE_SECRET_KEY }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
let saved = false;
let saving = Promise.resolve();
function consume(chunk) {
  const text = chunk.toString();
  output = (output + text).slice(-8192);
  const secret = output.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if (secret && !saved) {
    saved = true;
    saving = (async () => {
      const current = await readFile(envPath, "utf8");
      const next = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(current)
        ? current.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, () => `STRIPE_WEBHOOK_SECRET=${secret}`)
        : `${current.trimEnd()}\nSTRIPE_WEBHOOK_SECRET=${secret}\n`;
      await writeFile(envPath, next);
      console.log("Local test webhook signing secret saved privately to .env. Restart the website after the listener is ready.");
    })().catch(() => { console.error("Could not save local webhook signing secret."); process.exitCode = 1; child.kill(); });
  }
  process.stdout.write(text.replace(/whsec_[A-Za-z0-9]+/g, "[saved privately]").replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+/g, "[private key]"));
}
child.stdout.on("data", consume);
child.stderr.on("data", consume);
child.on("error", () => { console.error("Stripe CLI could not start."); process.exitCode = 1; });
child.on("exit", async code => { await saving; process.exitCode ||= code || 0; });
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
