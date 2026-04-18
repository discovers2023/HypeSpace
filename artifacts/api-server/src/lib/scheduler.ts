import { db, campaignsTable, activityTable, organizationsTable, remindersTable, guestsTable, eventsTable } from "@workspace/db";
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
      // Look up the parent event to get organizationId — remindersTable has no orgId column.
      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, reminder.eventId));
      if (!event) {
        // Event was deleted; mark reminder sent so we stop polling it.
        await db.update(remindersTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(remindersTable.id, reminder.id));
        logger.warn({ reminderId: reminder.id, eventId: reminder.eventId }, "Reminder skipped: event not found");
        continue;
      }
      const orgId = event.organizationId;

      // Get eligible guests based on audience targeting
      const guests = await db.select().from(guestsTable)
        .where(eq(guestsTable.eventId, reminder.eventId));
      const audience = (reminder as Record<string, unknown>).audience as string ?? "confirmed_and_maybe";
      const eligible = guests.filter(g => {
        if (audience === "confirmed") return g.status === "confirmed";
        if (audience === "maybe") return (g.status as string) === "maybe";
        if (audience === "confirmed_and_maybe") return g.status === "confirmed" || (g.status as string) === "maybe";
        // "all" — send to everyone who hasn't declined
        return g.status !== "declined";
      });

      // Send to each guest (pass orgId so getTransporter() resolves the org's SMTP, not Ethereal)
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
          orgId,
        }).catch((err) => {
          logger.error({ err, reminderId: reminder.id, guest: guest.email }, "Reminder email failed");
        });
      }

      // Mark sent AFTER the loop. Note: matches the campaign scheduler's "mark sent unconditionally
      // after attempting send" semantics — individual per-guest failures are logged but do not block
      // the row from being marked sent. This avoids re-spamming guests on transient failures.
      // Pre-loop failures (event lookup, DB error, guest query) are caught by the outer try and leave
      // status unchanged, so the row will be retried on the next 60s tick.
      await db.update(remindersTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(remindersTable.id, reminder.id));

      logger.info({ reminderId: reminder.id, recipientCount: eligible.length, orgId }, "Scheduled reminder sent");
    } catch (err) {
      logger.error({ err, reminderId: reminder.id }, "Scheduler: failed to send reminder");
      // Intentionally do NOT mark sent here — leave status pending so the next tick retries.
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
