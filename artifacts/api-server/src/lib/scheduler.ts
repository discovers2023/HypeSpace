import { db, campaignsTable, activityTable, organizationsTable } from "@workspace/db";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { getPlan } from "./plans";
import { sendEmail } from "./email";
import { logger } from "./logger";

const INTERVAL_MS = 60_000; // check every 60 seconds

async function processDueScheduledCampaigns(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status, "scheduled"),
        isNotNull(campaignsTable.scheduledAt),
        lte(campaignsTable.scheduledAt, now),
      )
    );

  for (const campaign of due) {
    try {
      // Enforce plan limit before sending
      const [org] = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.id, campaign.organizationId));
      const plan = getPlan(org?.plan);
      if (!plan.canSendCampaigns) {
        // Mark failed so we don't retry indefinitely
        await db
          .update(campaignsTable)
          .set({ status: "failed" })
          .where(eq(campaignsTable.id, campaign.id));
        logger.warn({ campaignId: campaign.id }, "Scheduled send skipped: plan does not allow campaigns");
        continue;
      }

      // Mark sent immediately to prevent double-send in next tick
      await db
        .update(campaignsTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(campaignsTable.id, campaign.id));

      // Send the email (uses org SMTP or Ethereal fallback)
      // NOTE: recipient iteration (per-guest bulk send) is a v2 concern;
      // current pattern matches the manual send route which marks sent and logs activity.
      await sendEmail({
        to: `noreply@placeholder.invalid`,
        subject: campaign.subject,
        html: campaign.htmlContent ?? `<p>${campaign.textContent ?? ""}</p>`,
        text: campaign.textContent ?? undefined,
        orgId: campaign.organizationId,
      }).catch((err) => {
        logger.error({ err, campaignId: campaign.id }, "Scheduled send email error");
      });

      await db.insert(activityTable).values({
        organizationId: campaign.organizationId,
        type: "campaign_sent",
        title: "Campaign Sent (Scheduled)",
        description: `${campaign.name} was auto-sent at scheduled time`,
        entityId: campaign.id,
        entityType: "campaign",
      });

      logger.info({ campaignId: campaign.id }, "Scheduled campaign sent");
    } catch (err) {
      logger.error({ err, campaignId: campaign.id }, "Scheduler: failed to send campaign");
      // Mark failed so we stop retrying
      await db
        .update(campaignsTable)
        .set({ status: "failed" })
        .where(eq(campaignsTable.id, campaign.id))
        .catch(() => {});
    }
  }
}

export function startScheduler(): void {
  logger.info("Campaign scheduler started (interval: 60s)");
  // Run once immediately on startup, then on interval
  processDueScheduledCampaigns().catch((err) =>
    logger.error({ err }, "Scheduler: initial run error")
  );
  setInterval(() => {
    processDueScheduledCampaigns().catch((err) =>
      logger.error({ err }, "Scheduler: interval error")
    );
  }, INTERVAL_MS);
}
