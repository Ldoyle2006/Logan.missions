import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { createRecurringDonationSubscription } from "./stripe-donations.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(root, "public");
const rateLimitWindowMs = 15 * 60 * 1000;
const rateLimitMax = 5;
const subscribeRequests = new Map();
const checkoutRequests = new Map();
const processedStripeEventIds = new Set();
let stripe = null;

await loadEnvironmentFile();
const configuredStripeMode = process.env.STRIPE_MODE || "test";
const liveModeApproved = process.env.STRIPE_LIVE_MODE_APPROVED === "true";
const expectedSecretPrefix = configuredStripeMode === "live" ? "sk_live_" : "sk_test_";
if (
  (configuredStripeMode === "test" || configuredStripeMode === "live" && liveModeApproved) &&
  process.env.STRIPE_SECRET_KEY?.startsWith(expectedSecretPrefix)
) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}
const port = Number(process.env.PORT || 3000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.stripe.com https://m.stripe.network https://r.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; form-action 'self'; base-uri 'self'; frame-ancestors 'none'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.PUBLIC_BASE_URL?.startsWith("https://")) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function isRateLimited(requests, ip, limit = rateLimitMax, now = Date.now()) {
  for (const [address, entry] of requests) {
    if (entry.resetAt <= now) requests.delete(address);
  }

  const entry = requests.get(ip);
  if (!entry || entry.resetAt <= now) {
    requests.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function readRawBody(request, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function subscribe(request, response) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    return sendJson(response, 415, { message: "Please submit the signup form normally." });
  }

  const origin = request.headers.origin;
  if (origin) {
    let originUrl;
    try {
      originUrl = new URL(origin);
    } catch {
      return sendJson(response, 403, { message: "This signup request could not be verified." });
    }
    const requestHost = request.headers.host;
    const forwardedProtocol = request.headers["x-forwarded-proto"]?.split(",")[0].trim().toLowerCase();
    if (
      !requestHost ||
      !["http:", "https:"].includes(originUrl.protocol) ||
      originUrl.host.toLowerCase() !== requestHost.toLowerCase() ||
      (forwardedProtocol && `${forwardedProtocol}:` !== originUrl.protocol)
    ) {
      return sendJson(response, 403, { message: "This signup request could not be verified." });
    }
  }

  if (isRateLimited(subscribeRequests, request.socket.remoteAddress || "unknown")) {
    return sendJson(response, 429, { message: "Too many attempts. Please try again later." });
  }

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(response, 400, { message: "Please check the signup form and try again." });
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return sendJson(response, 400, { message: "Please check the signup form and try again." });
  }
  if (typeof body.consent !== "boolean" || !body.consent) {
    return sendJson(response, 400, { message: "Please confirm that you want to receive email updates." });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    firstName.length > 80
  ) {
    return sendJson(response, 400, { message: "Enter a valid email address and try again." });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!apiKey || !Number.isInteger(listId) || listId < 1) {
    return sendJson(response, 503, {
      message: "Email signup is not set up yet. Please try again later.",
    });
  }
  const attributes = firstName ? { FIRSTNAME: firstName } : {};
  let providerResponse;
  try {
    providerResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [listId],
        updateEnabled: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("Brevo signup request failed:", error.message);
    return sendJson(response, 502, {
      message: "Signup could not be completed. Please try again later.",
    });
  }

  if (!providerResponse.ok) {
    const errorBody = await providerResponse.text();
    let errorCode;
    try {
      errorCode = JSON.parse(errorBody).code;
    } catch {
      errorCode = "";
    }
    if (providerResponse.status === 409 || errorCode === "duplicate_parameter") {
      return sendJson(response, 200, {
        message: "This email is already on the update list. Thank you!",
      });
    }
    console.error("Brevo signup request returned HTTP", providerResponse.status);
    return sendJson(response, 502, {
      message: "Signup could not be completed. Please try again later.",
    });
  }

  return sendJson(response, 200, {
    message: providerResponse.status === 204
      ? "Your email was already on the update list. Thank you!"
      : "You’re on the update list. Thank you for signing up.",
  });
}

function publicSiteOrigin() {
  try {
    const siteUrl = new URL(process.env.PUBLIC_BASE_URL);
    const isLocalHttp = siteUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname);
    if (
      (siteUrl.protocol !== "https:" && !isLocalHttp) ||
      siteUrl.username ||
      siteUrl.password
    ) {
      return null;
    }
    return siteUrl.origin;
  } catch {
    return null;
  }
}

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const forwardedProtocol = request.headers["x-forwarded-proto"]?.split(",")[0].trim().toLowerCase();
    return originUrl.host.toLowerCase() === request.headers.host?.toLowerCase() &&
      ["http:", "https:"].includes(originUrl.protocol) &&
      (!forwardedProtocol || `${forwardedProtocol}:` === originUrl.protocol);
  } catch {
    return false;
  }
}

function stripeConfiguration() {
  const mode = process.env.STRIPE_MODE || "test";
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const expectedSecretPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  const expectedPublishablePrefix = mode === "live" ? "pk_live_" : "pk_test_";
  if (
    !["test", "live"].includes(mode) ||
    (mode === "live" && !liveModeApproved) ||
    !stripe ||
    !secretKey.startsWith(expectedSecretPrefix) ||
    !publishableKey.startsWith(expectedPublishablePrefix) ||
    !webhookSecret.startsWith("whsec_") ||
    !publicSiteOrigin()
  ) {
    return null;
  }
  return { mode, publishableKey };
}

async function createDonationIntent(request, response) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    return sendJson(response, 415, { message: "Please try your donation again." });
  }
  if (!hasSameOrigin(request)) {
    return sendJson(response, 403, { message: "This donation request could not be verified." });
  }
  if (isRateLimited(checkoutRequests, request.socket.remoteAddress || "unknown", 10)) {
    return sendJson(response, 429, { message: "Too many donation attempts. Please try again later." });
  }

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(response, 400, { message: "Please choose a valid gift amount and schedule." });
  }

  const amountInCents = typeof body.amount === "number" ? Math.round(body.amount * 100) : 0;
  const schedule = body.schedule;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    body.amount < 5 ||
    body.amount > 999999.99 ||
    !Number.isSafeInteger(amountInCents) ||
    Math.abs(body.amount * 100 - amountInCents) > 0.000001 ||
    !["one-time", "bi-weekly", "monthly"].includes(schedule) ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    return sendJson(response, 400, { message: "Enter a valid email and gift amount of at least $5." });
  }

  const configuration = stripeConfiguration();
  if (!configuration) {
    return sendJson(response, 503, { message: "Stripe payment collection is not configured for this mode." });
  }

  const description = schedule === "one-time"
    ? "One-time mission support for Logan Doyle"
    : `${schedule === "monthly" ? "Monthly" : "Every-two-weeks"} mission support for Logan Doyle`;
  const metadata = {
    donation_schedule: schedule,
    integration: `elements_${configuration.mode}`,
  };

  try {
    if (schedule === "one-time") {
      const intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        receipt_email: email,
        description,
        metadata,
        automatic_payment_methods: { enabled: true },
      }, { idempotencyKey: `donation-intent-${requestId}` });
      if (!intent.client_secret) {
        throw new Error("Stripe did not return a payment client secret.");
      }
      return sendJson(response, 200, {
        clientSecret: intent.client_secret,
        publishableKey: configuration.publishableKey,
      });
    }

    const subscription = await createRecurringDonationSubscription(stripe, {
      amountInCents,
      email,
      mode: configuration.mode,
      requestId,
      schedule,
    });
    return sendJson(response, 200, {
      clientSecret: subscription.clientSecret,
      publishableKey: configuration.publishableKey,
      subscriptionId: subscription.subscriptionId,
      subscriptionStatus: subscription.subscriptionStatus,
    });
  } catch (error) {
    console.error("Stripe Elements intent creation failed:", error.message);
    return sendJson(response, 502, {
      message: "Secure payment could not be prepared. Please try again.",
    });
  }
}

function logStripeEvent(event) {
  const object = event.data.object;
  const mode = event.livemode ? "live" : "test";
  if (event.type === "payment_intent.succeeded") {
    console.info(`Stripe ${mode} payment confirmed`, {
      eventId: event.id,
      paymentIntentId: object.id,
      amount: object.amount,
      currency: object.currency,
    });
  } else if (event.type === "payment_intent.payment_failed") {
    console.info(`Stripe ${mode} payment failed`, {
      eventId: event.id,
      paymentIntentId: object.id,
      amount: object.amount,
      currency: object.currency,
      failureCode: object.last_payment_error?.code || null,
    });
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subscriptionId = typeof object.subscription === "string"
      ? object.subscription
      : object.parent?.subscription_details?.subscription || null;
    console.info(event.type === "invoice.paid" ? `Stripe ${mode} subscription payment confirmed` : `Stripe ${mode} subscription payment failed`, {
      eventId: event.id,
      invoiceId: object.id,
      subscriptionId,
      amount: object.amount_paid ?? object.amount_due,
    });
  } else if (event.type === "invoice.payment_action_required") {
    console.info(`Stripe ${mode} subscription payment requires customer action`, {
      eventId: event.id,
      invoiceId: object.id,
      subscriptionId: typeof object.subscription === "string" ? object.subscription : null,
    });
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    console.info(`Stripe ${mode} subscription changed`, {
      eventId: event.id,
      subscriptionId: object.id,
      status: object.status,
      currentPeriodEnd: object.current_period_end,
    });
  }
}

function isSupportedStripeEvent(type) {
  return [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.payment_action_required",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ].includes(type);
}

async function receiveStripeWebhook(request, response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const configuration = stripeConfiguration();
  if (!configuration || !webhookSecret.startsWith("whsec_")) {
    return sendJson(response, 503, { message: "Stripe webhooks are not configured." });
  }
  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return sendJson(response, 400, { message: "Missing Stripe signature." });
  }

  let event;
  try {
    const rawBody = await readRawBody(request);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn("Stripe webhook verification failed:", error.message);
    return sendJson(response, error.statusCode || 400, { message: "Invalid Stripe webhook." });
  }
  if (event.livemode !== (configuration.mode === "live")) {
    console.warn(`Rejected a Stripe webhook event that does not match configured ${configuration.mode} mode.`);
    return sendJson(response, 400, { message: "Stripe event mode does not match the configured mode." });
  }

  if (isSupportedStripeEvent(event.type)) {
    if (processedStripeEventIds.has(event.id)) {
      return sendJson(response, 200, { received: true, duplicate: true });
    }
    processedStripeEventIds.add(event.id);
    if (processedStripeEventIds.size > 10000) {
      processedStripeEventIds.delete(processedStripeEventIds.values().next().value);
    }
    logStripeEvent(event);
  }
  return sendJson(response, 200, { received: true });
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
  }[extension] || "application/octet-stream";
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Invalid path.");
    return;
  }

  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(404).end("Not found.");
    return;
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      response.writeHead(404).end("Not found.");
      return;
    }
    throw error;
  }
  if (!fileInfo.isFile()) {
    response.writeHead(404).end("Not found.");
    return;
  }

  const content = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
  response.end(content);
}

async function handleRequest(request, response) {
  setSecurityHeaders(response);
  const requestUrl = new URL(request.url || "/", "http://localhost");

  if (requestUrl.pathname === "/api/config" && request.method === "GET") {
    const configuration = stripeConfiguration();
    return sendJson(response, 200, {
      donationsConfigured: Boolean(configuration),
      stripePublishableKey: configuration?.publishableKey || null,
      stripeMode: configuration?.mode || null,
    });
  }

  if (requestUrl.pathname === "/api/create-donation-intent" && request.method === "POST") {
    return createDonationIntent(request, response);
  }

  if (requestUrl.pathname === "/api/stripe-webhook" && request.method === "POST") {
    return receiveStripeWebhook(request, response);
  }

  if (
    (requestUrl.pathname === "/api/newsletter" || requestUrl.pathname === "/api/subscribe") &&
    request.method === "POST"
  ) {
    return subscribe(request, response);
  }

  if (requestUrl.pathname === "/donate" && request.method === "GET") {
    const paymentLink = process.env.STRIPE_PAYMENT_LINK_URL;
    if (!paymentLink) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Donations are not configured yet. Please check back soon.");
      return;
    }

    let paymentUrl;
    try {
      paymentUrl = new URL(paymentLink);
    } catch {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The donation link is not configured correctly.");
      return;
    }
    if (
      paymentUrl.protocol !== "https:" ||
      paymentUrl.hostname !== "buy.stripe.com" ||
      !paymentUrl.pathname.startsWith("/test_")
    ) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Only a Stripe test-mode donation link is available.");
      return;
    }
    response.writeHead(303, { Location: paymentUrl.toString(), "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD, POST" }).end("Method not allowed.");
    return;
  }

  return serveStatic(request, response, requestUrl.pathname);
}

async function loadEnvironmentFile() {
  try {
    const content = await readFile(path.join(root, ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        message: error.statusCode ? error.message : "The request could not be completed.",
      });
    } else {
      response.destroy();
    }
  });
});

server.listen(port, () => {
  console.log(`Mission update site is listening on port ${port}.`);
});
