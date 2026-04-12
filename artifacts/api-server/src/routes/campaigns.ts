import { Router, type IRouter } from "express";
import { db, campaignsTable, activityTable, eventsTable } from "@workspace/db";
import { eq, and, avg } from "drizzle-orm";
import { sendEmail } from "../lib/email";
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
  });

  res.json({ sent: true, to, subject: campaign.subject, previewUrl: result.previewUrl || undefined });
});

router.post("/organizations/:orgId/campaigns/ai-generate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = AiGenerateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let eventContext = "";
  let eventSlug = "";
  if (parsed.data.eventId) {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, parsed.data.eventId));
    if (event) {
      eventContext = `Event: ${event.title}, Type: ${event.type}, Date: ${event.startDate.toDateString()}, Location: ${event.location || event.onlineUrl || "TBD"}`;
      eventSlug = event.slug ?? "";
    }
  }

  const { campaignType, tone, additionalContext } = parsed.data;
  // Build the RSVP link. Use a relative path so it works from any origin.
  // At send-time the launch endpoint personalises with ?t=<guestId>.
  const rsvpUrl = eventSlug ? `/e/${eventSlug}` : "#";

  // Generate a header image based on campaign type
  const imageKeywords: Record<string, string> = {
    invitation: "conference,event,professional",
    reminder: "calendar,schedule,professional",
    followup: "thank-you,handshake,team",
    announcement: "celebration,announcement,stage",
    custom: "business,professional,modern",
  };
  const imgQuery = imageKeywords[campaignType] || "event,professional";
  const headerImageUrl = `https://source.unsplash.com/600x200/?${imgQuery}&sig=${Date.now()}`;

  const subjectMap: Record<string, Record<string, string>> = {
    invitation: {
      professional: "You are Invited: Join Us for an Exclusive Event",
      friendly: "Hey! We'd love to see you at our event",
      formal: "Formal Invitation to Our Upcoming Event",
      casual: "Join us! It's going to be great",
      urgent: "Last Chance: Reserve Your Spot Now",
    },
    reminder: {
      professional: "Reminder: Your Event is Coming Up",
      friendly: "Don't forget — the event is almost here!",
      formal: "Event Reminder Notice",
      casual: "Quick reminder about the event",
      urgent: "Urgent: Event Happening in 24 Hours",
    },
    followup: {
      professional: "Thank You for Attending — Key Takeaways",
      friendly: "Thanks for coming! Here's what happened",
      formal: "Post-Event Follow-Up Communication",
      casual: "Hope you had fun! Here's a recap",
      urgent: "Action Required: Post-Event Survey",
    },
    announcement: {
      professional: "Exciting News: Announcing Our Next Event",
      friendly: "Big News: We're hosting something special!",
      formal: "Official Event Announcement",
      casual: "Guess what? New event alert!",
      urgent: "Breaking: Limited Spots Available",
    },
    custom: {
      professional: "Important Update from HypeSpace Events",
      friendly: "A message from our events team",
      formal: "Official Communication",
      casual: "Hey, quick update for you",
      urgent: "Time-Sensitive: Please Read",
    },
  };

  const subject = subjectMap[campaignType]?.[tone] ?? "Event Communication";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f4ff; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #FF8C00, #FF1493); padding: 40px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .body { padding: 40px; }
    .body h2 { color: #1a0533; font-size: 22px; }
    .body p { color: #4a4a6a; line-height: 1.7; }
    .cta { display: inline-block; background: linear-gradient(135deg, #FF8C00, #FF1493); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .event-card { background: #f8f4ff; border-left: 4px solid #FF1493; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .footer { background: #1a0533; color: rgba(255,255,255,0.6); padding: 24px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${headerImageUrl}" alt="Campaign header" class="header-img" style="width:100%;max-height:200px;object-fit:cover;border-radius:0;margin-bottom:16px;" />
      <h1>HypeSpace Events</h1>
      <p>Where moments are made</p>
    </div>
    <div class="body">
      <h2>${subject}</h2>
      ${eventContext ? `<div class="event-card"><strong>${eventContext}</strong></div>` : ""}
      <p>We're thrilled to reach out about an upcoming experience curated specifically for you. ${additionalContext || "This is a special event you won't want to miss."}</p>
      <p>Whether you're looking to connect, learn, or grow — this ${campaignType === "invitation" ? "event" : "experience"} has been designed with you in mind.</p>
      <a href="${rsvpUrl}" class="cta">${campaignType === "invitation" ? "Reserve My Spot" : campaignType === "reminder" ? "View Event Details" : campaignType === "followup" ? "Share Your Feedback" : "Learn More"}</a>
      <p>If you have any questions, don't hesitate to reach out to our team. We look forward to seeing you there.</p>
      <p>Warmly,<br><strong>The HypeSpace Events Team</strong></p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you're on our guest list.</p>
      <p>HypeSpace Events | Unsubscribe | Privacy Policy</p>
    </div>
  </div>
</body>
</html>`;

  const textContent = `${subject}\n\n${eventContext ? `${eventContext}\n\n` : ""}We're thrilled to reach out about an upcoming experience curated specifically for you. ${additionalContext || "This is a special event you won't want to miss."}\n\nFor more information, please contact our team.\n\nWarmly,\nThe HypeSpace Events Team`;

  res.json(AiGenerateCampaignResponse.parse({
    subject,
    htmlContent,
    textContent,
    suggestions: [
      "Add the event date and location in the opening paragraph for clarity",
      "Include a countdown timer to create urgency",
      "Personalize with the recipient's first name using merge tags",
      "Add social proof with attendee testimonials or speaker bios",
    ],
  }));
});

export default router;
