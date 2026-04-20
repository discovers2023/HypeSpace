import { Router, type IRouter } from "express";
import { db, teamMembersTable, usersTable, organizationsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { getPlan, assertWithinLimit, PlanLimitError } from "../lib/plans";
import crypto from "node:crypto";
import {
  ListTeamMembersResponse,
  InviteTeamMemberBody,
  UpdateTeamMemberBody,
  UpdateTeamMemberResponse,
} from "@workspace/api-zod";
import { sendInviteEmail } from "../lib/email.js";

const router: IRouter = Router();

const APP_URL = process.env.APP_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "http://localhost:5173");

function formatMember(member: typeof teamMembersTable.$inferSelect, user: typeof usersTable.$inferSelect) {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    email: user.email,
    name: user.name,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt?.toISOString() ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

router.get("/organizations/:orgId/team", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));
  const result = await Promise.all(members.map(async (m) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId));
    return formatMember(m, user);
  }));
  res.json(ListTeamMembersResponse.parse(result));
});

router.post("/organizations/:orgId/team", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = InviteTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Get the organization name for the invite email
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  // Enforce plan user-count limit
  const plan = getPlan(org.plan);
  const [memberCountRow] = await db.select({ c: count() }).from(teamMembersTable).where(eq(teamMembersTable.organizationId, orgId));
  try {
    assertWithinLimit(plan.key, "users", (memberCountRow?.c ?? 0) + 1, plan.users, "team members");
  } catch (e) {
    if (e instanceof PlanLimitError) {
      res.status(402).json({ error: e.code, message: "You've reached your plan's team member limit.", limit: e.limit, plan: e.plan, current: e.current, max: e.max, suggestedPlan: e.suggestedPlan });
      return;
    }
    throw e;
  }

  // Find or create the invited user
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  const isNewUser = !user;
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: "invited",
    }).returning();
    user = newUser;
  }

  // Generate secure invite token valid for 7 days
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [member] = await db.insert(teamMembersTable).values({
    userId: user.id,
    organizationId: orgId,
    role: parsed.data.role,
    status: "invited",
    inviteToken,
    inviteExpiresAt,
  }).returning();

  const inviteLink = `${APP_URL}/accept-invite?token=${inviteToken}`;

  // Send invite email (fire and forget — don't block the response on email delivery)
  const inviterName = (parsed.data as any).inviterName ?? "A team admin";
  sendInviteEmail({
    toEmail: user.email,
    toName: user.name,
    inviterName,
    orgName: org.name,
    role: parsed.data.role,
    inviteLink,
    orgId,
  }).catch((err) => console.error("Failed to send invite email:", err));

  res.status(201).json({ ...formatMember(member, user), inviteLink });
});

// GET /invite/:token — validate an invite token and return context
router.get("/invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token));
  if (!member) { res.status(404).json({ error: "INVALID_TOKEN" }); return; }
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    res.status(410).json({ error: "TOKEN_EXPIRED" });
    return;
  }
  if (member.status !== "invited") { res.status(409).json({ error: "ALREADY_ACCEPTED" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, member.userId));
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, member.organizationId));

  res.json({
    email: user.email,
    name: user.name,
    orgName: org?.name ?? "Your organization",
    role: member.role,
    isNewUser: user.passwordHash === "invited",
  });
});

// POST /invite/:token/accept — activate membership; set password ONLY for
// brand-new users. Existing users (invited to a second org) keep their login.
router.post("/invite/:token/accept", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { password } = req.body ?? {};

  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token));
  if (!member) { res.status(404).json({ error: "INVALID_TOKEN" }); return; }
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    res.status(410).json({ error: "TOKEN_EXPIRED" });
    return;
  }
  if (member.status !== "invited") { res.status(409).json({ error: "ALREADY_ACCEPTED" }); return; }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, member.userId));
  if (!existingUser) { res.status(404).json({ error: "USER_NOT_FOUND" }); return; }

  // Sentinel "invited" (set at invite-creation time in POST /organizations/:orgId/team)
  // distinguishes brand-new accounts from pre-existing users. We must NEVER rewrite
  // passwordHash for a pre-existing user — that would hijack their primary account.
  const isNewUser = existingUser.passwordHash === "invited";

  let user = existingUser;
  if (isNewUser) {
    if (!password || password.length < 8) { res.status(400).json({ error: "INVALID_INPUT" }); return; }
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);
    const [updated] = await db.update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, member.userId))
      .returning();
    user = updated;
  }

  await db.update(teamMembersTable)
    .set({ status: "active", joinedAt: new Date(), inviteToken: null })
    .where(eq(teamMembersTable.id, member.id));

  res.json({ id: user.id, email: user.email, name: user.name });
});

router.put("/organizations/:orgId/team/:memberId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawMemberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const orgId = parseInt(rawOrgId, 10);
  const memberId = parseInt(rawMemberId, 10);
  const parsed = UpdateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Partial<{ role: string; status: string }> = {};
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.status) updateData.status = parsed.data.status;

  const [member] = await db.update(teamMembersTable).set(updateData)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.organizationId, orgId)))
    .returning();
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, member.userId));
  res.json(UpdateTeamMemberResponse.parse(formatMember(member, user)));
});

router.delete("/organizations/:orgId/team/:memberId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawMemberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const orgId = parseInt(rawOrgId, 10);
  const memberId = parseInt(rawMemberId, 10);
  await db.delete(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
