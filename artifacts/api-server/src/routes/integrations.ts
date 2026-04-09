import { Router } from "express";
import { db } from "@workspace/db";
import { integrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /organizations/:orgId/integrations
router.get("/organizations/:orgId/integrations", async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const integrations = await db
      .select()
      .from(integrationsTable)
      .where(eq(integrationsTable.organizationId, orgId));
    res.json(integrations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list integrations" });
  }
});

// POST /organizations/:orgId/integrations  - Connect a platform
router.post("/organizations/:orgId/integrations", async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const { platform, platformType, accountName, accountId, metadata } = req.body;

    // Check if already connected
    const existing = await db
      .select()
      .from(integrationsTable)
      .where(
        and(
          eq(integrationsTable.organizationId, orgId),
          eq(integrationsTable.platform, platform)
        )
      );

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(integrationsTable)
        .set({ status: "connected", accountName, accountId, metadata })
        .where(eq(integrationsTable.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [integration] = await db
      .insert(integrationsTable)
      .values({ organizationId: orgId, platform, platformType, accountName, accountId, metadata, status: "connected" })
      .returning();

    res.status(201).json(integration);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to connect integration" });
  }
});

// DELETE /organizations/:orgId/integrations/:platform - Disconnect a platform
router.delete("/organizations/:orgId/integrations/:platform", async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const { platform } = req.params;

    await db
      .delete(integrationsTable)
      .where(
        and(
          eq(integrationsTable.organizationId, orgId),
          eq(integrationsTable.platform, platform)
        )
      );

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to disconnect integration" });
  }
});

export default router;
