import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable, teamMembersTable, eventsTable, campaignsTable, guestsTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// Admin credentials — in production, use env vars or a separate admin_users table
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@hypespace.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "HypeAdmin2026!";

// Simple admin session check (separate from user sessions)
function requireAdmin(req: any, res: any, next: any): void {
  if (!req.session?.isAdmin) {
    res.status(401).json({ error: "Admin access required" });
    return;
  }
  next();
}

// POST /admin/login
router.post("/admin/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ ok: true, email: ADMIN_EMAIL });
  } else {
    res.status(401).json({ error: "Invalid admin credentials" });
  }
});

// POST /admin/logout
router.post("/admin/logout", (req: any, res: any): void => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

// GET /admin/me
router.get("/admin/me", requireAdmin, (req: any, res: any): void => {
  res.json({ email: ADMIN_EMAIL, isAdmin: true });
});

// GET /admin/stats — overview dashboard
router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ c: count() }).from(usersTable);
  const [orgCount] = await db.select({ c: count() }).from(organizationsTable);
  const [eventCount] = await db.select({ c: count() }).from(eventsTable);
  const [campaignCount] = await db.select({ c: count() }).from(campaignsTable);
  const [guestCount] = await db.select({ c: count() }).from(guestsTable);

  res.json({
    users: userCount?.c ?? 0,
    organizations: orgCount?.c ?? 0,
    events: eventCount?.c ?? 0,
    campaigns: campaignCount?.c ?? 0,
    guests: guestCount?.c ?? 0,
  });
});

// GET /admin/organizations — list all orgs with details
router.get("/admin/organizations", requireAdmin, async (_req, res): Promise<void> => {
  const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  const result = await Promise.all(orgs.map(async (org) => {
    const [mc] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, org.id));
    const [ec] = await db.select({ c: count() }).from(eventsTable).where(eq(eventsTable.organizationId, org.id));
    const owner = org.ownerId
      ? await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, org.ownerId)).then(r => r[0])
      : null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      memberCount: mc?.c ?? 0,
      eventCount: ec?.c ?? 0,
      owner: owner ? { name: owner.name, email: owner.email } : null,
      createdAt: org.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

// GET /admin/users �� list all users
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    emailVerified: usersTable.emailVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));

  res.json(users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  })));
});

// POST /admin/impersonate/:userId — log in as a user (for support)
router.post("/admin/impersonate/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Set user session while keeping admin flag
  req.session.userId = user.id;
  req.session.isAdmin = true;
  req.session.impersonating = true;

  res.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    message: `Now impersonating ${user.name} (${user.email}). Use the app normally — all actions are on behalf of this user.`,
  });
});

// POST /admin/stop-impersonating — stop impersonation
router.post("/admin/stop-impersonating", requireAdmin, (req: any, res: any): void => {
  delete req.session.userId;
  req.session.impersonating = false;
  res.json({ ok: true });
});

// PATCH /admin/organizations/:orgId/plan — override plan for any org
router.patch("/admin/organizations/:orgId/plan", requireAdmin, async (req, res): Promise<void> => {
  const orgId = parseInt(Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId, 10);
  const { plan } = req.body ?? {};
  if (!plan || !["free", "starter", "growth", "agency"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  const [org] = await db.update(organizationsTable).set({ plan }).where(eq(organizationsTable.id, orgId)).returning();
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  res.json({ ok: true, plan: org.plan });
});

// PATCH /admin/users/:userId/verify — force-verify a user's email
router.patch("/admin/users/:userId/verify", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const [user] = await db.update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ok: true, email: user.email, emailVerified: true });
});

export default router;
