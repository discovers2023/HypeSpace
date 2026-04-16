---
phase: 02-multi-organization
plan: 01
subsystem: api-server
tags: [auth, orgs, multi-tenancy, drizzle, session]
dependency_graph:
  requires: [session-auth, requireAuth-middleware]
  provides: [auth-me-orgs-contract]
  affects: [artifacts/api-server/src/routes/auth.ts]
tech_stack:
  added: []
  patterns: [drizzle innerJoin, asc ordering, session-userId to org membership lookup]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/routes/auth.ts
decisions:
  - "Return 401 (not 200 with empty array) when user has no org membership — a user without any org cannot operate on the platform"
  - "activeOrgId derived server-side from first membership by createdAt ascending — client cannot influence ordering, no privilege escalation"
  - "orgs/activeOrgId spread outside GetMeResponse.parse() — same pattern as csrfToken; avoids mutating the Zod schema which is shared with api-zod"
metrics:
  duration: 5m
  completed: 2026-04-16
  tasks_completed: 1
  files_changed: 1
---

# Phase 2 Plan 01: Enhance /auth/me with Orgs + activeOrgId Summary

**One-liner:** GET /auth/me now queries teamMembersTable JOIN organizationsTable for the session user, returning orgs [{id, name, slug}] and activeOrgId (first by createdAt) — providing the backend contract Plan 02-02 consumes to eliminate hardcoded ORG_ID=1.

## What Was Done

### Task 1 — Enhance /auth/me to return user's orgs and activeOrgId (commit: 133e818)

Updated `artifacts/api-server/src/routes/auth.ts`:

- Added `asc` to the `drizzle-orm` import (alongside existing `eq`)
- After the existing user lookup, added a `teamMembersTable.innerJoin(organizationsTable)` query filtered by `teamMembersTable.userId = session.userId`, ordered by `asc(teamMembersTable.createdAt)`
- Added a 401 guard when memberships is empty (`{ error: "No organization access" }`)
- Built `orgs` array `[{ id, name, slug }]` and derived `activeOrgId = orgs[0].id`
- Merged `orgs` and `activeOrgId` into the existing `res.json()` spread pattern alongside `csrfToken`

`teamMembersTable` and `organizationsTable` were already imported from `@workspace/db` — no import changes needed beyond adding `asc`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

TypeScript compile (excluding pre-existing TS6305 from broken api-zod dist):
- `auth.ts`: zero errors introduced
- All other errors (campaigns.ts, events.ts, guests.ts, integrations.ts, social.ts) are pre-existing, deferred to QUAL-01 in Phase 3

Response shape for authenticated user with org membership:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Alice",
  "avatarUrl": null,
  "createdAt": "2026-04-15T00:00:00.000Z",
  "orgs": [{ "id": 1, "name": "Acme Corp", "slug": "acme-corp-1" }],
  "activeOrgId": 1,
  "csrfToken": "..."
}
```

## Must-Have Truths

| Truth | Status |
|-------|--------|
| GET /auth/me returns orgs array [{id, name, slug}] | Satisfied — built from JOIN query result |
| GET /auth/me returns activeOrgId (first by team_members.createdAt asc) | Satisfied — `orgs[0].id` after ordering |
| User with no team_members row gets 401 | Satisfied — `memberships.length === 0` guard returns `{ error: "No organization access" }` |

## Threat Surface

| Threat ID | Status |
|-----------|--------|
| T-02-01: org list only shows user's own orgs | Mitigated — WHERE clause filters by `teamMembersTable.userId = session.userId` |
| T-02-02: activeOrgId elevation risk | Accepted — server-derived from createdAt order; client has no influence |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `artifacts/api-server/src/routes/auth.ts` | FOUND |
| `.planning/phases/02-multi-organization/02-01-SUMMARY.md` | FOUND |
| Commit 133e818 (Task 1) | FOUND |
