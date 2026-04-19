---
phase: quick-260419-idor
plan: "01"
subsystem: api-server
type: security-hardening
files_modified:
  - artifacts/api-server/src/routes/index.ts
requirements: [SEC-01-extension, IDOR-fix]
severity: P0 / blocker
source: .planning/phases/02-multi-organization/02-UAT.md gap for Test 8
---

# Quick 260419-idor: Close Cross-Org IDOR via requireOrgMembership Middleware

## Context

Phase 2 UAT Test 8 confirmed a catastrophic IDOR:
- User 1 (member of orgs [1, 5] only) was able to GET /api/organizations/99/events and receive org 99's private events
- Same user was able to PUT /api/organizations/99/events/:id and overwrite the title to "HIJACKED" in the DB

Root cause: `requireAuth` middleware in `routes/index.ts` validates that a session exists but does NOT check whether the session user is a member of the organization in the URL path. Every authenticated user can read and mutate every other org's data.

## Fix

Add a single Express middleware `requireOrgMembership` mounted at path `/organizations/:orgId` that:
1. Parses `orgId` from the path param
2. Queries `team_members` for (userId=session.userId, organizationId=orgId) LIMIT 1
3. Returns 403 `FORBIDDEN` if no membership row exists
4. Calls next() otherwise

Mount placement: in `routes/index.ts`, after the existing `requireAuth` path-exclusion middleware (line 58) and before the router `.use()` statements (lines 60+). This ensures every sub-router receives already-authorized requests.

Scope:
- GET/POST/PUT/PATCH/DELETE `/organizations/:orgId/*` — all protected
- GET /organizations (list user's own orgs, no :orgId) — UNAFFECTED (different path)
- POST /organizations (create new org, no :orgId) — UNAFFECTED

## Tasks

### Task 1 — Implement requireOrgMembership middleware + wire in routes/index.ts
**File:** `artifacts/api-server/src/routes/index.ts`

**Action:**
- Import `db`, `teamMembersTable`, `and`, `eq` from `@workspace/db` + `drizzle-orm`
- Add async middleware `requireOrgMembership` that queries team_members for a membership row
- Mount with `router.use("/organizations/:orgId", requireOrgMembership)` after requireAuth block

**Verify:**
- Seeded state: user 1 ∈ org 1 only (single-org account)
- Setup: create org 99 with user X (new user), insert 1 event
- Curl as user 1 (with cookie):
  - `GET /api/organizations/1/events` → 200 (allowed, user is member)
  - `GET /api/organizations/99/events` → 403 (DENIED, user is NOT member)
  - `PUT /api/organizations/99/events/:id` → 403
  - `GET /api/organizations/1` → 200
  - `GET /api/organizations/99` → 403
- Clean up test data

**Done when:**
- All 4 curl checks above pass
- No pre-existing tests break (none exist, but typecheck must not regress on this file)
- Commit atomic, message: `fix(security): close cross-org IDOR with requireOrgMembership middleware`

## must_haves

truths:
- "An authenticated user who is NOT a member of org :orgId receives 403 on any GET/POST/PUT/PATCH/DELETE under /api/organizations/:orgId/*"
- "An authenticated user who IS a member of org :orgId receives normal 2xx/4xx responses per the route handler"
- "Endpoints under /api/organizations (no :orgId) are unaffected"
- "requireOrgMembership runs AFTER requireAuth (session already validated) and BEFORE any sub-router handler"

artifacts:
- path: artifacts/api-server/src/routes/index.ts
  contains: "requireOrgMembership"
  imports: ["teamMembersTable", "db", "and", "eq"]
