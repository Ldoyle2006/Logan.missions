import { createHash } from "node:crypto";
import { renderEmail, renderPlainText, validateNewsletter, siteOrigin } from "./newsletter.js";

export function createBrevoClient(apiKey, request = fetch) {
  if (!apiKey) throw new Error("Configure BREVO_API_KEY in the private environment file.");
  return async (route, { method = "GET", body } = {}) => {
    // Intentionally no sendNow, status-change, scheduling, contact import or transactional routes.
    if (!/^(contacts\/lists(?:\?[^\s]*)?|senders|emailCampaigns(?:\?[^\s]*)?|emailCampaigns\/\d+(?:\/sendTest)?)$/.test(route)) throw new Error("Unsupported newsletter API route.");
    if (!(["GET", "POST", "PUT"].includes(method)) || (method === "PUT" && !/^emailCampaigns\/\d+$/.test(route)) || (method === "POST" && !/^emailCampaigns(?:\/\d+\/sendTest)?$/.test(route))) throw new Error("Unsupported newsletter API action.");
    if (body && Object.keys(body).some(key => ["scheduledAt", "sendAtBestTime", "status"].includes(key))) throw new Error("Sending and scheduling are disabled in this tool.");
    const response = await request(`https://api.brevo.com/v3/${route}`, { method, headers: { "api-key": apiKey, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      const error = new Error(`Brevo returned HTTP ${response.status} for ${method} ${route.split("?")[0]}. Check the API key, audience, sender, or test recipient in Brevo. No automatic write retry was attempted.`);
      error.statusCode = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
}
export async function verifiedCampaignSettings(client, env) {
  const listId = Number(env.BREVO_LIST_ID), senderId = Number(env.NEWSLETTER_SENDER_ID);
  if (!Number.isSafeInteger(listId) || listId < 1 || !Number.isSafeInteger(senderId) || senderId < 1) throw new Error("Configure BREVO_LIST_ID and NEWSLETTER_SENDER_ID explicitly.");
  const [lists, senders] = await Promise.all([client("contacts/lists?limit=50&offset=0"), client("senders")]);
  if (!lists.lists?.some(list => list.id === listId)) throw new Error("Configured newsletter list was not found. Verify the audience in Brevo; no campaign was created.");
  const sender = senders.senders?.find(sender => sender.id === senderId && sender.active === true);
  if (!sender) throw new Error("The selected Brevo sender is not active/verified.");
  return { listId, sender };
}
export async function saveCampaignDraft(client, item, env, { receipt, saveReceipt = async () => {} } = {}) {
  validateNewsletter(item);
  const { listId, sender } = await verifiedCampaignSettings(client, env);
  const origin = siteOrigin(env.NEWSLETTER_PUBLIC_URL);
  const name = `Logan Missions | ${item.slug}`;
  const htmlContent = renderEmail(item, { origin, senderName: sender.name, mailingAddress: env.NEWSLETTER_MAILING_ADDRESS || "" });
  const payload = { name, type: "classic", sender: { id: sender.id }, subject: item.subject,
    previewText: item.previewText, htmlContent, recipients: { listIds: [listId] },
    replyTo: env.NEWSLETTER_REPLY_TO || sender.email };
  let id = receipt?.id;
  if (receipt?.slug && receipt.slug !== item.slug) throw new Error("Campaign receipt belongs to another newsletter.");
  if (!id) {
    // Recover an uncertain prior creation by its exact stable name instead of posting twice.
    const matches = [];
    for (let offset = 0; ; offset += 100) {
      if (offset >= 1000) throw new Error("More than 1000 campaigns: select the correct draft explicitly in a receipt before proceeding.");
      const page = await client(`emailCampaigns?type=classic&limit=100&offset=${offset}`);
      matches.push(...(page.campaigns || []).filter(campaign => campaign.name === name));
      if ((page.campaigns || []).length < 100) break;
    }
    if (matches.length > 1) throw new Error("Multiple matching campaigns exist. Review them in Brevo before continuing.");
    id = matches[0]?.id;
    if (!id && receipt?.state === "creating") throw new Error("Previous creation outcome is uncertain. Check Brevo before creating another draft.");
  }
  if (id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid campaign ID.");
    const existing = await client(`emailCampaigns/${id}`);
    if (existing.name !== name || existing.status !== "draft") throw new Error("Only this newsletter's unsent draft may be updated. A sent/scheduled campaign is never modified.");
    await client(`emailCampaigns/${id}`, { method: "PUT", body: payload });
  } else {
    await saveReceipt({ slug: item.slug, state: "creating", name, createdAt: new Date().toISOString() });
    let created;
    try { created = await client("emailCampaigns", { method: "POST", body: payload }); }
    catch (error) {
      if ([400, 401, 403, 404, 405, 422, 429].includes(error.statusCode)) await saveReceipt({ slug: item.slug, state: "rejected", name, statusCode: error.statusCode });
      throw error;
    }
    id = created?.id;
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Brevo did not return a campaign ID; check the dashboard before retrying.");
    await saveReceipt({ slug: item.slug, id, state: "created", name });
  }
  const verified = await client(`emailCampaigns/${id}`);
  if (verified.status !== "draft" || verified.scheduledAt || verified.name !== name || JSON.stringify(verified.recipients?.lists || verified.recipients?.listIds || []) !== JSON.stringify([listId])) throw new Error("Campaign verification did not confirm the expected unscheduled draft and audience. Check Brevo.");
  const result = { slug: item.slug, id, state: "draft", listId, senderId: sender.id, contentStatus: item.status,
    contentHash: createHash("sha256").update(htmlContent).digest("hex"), verifiedAt: new Date().toISOString() };
  await saveReceipt(result);
  return { ...result, plainText: renderPlainText(item, { origin }) };
}
export async function sendOwnerTest(client, campaignId, env, confirmed = false) {
  const email = env.NEWSLETTER_TEST_TO;
  if (!confirmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) throw new Error("Set NEWSLETTER_TEST_TO to your own address and pass --confirm-test. Empty recipient lists are never allowed.");
  if (!Number.isSafeInteger(campaignId) || campaignId < 1) throw new Error("Create a campaign draft first.");
  const campaign = await client(`emailCampaigns/${campaignId}`);
  if (campaign.status !== "draft" || campaign.scheduledAt) throw new Error("Only an unscheduled draft can be tested by this tool.");
  await client(`emailCampaigns/${campaignId}/sendTest`, { method: "POST", body: { emailTo: [email] } });
  return { campaignId, testRequested: true, recipient: email };
}
