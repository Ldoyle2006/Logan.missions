// A durable outbox keeps email delivery separate from payment acknowledgement.
// Retry only inside Brevo's idempotency window. Ambiguous older attempts require
// review rather than risking a second donation email after that window expires.
export async function deliverNotifications(store, config, fetchImpl = fetch, now = Date.now()) {
  if (!config.apiKey || !config.from || !config.to) return;
  for (let count = 0; count < 10; count++) {
    const job = await store.transaction(data => {
      for (const n of Object.values(data.notifications)) {
        if (!["pending", "sending"].includes(n.status)) continue;
        if (n.firstAttempt && now - n.firstAttempt >= 10 * 60_000) { n.status = "needs_review"; continue; }
        if (n.lastAttempt && now - n.lastAttempt < 60_000) continue;
        n.firstAttempt ||= now;
        n.lastAttempt = now;
        n.status = "sending";
        n.payload ||= { sender: { email: config.from, name: "Logan Missions" }, to: [{ email: config.to }],
          subject: `${store.mode === "test" ? "[TEST] " : ""}${n.subject}`, textContent: n.text,
          headers: { idempotencyKey: n.idempotencyKey } };
        return structuredClone(n);
      }
      return null;
    });
    if (!job) break;
    let status = "sending";
    let providerMessageId = null;
    let definiteRejection = false;
    let providerStatus = null;
    try {
      const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(job.payload), signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      providerStatus = response.status;
      if (response.ok && result.messageId) { status = "sent"; providerMessageId = result.messageId; }
      // Duplicate acknowledgement establishes provider acceptance of this key.
      else if (result.code === "duplicate_parameter" && /idempoten/i.test(result.message || "")) status = "sent";
      // A first attempt explicitly rejected for invalid credentials/sender data
      // was not accepted. Keep it queued for configuration repair rather than
      // expiring it as an ambiguous delivery. Preserve any earlier uncertainty.
      else if ([400, 401, 403].includes(response.status) && job.firstAttempt === now) {
        definiteRejection = true;
        status = "pending";
      }
    } catch { /* Preserve the attempt for bounded, idempotent retry. */ }
    await store.transaction(data => {
      const notification = data.notifications[job.id];
      Object.assign(notification, { status, providerMessageId,
        lastProviderStatus: providerStatus,
        ...(status === "sent" ? { acceptedAt: new Date(now).toISOString() } : {}) });
      if (definiteRejection) delete notification.firstAttempt;
    });
    if (definiteRejection) break;
  }
}
