import { Router, type IRouter } from "express";
import { db, organizationsTable, eventsTable, teamMembersTable, guestsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { PLANS, PLAN_ORDER, getPlan } from "../lib/plans";

const router: IRouter = Router();

// GET /plans — list all plans with their limits (public)
router.get("/plans", (_req, res) => {
  res.json({ plans: PLAN_ORDER.map((k) => PLANS[k]) });
});

// GET /organizations/:orgId/usage — current plan + usage vs. limits
router.get("/organizations/:orgId/usage", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  const plan = getPlan(org.plan);

  const [evc] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  const [tm] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));

  // Largest-event attendee count (used for plan progress bar)
  const events = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  let largestEventAttendees = 0;
  if (events.length > 0) {
    const ids = events.map((e) => e.id);
    const rows = await db.select({ eventId: guestsTable.eventId }).from(guestsTable).where(inArray(guestsTable.eventId, ids));
    const perEvent: Record<number, number> = {};
    for (const r of rows) perEvent[r.eventId] = (perEvent[r.eventId] ?? 0) + 1;
    largestEventAttendees = Math.max(0, ...Object.values(perEvent));
  }

  res.json({
    plan,
    usage: {
      events: evc?.c ?? 0,
      users: tm?.c ?? 0,
      largestEventAttendees,
    },
  });
});

export default router;
