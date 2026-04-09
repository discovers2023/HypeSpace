import { Router } from "express";
import { db, guestsTable, eventsTable } from "@workspace/db";
import { integrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

async function fetchGHLContacts(apiKey: string, locationId: string, tag: string): Promise<Array<{
  name: string; email: string; phone: string | null; company: string | null;
}>> {
  const url = new URL(`${GHL_BASE}/contacts/`);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("tags", tag);
  url.searchParams.set("limit", "100");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION, Accept: "application/json" },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`GHL API error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json() as { contacts?: any[] };
  const contacts = data.contacts ?? [];

  return contacts.map((c: any) => ({
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unknown",
    email: c.email ?? "",
    phone: c.phone ?? null,
    company: c.companyName ?? null,
  })).filter((c: any) => c.email);
}

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

// POST /organizations/:orgId/integrations/gohighlevel/preview — fetch contacts from GHL
router.post("/organizations/:orgId/integrations/gohighlevel/preview", async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const { tag = "studyclub" } = req.body;

    const [integration] = await db.select().from(integrationsTable).where(
      and(eq(integrationsTable.organizationId, orgId), eq(integrationsTable.platform, "gohighlevel"))
    );
    if (!integration) { res.status(404).json({ error: "GHL integration not connected" }); return; }

    const meta = (integration.metadata as Record<string, string>) ?? {};
    const apiKey = meta.apiKey;
    const locationId = meta.locationId;
    if (!apiKey || !locationId) { res.status(400).json({ error: "Missing GHL credentials" }); return; }

    const contacts = await fetchGHLContacts(apiKey, locationId, tag);
    res.json({ contacts, total: contacts.length });
  } catch (err: any) {
    req.log.error(err);
    res.status(502).json({ error: err.message ?? "Failed to fetch GHL contacts" });
  }
});

// POST /organizations/:orgId/integrations/gohighlevel/import — import contacts as event guests
router.post("/organizations/:orgId/integrations/gohighlevel/import", async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    const { tag = "studyclub", eventId } = req.body;

    if (!eventId) { res.status(400).json({ error: "eventId is required" }); return; }

    const [integration] = await db.select().from(integrationsTable).where(
      and(eq(integrationsTable.organizationId, orgId), eq(integrationsTable.platform, "gohighlevel"))
    );
    if (!integration) { res.status(404).json({ error: "GHL integration not connected" }); return; }

    const meta = (integration.metadata as Record<string, string>) ?? {};
    const apiKey = meta.apiKey;
    const locationId = meta.locationId;
    if (!apiKey || !locationId) { res.status(400).json({ error: "Missing GHL credentials" }); return; }

    // Verify event belongs to org
    const [event] = await db.select().from(eventsTable).where(
      and(eq(eventsTable.id, parseInt(eventId, 10)), eq(eventsTable.organizationId, orgId))
    );
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const contacts = await fetchGHLContacts(apiKey, locationId, tag);

    // Get existing guests for deduplication
    const existing = await db.select({ email: guestsTable.email }).from(guestsTable)
      .where(eq(guestsTable.eventId, parseInt(eventId, 10)));
    const existingEmails = new Set(existing.map((g) => g.email.toLowerCase()));

    const toInsert = contacts.filter((c) => !existingEmails.has(c.email.toLowerCase()));

    let imported = 0;
    if (toInsert.length > 0) {
      await db.insert(guestsTable).values(
        toInsert.map((c) => ({
          eventId: parseInt(eventId, 10),
          email: c.email,
          name: c.name,
          phone: c.phone ?? undefined,
          company: c.company ?? undefined,
          status: "invited" as const,
          notes: `Imported from Go HighLevel (tag: ${tag})`,
        }))
      );
      imported = toInsert.length;
    }

    res.json({ imported, skipped: contacts.length - imported, total: contacts.length });
  } catch (err: any) {
    req.log.error(err);
    res.status(502).json({ error: err.message ?? "Failed to import GHL contacts" });
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
