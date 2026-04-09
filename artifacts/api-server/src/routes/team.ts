import { Router, type IRouter } from "express";
import { db, teamMembersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListTeamMembersResponse,
  InviteTeamMemberBody,
  UpdateTeamMemberBody,
  UpdateTeamMemberResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: "invited",
    }).returning();
    user = newUser;
  }

  const [member] = await db.insert(teamMembersTable).values({
    userId: user.id,
    organizationId: orgId,
    role: parsed.data.role,
    status: "invited",
  }).returning();

  res.status(201).json(formatMember(member, user));
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
