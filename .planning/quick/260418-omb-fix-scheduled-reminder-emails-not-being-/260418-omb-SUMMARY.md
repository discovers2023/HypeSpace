---
phase: 260418-omb
plan: 01
subsystem: scheduler / email-delivery
tags: [bugfix, reminders, smtp, scheduler]
requires:
  - eventsTable (export from @workspace/db)
  - sendEmail.orgId parameter (already supported in email.ts)
provides:
  - processDueReminders() that resolves event.organizationId and passes orgId to sendEmail()
  - Retry semantics for pre-loop reminder failures (event lookup, DB/guest query errors)
affects:
  - artifacts/api-server/src/lib/scheduler.ts
tech-stack:
  added: []
  patterns:
    - "Event-org lookup pattern: db.select().from(eventsTable).where(eq(eventsTable.id, reminder.eventId))"
key-files:
  modified:
    - artifacts/api-server/src/lib/scheduler.ts
  created: []
decisions:
  - "Mark reminder 'sent' AFTER per-guest send loop (mirrors campaign scheduler semantics)"
  - "Per-guest send failures only logged, not retried — matches existing campaign behavior; true per-guest retry is a v2 reminder_sends ledger feature"
  - "Pre-loop failures (caught by outer try) leave status untouched so next 60s tick retries"
  - "Event-not-found branch marks reminder 'sent' + warns to stop polling deleted-event reminders"
metrics:
  duration: ~4 minutes
  completed: 2026-04-18
  tasks: 2 (1 auto + 1 human-verify checkpoint)
  files_modified: 1
  commits: 1 (7cc6747)
requirements: [REM-FIX-01, REM-FIX-02]
---

# Phase 260418-omb Plan 01: Fix scheduled reminder emails not being delivered Summary

Two-line bug fix in `processDueReminders()`: thread `orgId` into `sendEmail()` so org-configured SMTP is used (not Ethereal preview), and reorder the mark-sent UPDATE to AFTER the send loop so pre-loop failures get retried on the next 60s tick.

## Problem

User-reported symptom: scheduled reminders silently dropping into Ethereal preview URLs instead of reaching real inboxes. Two compounding root causes in `artifacts/api-server/src/lib/scheduler.ts:processDueReminders()`:

1. **Missing `orgId` in `sendEmail()` call** — `email.ts:getTransporter()` resolves SMTP in three tiers: (1) org SMTP from `integrationsTable` keyed by `orgId`, (2) env SMTP from `SMTP_HOST/USER/PASS`, (3) Ethereal test account fallback. With no `orgId` passed AND no env vars set in this project's `.env`, every scheduled reminder fell to tier 3 — preview URLs only, zero real delivery.
2. **Premature mark-sent** — the `status="sent"` UPDATE ran BEFORE the per-guest send loop, so any pre-loop failure (event lookup, DB error) left the reminder un-retryable.

The manual-send route (`routes/reminders.ts:71-114`) was already correct — it had the org context from the request and passed `orgId` properly. The scheduler was the lone broken caller.

## What Changed

**File:** `artifacts/api-server/src/lib/scheduler.ts` (+26 / -8 lines)

1. **Import:** added `eventsTable` to the existing `@workspace/db` import (line 1).
2. **Resolve org from event:** Inside the per-reminder loop, do `db.select().from(eventsTable).where(eq(eventsTable.id, reminder.eventId))` once. `remindersTable` has no `organizationId` column, so the event is the only path.
3. **Event-not-found short-circuit:** If the event was deleted, mark the reminder `sent` (with a `warn` log) and `continue` — prevents the scheduler polling a tombstone forever.
4. **Pass `orgId` to sendEmail:** Each per-guest `sendEmail({...})` call now includes `orgId`, so `getTransporter(orgId)` resolves the org's tier-1 SMTP integration.
5. **Move mark-sent AFTER loop:** The `db.update(remindersTable).set({ status: "sent", sentAt: new Date() })` call now runs after the `for (const guest of eligible)` loop instead of before it. The outer `try/catch` no longer marks-sent on error — pre-loop failures (event lookup, guest query, DB error) leave `status` untouched so the next 60s tick retries automatically.
6. **Logging:** `Scheduled reminder sent` log now includes the resolved `orgId` field (proves the lookup happened).

## Decision Log: Mark-Sent Semantics

The fix marks the reminder `sent` after the per-guest loop completes regardless of whether individual `sendEmail()` calls inside the loop failed. Justification:

1. **Mirrors campaign scheduler** (`scheduler.ts:41-57`) — one consistent rule for the codebase.
2. **Per-guest `.catch()` already logs each failure** for observability.
3. **Re-running the whole reminder on partial failure would re-spam guests who DID receive it** (no per-guest send-tracking exists yet).
4. **The user-reported failure mode was a *pre-loop* config issue** (Ethereal-fallback) and is now fixed by passing `orgId`. True per-guest retry would need a `reminder_sends` ledger table — explicitly out of scope per the plan.

The outer `try/catch` DOES enable retry for failures occurring before any send is attempted (event lookup, guest query, DB error) — those leave `status` untouched and the next tick reprocesses the row.

## Verification

### Automated (Task 1) — PASSED

```
cd /root/Claude-projects/HypeSpace && pnpm --filter @workspace/api-server exec tsc --noEmit
```

Result: zero new TypeScript errors in `scheduler.ts`. Pre-existing errors in `src/routes/admin.ts` (lines 25, 107, 108 — `Property 'isAdmin' does not exist on type 'Session'`) are unrelated to this task and out of scope.

### Manual (Task 2) — AWAITING USER

The plan includes a `checkpoint:human-verify` with these steps. **User to execute before closing the task:**

**Prerequisites:**
1. Test org must have an SMTP integration configured: row in `integrations` table with `organization_id = <your org>`, `platform = 'smtp_provider'`, `status = 'connected'`, `metadata` containing valid `host`/`port`/`user`/`pass`. Configure via Settings → Integrations UI if missing.
2. `psql` access to dev DB (`docker compose exec postgres psql -U postgres -d hypespace`) and tail access to api-server logs.

**Steps:**

1. Restart api-server: `pnpm --filter @workspace/api-server dev` and confirm `Campaign & reminder scheduler started (interval: 60s)` log line.

2. Pick an event with at least one `confirmed` guest using a real email you can check (your own).

3. Insert a past-due reminder so the next tick picks it up:
   ```sql
   INSERT INTO reminders (event_id, type, offset_hours, subject, message, audience, channel, status, scheduled_at)
   VALUES (<EVENT_ID>, 'before_event', 1, 'Reminder test 260418-omb', 'This is a scheduled reminder delivery test.', 'confirmed_and_maybe', 'email', 'pending', NOW() - INTERVAL '30 seconds')
   RETURNING id;
   ```

4. Within 60 seconds, watch logs for ONE of:
   - `📧  Email sent to <your-email> (messageId: <real-id>)` — SUCCESS, real SMTP path used.
   - `📧  Email sent (Ethereal preview): ... Preview: <url>` — FAILURE, org SMTP not resolved (check the org's integrations row).

   Followed by: `Scheduled reminder sent` log line with `recipientCount` and `orgId` populated.

5. Confirm the email arrived in your real inbox (subject: `Reminder test 260418-omb`).

6. Confirm row was marked sent:
   ```sql
   SELECT id, status, sent_at FROM reminders WHERE id = <REMINDER_ID>;
   ```
   Expected: `status = 'sent'`, `sent_at` populated.

**Optional spot checks:**

7. **Retry-on-failure (per-guest):** Temporarily corrupt org SMTP `metadata.host` to `'invalid.example'`, insert another past-due reminder. Logs should show `Reminder email failed` per guest, but the row IS still marked `sent` (matches campaign semantics). Restore SMTP after.

8. **Pre-loop retry (event-not-found):** Insert a reminder with `event_id = 999999`. Verify row is marked `sent` with warn `Reminder skipped: event not found` (not retried infinitely).

**Resume signal:** User to type "approved" once a real reminder lands in inbox, or describe what they observed.

## Deviations from Plan

None — plan executed exactly as written. The plan was extremely prescriptive (full code blocks for both edits) and required no improvisation.

## Out-of-Scope Issues Noted (NOT fixed)

Pre-existing TypeScript errors discovered during typecheck — unrelated to this task, no action taken:

| File | Lines | Error |
|------|-------|-------|
| `artifacts/api-server/src/routes/admin.ts` | 25, 107, 108 | `Property 'isAdmin'/'impersonating' does not exist on type 'Session & Partial<SessionData>'` (missing session type augmentation) |

These should be tracked separately if not already covered by another task.

## Commits

| Hash    | Message                                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| 7cc6747 | fix(260418-omb): pass orgId to scheduled reminder sendEmail + retry on pre-loop failure |

## Self-Check: PASSED

- File modified: `artifacts/api-server/src/lib/scheduler.ts` — FOUND
- Commit `7cc6747` — FOUND in `git log`
- Import line includes `eventsTable` — VERIFIED (line 1)
- `db.select().from(eventsTable)` lookup present — VERIFIED (line 101)
- `sendEmail` call includes `orgId` — VERIFIED (line 135)
- Mark-sent UPDATE positioned AFTER per-guest loop — VERIFIED (line 146, after loop ending line 139)
- Event-not-found branch marks sent + continues — VERIFIED (lines 102-109)
- Outer catch does NOT mark sent — VERIFIED (lines 151-154, only logs)
- No changes to `processDueScheduledCampaigns`, `escapeHtml`, `startScheduler`, or other files — VERIFIED via `git diff --stat`
