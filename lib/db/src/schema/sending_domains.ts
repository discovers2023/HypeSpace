import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const sendingDomainsTable = pgTable("sending_domains", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  domain: text("domain").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  // DNS records the customer needs to add
  dnsRecords: jsonb("dns_records").$type<Array<{ type: string; name: string; value: string }>>(),
  // Verification status
  status: text("status").notNull().default("pending"), // pending | verifying | verified | failed
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  // Provider-specific metadata (e.g. SES identity ARN, Postmark server ID)
  providerMeta: jsonb("provider_meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SendingDomain = typeof sendingDomainsTable.$inferSelect;
