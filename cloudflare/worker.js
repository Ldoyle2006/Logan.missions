// Public API forwarding only. No payment or database secrets are stored here.
const backendOrigin = "https://logan-missions.onrender.com";
export const publicRoutes = new Set([
  "/api/config", "/api/schools", "/api/schools/checkout",
  "/api/create-checkout-session", "/api/newsletter", "/api/subscribe",
]);
const verificationPath = "/google9bcf900fc8b10803.html";
export const functionRoutes = [...publicRoutes, verificationPath];

export function createPagesWorker(upstreamFetch = fetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      // Pages normally redirects .html URLs. Google verification needs this
      // exact file URL to return its public token directly with HTTP 200.
      if (url.pathname === verificationPath && ["GET", "HEAD"].includes(request.method)) {
        return new Response(request.method === "HEAD" ? null : "google-site-verification: google9bcf900fc8b10803.html", {
          headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" },
        });
      }
      if (!publicRoutes.has(url.pathname)) return env.ASSETS.fetch(request);
      const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      const failure = (status, message) => new Response(JSON.stringify({ message }), {
        status, headers: { ...Object.fromEntries(headers), "Content-Type": "application/json; charset=utf-8" },
      });
      if (!["GET", "HEAD", "POST"].includes(request.method)) return failure(405, "Method not allowed.");
      // Prevent preview pages and cross-site requests from submitting forms.
      if (request.method === "POST") {
        let configuredOrigin;
        try { configuredOrigin = new URL(env.PUBLIC_SITE_URL).origin; } catch { return failure(503, "Giving is being configured. Please try again shortly."); }
        if (configuredOrigin !== url.origin || request.headers.get("Origin") !== url.origin) return failure(403, "This request could not be verified.");
      }
      const forwarded = new Headers(request.headers);
      forwarded.delete("Cookie");
      forwarded.delete("Authorization");
      forwarded.delete("Host");
      forwarded.delete("Content-Length");
      try {
        const upstream = await upstreamFetch(`${backendOrigin}${url.pathname}${url.search}`, {
          method: request.method, headers: forwarded,
          body: request.method === "POST" ? await request.arrayBuffer() : undefined,
          redirect: "manual", cache: "no-store",
        });
        // The host can return an HTML wake-up page before the application starts.
        // These are JSON-only API routes: keep that host page out of the donor UI.
        if (!upstream.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
          const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 503;
          return failure(status, "Logan Missions is connecting. Please try again shortly.");
        }
        const resultHeaders = new Headers(upstream.headers);
        resultHeaders.set("Cache-Control", "no-store");
        resultHeaders.delete("Set-Cookie");
        resultHeaders.delete("Access-Control-Allow-Origin");
        return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
      } catch { return failure(503, "The donation server is waking up or temporarily unavailable. Please try again shortly."); }
    },
  };
}

export default createPagesWorker();
