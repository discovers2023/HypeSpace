import { Router, type IRouter } from "express";
import { db, guestsTable, activityTable, eventsTable, organizationsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import {
  ListGuestsResponse,
  AddGuestBody,
  BulkAddGuestsBody,
  UpdateGuestBody,
  UpdateGuestResponse,
} from "@workspace/api-zod";
import { getPlan, assertWithinLimit, PlanLimitError } from "../lib/plans";
import { syncRsvpToGHL, syncRsvpToCustomCRM } from "./integrations";

const router: IRouter = Router();

async function checkGuestCapacity(orgId: number, eventId: number, addingCount: number): Promise<PlanLimitError | null> {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) return null;
  const plan = getPlan(org.plan);
  const [gc] = await db.select({ c: count() }).from(guestsTable).where(eq(guestsTable.eventId, eventId));
  try {
    assertWithinLimit(plan.key, "attendeesPerEvent", (gc?.c ?? 0) + addingCount, plan.attendeesPerEvent, "attendees per event");
    return null;
  } catch (e) {
    if (e instanceof PlanLimitError) return e;
    throw e;
  }
}

function formatGuest(g: typeof guestsTable.$inferSelect) {
  return {
    id: g.id,
    eventId: g.eventId,
    email: g.email,
    name: g.name,
    phone: g.phone ?? null,
    company: g.company ?? null,
    status: g.status,
    notes: g.notes ?? null,
    invitedAt: g.invitedAt?.toISOString() ?? null,
    respondedAt: g.respondedAt?.toISOString() ?? null,
  };
}

router.get("/organizations/:orgId/events/:eventId/guests", async (req, res): Promise<void> => {
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const eventId = parseInt(rawEventId, 10);
  const { status } = req.query as { status?: string };
  let query = db.select().from(guestsTable).where(eq(guestsTable.eventId, eventId));
  const guests = await query;
  const filtered = status ? guests.filter(g => g.status === status) : guests;
  res.json(ListGuestsResponse.parse(filtered.map(formatGuest)));
});

router.post("/organizations/:orgId/events/:eventId/guests", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  const parsed = AddGuestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const capErr = await checkGuestCapacity(orgId, eventId, 1);
  if (capErr) {
    res.status(402).json({ error: capErr.code, message: "Attendee limit reached for this event.", limit: capErr.limit, plan: capErr.plan, current: capErr.current, max: capErr.max, suggestedPlan: capErr.suggestedPlan });
    return;
  }

  const [guest] = await db.insert(guestsTable).values({
    ...parsed.data,
    eventId,
    status: "added",
  }).returning();

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (event) {
    await db.insert(activityTable).values({
      organizationId: orgId,
      type: "guest_added",
      title: "Guest Added",
      description: `${guest.name} added to ${event.title}`,
      entityId: eventId,
      entityType: "event",
    });
  }

  res.status(201).json(formatGuest(guest));
});

router.post("/organizations/:orgId/events/:eventId/guests/bulk", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const orgId = parseInt(rawOrgId, 10);
  const eventId = parseInt(rawEventId, 10);
  const parsed = BulkAddGuestsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const capErr = await checkGuestCapacity(orgId, eventId, parsed.data.guests.length);
  if (capErr) {
    res.status(402).json({ error: capErr.code, message: `Importing ${parsed.data.guests.length} guests would exceed this event's attendee limit.`, limit: capErr.limit, plan: capErr.plan, current: capErr.current, max: capErr.max, suggestedPlan: capErr.suggestedPlan });
    return;
  }

  const inserted = await db.insert(guestsTable).values(
    parsed.data.guests.map(g => ({ ...g, eventId, status: "added" as const }))
  ).returning();

  res.status(201).json(inserted.map(formatGuest));
});

router.put("/organizations/:orgId/events/:eventId/guests/:guestId", async (req, res): Promise<void> => {
  const rawGuestId = Array.isArray(req.params.guestId) ? req.params.guestId[0] : req.params.guestId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const guestId = parseInt(rawGuestId, 10);
  const eventId = parseInt(rawEventId, 10);
  const parsed = UpdateGuestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "invited") {
    updateData.invitedAt = new Date();
  }
  if (parsed.data.status && ["confirmed", "declined"].includes(parsed.data.status)) {
    updateData.respondedAt = new Date();
  }

  const [guest] = await db.update(guestsTable).set(updateData)
    .where(and(eq(guestsTable.id, guestId), eq(guestsTable.eventId, eventId)))
    .returning();
  if (!guest) { res.status(404).json({ error: "Guest not found" }); return; }
  res.json(UpdateGuestResponse.parse(formatGuest(guest)));

  // Fire CRM syncs in the background for RSVP-relevant status changes
  const rsvpStatuses = ["confirmed", "declined", "maybe"];
  if (parsed.data.status && rsvpStatuses.includes(parsed.data.status)) {
    const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
    const orgId = parseInt(rawOrgId, 10);
    const guestContact = { name: guest.name, email: guest.email, phone: guest.phone ?? null };
    // Look up event title for the custom CRM payload
    const [event] = await db.select({ title: eventsTable.title }).from(eventsTable).where(eq(eventsTable.id, eventId));
    const eventTitle = event?.title;
    // Both are best-effort (never throw)
    Promise.all([
      syncRsvpToGHL(orgId, guestContact, parsed.data.status),
      syncRsvpToCustomCRM(orgId, guestContact, parsed.data.status, eventTitle),
    ]).catch(() => {});
  }
});

router.delete("/organizations/:orgId/events/:eventId/guests/:guestId", async (req, res): Promise<void> => {
  const rawGuestId = Array.isArray(req.params.guestId) ? req.params.guestId[0] : req.params.guestId;
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const guestId = parseInt(rawGuestId, 10);
  const eventId = parseInt(rawEventId, 10);
  await db.delete(guestsTable).where(and(eq(guestsTable.id, guestId), eq(guestsTable.eventId, eventId)));
  res.sendStatus(204);
});

export default router;
