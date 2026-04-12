import { Router, type IRouter } from "express";
import { db, remindersTable, guestsTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import {
  ListRemindersResponse,
  CreateReminderBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatReminder(r: typeof remindersTable.$inferSelect) {
  return {
    id: r.id,
    eventId: r.eventId,
    type: r.type,
    offsetHours: r.offsetHours,
    subject: r.subject,
    message: r.message,
    status: r.status,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/organizations/:orgId/events/:eventId/reminders", async (req, res): Promise<void> => {
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const eventId = parseInt(rawEventId, 10);
  const reminders = await db.select().from(remindersTable).where(eq(remindersTable.eventId, eventId));
  res.json(ListRemindersResponse.parse(reminders.map(formatReminder)));
});

router.post("/organizations/:orgId/events/:eventId/reminders", async (req, res): Promise<void> => {
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const eventId = parseInt(rawEventId, 10);
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [reminder] = await db.insert(remindersTable).values({
    ...parsed.data,
    eventId,
  }).returning();

  res.status(201).json(formatReminder(reminder));
});

// --- Send reminder now: email all invited/confirmed guests ---
router.post("/organizations/:orgId/events/:eventId/reminders/:reminderId/send", async (req, res): Promise<void> => {
  const rawEventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const rawReminderId = Array.isArray(req.params.reminderId) ? req.params.reminderId[0] : req.params.reminderId;
  const eventId = parseInt(rawEventId, 10);
  const reminderId = parseInt(rawReminderId, 10);

  const [reminder] = await db.select().from(remindersTable)
    .where(and(eq(remindersTable.id, reminderId), eq(remindersTable.eventId, eventId)));
  if (!reminder) { res.status(404).json({ error: "Reminder not found" }); return; }

  if (reminder.status === "sent") {
    res.status(400).json({ error: "Reminder already sent" });
    return;
  }

  // Get all eligible guests (invited or confirmed)
  const guests = await db.select().from(guestsTable)
    .where(eq(guestsTable.eventId, eventId));
  const eligible = guests.filter(g => g.status === "invited" || g.status === "confirmed");

  for (const guest of eligible) {
    await sendEmail({
      to: guest.email,
      toName: guest.name,
      subject: reminder.subject,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1a0533;">${reminder.subject}</h2>
        <p style="color:#4a4a6a;line-height:1.7;white-space:pre-wrap;">${reminder.message}</p>
      </div>`,
      text: reminder.message,
    });
  }

  // Mark reminder as sent
  const [updated] = await db.update(remindersTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(remindersTable.id, reminderId))
    .returning();

  res.json({ ...formatReminder(updated), recipientCount: eligible.length });
});

export default router;
