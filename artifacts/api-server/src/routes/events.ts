import { Router, type IRouter } from "express";
import { db, eventsTable, guestsTable, activityTable, campaignsTable, socialPostsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { syncRsvpToGHL } from "./integrations";
import {
  ListEventsResponse,
  CreateEventBody,
  GetEventResponse,
  UpdateEventBody,
  UpdateEventResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Generate a URL-safe slug from event title + short random suffix. */
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

async function formatEvent(event: typeof eventsTable.$inferSelect) {
  // Lazy backfill: generate slug for events that don't have one yet
  if (!event.slug) {
    const slug = generateSlug(event.title);
    const [updated] = await db.update(eventsTable).set({ slug }).where(eq(eventsTable.id, event.id)).returning();
    if (updated) event = updated;
  }

  const [gc] = await db.select({ c: count() }).from(guestsTable).where(eq(guestsTable.eventId, event.id));
  const confirmed = await db.select().from(guestsTable)
    .where(and(eq(guestsTable.eventId, event.id), eq(guestsTable.status, "confirmed")));
  return {
    id: event.id,
    organizationId: event.organizationId,
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    category: event.category,
    status: event.status,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    timezone: event.timezone,
    location: event.location ?? null,
    onlineUrl: event.onlineUrl ?? null,
    capacity: event.capacity ?? null,
    coverImageUrl: event.coverImageUrl ?? null,
    slug: event.slug ?? null,
    publicId: event.publicId,
    guestCount: gc.c,
    confirmedCount: confirmed.length,
    createdAt: event.createdAt.toISOString(),
  };
}

router.get("/organizations/:orgId/events", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  let query = db.select().from(eventsTable).where(eq(eventsTable.organizationId, orgId)).$dynamic();
  const events = await query;
  const result = await Promise.all(events.map(formatEvent));
  res.json(ListEventsResponse.parse(result));
});

router.post("/organizations/:orgId/events", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [event] = await db.insert(eventsTable).values({
    ...parsed.data,
    organizationId: orgId,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    slug: generateSlug(parsed.data.title),
  }).returning();

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "event_created",
    title: "Event Created",
    description: `${event.title} was created`,
    entityId: event.id,
    entityType: "event",
  });

  res.status(201).json(GetEventResponse.parse(await formatEvent(event)));
});

router.get("/organizations/:orgId/events/:eventId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  const [event] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(GetEventResponse.parse(await formatEvent(event)));
});

router.put("/organizations/:orgId/events/:eventId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate) updateData.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) updateData.endDate = new Date(parsed.data.endDate);

  const [event] = await db.update(eventsTable).set(updateData)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)))
    .returning();
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  if (parsed.data.status === "published") {
    await db.insert(activityTable).values({
      organizationId: orgId,
      type: "event_published",
      title: "Event Published",
      description: `${event.title} is now live`,
      entityId: event.id,
      entityType: "event",
    });
  }

  res.json(UpdateEventResponse.parse(await formatEvent(event)));
});

// --- Launch endpoint: send campaign to all guests, create social post, publish event ---
router.post("/organizations/:orgId/events/:eventId/launch", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);

  const [event] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Find the linked campaign for this event
  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.eventId, eventId), eq(campaignsTable.organizationId, orgId)));

  // Get all guests and mark them as invited
  const guests = await db.select().from(guestsTable).where(eq(guestsTable.eventId, eventId));
  const now = new Date();
  for (const guest of guests) {
    if (guest.status === "added") {
      await db.update(guestsTable).set({ status: "invited", invitedAt: now }).where(eq(guestsTable.id, guest.id));
    }
  }

  // Determine the base URL for RSVP links in campaign emails
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

  // Mark campaign as sent and send personalized emails to each guest
  if (campaign) {
    for (const guest of guests) {
      // Personalize CTA link: append guest token for pre-identified RSVP
      const genericLink = `/e/${event.slug}`;
      const personalLink = `/e/${event.slug}?t=${guest.id}`;
      const personalizedHtml = (campaign.htmlContent ?? "")
        .replace(new RegExp(`href="${genericLink}"`, "g"), `href="${personalLink}"`)
        .replace(new RegExp(`href="${genericLink}\\?`, "g"), `href="${personalLink}&`);

      // In production this would call the mailer. For now, log it.
      console.log(`[LAUNCH] Email → ${guest.email} | Subject: ${campaign.subject}`);
      console.log(`[LAUNCH] RSVP link: ${appBaseUrl}${personalLink}`);
    }

    await db.update(campaignsTable).set({
      status: "sent",
      sentAt: now,
      recipientCount: guests.length,
    }).where(eq(campaignsTable.id, campaign.id));

    await db.insert(activityTable).values({
      organizationId: orgId,
      type: "campaign_sent",
      title: "Campaign Sent",
      description: `${campaign.name} sent to ${guests.length} guests`,
      entityId: campaign.id,
      entityType: "campaign",
    });
  }

  // Auto-create a social post announcing the event
  const [socialPost] = await db.insert(socialPostsTable).values({
    organizationId: orgId,
    eventId,
    platform: "linkedin",
    content: `We're excited to announce ${event.title}! ${event.description || ""} Join us on ${event.startDate.toLocaleDateString()}.`.trim(),
    status: "published",
    publishedAt: now,
  }).returning();

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "social_posted",
    title: "Social Post Published",
    description: `Launch announcement posted to LinkedIn`,
    entityId: socialPost.id,
    entityType: "social_post",
  });

  // Set event status to published
  const [updated] = await db.update(eventsTable).set({ status: "published" })
    .where(eq(eventsTable.id, eventId))
    .returning();

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "event_published",
    title: "Event Launched",
    description: `${event.title} is now live — ${guests.length} guests invited`,
    entityId: eventId,
    entityType: "event",
  });

  res.json({
    event: await formatEvent(updated),
    guestsInvited: guests.length,
    campaignSent: !!campaign,
    socialPostCreated: true,
  });
});

// --- Public event endpoint (no auth) ---
router.get("/public/events/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Return public-safe event data (no internal IDs exposed beyond what's needed)
  res.json({
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    category: event.category,
    status: event.status,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    timezone: event.timezone,
    location: event.location ?? null,
    onlineUrl: event.type === "remote" || event.type === "hybrid" ? (event.onlineUrl ?? null) : null,
    coverImageUrl: event.coverImageUrl ?? null,
    slug: event.slug,
  });
});

// --- Public RSVP endpoint ---
router.post("/public/events/:slug/rsvp", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const { status, guestToken, firstName, lastName, name, email, practiceName, specialty, phone } = req.body as {
    status: string;
    guestToken?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    practiceName?: string;
    specialty?: string;
    phone?: string;
  };

  if (!["confirmed", "maybe", "declined"].includes(status)) {
    res.status(400).json({ error: "Invalid RSVP status" });
    return;
  }

  // If guest token provided, update existing guest
  if (guestToken) {
    const guestId = parseInt(guestToken, 10);
    const [guest] = await db.update(guestsTable)
      .set({ status, respondedAt: new Date() })
      .where(and(eq(guestsTable.id, guestId), eq(guestsTable.eventId, event.id)))
      .returning();
    if (!guest) { res.status(404).json({ error: "Guest not found" }); return; }

    // Sync RSVP status to GHL (best-effort, non-blocking)
    syncRsvpToGHL(event.organizationId, { name: guest.name, email: guest.email, phone: guest.phone }, status);

    res.json({ status: guest.status, name: guest.name });
    return;
  }

  // Self-register: create new guest with RSVP status
  const fullName = name || [firstName, lastName].filter(Boolean).join(" ");
  if (!fullName || !email) {
    res.status(400).json({ error: "Name and email are required for self-registration" });
    return;
  }

  const [guest] = await db.insert(guestsTable).values({
    eventId: event.id,
    name: fullName,
    email,
    phone: phone ?? undefined,
    practiceName: practiceName ?? undefined,
    specialty: specialty ?? undefined,
    company: practiceName ?? undefined,
    status,
    respondedAt: new Date(),
  }).returning();

  // Sync new guest to GHL (creates contact if not found, sets RSVP tag)
  syncRsvpToGHL(event.organizationId, { name: fullName, email, phone }, status);

  res.status(201).json({ status: guest.status, name: guest.name });
});

router.delete("/organizations/:orgId/events/:eventId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  await db.delete(guestsTable).where(eq(guestsTable.eventId, eventId));
  await db.delete(eventsTable).where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
