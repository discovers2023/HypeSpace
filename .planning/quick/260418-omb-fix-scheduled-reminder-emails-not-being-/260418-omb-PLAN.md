---
phase: 260418-omb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - artifacts/api-server/src/lib/scheduler.ts
autonomous: false
requirements:
  - REM-FIX-01  # Scheduled reminders deliver via real SMTP (org config), not Ethereal
  - REM-FIX-02  # Failed reminder batches retry on the next 60s tick instead of being marked sent prematurely

must_haves:
  truths:
    - "Scheduled reminders sent by processDueReminders() are delivered via the org's configured SMTP provider (not Ethereal)."
    - "When a reminder's scheduledAt is in the past and the row status != 'sent', the scheduler tick processes it within ~60s."
    - "If the per-guest send loop throws BEFORE attempting any send (e.g. event lookup fails, DB error), the reminder row is NOT marked 'sent' and will be retried on the next tick."
    - "Manual send via POST /reminders/:id/send still works unchanged."
  artifacts:
    - path: "artifacts/api-server/src/lib/scheduler.ts"
      provides: "processDueReminders() that resolves event.organizationId and passes orgId to sendEmail()"
      contains: "orgId: event.organizationId"
  key_links:
    - from: "scheduler.ts:processDueReminders"
      to: "eventsTable"
      via: "db.select().from(eventsTable).where(eq(eventsTable.id, reminder.eventId))"
      pattern: "eventsTable"
    - from: "scheduler.ts:processDueReminders"
      to: "sendEmail"
      via: "sendEmail({ ..., orgId })"
      pattern: "orgId"
---

<objective>
Fix scheduled reminder emails silently dropping into Ethereal preview instead of reaching guests.

Purpose: Users create reminders with `scheduledAt` set in the future. When the 60s scheduler tick reaches the due time, `processDueReminders()` calls `sendEmail()` without `orgId`. With no env-level SMTP configured, every send falls to the Ethereal test-account fallback in `email.ts:84-98` — generating a preview URL but no real delivery. Compounding this, the row is marked `status="sent"` BEFORE the send loop runs, so even a transient failure makes the reminder un-retryable.

Output: A single edited `scheduler.ts` whose `processDueReminders()` (a) looks up the parent event's `organizationId` once per due reminder and (b) passes that `orgId` into each `sendEmail()` call, matching the proven pattern in `routes/reminders.ts:71-114`. The "mark sent" UPDATE is moved AFTER the per-guest loop so pre-loop failures (event-not-found, DB error) leave the reminder pending for retry on the next tick.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@artifacts/api-server/src/lib/scheduler.ts
@artifacts/api-server/src/lib/email.ts
@artifacts/api-server/src/routes/reminders.ts
@lib/db/src/schema/events.ts
@lib/db/src/schema/reminders.ts

<interfaces>
<!-- Key contracts the executor needs. Already extracted — do not re-explore the codebase. -->

From artifacts/api-server/src/lib/email.ts:
```typescript
export async function sendEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  fromOverride?: { name: string; email: string };
  orgId?: number;          // ← THE MISSING FIELD in the broken call site
}): Promise<{ messageId: string; previewUrl?: string | false }>
```

`getTransporter(orgId)` resolution order (email.ts:49-99):
  1. Org SMTP from `integrationsTable` where `platform="smtp_provider"` AND `status="connected"` — REQUIRES orgId
  2. Env SMTP via `SMTP_HOST/SMTP_USER/SMTP_PASS` — NOT SET in this project's `.env`
  3. Ethereal test account — preview URL only, no real delivery ← currently hit on every reminder

From lib/db/src/schema/events.ts:
```typescript
export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  // ... other columns ...
});
```

From lib/db/src/schema/reminders.ts:
```typescript
export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id),
  // NOTE: NO organizationId column. Must resolve via eventsTable.
  // ... other columns ...
});
```

Reference: working manual-send pattern (artifacts/api-server/src/routes/reminders.ts:93-104):
```typescript
for (const guest of eligible) {
  await sendEmail({
    to: guest.email,
    toName: guest.name,
    subject: reminder.subject,
    html: `...`,
    text: reminder.message,
    orgId,                  // ← passed correctly here
  });
}
```

Reference: event-org lookup pattern already used in scheduler.ts:25-29 for campaigns:
```typescript
const [org] = await db
  .select()
  .from(organizationsTable)
  .where(eq(organizationsTable.id, campaign.organizationId));
```
For reminders we need the event-org lookup instead (since reminder has no orgId column):
```typescript
const [event] = await db
  .select()
  .from(eventsTable)
  .where(eq(eventsTable.id, reminder.eventId));
```
`eventsTable` is already exported from `@workspace/db` (campaigns import is the proof of available imports).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix processDueReminders to pass orgId and reorder mark-sent</name>
  <files>artifacts/api-server/src/lib/scheduler.ts</files>
  <action>
Make exactly these changes to `artifacts/api-server/src/lib/scheduler.ts`. Do not touch `processDueScheduledCampaigns`, `escapeHtml`, `startScheduler`, or any other code.

**Change 1 — Add `eventsTable` to the existing import on line 1:**

Current:
```typescript
import { db, campaignsTable, activityTable, organizationsTable, remindersTable, guestsTable } from "@workspace/db";
```

New:
```typescript
import { db, campaignsTable, activityTable, organizationsTable, remindersTable, guestsTable, eventsTable } from "@workspace/db";
```

**Change 2 — Rewrite the body of `processDueReminders()` (lines ~85–138).** Keep the function signature, the outer query for `due` reminders, and the outer try/catch. Inside the `for (const reminder of due)` loop:

Replace the existing try-block body with:

```typescript
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
```

**Decision log (mark-sent semantics):** This fix marks the reminder `sent` after the per-guest loop completes, regardless of whether individual `sendEmail()` calls inside the loop failed. Justification:
  1. Mirrors the campaign scheduler pattern (scheduler.ts:41-57) so the codebase has one consistent rule.
  2. Per-guest `.catch()` already logs each failure for observability.
  3. Re-running the whole reminder on partial failure would re-spam guests who DID receive it (no per-guest send-tracking exists yet).
  4. The failure mode the user reported (Ethereal-fallback) is a *pre-loop* config issue and is now fixed by passing `orgId`. True per-guest retry is a v2 feature requiring a `reminder_sends` ledger table — explicitly out of scope.

The outer try/catch DOES enable retry for failures that occur before any send is attempted (event lookup, guest query, DB error) — those leave `status` untouched.

**Do NOT:**
- Touch `processDueScheduledCampaigns`
- Add new imports beyond `eventsTable`
- Refactor the audience filter, the HTML template, or `escapeHtml`
- Add a per-guest send-tracking table
- Add retry counters or backoff logic
- Reformat unrelated lines
  </action>
  <verify>
    <automated>cd /root/Claude-projects/HypeSpace && pnpm --filter @workspace/api-server exec tsc --noEmit</automated>
  </verify>
  <done>
- `eventsTable` appears in the import on scheduler.ts line 1.
- `processDueReminders()` calls `db.select().from(eventsTable)...` once per due reminder before sending.
- Every `sendEmail({...})` call inside `processDueReminders()` includes `orgId`.
- The `db.update(remindersTable).set({ status: "sent", ... })` call is positioned AFTER the per-guest `for` loop (not before).
- The "event not found" branch marks the reminder sent and `continue`s (so deleted events don't poll forever).
- The outer `catch` block does NOT mark the reminder sent.
- TypeScript compilation passes with no new errors.
- No changes to `processDueScheduledCampaigns`, `escapeHtml`, `startScheduler`, or any other file.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual end-to-end verification with real SMTP</name>
  <what-built>
`processDueReminders()` now resolves `event.organizationId` and passes it to `sendEmail()`, so the org's configured SMTP provider (tier 1 in `getTransporter`) is used instead of the Ethereal fallback. The mark-sent UPDATE was moved to after the send loop so pre-loop failures retry on the next tick.
  </what-built>
  <how-to-verify>
**Prerequisites:**
1. The org used in testing must have an SMTP integration configured: a row in `integrations` table with `organization_id = <your org>`, `platform = 'smtp_provider'`, `status = 'connected'`, and `metadata` containing valid `host`, `port`, `user`, `pass`, optional `fromEmail`/`fromName`. If this is missing, configure it via the Settings → Integrations UI BEFORE running this verification (otherwise the tier-2 env-SMTP path will be hit, which is also valid but won't prove the tier-1 fix).
2. Have `psql` access to the dev DB (via docker-compose: `docker compose exec postgres psql -U postgres -d hypespace`) and tail access to the api-server logs.

**Steps:**
1. Restart the api-server so it picks up the new code:
   ```
   pnpm --filter @workspace/api-server dev
   ```
   Watch for the log line: `Campaign & reminder scheduler started (interval: 60s)`.

2. Pick or create an event you control. Note its `id` and the `organization_id` of the org. Make sure at least one guest on the event has `status = 'confirmed'` and a real email address you can check (your own).

3. Insert a reminder with `scheduled_at` 30 seconds in the past so the next tick will pick it up:
   ```sql
   INSERT INTO reminders (event_id, type, offset_hours, subject, message, audience, channel, status, scheduled_at)
   VALUES (<EVENT_ID>, 'before_event', 1, 'Reminder test 260418-omb', 'This is a scheduled reminder delivery test.', 'confirmed_and_maybe', 'email', 'pending', NOW() - INTERVAL '30 seconds')
   RETURNING id;
   ```
   Note the returned `id`.

4. Within 60 seconds, watch the api-server logs. You should see ONE of:
   - `📧  Email sent to <your-email> (messageId: <real-id>)` — SUCCESS, real SMTP path used.
   - `📧  Email sent (Ethereal preview): ... Preview: <url>` — FAILURE, org SMTP not resolved (check the org's integrations row).
   Followed by: `Scheduled reminder sent` with `recipientCount` and `orgId` populated.

5. Confirm the email actually arrived in your inbox (the real one, not Ethereal). Subject: `Reminder test 260418-omb`.

6. Confirm the reminder row was marked sent:
   ```sql
   SELECT id, status, sent_at FROM reminders WHERE id = <REMINDER_ID>;
   ```
   Expected: `status = 'sent'`, `sent_at` populated.

7. **Retry-on-failure spot check (optional but recommended):** Temporarily corrupt the org SMTP config (e.g. set `metadata.host` to `'invalid.example'` via SQL). Insert another past-due reminder. Observe:
   - Log shows `Reminder email failed` per guest (connection refused / DNS fail).
   - The row IS still marked `sent` after the loop (matches campaign-scheduler semantics — see decision log in Task 1).
   This confirms the chosen "mark sent after loop, log per-guest failures" behavior. Restore the SMTP config when done.

8. **Pre-loop retry spot check (optional):** Insert a reminder pointing to a non-existent `event_id` (e.g. 999999). Wait one tick. Verify the row is marked sent with the warn log `Reminder skipped: event not found` (not infinitely retried). 

If real email arrives in step 5 → fix is verified. If only Ethereal preview appears → check the org's `integrations` row and re-test.
  </how-to-verify>
  <resume-signal>Type "approved" once a real reminder email landed in your inbox, or describe what you observed.</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles cleanly (Task 1 automated check).
- A reminder inserted with past `scheduled_at` is processed within ~60s.
- Recipient receives the email at their real address (not via Ethereal preview URL).
- `reminders.status` flips to `sent` and `reminders.sent_at` is populated only after the send loop runs.
- Logs include `Scheduled reminder sent` with `orgId` field populated (proves the lookup happened).
</verification>

<success_criteria>
- User-reported symptom resolved: scheduled reminders are delivered to real inboxes.
- The two-line root cause (missing `orgId` arg + premature mark-sent) is fixed.
- No collateral changes to other scheduler functions, email helpers, or routes.
- No new tables, no new env vars, no new dependencies.
</success_criteria>

<output>
After completion, create `.planning/quick/260418-omb-fix-scheduled-reminder-emails-not-being-/260418-omb-SUMMARY.md` summarizing:
- Files modified (single file: scheduler.ts)
- The two semantic changes (orgId pass-through; mark-sent reorder)
- The decision-log rationale on retry semantics
- Verification result from Task 2
</output>
