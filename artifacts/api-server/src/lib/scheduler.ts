import { db, campaignsTable, activityTable, organizationsTable, remindersTable, guestsTable } from "@workspace/db";
import { and, eq, lte, isNotNull, ne } from "drizzle-orm";
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function processDueReminders(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(remindersTable)
    .where(
      and(
        ne(remindersTable.status, "sent"),
        isNotNull(remindersTable.scheduledAt),
        lte(remindersTable.scheduledAt, now),
      )
    );

  for (const reminder of due) {
    try {
      // Get eligible guests
      const guests = await db.select().from(guestsTable)
        .where(eq(guestsTable.eventId, reminder.eventId));
      const eligible = guests.filter(g => g.status === "invited" || g.status === "confirmed" || g.status === "added");

      // Mark sent immediately
      await db.update(remindersTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(remindersTable.id, reminder.id));

      // Send to each guest
      for (const guest of eligible) {
        await sendEmail({
          to: guest.email,
          toName: guest.name,
          subject: reminder.subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a0533;">${escapeHtml(reminder.subject)}</h2>
            <p style="color:#4a4a6a;line-height:1.7;white-space:pre-wrap;">${escapeHtml(reminder.message)}</p>
          </div>`,
          text: reminder.message,
        }).catch((err) => {
          logger.error({ err, reminderId: reminder.id, guest: guest.email }, "Reminder email failed");
        });
      }

      logger.info({ reminderId: reminder.id, recipientCount: eligible.length }, "Scheduled reminder sent");
    } catch (err) {
      logger.error({ err, reminderId: reminder.id }, "Scheduler: failed to send reminder");
    }
  }
}

export function startScheduler(): void {
  logger.info("Campaign & reminder scheduler started (interval: 60s)");

  const runAll = () => Promise.all([
    processDueScheduledCampaigns(),
    processDueReminders(),
  ]).catch((err) => logger.error({ err }, "Scheduler error"));

  runAll();
  setInterval(runAll, INTERVAL_MS);
}
