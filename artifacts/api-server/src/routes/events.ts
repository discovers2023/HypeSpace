import { Router, type IRouter } from "express";
import { db, eventsTable, guestsTable, activityTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import {
  ListEventsResponse,
  CreateEventBody,
  GetEventResponse,
  UpdateEventBody,
  UpdateEventResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function formatEvent(event: typeof eventsTable.$inferSelect) {
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
