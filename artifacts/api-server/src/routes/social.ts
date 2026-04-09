import { Router, type IRouter } from "express";
import { db, socialPostsTable, activityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListSocialPostsResponse,
  CreateSocialPostBody,
  UpdateSocialPostBody,
  UpdateSocialPostResponse,
  PublishSocialPostResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPost(p: typeof socialPostsTable.$inferSelect) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    eventId: p.eventId ?? null,
    platform: p.platform,
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    status: p.status,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/organizations/:orgId/social-posts", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const posts = await db.select().from(socialPostsTable).where(eq(socialPostsTable.organizationId, orgId));
  res.json(ListSocialPostsResponse.parse(posts.map(formatPost)));
});

router.post("/organizations/:orgId/social-posts", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);
  const parsed = CreateSocialPostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertData: Record<string, unknown> = { ...parsed.data, organizationId: orgId };
  if (parsed.data.scheduledAt) insertData.scheduledAt = new Date(parsed.data.scheduledAt);

  const [post] = await db.insert(socialPostsTable).values(insertData as Parameters<typeof socialPostsTable.$inferInsert>[0]).returning();
  res.status(201).json(formatPost(post));
});

router.put("/organizations/:orgId/social-posts/:postId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawPostId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const orgId = parseInt(rawOrgId, 10);
  const postId = parseInt(rawPostId, 10);
  const parsed = UpdateSocialPostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledAt) updateData.scheduledAt = new Date(parsed.data.scheduledAt);

  const [post] = await db.update(socialPostsTable).set(updateData)
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.organizationId, orgId)))
    .returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(UpdateSocialPostResponse.parse(formatPost(post)));
});

router.delete("/organizations/:orgId/social-posts/:postId", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawPostId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const orgId = parseInt(rawOrgId, 10);
  const postId = parseInt(rawPostId, 10);
  await db.delete(socialPostsTable).where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.organizationId, orgId)));
  res.sendStatus(204);
});

router.post("/organizations/:orgId/social-posts/:postId/publish", async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawPostId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const orgId = parseInt(rawOrgId, 10);
  const postId = parseInt(rawPostId, 10);

  const [post] = await db.update(socialPostsTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.organizationId, orgId)))
    .returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  await db.insert(activityTable).values({
    organizationId: orgId,
    type: "social_posted",
    title: "Social Post Published",
    description: `Post published to ${post.platform}`,
    entityId: post.id,
    entityType: "social_post",
  });

  res.json(PublishSocialPostResponse.parse(formatPost(post)));
});

export default router;
