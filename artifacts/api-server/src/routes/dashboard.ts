import { Router, type IRouter } from "express";
import { db, eventsTable, guestsTable, campaignsTable, activityTable } from "@workspace/db";
import { eq, and, count, avg, desc } from "drizzle-orm";
import {
  GetDashboardStatsResponse,
  GetRecentActivityResponse,
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

router.get("/organizations/:orgId/dashboard", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);

  const events = await db.select().from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  const guests = await db.select().from(guestsTable);
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.organizationId, orgId));

  const eventIds = events.map(e => e.id);
  const eventGuests = guests.filter(g => eventIds.includes(g.eventId));

  const activeEvents = events.filter(e => e.status === "published").length;
  const totalGuests = eventGuests.length;
  const confirmedGuests = eventGuests.filter(g => g.status === "confirmed").length;
  const campaignsSent = campaigns.filter(c => c.status === "sent").length;

  const sentCampaigns = campaigns.filter(c => c.status === "sent" && c.openRate != null);
  const avgOpenRate = sentCampaigns.length > 0
    ? sentCampaigns.reduce((acc, c) => acc + (c.openRate ?? 0), 0) / sentCampaigns.length
    : 0;

  const upcomingEvents = events
    .filter(e => e.status === "published" && new Date(e.startDate) > new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const upcomingFormatted = await Promise.all(upcomingEvents.map(formatEvent));

  const guestsByStatus = {
    added: eventGuests.filter(g => g.status === "added").length,
    invited: eventGuests.filter(g => g.status === "invited").length,
    confirmed: eventGuests.filter(g => g.status === "confirmed").length,
    declined: eventGuests.filter(g => g.status === "declined").length,
    maybe: eventGuests.filter(g => g.status === "maybe").length,
    attended: eventGuests.filter(g => g.status === "attended").length,
  };

  const eventsByType = {
    onsite: events.filter(e => e.type === "onsite").length,
    remote: events.filter(e => e.type === "remote").length,
    hybrid: events.filter(e => e.type === "hybrid").length,
  };

  const perEventRsvp = events.map(event => {
    const eg = eventGuests.filter(g => g.eventId === event.id);
    return {
      eventId: event.id,
      title: event.title,
      yes: eg.filter(g => g.status === "confirmed" || g.status === "attended").length,
      no: eg.filter(g => g.status === "declined").length,
      maybe: eg.filter(g => g.status === "maybe").length,
      invited: eg.filter(g => g.status === "invited").length,
      total: eg.length,
    };
  });

  res.json(GetDashboardStatsResponse.parse({
    totalEvents: events.length,
    activeEvents,
    totalGuests,
    confirmedGuests,
    campaignsSent,
    avgOpenRate,
    upcomingEvents: upcomingFormatted,
    guestsByStatus,
    eventsByType,
    perEventRsvp,
  }));
});

router.get("/organizations/:orgId/activity", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const rawLimit = req.query.limit as string | undefined;
  const limit = rawLimit ? parseInt(rawLimit, 10) : 20;

  const items = await db.select().from(activityTable)
    .where(eq(activityTable.organizationId, orgId))
    .orderBy(desc(activityTable.createdAt))
    .limit(limit);

  res.json(GetRecentActivityResponse.parse(items.map(i => ({
    id: i.id,
    type: i.type,
    title: i.title,
    description: i.description,
    entityId: i.entityId ?? null,
    entityType: i.entityType ?? null,
    createdAt: i.createdAt.toISOString(),
  }))));
});

export default router;
