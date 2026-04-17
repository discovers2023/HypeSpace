import { Router, type IRouter } from "express";
import { db, eventsTable, guestsTable, activityTable, campaignsTable, socialPostsTable, sendingDomainsTable, organizationsTable, remindersTable } from "@workspace/db";
import { eq, and, count, gt } from "drizzle-orm";
import { syncRsvpToGHL } from "./integrations";
import { sendEmail } from "../lib/email";
import { getPlan, assertWithinLimit, PlanLimitError } from "../lib/plans";
import { getAppBaseUrl } from "../lib/app-url";
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
    recurrence: event.recurrence ?? "one_time",
    recurrenceEndDate: event.recurrenceEndDate?.toISOString() ?? null,
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

  // Enforce plan event-count limit — only active (non-past) events count.
  // Expired events (endDate in the past) do not block creating a new one.
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const plan = getPlan(org.plan);
  const now = new Date();
  const [eventCountRow] = await db
    .select({ c: count() })
    .from(eventsTable)
    .where(and(eq(eventsTable.organizationId, orgId), gt(eventsTable.endDate, now)));
  try {
    assertWithinLimit(plan.key, "events", (eventCountRow?.c ?? 0) + 1, plan.events, "active events");
  } catch (e) {
    if (e instanceof PlanLimitError) {
      res.status(402).json({ error: e.code, message: e.message, limit: e.limit, plan: e.plan, current: e.current, max: e.max, suggestedPlan: e.suggestedPlan });
      return;
    }
    throw e;
  }

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
  const appBaseUrl = getAppBaseUrl(req);

  // Look up verified sending domain for this org (so emails come from their domain)
  const [sendingDomain] = await db.select().from(sendingDomainsTable)
    .where(and(eq(sendingDomainsTable.organizationId, orgId), eq(sendingDomainsTable.status, "verified")));
  const fromOverride = sendingDomain
    ? { name: sendingDomain.fromName, email: sendingDomain.fromEmail }
    : undefined;

  // Mark campaign as sent and send personalized emails to each guest
  if (campaign) {
    const baseUrl = appBaseUrl.replace(/\/$/, "");
    for (const guest of guests) {
      // Personalize CTA link: append guest token so the pre-identified recipient
      // can RSVP without filling the form. Handles both relative legacy links
      // (/e/slug) and the new absolute links (https://host/e/slug).
      const relGeneric = `/e/${event.slug}`;
      const relPersonal = `${relGeneric}?t=${guest.rsvpToken}`;
      const absGeneric = `${baseUrl}${relGeneric}`;
      const absPersonal = `${baseUrl}${relPersonal}`;
      const personalizedHtml = (campaign.htmlContent ?? "")
        .replace(new RegExp(`href="${absGeneric}"`, "g"), `href="${absPersonal}"`)
        .replace(new RegExp(`href="${absGeneric}\\?`, "g"), `href="${absPersonal}&`)
        .replace(new RegExp(`href="${relGeneric}"`, "g"), `href="${absPersonal}"`)
        .replace(new RegExp(`href="${relGeneric}\\?`, "g"), `href="${absPersonal}&`);

      await sendEmail({
        to: guest.email,
        toName: guest.name,
        subject: campaign.subject,
        html: personalizedHtml,
        text: campaign.textContent ?? undefined,
        fromOverride,
        orgId,
      });
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

  // Auto-create default reminders (14d, 7d, 3d, 1d, 4h before event)
  const startDate = new Date(event.startDate);
  const defaultReminders = [
    { offsetHours: 336, label: "14 days" },
    { offsetHours: 168, label: "7 days" },
    { offsetHours: 72, label: "3 days" },
    { offsetHours: 24, label: "1 day" },
    { offsetHours: 4, label: "4 hours" },
  ];
  for (const r of defaultReminders) {
    const scheduledAt = new Date(startDate.getTime() - r.offsetHours * 60 * 60 * 1000);
    if (scheduledAt > now) {
      await db.insert(remindersTable).values({
        eventId,
        type: "before_event",
        offsetHours: r.offsetHours,
        audience: "confirmed_and_maybe",
        subject: `Reminder: ${event.title} is in ${r.label}`,
        message: `This is a friendly reminder that ${event.title} is coming up in ${r.label}. We look forward to seeing you there!\n\nEvent: ${event.title}\nDate: ${startDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\nLocation: ${event.location || event.onlineUrl || "See event page"}`,
        scheduledAt,
      });
    }
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

// --- Bulk email to guest segment / selection ---
router.post("/organizations/:orgId/events/:eventId/bulk-email", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);

  const { subject, htmlContent, textContent, recipientFilter, saveAsCampaign } = req.body ?? {};
  if (!subject || !htmlContent || !recipientFilter) {
    res.status(400).json({ error: "subject, htmlContent, recipientFilter required" });
    return;
  }

  const [event] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  let guests = await db.select().from(guestsTable).where(eq(guestsTable.eventId, eventId));
  const mode: string = recipientFilter.mode;
  if (mode === "ids") {
    const ids: number[] = Array.isArray(recipientFilter.guestIds) ? recipientFilter.guestIds.map((n: unknown) => Number(n)) : [];
    const idSet = new Set(ids);
    guests = guests.filter((g) => idSet.has(g.id));
  } else {
    const segment: string = recipientFilter.segment ?? "all";
    const segmentMap: Record<string, (g: typeof guests[number]) => boolean> = {
      all: () => true,
      yes: (g) => g.status === "confirmed",
      no: (g) => g.status === "declined",
      maybe: (g) => g.status === "maybe",
      invited: (g) => g.status === "invited",
      not_responded: (g) => g.status === "invited" || g.status === "added",
    };
    const pred = segmentMap[segment] ?? segmentMap.all;
    guests = guests.filter(pred);
  }

  // De-dupe by email
  const byEmail = new Map<string, typeof guests[number]>();
  for (const g of guests) {
    if (!byEmail.has(g.email)) byEmail.set(g.email, g);
  }
  guests = Array.from(byEmail.values());

  if (guests.length === 0) {
    res.status(400).json({ error: "No recipients match the selected filter" });
    return;
  }
  if (guests.length > 500) {
    res.status(400).json({ error: "Too many recipients (max 500 per send)" });
    return;
  }

  const [sendingDomain] = await db.select().from(sendingDomainsTable)
    .where(and(eq(sendingDomainsTable.organizationId, orgId), eq(sendingDomainsTable.status, "verified")));
  const fromOverride = sendingDomain
    ? { name: sendingDomain.fromName, email: sendingDomain.fromEmail }
    : undefined;

  const appBaseUrl = getAppBaseUrl(req);
  const eventDate = event.startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const now = new Date();
  let sent = 0;
  let failed = 0;
  let firstPreviewUrl: string | undefined;

  for (const guest of guests) {
    const rsvpLink = `${appBaseUrl}/e/${event.slug}?t=${guest.rsvpToken}`;
    const vars: Record<string, string> = {
      "guest.name": guest.name,
      "guest.email": guest.email,
      "event.title": event.title,
      "event.date": eventDate,
      "rsvpLink": rsvpLink,
    };
    const personalize = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
    try {
      const result = await sendEmail({
        to: guest.email,
        toName: guest.name,
        subject: personalize(subject),
        html: personalize(htmlContent),
        text: textContent ? personalize(textContent) : undefined,
        fromOverride,
        orgId,
      });
      sent += 1;
      if (!firstPreviewUrl && typeof result.previewUrl === "string") firstPreviewUrl = result.previewUrl;
    } catch {
      failed += 1;
    }
  }

  let campaignId: number | null = null;
  if (saveAsCampaign !== false) {
    const name = `Event update — ${event.title} — ${now.toLocaleString()}`;
    const [campaign] = await db.insert(campaignsTable).values({
      organizationId: orgId,
      eventId,
      name,
      subject,
      type: "custom",
      status: "sent",
      htmlContent,
      textContent: textContent ?? null,
      recipientCount: sent,
      sentAt: now,
    }).returning();
    campaignId = campaign.id;
  }

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "campaign_sent",
    title: "Event update sent",
    description: `Sent "${subject}" to ${sent} guest${sent === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}`,
    entityId: campaignId ?? eventId,
    entityType: campaignId ? "campaign" : "event",
  });

  res.json({ campaignId, sent, failed, total: guests.length, previewUrl: firstPreviewUrl });
});

// --- Public event endpoint (no auth) ---
// SEC-05: only published events are visible publicly; drafts and cancelled events return 404.
router.get("/public/events/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [event] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.slug, slug), eq(eventsTable.status, "published")));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Return public-safe event data (no internal IDs exposed beyond what's needed).
  // status field omitted — callers of a published-only endpoint don't need it.
  res.json({
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    category: event.category,
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

  const { status, guestToken, firstName, lastName, name, email, practiceName, specialty, phone, optInFuture } = req.body as {
    status: string;
    guestToken?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    practiceName?: string;
    specialty?: string;
    phone?: string;
    optInFuture?: boolean;
  };

  if (!["confirmed", "maybe", "declined"].includes(status)) {
    res.status(400).json({ error: "Invalid RSVP status" });
    return;
  }

  // If guest token provided, update existing guest
  // SEC-04: look up by rsvpToken (random hex string), not integer id.
  if (guestToken) {
    const updateData: Record<string, unknown> = { status, respondedAt: new Date() };
    if (typeof optInFuture === "boolean") updateData.optInFuture = optInFuture;
    const [guest] = await db.update(guestsTable)
      .set(updateData)
      .where(and(eq(guestsTable.rsvpToken, guestToken), eq(guestsTable.eventId, event.id)))
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

  // If an existing guest with this email is already on the event, update it
  const emailLc = email.toLowerCase();
  const [existing] = await db.select().from(guestsTable)
    .where(and(eq(guestsTable.eventId, event.id), eq(guestsTable.email, emailLc)));

  // Enforce plan attendee-per-event limit when creating a new guest
  if (!existing) {
    const [planOrg] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, event.organizationId));
    const plan = getPlan(planOrg?.plan);
    const [gc] = await db.select({ c: count() }).from(guestsTable).where(eq(guestsTable.eventId, event.id));
    try {
      assertWithinLimit(plan.key, "attendeesPerEvent", (gc?.c ?? 0) + 1, plan.attendeesPerEvent, "attendees per event");
    } catch (e) {
      if (e instanceof PlanLimitError) {
        res.status(402).json({ error: e.code, message: "This event has reached its attendee limit.", limit: e.limit, plan: e.plan, current: e.current, max: e.max, suggestedPlan: e.suggestedPlan });
        return;
      }
      throw e;
    }
  }

  let guest: typeof guestsTable.$inferSelect;
  if (existing) {
    const [updated] = await db.update(guestsTable).set({
      status,
      name: fullName,
      phone: phone ?? existing.phone,
      practiceName: practiceName ?? existing.practiceName,
      specialty: specialty ?? existing.specialty,
      company: practiceName ?? existing.company,
      optInFuture: typeof optInFuture === "boolean" ? optInFuture : existing.optInFuture,
      respondedAt: new Date(),
    }).where(eq(guestsTable.id, existing.id)).returning();
    guest = updated;
  } else {
    const [created] = await db.insert(guestsTable).values({
      eventId: event.id,
      name: fullName,
      email: emailLc,
      phone: phone ?? undefined,
      practiceName: practiceName ?? undefined,
      specialty: specialty ?? undefined,
      company: practiceName ?? undefined,
      status,
      optInFuture: typeof optInFuture === "boolean" ? optInFuture : undefined,
      respondedAt: new Date(),
    }).returning();
    guest = created;
  }

  // Sync new guest to GHL (creates contact if not found, sets RSVP tag)
  syncRsvpToGHL(event.organizationId, { name: fullName, email: emailLc, phone }, status);

  res.status(201).json({ status: guest.status, name: guest.name });
});

router.post("/organizations/:orgId/events/:eventId/duplicate", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);

  const [original] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  if (!original) { res.status(404).json({ error: "Event not found" }); return; }

  // Check plan limits (count active events as usual)
  const org = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).then((r) => r[0]);
  if (org) {
    try {
      const plan = getPlan(org.plan ?? "free");
      const now = new Date();
      const [{ c: activeCount }] = await db.select({ c: count() }).from(eventsTable)
        .where(and(eq(eventsTable.organizationId, orgId), gt(eventsTable.endDate, now)));
      assertWithinLimit(plan.key, "events", activeCount, plan.events, "active events");
    } catch (err) {
      if (err instanceof PlanLimitError) {
        res.status(402).json({ error: err.message, code: "PLAN_LIMIT" });
        return;
      }
    }
  }

  const newSlug = generateSlug(`copy-${original.title}`);
  const [newEvent] = await db.insert(eventsTable).values({
    organizationId: orgId,
    title: `Copy of ${original.title}`,
    description: original.description,
    startDate: original.startDate,
    endDate: original.endDate,
    location: original.location,
    type: original.type,
    status: "draft",
    capacity: original.capacity,
    timezone: original.timezone,
    category: original.category,
    recurrence: original.recurrence,
    slug: newSlug,
  }).returning();

  res.status(201).json({ id: newEvent.id, slug: newSlug });
});

router.delete("/organizations/:orgId/events/:eventId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  // Cascade-delete all child records before removing the event itself
  await db.delete(guestsTable).where(eq(guestsTable.eventId, eventId));
  await db.delete(remindersTable).where(eq(remindersTable.eventId, eventId));
  await db.delete(campaignsTable).where(eq(campaignsTable.eventId, eventId));
  await db.delete(socialPostsTable).where(eq(socialPostsTable.eventId, eventId));
  await db.delete(eventsTable).where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
