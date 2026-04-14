import { Router, type IRouter } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const PROVIDERS: Record<string, { host: string; port: number; label: string }> = {
  gmail: { host: "smtp.gmail.com", port: 587, label: "Gmail" },
  outlook: { host: "smtp.office365.com", port: 587, label: "Outlook / Office 365" },
  resend: { host: "smtp.resend.com", port: 587, label: "Resend" },
  sendgrid: { host: "smtp.sendgrid.net", port: 587, label: "SendGrid" },
  mailgun: { host: "smtp.mailgun.org", port: 587, label: "Mailgun" },
  postmark: { host: "smtp.postmarkapp.com", port: 587, label: "Postmark" },
  zoho: { host: "smtp.zoho.com", port: 587, label: "Zoho Mail" },
  custom: { host: "", port: 587, label: "Custom SMTP" },
};

function parseOrgId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/organizations/:orgId/email-provider", async (req, res): Promise<void> => {
  const orgId = parseOrgId(req.params.orgId);
  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(
      and(
        eq(integrationsTable.organizationId, orgId),
        eq(integrationsTable.platform, "smtp_provider"),
      ),
    )
    .limit(1);

  if (!row) {
    res.json(null);
    return;
  }

  const m = (row.metadata ?? {}) as Record<string, unknown>;
  res.json({
    id: row.id,
    provider: m.provider ?? "custom",
    host: m.host ?? "",
    port: m.port ?? 587,
    user: m.user ?? "",
    passSet: !!m.pass,
    fromEmail: m.fromEmail ?? "",
    fromName: m.fromName ?? "",
    status: row.status,
  });
});

router.post("/organizations/:orgId/email-provider", async (req, res): Promise<void> => {
  const orgId = parseOrgId(req.params.orgId);
  const { provider, host, port, user, pass, fromEmail, fromName } = req.body as {
    provider?: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    fromEmail?: string;
    fromName?: string;
  };

  if (!user || !pass) {
    res.status(400).json({ error: "Username and password/API key are required" });
    return;
  }

  const providerKey = provider && PROVIDERS[provider] ? provider : "custom";
  const resolvedHost = providerKey !== "custom" ? PROVIDERS[providerKey].host : (host ?? "");
  const resolvedPort = providerKey !== "custom" ? PROVIDERS[providerKey].port : (port ?? 587);

  if (!resolvedHost) {
    res.status(400).json({ error: "SMTP host is required for custom provider" });
    return;
  }

  const metadata = {
    provider: providerKey,
    host: resolvedHost,
    port: resolvedPort,
    user,
    pass,
    fromEmail: fromEmail || user,
    fromName: fromName || "HypeSpace",
  };

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(
      and(
        eq(integrationsTable.organizationId, orgId),
        eq(integrationsTable.platform, "smtp_provider"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(integrationsTable)
      .set({ metadata, status: "connected", accountName: PROVIDERS[providerKey]?.label ?? "Custom SMTP" })
      .where(eq(integrationsTable.id, existing.id));
  } else {
    await db.insert(integrationsTable).values({
      organizationId: orgId,
      platform: "smtp_provider",
      platformType: "email",
      status: "connected",
      accountName: PROVIDERS[providerKey]?.label ?? "Custom SMTP",
      metadata,
    });
  }

  res.json({ saved: true });
});

router.delete("/organizations/:orgId/email-provider", async (req, res): Promise<void> => {
  const orgId = parseOrgId(req.params.orgId);
  await db
    .delete(integrationsTable)
    .where(
      and(
        eq(integrationsTable.organizationId, orgId),
        eq(integrationsTable.platform, "smtp_provider"),
      ),
    );
  res.json({ removed: true });
});

router.post("/organizations/:orgId/email-provider/test", async (req, res): Promise<void> => {
  const orgId = parseOrgId(req.params.orgId);
  const { to } = req.body as { to?: string };

  if (!to || !to.includes("@")) {
    res.status(400).json({ error: "A valid recipient email is required" });
    return;
  }

  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(
      and(
        eq(integrationsTable.organizationId, orgId),
        eq(integrationsTable.platform, "smtp_provider"),
        eq(integrationsTable.status, "connected"),
      ),
    )
    .limit(1);

  if (!row?.metadata) {
    res.status(400).json({ error: "No email provider configured. Save your settings first." });
    return;
  }

  const m = row.metadata as Record<string, unknown>;

  try {
    const transporter = nodemailer.createTransport({
      host: String(m.host),
      port: Number(m.port ?? 587),
      secure: Number(m.port) === 465,
      auth: { user: String(m.user), pass: String(m.pass) },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${String(m.fromName ?? "HypeSpace")}" <${String(m.fromEmail ?? m.user)}>`,
      to,
      subject: "HypeSpace — Email provider test",
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;">
          <div style="background:linear-gradient(135deg,#F97316,#7C3AED);border-radius:12px;padding:32px;text-align:center;margin-bottom:24px;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">HypeSpace</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Email provider test</p>
          </div>
          <h2 style="color:#1a0533;margin:0 0 12px;">Your email provider is working!</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 20px;">
            This test email confirms that HypeSpace can send emails through your configured SMTP provider.
            All future campaign and reminder emails will be delivered via this provider.
          </p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;font-size:13px;color:#888;">
            Provider: <strong style="color:#333;">${String(m.host)}</strong> · Port: <strong style="color:#333;">${String(m.port)}</strong>
          </div>
        </div>
      `,
      text: "Your HypeSpace email provider is configured correctly. This is a test message.",
    });

    res.json({ sent: true, to });
  } catch (err: any) {
    console.error("Email provider test failed:", err.message);
    res.status(400).json({ error: err.message ?? "SMTP connection failed" });
  }
});

export default router;
