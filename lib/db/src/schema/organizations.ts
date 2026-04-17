import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  plan: text("plan").notNull().default("free"),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id),
  primaryColor: text("primary_color").default("#F97316"),
  accentColor: text("accent_color").default("#7C3AED"),
  fromEmail: text("from_email"),
  replyToEmail: text("reply_to_email"),
  emailFooterText: text("email_footer_text"),
  // AI provider config — encrypted in production, stored as JSON
  aiProvider: text("ai_provider").default("none"), // none | anthropic | gemini | openai | ollama
  aiApiKey: text("ai_api_key"), // encrypted API key
  aiModel: text("ai_model"), // e.g. claude-sonnet-4-20250514, gemini-pro, gpt-4o, llama3
  aiBaseUrl: text("ai_base_url"), // custom endpoint for Ollama / self-hosted
  // Null = onboarding wizard not yet completed; any timestamp = completed at that time.
  // After schema push, backfill existing dev/seed orgs with:
  //   UPDATE organizations SET onboarding_completed_at = NOW() WHERE id = 1;
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
