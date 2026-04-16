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

// PATCH /organizations/:orgId/plan — change org plan (with downgrade validation)
router.patch("/organizations/:orgId/plan", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const { plan: newPlanKey } = req.body ?? {};

  if (!newPlanKey || !PLANS[newPlanKey]) {
    res.status(400).json({ error: "Invalid plan key", validPlans: PLAN_ORDER });
    return;
  }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  const currentPlan = getPlan(org.plan);
  const newPlan = PLANS[newPlanKey];

  if (currentPlan.key === newPlan.key) {
    res.status(400).json({ error: "Already on this plan" });
    return;
  }

  // Downgrade validation: check current usage fits new limits
  const [evc] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  const [tm] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));

  const events = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  let largestEventAttendees = 0;
  if (events.length > 0) {
    const ids = events.map((e) => e.id);
    const rows = await db.select({ eventId: guestsTable.eventId }).from(guestsTable).where(inArray(guestsTable.eventId, ids));
    const perEvent: Record<number, number> = {};
    for (const r of rows) perEvent[r.eventId] = (perEvent[r.eventId] ?? 0) + 1;
    largestEventAttendees = Math.max(0, ...Object.values(perEvent));
  }

  const violations: string[] = [];
  const eventCount = evc?.c ?? 0;
  const userCount = tm?.c ?? 0;

  if (newPlan.events !== null && eventCount > newPlan.events) {
    violations.push(`You have ${eventCount} events but the ${newPlan.name} plan allows ${newPlan.events}. Delete ${eventCount - newPlan.events} event(s) first.`);
  }
  if (newPlan.users !== null && userCount > newPlan.users) {
    violations.push(`You have ${userCount} team members but the ${newPlan.name} plan allows ${newPlan.users}. Remove ${userCount - newPlan.users} member(s) first.`);
  }
  if (newPlan.attendeesPerEvent !== null && largestEventAttendees > newPlan.attendeesPerEvent) {
    violations.push(`Your largest event has ${largestEventAttendees} guests but the ${newPlan.name} plan allows ${newPlan.attendeesPerEvent}. Remove guests first.`);
  }
  if (!newPlan.canSendCampaigns && currentPlan.canSendCampaigns) {
    violations.push(`The ${newPlan.name} plan does not include email campaigns.`);
  }

  if (violations.length > 0) {
    res.status(422).json({ error: "Cannot downgrade — usage exceeds new plan limits", violations });
    return;
  }

  await db.update(organizationsTable).set({ plan: newPlanKey }).where(eq(organizationsTable.id, orgId));

  res.json({ success: true, plan: newPlan });
});

export default router;
