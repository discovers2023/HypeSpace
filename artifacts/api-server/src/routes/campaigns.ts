import { Router, type IRouter } from "express";
import { db, campaignsTable, activityTable, eventsTable, organizationsTable } from "@workspace/db";
import { eq, and, avg } from "drizzle-orm";
import { getPlan } from "../lib/plans";
import { sendEmail } from "../lib/email";
import { getAppBaseUrl } from "../lib/app-url";
import sanitizeHtml from "sanitize-html";
import { isAiAvailable, generateCampaignWithAI } from "../lib/ai-campaign";

const sanitizeOpts: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "style", "head", "meta", "link", "center", "font"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["style", "class", "id", "width", "height", "align", "valign", "bgcolor", "cellpadding", "cellspacing", "border"],
    img: ["src", "alt", "width", "height", "style"],
    a: ["href", "target", "style", "class"],
    td: ["style", "width", "height", "align", "valign", "bgcolor", "colspan", "rowspan"],
    table: ["style", "width", "cellpadding", "cellspacing", "border", "align", "bgcolor"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};
import {
  ListCampaignsResponse,
  CreateCampaignBody,
  GetCampaignResponse,
  UpdateCampaignBody,
  UpdateCampaignResponse,
  SendCampaignResponse,
  AiGenerateCampaignBody,
  AiGenerateCampaignResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Injects a hero image into the email HTML. Best-effort regex:
 * 1. Try to inject the <img> as the first child of the gradient header <td>.
 * 2. Fall back to inserting an <img> right after the first <body ...> tag.
 * 3. Worst case, prepend the <img>.
 */
export function injectHeroImage(html: string, imageUrl: string, alt: string): string {
  const safeAlt = alt.replace(/"/g, "&quot;");
  const imgTag = `<img src="${imageUrl}" alt="${safeAlt}" style="width:100%;height:240px;object-fit:cover;display:block;border-radius:20px 20px 0 0;" />`;

  const gradientHeaderRegex = /(<td\s[^>]*background:\s*linear-gradient\(135deg,\s*#7C3AED[^>]*>)/i;
  if (gradientHeaderRegex.test(html)) {
    return html.replace(gradientHeaderRegex, (match) => `${match}${imgTag}`);
  }

  const bodyRegex = /(<body[^>]*>)/i;
  if (bodyRegex.test(html)) {
    return html.replace(bodyRegex, (match) => `${match}${imgTag}`);
  }

  return `${imgTag}${html}`;
}

/**
 * Injects a tracking pixel and rewrites href links for click tracking.
 * Called just before sendEmail() so the stored htmlContent is never mutated.
 */
export function injectTracking(html: string, campaignId: number, baseUrl: string): string {
  // 1. Rewrite all <a href="..."> links to go through the click tracker
  //    Exclude unsubscribe links (href="#") and mailto links
  const rewritten = html.replace(
    /(<a\s[^>]*href=["'])(?!#|mailto:)(https?:\/\/[^"']+)(["'])/gi,
    (_, pre, url, post) => {
      const tracked = `${baseUrl}/api/track/click/${campaignId}?url=${encodeURIComponent(url)}`;
      return `${pre}${tracked}${post}`;
    }
  );

  // 2. Inject tracking pixel just before </body>
  const pixel = `<img src="${baseUrl}/api/track/open/${campaignId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  if (rewritten.includes("</body>")) {
    return rewritten.replace("</body>", `${pixel}\n</body>`);
  }
  return rewritten + pixel;
}

function formatCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    id: c.id,
    organizationId: c.organizationId,
    eventId: c.eventId ?? null,
    name: c.name,
    subject: c.subject,
    type: c.type,
    status: c.status,
    htmlContent: c.htmlContent ?? null,
    textContent: c.textContent ?? null,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    recipientCount: c.recipientCount,
    openRate: c.openRate ?? null,
    clickRate: c.clickRate ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/organizations/:orgId/campaigns", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.organizationId, orgId));
  res.json(ListCampaignsResponse.parse(campaigns.map(formatCampaign)));
});

router.post("/organizations/:orgId/campaigns", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.eventId) {
    const [ev] = await db.select({ id: eventsTable.id }).from(eventsTable)
      .where(and(eq(eventsTable.id, parsed.data.eventId), eq(eventsTable.organizationId, orgId)));
    if (!ev) { res.status(404).json({ error: "Event not found in this organization" }); return; }
  }

  const insertData: Record<string, unknown> = { ...parsed.data, organizationId: orgId };
  if (parsed.data.scheduledAt) insertData.scheduledAt = new Date(parsed.data.scheduledAt);
  if (typeof insertData.htmlContent === "string") {
    insertData.htmlContent = sanitizeHtml(insertData.htmlContent as string, sanitizeOpts);
  }

  const [campaign] = await db.insert(campaignsTable).values(insertData as typeof campaignsTable.$inferInsert).returning();
  res.status(201).json(GetCampaignResponse.parse(formatCampaign(campaign)));
});

router.get("/organizations/:orgId/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);
  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.organizationId, orgId)));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(GetCampaignResponse.parse(formatCampaign(campaign)));
});

router.patch("/organizations/:orgId/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledAt) {
    const scheduledDate = new Date(parsed.data.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: "Invalid scheduledAt date" });
      return;
    }
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (scheduledDate > oneYearFromNow) {
      res.status(400).json({ error: "scheduledAt cannot be more than 1 year in the future" });
      return;
    }
    updateData.scheduledAt = scheduledDate;
  }
  if (typeof updateData.htmlContent === "string") {
    updateData.htmlContent = sanitizeHtml(updateData.htmlContent as string, sanitizeOpts);
  }

  const [campaign] = await db.update(campaignsTable).set(updateData)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.organizationId, orgId)))
    .returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(UpdateCampaignResponse.parse(formatCampaign(campaign)));
});

router.delete("/organizations/:orgId/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);
  await db.delete(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.organizationId, orgId)));
  res.sendStatus(204);
});

router.post("/organizations/:orgId/campaigns/:campaignId/send", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);

  // Enforce plan: free plan cannot send campaigns
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  const plan = getPlan(org?.plan);
  if (!plan.canSendCampaigns) {
    res.status(402).json({
      error: "PLAN_LIMIT_EXCEEDED",
      message: "Sending campaigns requires a paid plan. Upgrade to Starter or higher to launch your campaigns.",
      limit: "canSendCampaigns",
      plan: plan.key,
      suggestedPlan: "starter",
    });
    return;
  }

  const [campaign] = await db.update(campaignsTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.organizationId, orgId)))
    .returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "campaign_sent",
    title: "Campaign Sent",
    description: `${campaign.name} was sent to ${campaign.recipientCount} recipients`,
    entityId: campaign.id,
    entityType: "campaign",
  });

  // Deliver the email with tracking injected
  const appBaseUrl = getAppBaseUrl(req);
  const trackedHtml = injectTracking(
    campaign.htmlContent ?? `<p>${campaign.textContent ?? ""}</p>`,
    campaignId,
    appBaseUrl
  );
  await sendEmail({
    to: "broadcast@placeholder", // broadcast placeholder — per-guest iteration is v2
    subject: campaign.subject,
    html: trackedHtml,
    text: campaign.textContent ?? undefined,
    orgId,
  }).catch((err) => {
    // Log but do not fail the response — campaign is already marked sent
    console.error("Send email error:", err);
  });

  res.json(SendCampaignResponse.parse(formatCampaign(campaign)));
});

// --- Test-send: deliver campaign HTML to a single address ---
router.post("/organizations/:orgId/campaigns/:campaignId/test-send", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);
  const { to } = req.body as { to?: string };

  if (!to || !to.includes("@")) {
    res.status(400).json({ error: "A valid 'to' email address is required" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.organizationId, orgId)));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  const result = await sendEmail({
    to,
    subject: `[TEST] ${campaign.subject}`,
    html: campaign.htmlContent ?? `<p>${campaign.textContent ?? ""}</p>`,
    text: campaign.textContent ?? undefined,
    orgId,
  });

  res.json({ sent: true, to, subject: campaign.subject, previewUrl: result.previewUrl || undefined });
});

router.post("/organizations/:orgId/campaigns/ai-generate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = AiGenerateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let eventTitle = "Our Event";
  let eventSlug = "";
  let eventDate = "";
  let eventTime = "";
  let eventLocation = "";
  let eventType = "";
  let eventDescription = "";

  if (parsed.data.eventId) {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, parsed.data.eventId));
    if (event) {
      eventSlug = event.slug ?? "";
      eventTitle = event.title;
      eventType = event.type ?? "";
      eventDescription = event.description ?? "";

      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      const dateOpts: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: event.timezone ?? "UTC" };
      const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: event.timezone ?? "UTC" };
      const endTimeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: event.timezone ?? "UTC" };
      eventDate = start.toLocaleDateString("en-US", dateOpts);
      eventTime = `${start.toLocaleTimeString("en-US", timeOpts)} – ${end.toLocaleTimeString("en-US", endTimeOpts)}`;

      if (event.type === "online" || event.type === "hybrid") {
        eventLocation = event.onlineUrl ? `Online — ${event.onlineUrl}` : event.location || "Online";
      } else {
        eventLocation = event.location || event.onlineUrl || "To be announced";
      }
    }
  }

  const { campaignType, tone, additionalContext } = parsed.data;
  const appBaseUrl = getAppBaseUrl(req);
  const rsvpUrl = eventSlug ? `${appBaseUrl}/e/${eventSlug}` : "#";

  // Fetch org name for branding
  const [orgRow] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  const orgName = orgRow?.name ?? "HypeSpace Events";

  // Build org AI config from DB
  const orgAiConfig = orgRow?.aiProvider && orgRow.aiProvider !== "none" ? {
    provider: orgRow.aiProvider,
    apiKey: orgRow.aiApiKey ?? "",
    model: orgRow.aiModel ?? undefined,
    baseUrl: orgRow.aiBaseUrl ?? undefined,
  } : null;

  // AI generation is mandatory — no template fallback (plan 260417-oz0).
  if (!isAiAvailable(orgAiConfig)) {
    res.status(400).json({
      error: "AI_NOT_CONFIGURED",
      message: "No AI provider is configured. Open Settings → AI to configure a provider.",
    });
    return;
  }

  try {
    const aiPromise = generateCampaignWithAI({
      eventTitle, eventDate, eventTime, eventLocation, eventType,
      eventDescription, campaignType, tone,
      additionalContext: additionalContext ?? undefined,
      rsvpUrl, orgName,
    }, orgAiConfig);

    let heroImageUrl: string | null = null;
    if (parsed.data.includeImage) {
      const { generateCampaignImage } = await import("../lib/ai-image");
      const imagePromise = generateCampaignImage({
        eventTitle,
        eventType,
        eventDescription,
        campaignType,
        tone,
        additionalContext: additionalContext ?? null,
        orgId,
        config: orgAiConfig,
      }).catch((err: unknown) => {
        req.log?.warn({ err }, "Image generation failed, continuing without image");
        return null;
      });
      const [aiResult, imageResult] = await Promise.all([aiPromise, imagePromise]);
      heroImageUrl = imageResult?.imageUrl ?? null;
      const htmlWithImage = heroImageUrl
        ? injectHeroImage(aiResult.htmlContent, heroImageUrl, eventTitle)
        : aiResult.htmlContent;
      res.json(AiGenerateCampaignResponse.parse({
        ...aiResult,
        htmlContent: htmlWithImage,
        heroImageUrl,
      }));
      return;
    }

    const aiResult = await aiPromise;
    res.json(AiGenerateCampaignResponse.parse({ ...aiResult, heroImageUrl: null }));
  } catch (err) {
    const provider = orgAiConfig?.provider ?? "unknown";
    const detail = err instanceof Error ? err.message : String(err);
    req.log?.error({ err, provider }, "AI generation failed");
    res.status(502).json({
      error: "AI_GENERATION_FAILED",
      provider,
      detail: detail.slice(0, 500),
    });
  }
});

export default router;
