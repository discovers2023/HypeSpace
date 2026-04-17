import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id),
  type: text("type").notNull().default("before_event"),
  offsetHours: integer("offset_hours").notNull().default(24),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  // Who receives this reminder: all, confirmed, maybe, confirmed_and_maybe
  audience: text("audience").notNull().default("confirmed_and_maybe"),
  channel: text("channel").notNull().default("email"),
  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;
