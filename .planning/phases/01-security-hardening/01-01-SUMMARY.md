---
phase: 01-security-hardening
plan: "01"
subsystem: backend
tags: [security, rsvp, schema, public-api]
dependency_graph:
  requires: []
  provides: [rsvp-token-column, published-only-public-events]
  affects: [lib/db/src/schema/guests.ts, artifacts/api-server/src/routes/events.ts]
tech_stack:
  added: []
  patterns: [drizzle-sql-default, token-based-lookup]
key_files:
  created: []
  modified:
    - lib/db/src/schema/guests.ts
    - artifacts/api-server/src/routes/events.ts
decisions:
  - "Use md5(random()::text || clock_timestamp()::text) for rsvp_token default (pgcrypto not installed)"
  - "Remove status field from public event GET response (always 'published', no info value)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_modified: 2
requirements:
  - SEC-04
  - SEC-05
---

# Phase 1 Plan 01: Random RSVP Tokens + Published-Only Public Events Summary

**One-liner:** Replaced sequential guest.id RSVP tokens with 32-char md5 hex tokens and restricted the public event endpoint to published-only with 404 for drafts/cancelled.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add rsvpToken column to guests schema + push to DB | 433e633 |
| 2 | Fix public event endpoint (published-only) + RSVP token lookup | 5fdbdcd |

## What Was Done

### Task 1 — guests schema: rsvpToken column

Added `rsvp_token` column to `guestsTable` in `lib/db/src/schema/guests.ts`:

- Type: `text`, NOT NULL
- Default: `md5(random()::text || clock_timestamp()::text)` — generates a 32-char hex string automatically for every INSERT
- Unique index `guests_rsvp_token_idx` added to prevent collisions and enable fast token lookups
- Schema pushed to DB at port 5433 successfully — column confirmed present with `is_nullable=NO`
- Rebuilt `lib/db` TypeScript declarations so `guestsTable.rsvpToken` resolves correctly in consuming packages

### Task 2 — events route: two security fixes

**Fix 1 — SEC-05: Published-only public event GET**

Changed `GET /api/public/events/:slug` WHERE clause from:
```
eq(eventsTable.slug, slug)
```
to:
```
and(eq(eventsTable.slug, slug), eq(eventsTable.status, "published"))
```
Draft, cancelled, and any non-published event now returns 404. The `status` field was also removed from the response object — callers of a published-only endpoint don't need it, and exposing it could hint at the filter logic.

**Fix 2 — SEC-04: RSVP token lookup replaces integer ID**

Changed the `guestToken` branch in `POST /api/public/events/:slug/rsvp` from:
```typescript
const guestId = parseInt(guestToken, 10);
eq(guestsTable.id, guestId)
```
to:
```typescript
eq(guestsTable.rsvpToken, guestToken)
```
No `parseInt`. The token is a plain string match against the random column. The `eventId` guard is kept as defense-in-depth.

**Fix 3 — RSVP link construction updated in two places**

Both locations that embed RSVP links in emails were updated from `guest.id` to `guest.rsvpToken`:
- Launch endpoint (line ~204): personalized campaign HTML replacement
- Bulk-email endpoint (line ~349): `rsvpLink` variable for template substitution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pgcrypto extension not available**

- **Found during:** Task 1 — first push attempt
- **Issue:** `gen_random_bytes(integer) does not exist` — pgcrypto extension not installed in the Docker Postgres instance
- **Fix:** Fell back to `md5(random()::text || clock_timestamp()::text)` as the column default, exactly as the plan specified as the fallback. This produces a 32-char hex string. Less cryptographically strong than `gen_random_bytes(16)` but always available in standard Postgres and sufficient to close SEC-04 (token cannot be guessed by enumeration).
- **Files modified:** `lib/db/src/schema/guests.ts`
- **Commit:** 433e633

**2. [Rule 2 - Missing] lib/db declarations stale after schema change**

- **Found during:** Task 2 TypeScript check
- **Issue:** `rsvpToken` showed as not existing on the inferred type because `lib/db` uses `composite: true` and `emitDeclarationOnly` — api-server resolves types from `dist/`, not source
- **Fix:** Ran `pnpm --filter @workspace/db exec tsc --build` to regenerate declarations before final TS check
- **Files modified:** `lib/db/dist/` (generated, not committed)
- **Commit:** included in 433e633 scope

## Deferred Issues (out of scope)

Logged to `.planning/phases/01-security-hardening/deferred-items.md`:

- `events.ts:554` — pre-existing bug: `assertWithinLimit("events", activeCount, plan.limits)` called with 3 args but signature expects 5, and `plan.limits` doesn't exist. This is in the `duplicate` endpoint which was not touched by this plan. Will surface as a TS error until resolved in a later plan.
- Multiple pre-existing TS errors in `auth.ts`, `campaigns.ts`, `integrations.ts`, `guests.ts` — all pre-date this plan.

## Verification Status

### Automated

- DB push: `[✓] Changes applied` — confirmed via `pnpm run push`
- Column confirmed: `rsvp_token | md5(...) | NO` from `information_schema.columns`
- Unique index confirmed: `guests_rsvp_token_idx` in `pg_indexes`
- TypeScript: `events.ts` rsvpToken errors resolved after `lib/db` rebuild; remaining errors are pre-existing

### Manual Smoke Test (to verify after server restart)

1. Create an event in draft status → `GET /api/public/events/{slug}` should return 404
2. Publish the event → `GET /api/public/events/{slug}` should return 200 (no `status` field in response)
3. Cancel the event → `GET /api/public/events/{slug}` should return 404 again
4. Check a guest row: `SELECT rsvp_token FROM guests LIMIT 1;` — should be 32-char hex, not null
5. POST `/public/events/:slug/rsvp` with `guestToken: "<rsvp_token value>"` → 200
6. POST `/public/events/:slug/rsvp` with `guestToken: "1"` (old integer ID) → 404

## Self-Check: PASSED

- `lib/db/src/schema/guests.ts` — modified, rsvpToken column present
- `artifacts/api-server/src/routes/events.ts` — modified, published filter + token lookup applied
- Commit 433e633 — exists in git log
- Commit 5fdbdcd — exists in git log
