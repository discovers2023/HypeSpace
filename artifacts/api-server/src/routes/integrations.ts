import { Router } from "express";
import { db, guestsTable, eventsTable, organizationsTable } from "@workspace/db";
import { integrationsTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getPlan, assertWithinLimit, PlanLimitError } from "../lib/plans";

const router = Router();

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

type NormalizedGhlContact = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  practiceName: string | null;
  specialty: string | null;
  tags: string[];
};

/**
 * GHL contacts expose user-defined fields as customFields or customField
 * (array shape varies across API versions). Probe common keys case-
 * insensitively and return the first non-empty match.
 */
function readCustomField(c: any, keys: string[]): string | null {
  const custom = c.customFields ?? c.customField ?? [];
  if (!Array.isArray(custom)) return null;
  const needle = keys.map((k) => k.toLowerCase());
  for (const f of custom) {
    const k = String(f?.key ?? f?.name ?? f?.fieldKey ?? "").toLowerCase();
    if (needle.includes(k) && f?.value != null && f.value !== "") {
      return String(f.value);
    }
  }
  return null;
}

async function fetchGHLContacts(
  apiKey: string,
  locationId: string,
  tags: string[],
): Promise<NormalizedGhlContact[]> {
  const url = new URL(`${GHL_BASE}/contacts/`);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("limit", "100");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION, Accept: "application/json" },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`GHL API error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { contacts?: any[] };
  const contacts = data.contacts ?? [];

  const tagFilters = tags.map((t) => t.toLowerCase()).filter(Boolean);
  const filtered =
    tagFilters.length > 0
      ? contacts.filter((c: any) => {
          const contactTags: string[] = (c.tags ?? []).map((t: string) => t.toLowerCase());
          return tagFilters.some((f) => contactTags.includes(f));
        })
      : contacts;

  return filtered
    .map((c: any): NormalizedGhlContact => {
      const name =
        [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unknown";
      // practiceName: try common custom field keys, fall back to companyName
      const practiceName =
        readCustomField(c, ["practiceName", "practice_name", "practice"]) ??
        c.companyName ??
        null;
      const specialty = readCustomField(c, [
        "specialty",
        "speciality",
        "dental_specialty",
        "dentalSpecialty",
      ]);
      return {
        name,
        email: c.email ?? "",
        phone: c.phone ?? null,
        company: c.companyName ?? null,
        practiceName,
        specialty,
        tags: Array.isArray(c.tags) ? c.tags.map((t: any) => String(t)) : [],
      };
    })
    .filter((c) => c.email);
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
    const tags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];

    const [integration] = await db.select().from(integrationsTable).where(
      and(eq(integrationsTable.organizationId, orgId), eq(integrationsTable.platform, "gohighlevel"))
    );
    if (!integration) { res.status(404).json({ error: "GHL integration not connected" }); return; }

    const meta = (integration.metadata as Record<string, string>) ?? {};
    const apiKey = meta.apiKey;
    const locationId = meta.locationId;
    if (!apiKey || !locationId) { res.status(400).json({ error: "Missing GHL credentials" }); return; }

    const contacts = await fetchGHLContacts(apiKey, locationId, tags);
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
    const tags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];
    const { eventId } = req.body;

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

    const contacts = await fetchGHLContacts(apiKey, locationId, tags);

    // Get existing guests for deduplication
    const existing = await db.select({ email: guestsTable.email }).from(guestsTable)
      .where(eq(guestsTable.eventId, parseInt(eventId, 10)));
    const existingEmails = new Set(existing.map((g) => g.email.toLowerCase()));

    let toInsert = contacts.filter((c) => !existingEmails.has(c.email.toLowerCase()));
    const tagNote = tags.length > 0 ? `tags: ${tags.join(", ")}` : "all contacts";

    // Enforce plan attendee-per-event limit; cap the import size so we
    // import as much as allowed rather than rejecting the whole batch.
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
    const plan = getPlan(org?.plan);
    let planCapped = 0;
    if (plan.attendeesPerEvent !== null) {
      const remaining = Math.max(0, plan.attendeesPerEvent - existing.length);
      if (toInsert.length > remaining) {
        planCapped = toInsert.length - remaining;
        toInsert = toInsert.slice(0, remaining);
      }
      if (remaining === 0 && toInsert.length === 0) {
        res.status(402).json({
          error: "PLAN_LIMIT_EXCEEDED",
          message: "This event has reached its attendee limit — upgrade to import more.",
          limit: "attendees per event",
          plan: plan.key,
          current: existing.length,
          max: plan.attendeesPerEvent,
        });
        return;
      }
    }

    let imported = 0;
    if (toInsert.length > 0) {
      await db.insert(guestsTable).values(
        toInsert.map((c) => ({
          eventId: parseInt(eventId, 10),
          email: c.email,
          name: c.name,
          phone: c.phone ?? undefined,
          company: c.company ?? undefined,
          practiceName: c.practiceName ?? undefined,
          specialty: c.specialty ?? undefined,
          tags: c.tags ?? [],
          status: "added" as const,
          notes: `Imported from Go HighLevel (${tagNote})`,
        }))
      );
      imported = toInsert.length;
    }

    res.json({ imported, skipped: contacts.length - imported, total: contacts.length, planCapped });
  } catch (err: any) {
    req.log.error(err);
    res.status(502).json({ error: err.message ?? "Failed to import GHL contacts" });
  }
});

// ── GHL contact sync helpers ──────────────────────────────────────

const RSVP_TAG_MAP: Record<string, string> = {
  confirmed: "studyclub-rsvp-yes",
  maybe: "studyclub-rsvp-maybe",
  declined: "studyclub-rsvp-no",
};

const ALL_RSVP_TAGS = Object.values(RSVP_TAG_MAP);

/**
 * Search GHL for a contact by email. Returns the contact object or null.
 */
async function findGHLContactByEmail(apiKey: string, locationId: string, email: string): Promise<any | null> {
  const url = new URL(`${GHL_BASE}/contacts/search/duplicate`);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("email", email);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION, Accept: "application/json" },
  });
  if (!resp.ok) return null;
  const data = await resp.json() as { contact?: any };
  return data.contact ?? null;
}

/**
 * Create a new contact in GHL with the given tags.
 */
async function createGHLContact(
  apiKey: string,
  locationId: string,
  contact: { name: string; email: string; phone?: string | null },
  tags: string[],
): Promise<any> {
  const nameParts = contact.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const resp = await fetch(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
      firstName,
      lastName,
      email: contact.email,
      phone: contact.phone ?? undefined,
      tags,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error(`[GHL] Failed to create contact: ${resp.status} ${body.slice(0, 200)}`);
    return null;
  }

  return (await resp.json()).contact ?? null;
}

/**
 * Update tags on an existing GHL contact. Removes old RSVP tags and adds the new one.
 */
async function updateGHLContactTags(
  apiKey: string,
  contactId: string,
  existingTags: string[],
  rsvpStatus: string,
): Promise<void> {
  const newTag = RSVP_TAG_MAP[rsvpStatus];
  if (!newTag) return;

  // Remove any existing RSVP tags and add the correct one
  const cleaned = existingTags.filter(t => !ALL_RSVP_TAGS.includes(t));
  cleaned.push(newTag);

  const resp = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tags: cleaned }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error(`[GHL] Failed to update contact tags: ${resp.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Sync a guest's RSVP status to GHL: find or create the contact, then set the
 * correct studyclub-rsvp-* tag.
 */
export async function syncRsvpToGHL(
  orgId: number,
  guest: { name: string; email: string; phone?: string | null },
  rsvpStatus: string,
): Promise<void> {
  try {
    const [integration] = await db.select().from(integrationsTable).where(
      and(eq(integrationsTable.organizationId, orgId), eq(integrationsTable.platform, "gohighlevel"))
    );
    if (!integration) return; // GHL not connected — skip silently

    const meta = (integration.metadata as Record<string, string>) ?? {};
    const apiKey = meta.apiKey;
    const locationId = meta.locationId;
    if (!apiKey || !locationId) return;

    const rsvpTag = RSVP_TAG_MAP[rsvpStatus];
    if (!rsvpTag) return;

    // Try to find existing contact
    const existing = await findGHLContactByEmail(apiKey, locationId, guest.email);

    if (existing) {
      // Update tags on existing contact
      const currentTags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
      await updateGHLContactTags(apiKey, existing.id, currentTags, rsvpStatus);
      console.log(`[GHL] Updated ${guest.email} tags → ${rsvpTag}`);
    } else {
      // Create new contact with the RSVP tag
      await createGHLContact(apiKey, locationId, guest, [rsvpTag]);
      console.log(`[GHL] Created ${guest.email} with tag ${rsvpTag}`);
    }
  } catch (err) {
    // GHL sync is best-effort — never fail the RSVP because of it
    console.error("[GHL] Sync error (non-fatal):", err);
  }
}

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
