import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(root, "public");
const rateLimitWindowMs = 15 * 60 * 1000;
const rateLimitMax = 5;
const subscribeRequests = new Map();
const checkoutRequests = new Map();

await loadEnvironmentFile();
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
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'",
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

async function createCheckoutSession(request, response) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    return sendJson(response, 415, { message: "Please try checkout again." });
  }
  if (!hasSameOrigin(request)) {
    return sendJson(response, 403, { message: "This checkout request could not be verified." });
  }
  if (isRateLimited(checkoutRequests, request.socket.remoteAddress || "unknown", 10)) {
    return sendJson(response, 429, { message: "Too many checkout attempts. Please try again later." });
  }

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(response, 400, { message: "Please choose a valid gift amount and schedule." });
  }

  const amount = body.amount;
  const amountInCents = typeof amount === "number" ? Math.round(amount * 100) : 0;
  const schedule = body.schedule;
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 5 ||
    amount > 999999.99 ||
    !Number.isSafeInteger(amountInCents) ||
    Math.abs(amount * 100 - amountInCents) > 0.000001 ||
    !["one-time", "bi-weekly", "monthly"].includes(schedule)
  ) {
    return sendJson(response, 400, { message: "Choose a valid gift of at least $5 and select a giving schedule." });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  const siteOrigin = publicSiteOrigin();
  if (!apiKey || !siteOrigin) {
    return sendJson(response, 503, {
      message: "Secure donation checkout is not configured yet. Please try again later.",
    });
  }

  const sessionParameters = new URLSearchParams({
    mode: schedule === "one-time" ? "payment" : "subscription",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountInCents),
    "line_items[0][price_data][product_data][name]": "Mission support for Logan Doyle",
    "success_url": `${siteOrigin}/giving.html?donation=success&session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url": `${siteOrigin}/giving.html?donation=cancelled`,
  });

  if (schedule === "one-time") {
    sessionParameters.set("customer_creation", "always");
  } else {
    sessionParameters.set("line_items[0][price_data][recurring][interval]", schedule === "monthly" ? "month" : "week");
    if (schedule === "bi-weekly") {
      sessionParameters.set("line_items[0][price_data][recurring][interval_count]", "2");
    }
  }

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sessionParameters,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Stripe checkout request failed:", error.message);
    return sendJson(response, 502, {
      message: "Secure checkout could not be started. Please try again.",
    });
  }

  let session;
  try {
    session = await providerResponse.json();
  } catch {
    console.error("Stripe checkout returned an unreadable response.");
    return sendJson(response, 502, {
      message: "Secure checkout could not be started. Please try again.",
    });
  }

  if (!providerResponse.ok) {
    console.error("Stripe checkout request returned HTTP", providerResponse.status);
    return sendJson(response, 502, {
      message: "Secure checkout could not be started. Please try again.",
    });
  }

  let checkoutUrl;
  try {
    checkoutUrl = new URL(session.url);
  } catch {
    checkoutUrl = null;
  }
  if (!checkoutUrl || checkoutUrl.protocol !== "https:") {
    console.error("Stripe checkout response did not include a secure session URL.");
    return sendJson(response, 502, {
      message: "Secure checkout could not be started. Please try again.",
    });
  }

  return sendJson(response, 200, { url: checkoutUrl.toString() });
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
    return sendJson(response, 200, {
      donationsConfigured: Boolean(process.env.STRIPE_SECRET_KEY && publicSiteOrigin()),
    });
  }

  if (requestUrl.pathname === "/api/create-checkout-session" && request.method === "POST") {
    return createCheckoutSession(request, response);
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
    if (paymentUrl.protocol !== "https:") {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The donation link must use HTTPS.");
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
