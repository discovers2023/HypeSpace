import { Router, type IRouter } from "express";
import { db, sendingDomainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import dns from "node:dns/promises";

const router: IRouter = Router();

function formatDomain(d: typeof sendingDomainsTable.$inferSelect) {
  return {
    id: d.id,
    organizationId: d.organizationId,
    domain: d.domain,
    fromEmail: d.fromEmail,
    fromName: d.fromName,
    dnsRecords: d.dnsRecords ?? [],
    status: d.status,
    verifiedAt: d.verifiedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

/**
 * Generate the DNS records a customer needs to add.
 * In production with SES/Postmark, these come from the provider API.
 * For now we generate SPF + DKIM-like records that can be verified via DNS lookup.
 */
function generateDnsRecords(domain: string): Array<{ type: string; name: string; value: string }> {
  return [
    {
      type: "TXT",
      name: domain,
      value: "v=spf1 include:amazonses.com ~all",
    },
    {
      type: "CNAME",
      name: `hs1._domainkey.${domain}`,
      value: "dkim1.hypespace.app",
    },
    {
      type: "CNAME",
      name: `hs2._domainkey.${domain}`,
      value: "dkim2.hypespace.app",
    },
    {
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: "v=DMARC1; p=none;",
    },
  ];
}

// GET /organizations/:orgId/sending-domains
router.get("/organizations/:orgId/sending-domains", async (req, res): Promise<void> => {
  const orgId = parseInt(req.params.orgId as string, 10);
  const domains = await db.select().from(sendingDomainsTable)
    .where(eq(sendingDomainsTable.organizationId, orgId));
  res.json(domains.map(formatDomain));
});

// POST /organizations/:orgId/sending-domains — add a new sending domain
router.post("/organizations/:orgId/sending-domains", async (req, res): Promise<void> => {
  const orgId = parseInt(req.params.orgId as string, 10);
  const { domain, fromEmail, fromName } = req.body as {
    domain: string;
    fromEmail: string;
    fromName: string;
  };

  if (!domain || !fromEmail || !fromName) {
    res.status(400).json({ error: "domain, fromEmail, and fromName are required" });
    return;
  }

  // Check for duplicates
  const existing = await db.select().from(sendingDomainsTable)
    .where(and(eq(sendingDomainsTable.organizationId, orgId), eq(sendingDomainsTable.domain, domain)));
  if (existing.length > 0) {
    res.status(409).json({ error: "Domain already registered for this organization" });
    return;
  }

  const dnsRecords = generateDnsRecords(domain);

  const [created] = await db.insert(sendingDomainsTable).values({
    organizationId: orgId,
    domain,
    fromEmail,
    fromName,
    dnsRecords,
    status: "pending",
  }).returning();

  res.status(201).json(formatDomain(created));
});

// POST /organizations/:orgId/sending-domains/:domainId/verify — check DNS records
router.post("/organizations/:orgId/sending-domains/:domainId/verify", async (req, res): Promise<void> => {
  const orgId = parseInt(req.params.orgId as string, 10);
  const domainId = parseInt(req.params.domainId as string, 10);

  const [record] = await db.select().from(sendingDomainsTable)
    .where(and(eq(sendingDomainsTable.id, domainId), eq(sendingDomainsTable.organizationId, orgId)));

  if (!record) { res.status(404).json({ error: "Domain not found" }); return; }

  // Check if SPF TXT record exists
  let spfVerified = false;
  let dmarcVerified = false;
  const checks: Array<{ record: string; status: "pass" | "fail"; detail: string }> = [];

  try {
    const txtRecords = await dns.resolveTxt(record.domain);
    const flat = txtRecords.map(r => r.join(""));
    spfVerified = flat.some(r => r.includes("spf1") && (r.includes("amazonses.com") || r.includes("include:")));
    checks.push({
      record: `SPF (TXT on ${record.domain})`,
      status: spfVerified ? "pass" : "fail",
      detail: spfVerified ? "SPF record found" : "No valid SPF record found",
    });
  } catch {
    checks.push({ record: `SPF (TXT on ${record.domain})`, status: "fail", detail: "DNS lookup failed" });
  }

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${record.domain}`);
    const flat = dmarcRecords.map(r => r.join(""));
    dmarcVerified = flat.some(r => r.includes("DMARC1"));
    checks.push({
      record: `DMARC (TXT on _dmarc.${record.domain})`,
      status: dmarcVerified ? "pass" : "fail",
      detail: dmarcVerified ? "DMARC record found" : "No DMARC record found",
    });
  } catch {
    checks.push({ record: `DMARC (TXT on _dmarc.${record.domain})`, status: "fail", detail: "DNS lookup failed" });
  }

  // Check DKIM CNAME
  let dkimVerified = false;
  try {
    const cname = await dns.resolveCname(`hs1._domainkey.${record.domain}`);
    dkimVerified = cname.length > 0;
    checks.push({
      record: `DKIM (CNAME on hs1._domainkey.${record.domain})`,
      status: dkimVerified ? "pass" : "fail",
      detail: dkimVerified ? `Points to ${cname[0]}` : "CNAME not found",
    });
  } catch {
    checks.push({
      record: `DKIM (CNAME on hs1._domainkey.${record.domain})`,
      status: "fail",
      detail: "DNS lookup failed — CNAME not set yet",
    });
  }

  // At minimum, SPF must pass to mark as verified. DKIM and DMARC are recommended but not blocking.
  const verified = spfVerified;
  const newStatus = verified ? "verified" : "failed";

  const [updated] = await db.update(sendingDomainsTable).set({
    status: newStatus,
    verifiedAt: verified ? new Date() : null,
  }).where(eq(sendingDomainsTable.id, domainId)).returning();

  res.json({ ...formatDomain(updated), checks });
});

// DELETE /organizations/:orgId/sending-domains/:domainId
router.delete("/organizations/:orgId/sending-domains/:domainId", async (req, res): Promise<void> => {
  const orgId = parseInt(req.params.orgId as string, 10);
  const domainId = parseInt(req.params.domainId as string, 10);
  await db.delete(sendingDomainsTable)
    .where(and(eq(sendingDomainsTable.id, domainId), eq(sendingDomainsTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
