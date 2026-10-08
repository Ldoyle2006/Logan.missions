import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(root, "public");
const rateLimitWindowMs = 15 * 60 * 1000;
const rateLimitMax = 5;
const subscribeRequests = new Map();

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

function isRateLimited(ip, now = Date.now()) {
  for (const [address, entry] of subscribeRequests) {
    if (entry.resetAt <= now) subscribeRequests.delete(address);
  }

  const entry = subscribeRequests.get(ip);
  if (!entry || entry.resetAt <= now) {
    subscribeRequests.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > rateLimitMax;
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

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  const origin = request.headers.origin;
  let publicUrl;
  try {
    publicUrl = publicBaseUrl ? new URL(publicBaseUrl) : null;
    if (origin && (!publicUrl || new URL(origin).origin !== publicUrl.origin)) {
      return sendJson(response, 403, { message: "This signup request could not be verified." });
    }
  } catch {
    return sendJson(response, 503, {
      message: "Email signup is not set up yet. Please try again later.",
    });
  }

  if (isRateLimited(request.socket.remoteAddress || "unknown")) {
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
  const templateId = Number(process.env.BREVO_DOUBLE_OPT_IN_TEMPLATE_ID);
  if (!apiKey || !Number.isInteger(listId) || listId < 1 || !Number.isInteger(templateId) || templateId < 1) {
    return sendJson(response, 503, {
      message: "Email signup is not set up yet. Please try again later.",
    });
  }
  if (!publicUrl || !["http:", "https:"].includes(publicUrl.protocol)) {
    return sendJson(response, 503, {
      message: "Email signup is not set up yet. Please try again later.",
    });
  }

  const attributes = firstName ? { FIRSTNAME: firstName } : {};
  let providerResponse;
  try {
    providerResponse = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        attributes,
        includeListIds: [listId],
        templateId,
        redirectionUrl: new URL("/?subscription=confirmed", publicUrl).toString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("Brevo signup request failed:", error.message);
    return sendJson(response, 502, {
      message: "We could not send the confirmation email right now. Please try again later.",
    });
  }

  if (!providerResponse.ok) {
    console.error("Brevo signup request returned HTTP", providerResponse.status);
    return sendJson(response, 502, {
      message: "We could not send the confirmation email right now. Please try again later.",
    });
  }

  return sendJson(response, 200, {
    message: "Please check your inbox for a confirmation email to finish signing up.",
  });
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
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
      donationsConfigured: Boolean(process.env.STRIPE_PAYMENT_LINK_URL),
    });
  }

  if (requestUrl.pathname === "/api/subscribe" && request.method === "POST") {
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
