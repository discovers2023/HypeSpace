---
phase: quick-260419-idor
plan: "01"
status: complete
subsystem: api-server
tags: [security, idor, multi-tenancy, middleware, express]
provides:
  - requireOrgMembership middleware in artifacts/api-server/src/routes/index.ts
  - 403 response on any /api/organizations/:orgId/* request where session.userId is not in team_members for that org
affects:
  - artifacts/api-server/src/routes/index.ts
requirements: [IDOR-fix]
severity: P0 / blocker
decisions:
  - "Middleware mounted at path `/organizations/:orgId` so Express populates req.params.orgId — routes without :orgId (GET /organizations, POST /organizations) are unaffected"
  - "Middleware runs AFTER requireAuth — userId is guaranteed present, but keep a defensive check anyway (belt-and-suspenders)"
  - "403 returns {error:'FORBIDDEN', message:'You do not have access to this organization'} — does not leak whether the org exists"
  - "No frontend changes needed — users who legitimately belong to the org get 2xx; UX unaffected"
metrics:
  duration: ~8 minutes
  completed: 2026-04-19
  tasks_completed: 1
  files_changed: 1
---

# Quick 260419-idor: Close Cross-Org IDOR with requireOrgMembership

**One-liner:** Added a single Express middleware that rejects any `/api/organizations/:orgId/*` request where `session.userId` is not a member of `orgId`. Closes the IDOR uncovered in Phase 2 UAT Test 8.

## What Was Done

### Task 1 — requireOrgMembership middleware
**File:** `artifacts/api-server/src/routes/index.ts`

- Imported `db`, `teamMembersTable` from `@workspace/db` and `and`, `eq` from `drizzle-orm`
- Added async middleware `requireOrgMembership`:
  - Parses `req.params.orgId` (handles `string | string[]` per Express type)
  - Returns 400 on invalid id, 401 if session missing (defense in depth)
  - Queries `team_members` for a row with `(userId=session.userId, organizationId=orgId)` LIMIT 1
  - Returns 403 `FORBIDDEN` if no membership row
  - Calls `next()` on success; surfaces DB errors via `next(err)`
- Mounted via `router.use("/organizations/:orgId", requireOrgMembership)` immediately after the existing requireAuth path-exclusion block and before any sub-routers

## Verification (live curl against rebuilt api-server)

**Setup:** Seeded user 1 (member of org 1 only). Inserted separate user+org 99 with 1 event, then tested as user 1.

| Call | Expected | Got |
|------|----------|-----|
| `GET /api/organizations/1/events` (own org) | 200 | **200 ✓** |
| `GET /api/organizations/1` (own org) | 200 | **200 ✓** |
| `GET /api/organizations/99/events` (foreign) | 403 | **403 ✓** |
| `GET /api/organizations/99` (foreign) | 403 | **403 ✓** |
| `GET /api/organizations/99/campaigns` (foreign) | 403 | **403 ✓** |
| `PUT /api/organizations/99/events/:id` (hijack attempt) | 403 | **403 ✓** |
| DB `SELECT title FROM events WHERE id=6` (post-hijack) | "Victim Event" | **"Victim Event" ✓ (NOT HIJACKED)** |
| `GET /api/organizations` (list, no :orgId) | 200 | **200 ✓** |

403 body: `{"error":"FORBIDDEN","message":"You do not have access to this organization"}` — no info leak about org existence.

## TypeScript

- `src/routes/index.ts` — **0 errors** (initial attempt had one TS2345 on `parseInt(req.params.orgId, 10)`; fixed by handling `string | string[]` with `Array.isArray` guard, matching the pattern used in `events.ts:460`)
- 3 pre-existing `admin.ts` errors (Session.isAdmin / .impersonating) untouched — Phase 3 QUAL-01 scope

## Threat Model

| Threat | Mitigation | Status |
|--------|------------|--------|
| Cross-org READ via URL manipulation | requireOrgMembership rejects with 403 | Implemented |
| Cross-org WRITE via URL manipulation | Same — middleware runs before any write handler | Implemented |
| Existence enumeration via response difference | 403 returned regardless of whether the org exists | Mitigated |
| Race between membership deletion and in-flight request | Acceptable — window is milliseconds; new requests will be blocked | Accepted |

## Self-Check: PASSED

- `artifacts/api-server/src/routes/index.ts` — `requireOrgMembership` function exists, mounted at correct path
- Build succeeds: `pnpm run build` produces updated `dist/index.mjs`
- Runtime verified: restarted api-server, 403 on foreign org, 200 on own org
- DB cleanup: test org 99 + victim user removed; DB back to seed baseline
