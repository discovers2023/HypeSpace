import { Router, type IRouter } from "express";
import { db, remindersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

export default router;
