import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  platform: text("platform").notNull(),
  platformType: text("platform_type").notNull(),
  status: text("status").notNull().default("connected"),
  accountName: text("account_name"),
  accountId: text("account_id"),
  metadata: jsonb("metadata"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIntegrationSchema = createInsertSchema(integrationsTable).omit({ id: true, connectedAt: true, updatedAt: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrationsTable.$inferSelect;
