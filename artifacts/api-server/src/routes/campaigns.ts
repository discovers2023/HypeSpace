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

  // Try AI generation first, fall back to templates
  if (isAiAvailable()) {
    try {
      const aiResult = await generateCampaignWithAI({
        eventTitle, eventDate, eventTime, eventLocation, eventType,
        eventDescription, campaignType, tone, additionalContext, rsvpUrl, orgName,
      });
      res.json(AiGenerateCampaignResponse.parse(aiResult));
      return;
    } catch (err) {
      // Log and fall through to template generation
      console.error("AI generation failed, falling back to templates:", err);
    }
  }

  // --- Template fallback (when no ANTHROPIC_API_KEY or AI fails) ---
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Extract speaker / topic from additionalContext heuristically
  const speakerMatch = additionalContext?.match(/speaker[:\-\s]+([^,.\n]+)/i);
  const topicMatch = additionalContext?.match(/topic[:\-\s]+([^,.\n]+)/i);
  const speakerName = speakerMatch ? speakerMatch[1].trim() : "";
  const topicName = topicMatch ? topicMatch[1].trim() : "";

  const subjectMap: Record<string, Record<string, string[]>> = {
    invitation: {
      professional: [`You're Invited: ${eventTitle}`, `Join Us at ${eventTitle}`, `Your Invitation to ${eventTitle}`, `${eventTitle} — You're on the List`],
      friendly: [`Hey! Join us for ${eventTitle} 🎉`, `You're invited to ${eventTitle}! 🎊`, `Save your spot at ${eventTitle} 🙌`, `${eventTitle} — we'd love to see you there!`],
      formal: [`Formal Invitation — ${eventTitle}`, `Cordial Invitation to ${eventTitle}`, `You Are Cordially Invited: ${eventTitle}`],
      casual: [`Come join us for ${eventTitle}!`, `You + ${eventTitle} = a great time`, `Don't miss ${eventTitle}!`],
      urgent: [`Last Chance: Reserve Your Spot for ${eventTitle}`, `⏳ Spots Running Out: ${eventTitle}`, `Final Call — ${eventTitle}`, `Don't Miss Out: ${eventTitle} Is Almost Full`],
    },
    reminder: {
      professional: [`Reminder: ${eventTitle} is Coming Up`, `${eventTitle} — Just Around the Corner`, `Your Event Reminder: ${eventTitle}`],
      friendly: [`Don't forget — ${eventTitle} is almost here!`, `${eventTitle} is coming up soon! 🗓️`, `Almost time for ${eventTitle}!`],
      formal: [`Event Reminder — ${eventTitle}`, `Gentle Reminder: ${eventTitle}`, `${eventTitle} — Upcoming Event Notice`],
      casual: [`Quick reminder about ${eventTitle}`, `Heads up — ${eventTitle} is soon!`, `${eventTitle} reminder 📋`],
      urgent: [`⏰ Happening Soon: ${eventTitle}`, `${eventTitle} Starts Tomorrow!`, `RSVP Now — ${eventTitle} Is Almost Here`],
    },
    followup: {
      professional: [`Thank You for Attending ${eventTitle}`, `${eventTitle} — Post-Event Recap`, `Highlights from ${eventTitle}`],
      friendly: [`Thanks for joining ${eventTitle}! Here's a recap`, `What a great event! ${eventTitle} highlights`, `${eventTitle} was awesome — here's the recap 🎉`],
      formal: [`Post-Event Follow-Up — ${eventTitle}`, `${eventTitle} — Event Summary and Next Steps`, `Thank You for Your Participation: ${eventTitle}`],
      casual: [`Hope you had fun at ${eventTitle}!`, `${eventTitle} recap — what a time!`, `Great seeing you at ${eventTitle}!`],
      urgent: [`Action Required: ${eventTitle} Post-Event Survey`, `Your Feedback Matters: ${eventTitle}`, `Quick Survey: How Was ${eventTitle}?`],
    },
    announcement: {
      professional: [`Announcing: ${eventTitle}`, `Introducing ${eventTitle}`, `Mark Your Calendar: ${eventTitle}`],
      friendly: [`Big News — ${eventTitle} is happening!`, `Exciting announcement: ${eventTitle}! 🎊`, `Guess what? ${eventTitle} is here!`],
      formal: [`Official Announcement — ${eventTitle}`, `${eventTitle} — Official Event Notice`, `We Are Pleased to Announce ${eventTitle}`],
      casual: [`New event alert: ${eventTitle}!`, `Something exciting is coming: ${eventTitle}`, `${eventTitle} just dropped! 🎉`],
      urgent: [`Limited Spots: ${eventTitle}`, `Act Fast — ${eventTitle} Won't Last`, `Register Now: ${eventTitle} Filling Up`],
    },
    custom: {
      professional: [`Important Update — ${eventTitle}`, `${eventTitle}: An Update for You`, `News About ${eventTitle}`],
      friendly: [`A quick note about ${eventTitle}`, `${eventTitle} update for you! ✉️`, `Some news about ${eventTitle}`],
      formal: [`Official Communication — ${eventTitle}`, `Re: ${eventTitle} — Important Update`, `${eventTitle} — Formal Notice`],
      casual: [`Hey, a quick update on ${eventTitle}`, `Update on ${eventTitle} 👋`, `FYI — ${eventTitle} news`],
      urgent: [`Time-Sensitive: ${eventTitle}`, `Urgent Update: ${eventTitle}`, `Action Needed: ${eventTitle}`],
    },
  };

  const subjectOptions = subjectMap[campaignType]?.[tone] ?? [`${eventTitle} — Event Communication`];
  const subject = pick(subjectOptions);

  const bodyIntroMap: Record<string, Record<string, string[]>> = {
    invitation: {
      professional: [
        `We are pleased to extend a personal invitation to you for <strong>${eventTitle}</strong>. This is an exceptional opportunity to connect, learn, and be part of something remarkable.`,
        `You are cordially invited to <strong>${eventTitle}</strong>. We've put together an outstanding program and would be honored to have you join us.`,
        `It's our pleasure to invite you to <strong>${eventTitle}</strong> — an event designed to inspire, connect, and empower attendees like you.`,
      ],
      friendly: [
        `We'd love to have you join us for <strong>${eventTitle}</strong>! It's going to be an amazing experience and we can't wait to see you there.`,
        `Great news — <strong>${eventTitle}</strong> is happening and you're invited! We think you'll really enjoy this one.`,
        `Hey there! We're putting together something special with <strong>${eventTitle}</strong>, and it wouldn't be the same without you.`,
      ],
      formal: [
        `On behalf of the organizing committee, we cordially invite you to attend <strong>${eventTitle}</strong>. Your presence would be an honour.`,
        `We have the honour of inviting you to <strong>${eventTitle}</strong>. This event represents a distinguished gathering of our community.`,
      ],
      casual: [
        `Guess what? You're invited to <strong>${eventTitle}</strong> — it's going to be a great time and we'd love to have you there!`,
        `You + <strong>${eventTitle}</strong> = an awesome time. Seriously, you should come!`,
        `We've got something fun lined up — <strong>${eventTitle}</strong>! Come hang out with us.`,
      ],
      urgent: [
        `Spots are filling up fast for <strong>${eventTitle}</strong>! Don't miss your chance to be part of this exclusive event.`,
        `Registration for <strong>${eventTitle}</strong> is closing soon — secure your spot before it's too late!`,
        `This is your final opportunity to join <strong>${eventTitle}</strong>. Seats are limited and going fast.`,
      ],
    },
    reminder: {
      professional: [
        `This is a friendly reminder that <strong>${eventTitle}</strong> is coming up soon. Please review the details below and ensure you're prepared for the event.`,
        `We wanted to make sure <strong>${eventTitle}</strong> is on your calendar. Here's everything you need to know to prepare.`,
      ],
      friendly: [
        `Just a heads-up — <strong>${eventTitle}</strong> is right around the corner! We're so excited to see you soon.`,
        `Getting close to <strong>${eventTitle}</strong>! Here's a quick refresher on the details so you're all set.`,
      ],
      formal: [
        `We wish to remind you of the forthcoming event, <strong>${eventTitle}</strong>. Please take note of the event details listed below.`,
        `This correspondence serves as a formal reminder regarding <strong>${eventTitle}</strong>. Kindly review the details herein.`,
      ],
      casual: [
        `Hey! Just wanted to remind you that <strong>${eventTitle}</strong> is almost here. Don't forget to mark your calendar!`,
        `Psst — <strong>${eventTitle}</strong> is coming up! Here's the scoop so you don't miss it.`,
      ],
      urgent: [
        `<strong>Time is running out!</strong> <strong>${eventTitle}</strong> is happening very soon. Please confirm your attendance immediately.`,
        `<strong>${eventTitle}</strong> is right around the corner — make sure you're ready! Check the details below.`,
      ],
    },
    followup: {
      professional: [
        `Thank you for your participation in <strong>${eventTitle}</strong>. We hope the experience was both valuable and enriching.`,
        `We appreciate you taking the time to attend <strong>${eventTitle}</strong>. Your engagement made the event truly special.`,
      ],
      friendly: [
        `It was so wonderful having you at <strong>${eventTitle}</strong>! We hope you had a fantastic time and took away some great memories.`,
        `What an incredible event! Thank you for being part of <strong>${eventTitle}</strong> — we loved having you there.`,
      ],
      formal: [
        `We extend our sincere gratitude for your attendance at <strong>${eventTitle}</strong>. Your presence was greatly appreciated.`,
        `On behalf of the organizers, we wish to express our gratitude for your attendance at <strong>${eventTitle}</strong>.`,
      ],
      casual: [
        `Thanks for coming to <strong>${eventTitle}</strong>! Hope you had a blast — we sure did!`,
        `Hey! Just wanted to say thanks for showing up at <strong>${eventTitle}</strong> — it was a great time!`,
      ],
      urgent: [
        `Thank you for attending <strong>${eventTitle}</strong>. We kindly request your immediate feedback to help us improve future events.`,
        `We value your input! Please take a moment to share your thoughts on <strong>${eventTitle}</strong> — it only takes a minute.`,
      ],
    },
    announcement: {
      professional: [
        `We are thrilled to announce <strong>${eventTitle}</strong> — a premier event that promises to deliver outstanding value and insights.`,
        `We're excited to share the details of <strong>${eventTitle}</strong>, an upcoming event that you won't want to miss.`,
      ],
      friendly: [
        `We have some exciting news — <strong>${eventTitle}</strong> is officially happening and we'd love for you to be a part of it!`,
        `Drumroll please... <strong>${eventTitle}</strong> is officially on! Here's everything you need to know.`,
      ],
      formal: [
        `It is with great pleasure that we officially announce <strong>${eventTitle}</strong>. This event marks a significant occasion for our community.`,
        `We are honoured to present <strong>${eventTitle}</strong> — an event of significance for all stakeholders.`,
      ],
      casual: [
        `Big news! <strong>${eventTitle}</strong> is happening and it's going to be epic. Read on for all the details!`,
        `Hey! We just launched <strong>${eventTitle}</strong> — check out the details and get on the list!`,
      ],
      urgent: [
        `<strong>Limited spots available!</strong> We're announcing <strong>${eventTitle}</strong> — act now before it sells out.`,
        `<strong>${eventTitle}</strong> just launched with limited capacity — register today before spots run out!`,
      ],
    },
    custom: {
      professional: [
        `We are reaching out with an important update regarding <strong>${eventTitle}</strong>.`,
        `We have some important information to share about <strong>${eventTitle}</strong> that we think you'll find valuable.`,
      ],
      friendly: [
        `Hey! We've got a message for you about <strong>${eventTitle}</strong> that we think you'll want to read.`,
        `Quick note about <strong>${eventTitle}</strong> — we've got some updates to share!`,
      ],
      formal: [
        `Please find below an official communication pertaining to <strong>${eventTitle}</strong>.`,
        `This message contains important information regarding <strong>${eventTitle}</strong>. Please review carefully.`,
      ],
      casual: [
        `Quick update for you about <strong>${eventTitle}</strong> — read on!`,
        `Just wanted to fill you in on some <strong>${eventTitle}</strong> updates!`,
      ],
      urgent: [
        `<strong>Urgent:</strong> Please read this message about <strong>${eventTitle}</strong> right away.`,
        `<strong>Action required:</strong> Important update about <strong>${eventTitle}</strong> that needs your attention now.`,
      ],
    },
  };

  const bodyIntroOptions = bodyIntroMap[campaignType]?.[tone] ?? [`We're reaching out about <strong>${eventTitle}</strong>.`];
  const bodyIntro = pick(bodyIntroOptions);

  const ctaLabelMap: Record<string, string> = {
    invitation: "Reserve My Spot",
    reminder: "View Event Details",
    followup: "Share Your Feedback",
    announcement: "Learn More & Register",
    custom: "Find Out More",
  };
  const ctaLabel = ctaLabelMap[campaignType] ?? "Learn More";

  const extraNote = additionalContext && !speakerMatch && !topicMatch
    ? `<p style="color:#4a4a6a;line-height:1.8;margin:0 0 16px;">${additionalContext}</p>`
    : additionalContext && (speakerMatch || topicMatch)
      ? `<p style="color:#4a4a6a;line-height:1.8;margin:0 0 16px;">${additionalContext.replace(/speaker[:\-\s]+[^,.\n]+/i, "").replace(/topic[:\-\s]+[^,.\n]+/i, "").trim()}</p>`
      : "";

  const infoPillStyle = "display:inline-block;background:#f0ebff;color:#6d28d9;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;";
  const infoValueStyle = "margin:0;font-size:15px;font-weight:600;color:#1a0533;line-height:1.4;";
  const infoSubStyle = "margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.4;";
  const detailCellStyle = "background:#faf8ff;border:1px solid #e5deff;border-radius:12px;padding:18px 20px;width:48%;display:inline-block;vertical-align:top;box-sizing:border-box;";

  const speakerBlock = speakerName ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr>
          <td style="background:linear-gradient(135deg,#fdf4ff,#f0ebff);border:1px solid #d8b4fe;border-radius:14px;padding:20px 24px;">
            <span style="${infoPillStyle}">🎤 Featured Speaker</span>
            <p style="${infoValueStyle}font-size:18px;">${speakerName}</p>
            ${topicName ? `<p style="${infoSubStyle}">Topic: <em>${topicName}</em></p>` : ""}
          </td>
        </tr>
      </table>` : "";

  const topicBlock = topicName && !speakerName ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr>
          <td style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fed7aa;border-radius:14px;padding:20px 24px;">
            <span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">📋 Topic</span>
            <p style="${infoValueStyle}font-size:17px;">${topicName}</p>
          </td>
        </tr>
      </table>` : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f0ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ff;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(109,40,217,0.10);">

          <!-- HEADER GRADIENT BANNER -->
          <tr>
            <td style="background:linear-gradient(135deg,#7C3AED 0%,#a855f7 50%,#F97316 100%);padding:48px 40px 40px;text-align:center;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.75);">HypeSpace Events</p>
              <h1 style="margin:0;font-size:34px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">${eventTitle}</h1>
              <p style="margin:14px 0 0;font-size:15px;color:rgba(255,255,255,0.85);font-weight:400;">${campaignType === "invitation" ? "You're personally invited" : campaignType === "reminder" ? "Your event is coming up" : campaignType === "followup" ? "Thank you for joining us" : campaignType === "announcement" ? "Save the date" : "An update for you"}</p>
            </td>
          </tr>

          <!-- EVENT DETAILS HIGHLIGHT STRIP -->
          <tr>
            <td style="background:linear-gradient(90deg,#6d28d9,#a855f7);padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:16px 24px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#fff;font-size:13px;font-weight:600;padding:0 20px 0 0;border-right:1px solid rgba(255,255,255,0.3);">
                          📅&nbsp;&nbsp;${eventDate || "Date TBD"}
                        </td>
                        <td style="color:#fff;font-size:13px;font-weight:600;padding:0 0 0 20px;">
                          🕐&nbsp;&nbsp;${eventTime || "Time TBD"}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 40px 8px;">
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.8;">${bodyIntro}</p>
              ${extraNote}
            </td>
          </tr>

          <!-- SPEAKER / TOPIC HIGHLIGHT (conditional) -->
          ${speakerBlock || topicBlock ? `<tr><td style="padding:0 40px 8px;">${speakerBlock}${topicBlock}</td></tr>` : ""}

          <!-- INFO CARDS: LOCATION + DATE/TIME -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="${detailCellStyle}margin-right:4%;">
                    <span style="${infoPillStyle}">📍 Location</span>
                    <p style="${infoValueStyle}">${eventLocation || "To be announced"}</p>
                    ${eventType ? `<p style="${infoSubStyle}">${eventType.charAt(0).toUpperCase() + eventType.slice(1)} event</p>` : ""}
                  </td>
                  <td width="4%"></td>
                  <td style="${detailCellStyle}">
                    <span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">📅 Date & Time</span>
                    <p style="${infoValueStyle}">${eventDate || "Date TBD"}</p>
                    <p style="${infoSubStyle}">${eventTime || "Time TBD"}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DESCRIPTION (if available) -->
          ${eventDescription ? `<tr><td style="padding:0 40px 32px;"><p style="margin:0;font-size:14px;color:#6b7280;line-height:1.8;background:#f9fafb;border-radius:10px;padding:16px 20px;">${eventDescription}</p></td></tr>` : ""}

          <!-- CTA BUTTON -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="${rsvpUrl}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#F97316);color:#ffffff;padding:16px 48px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.02em;box-shadow:0 4px 20px rgba(124,58,237,0.4);">${ctaLabel}</a>
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Or copy this link: <a href="${rsvpUrl}" style="color:#7C3AED;">${rsvpUrl}</a></p>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px 32px;">
              <hr style="border:none;border-top:1px solid #f0ebff;margin:0;">
            </td>
          </tr>

          <!-- CLOSING -->
          <tr>
            <td style="padding:0 40px 40px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.7;">If you have any questions, feel free to reach out. We look forward to seeing you!</p>
              <p style="margin:0;font-size:15px;color:#374151;">Warmly,<br><strong style="color:#6d28d9;">The HypeSpace Events Team</strong></p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1a0533;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.5);">You're receiving this because you're on our guest list for <strong style="color:rgba(255,255,255,0.7);">${eventTitle}</strong>.</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">HypeSpace Events &nbsp;·&nbsp; <a href="#" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="#" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Privacy Policy</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = [
    subject,
    "",
    eventTitle,
    eventDate ? `Date: ${eventDate}` : "",
    eventTime ? `Time: ${eventTime}` : "",
    eventLocation ? `Location: ${eventLocation}` : "",
    speakerName ? `Speaker: ${speakerName}` : "",
    topicName ? `Topic: ${topicName}` : "",
    "",
    additionalContext || "This is a special event you won't want to miss.",
    "",
    eventDescription || "",
    "",
    `${ctaLabel}: ${rsvpUrl}`,
    "",
    "Warmly,",
    "The HypeSpace Events Team",
  ].filter(Boolean).join("\n");

  res.json(AiGenerateCampaignResponse.parse({
    subject,
    htmlContent,
    textContent,
    suggestions: [
      speakerName ? "Speaker is highlighted — add a short bio to boost attendance" : "Add 'Speaker: [Name]' in Additional Context to get a featured speaker section",
      topicName ? "Topic is highlighted in the email — consider adding bullet-point takeaways" : "Add 'Topic: [Subject]' in Additional Context to highlight the session topic",
      "Personalize with {{first_name}} merge tags to increase open rates by up to 26%",
      "Add a countdown banner above the CTA for urgency — edit the HTML directly",
    ],
  }));
});

export default router;
