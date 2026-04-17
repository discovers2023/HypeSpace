import { Router, type IRouter } from "express";
import { db, organizationsTable, teamMembersTable, eventsTable, usersTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";
import {
  ListOrganizationsResponse,
  CreateOrganizationBody,
  GetOrganizationParams,
  GetOrganizationResponse,
  UpdateOrganizationParams,
  UpdateOrganizationBody,
  UpdateOrganizationResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatOrg(org: typeof organizationsTable.$inferSelect, memberCount: number, eventCount: number) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    logoUrl: org.logoUrl,
    plan: org.plan,
    ownerId: org.ownerId,
    memberCount,
    eventCount,
    createdAt: org.createdAt.toISOString(),
    primaryColor: org.primaryColor ?? null,
    accentColor: org.accentColor ?? null,
    fromEmail: org.fromEmail ?? null,
    replyToEmail: org.replyToEmail ?? null,
    emailFooterText: org.emailFooterText ?? null,
  };
}

router.get("/organizations", async (req, res): Promise<void> => {
  const userId = 1;
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.userId, userId));
  const orgIds = members.map(m => m.organizationId);
  if (orgIds.length === 0) {
    res.json(ListOrganizationsResponse.parse([]));
    return;
  }
  const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgIds[0]));
  const result = await Promise.all(orgs.map(async (org) => {
    const [mc] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, org.id));
    const [ec] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, org.id));
    return formatOrg(org, mc.c, ec.c);
  }));
  res.json(ListOrganizationsResponse.parse(result));
});

router.post("/organizations", async (req, res): Promise<void> => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = 1;
  const [org] = await db.insert(organizationsTable).values({ ...parsed.data, ownerId: userId }).returning();
  await db.insert(teamMembersTable).values({ userId, organizationId: org.id, role: "owner", status: "active", joinedAt: new Date() });
  res.status(201).json(GetOrganizationResponse.parse(formatOrg(org, 1, 0)));
});

router.get("/organizations/:orgId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [mc] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));
  const [ec] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  res.json(GetOrganizationResponse.parse(formatOrg(org, mc.c, ec.c)));
});

router.put("/organizations/:orgId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = UpdateOrganizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [org] = await db.update(organizationsTable).set(parsed.data).where(eq(organizationsTable.id, orgId)).returning();
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [mc] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));
  const [ec] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, orgId));
  res.json(UpdateOrganizationResponse.parse(formatOrg(org, mc.c, ec.c)));
});

// PATCH /organizations/:orgId/onboarding — set/clear onboardingCompletedAt for the org.
// Uses req.session.userId (NOT the hardcoded userId=1 above) so completion is tied
// to the actual authenticated user, and enforces membership to prevent IDOR.
router.patch("/organizations/:orgId/onboarding", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "Invalid orgId" });
    return;
  }

  // Verify user is a member of this org (cheap IDOR check).
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, userId), eq(teamMembersTable.organizationId, orgId)));
  if (!membership) { res.status(404).json({ error: "Organization not found" }); return; }

  const { completedAt } = req.body ?? {};
  // Accept an ISO string or null. Anything else → 400.
  let value: Date | null;
  if (completedAt === null) {
    value = null;
  } else if (typeof completedAt === "string") {
    const d = new Date(completedAt);
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "Invalid completedAt" }); return; }
    value = d;
  } else {
    res.status(400).json({ error: "completedAt must be an ISO string or null" });
    return;
  }

  const [updated] = await db
    .update(organizationsTable)
    .set({ onboardingCompletedAt: value })
    .where(eq(organizationsTable.id, orgId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Organization not found" }); return; }

  res.json({ onboardingCompletedAt: updated.onboardingCompletedAt?.toISOString() ?? null });
});

export default router;
