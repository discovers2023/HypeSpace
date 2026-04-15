import { Router, type IRouter } from "express";
import { db, campaignsTable, activityTable, eventsTable, organizationsTable } from "@workspace/db";
import { eq, and, avg } from "drizzle-orm";
import { getPlan } from "../lib/plans";
import { sendEmail } from "../lib/email";
import { getAppBaseUrl } from "../lib/app-url";
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

  const insertData: Record<string, unknown> = { ...parsed.data, organizationId: orgId };
  if (parsed.data.scheduledAt) insertData.scheduledAt = new Date(parsed.data.scheduledAt);

  const [campaign] = await db.insert(campaignsTable).values(insertData as Parameters<typeof campaignsTable.$inferInsert>[0]).returning();
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

router.put("/organizations/:orgId/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawCampaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const orgId = parseInt(rawOrgId, 10);
  const campaignId = parseInt(rawCampaignId, 10);
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledAt) updateData.scheduledAt = new Date(parsed.data.scheduledAt);

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

  // Extract speaker / topic from additionalContext heuristically
  const speakerMatch = additionalContext?.match(/speaker[:\-\s]+([^,.\n]+)/i);
  const topicMatch = additionalContext?.match(/topic[:\-\s]+([^,.\n]+)/i);
  const speakerName = speakerMatch ? speakerMatch[1].trim() : "";
  const topicName = topicMatch ? topicMatch[1].trim() : "";

  const subjectMap: Record<string, Record<string, string>> = {
    invitation: {
      professional: `You're Invited: ${eventTitle}`,
      friendly: `Hey! Join us for ${eventTitle} 🎉`,
      formal: `Formal Invitation — ${eventTitle}`,
      casual: `Come join us for ${eventTitle}!`,
      urgent: `Last Chance: Reserve Your Spot for ${eventTitle}`,
    },
    reminder: {
      professional: `Reminder: ${eventTitle} is Coming Up`,
      friendly: `Don't forget — ${eventTitle} is almost here!`,
      formal: `Event Reminder — ${eventTitle}`,
      casual: `Quick reminder about ${eventTitle}`,
      urgent: `⏰ Happening Soon: ${eventTitle}`,
    },
    followup: {
      professional: `Thank You for Attending ${eventTitle}`,
      friendly: `Thanks for joining ${eventTitle}! Here's a recap`,
      formal: `Post-Event Follow-Up — ${eventTitle}`,
      casual: `Hope you had fun at ${eventTitle}!`,
      urgent: `Action Required: ${eventTitle} Post-Event Survey`,
    },
    announcement: {
      professional: `Announcing: ${eventTitle}`,
      friendly: `Big News — ${eventTitle} is happening!`,
      formal: `Official Announcement — ${eventTitle}`,
      casual: `New event alert: ${eventTitle}!`,
      urgent: `Limited Spots: ${eventTitle}`,
    },
    custom: {
      professional: `Important Update — ${eventTitle}`,
      friendly: `A quick note about ${eventTitle}`,
      formal: `Official Communication — ${eventTitle}`,
      casual: `Hey, a quick update on ${eventTitle}`,
      urgent: `Time-Sensitive: ${eventTitle}`,
    },
  };

  const subject = subjectMap[campaignType]?.[tone] ?? `${eventTitle} — Event Communication`;

  const bodyIntroMap: Record<string, Record<string, string>> = {
    invitation: {
      professional: `We are pleased to extend a personal invitation to you for <strong>${eventTitle}</strong>. This is an exceptional opportunity to connect, learn, and be part of something remarkable.`,
      friendly: `We'd love to have you join us for <strong>${eventTitle}</strong>! It's going to be an amazing experience and we can't wait to see you there.`,
      formal: `On behalf of the organizing committee, we cordially invite you to attend <strong>${eventTitle}</strong>. Your presence would be an honour.`,
      casual: `Guess what? You're invited to <strong>${eventTitle}</strong> — it's going to be a great time and we'd love to have you there!`,
      urgent: `Spots are filling up fast for <strong>${eventTitle}</strong>! Don't miss your chance to be part of this exclusive event.`,
    },
    reminder: {
      professional: `This is a friendly reminder that <strong>${eventTitle}</strong> is coming up soon. Please review the details below and ensure you're prepared for the event.`,
      friendly: `Just a heads-up — <strong>${eventTitle}</strong> is right around the corner! We're so excited to see you soon.`,
      formal: `We wish to remind you of the forthcoming event, <strong>${eventTitle}</strong>. Please take note of the event details listed below.`,
      casual: `Hey! Just wanted to remind you that <strong>${eventTitle}</strong> is almost here. Don't forget to mark your calendar!`,
      urgent: `<strong>Time is running out!</strong> <strong>${eventTitle}</strong> is happening very soon. Please confirm your attendance immediately.`,
    },
    followup: {
      professional: `Thank you for your participation in <strong>${eventTitle}</strong>. We hope the experience was both valuable and enriching.`,
      friendly: `It was so wonderful having you at <strong>${eventTitle}</strong>! We hope you had a fantastic time and took away some great memories.`,
      formal: `We extend our sincere gratitude for your attendance at <strong>${eventTitle}</strong>. Your presence was greatly appreciated.`,
      casual: `Thanks for coming to <strong>${eventTitle}</strong>! Hope you had a blast — we sure did!`,
      urgent: `Thank you for attending <strong>${eventTitle}</strong>. We kindly request your immediate feedback to help us improve future events.`,
    },
    announcement: {
      professional: `We are thrilled to announce <strong>${eventTitle}</strong> — a premier event that promises to deliver outstanding value and insights.`,
      friendly: `We have some exciting news — <strong>${eventTitle}</strong> is officially happening and we'd love for you to be a part of it!`,
      formal: `It is with great pleasure that we officially announce <strong>${eventTitle}</strong>. This event marks a significant occasion for our community.`,
      casual: `Big news! <strong>${eventTitle}</strong> is happening and it's going to be epic. Read on for all the details!`,
      urgent: `<strong>Limited spots available!</strong> We're announcing <strong>${eventTitle}</strong> — act now before it sells out.`,
    },
    custom: {
      professional: `We are reaching out with an important update regarding <strong>${eventTitle}</strong>.`,
      friendly: `Hey! We've got a message for you about <strong>${eventTitle}</strong> that we think you'll want to read.`,
      formal: `Please find below an official communication pertaining to <strong>${eventTitle}</strong>.`,
      casual: `Quick update for you about <strong>${eventTitle}</strong> — read on!`,
      urgent: `<strong>Urgent:</strong> Please read this message about <strong>${eventTitle}</strong> right away.`,
    },
  };

  const bodyIntro = bodyIntroMap[campaignType]?.[tone] ?? `We're reaching out about <strong>${eventTitle}</strong>.`;

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

          <!-- INFO CARDS: LOCATION + TYPE -->
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
                    <span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">🕐 Time</span>
                    <p style="${infoValueStyle}">${eventTime || "Time TBD"}</p>
                    <p style="${infoSubStyle}">${eventDate || "Date TBD"}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SPEAKER / TOPIC HIGHLIGHT (conditional) -->
          ${speakerBlock || topicBlock ? `<tr><td style="padding:0 40px 8px;">${speakerBlock}${topicBlock}</td></tr>` : ""}

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
