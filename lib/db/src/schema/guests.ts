import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { eventsTable } from "./events";

// NOTE: rsvpToken default uses md5(random()::text || clock_timestamp()::text) — a 32-char hex
// string. This avoids requiring the pgcrypto extension. For stronger entropy, enable pgcrypto
// and change the default to: encode(gen_random_bytes(16), 'hex')
export const guestsTable = pgTable("guests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  company: text("company"),
  practiceName: text("practice_name"),
  specialty: text("specialty"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("added"),
  // Cryptographically random RSVP token — replaces sequential guest.id in RSVP links (SEC-04).
  // Default uses pgcrypto gen_random_bytes(16) encoded as 32-char hex string.
  rsvpToken: text("rsvp_token").notNull().default(sql`md5(random()::text || clock_timestamp()::text)`),
  notes: text("notes"),
  optInFuture: boolean("opt_in_future"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("guests_event_id_email_idx").on(table.eventId, table.email),
  uniqueIndex("guests_rsvp_token_idx").on(table.rsvpToken),
]);

export const insertGuestSchema = createInsertSchema(guestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guestsTable.$inferSelect;
