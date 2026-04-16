---
phase: 01-security-hardening
plan: 02
subsystem: api-server
tags: [security, auth, session, csrf, cors]
dependency_graph:
  requires: []
  provides: [session-auth, requireAuth-middleware, csrf-protection, restricted-cors]
  affects: [artifacts/api-server/src/app.ts, artifacts/api-server/src/routes/auth.ts, artifacts/api-server/src/routes/index.ts]
tech_stack:
  added: [express-session, @types/express-session, csrf-csrf]
  patterns: [double-submit CSRF cookie, session-based auth, CORS allowlist]
key_files:
  created:
    - artifacts/api-server/src/types/session.d.ts
  modified:
    - artifacts/api-server/src/app.ts
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/api-server/src/routes/index.ts
    - artifacts/api-server/package.json
    - pnpm-lock.yaml
decisions:
  - "Used csrf-csrf v4 double-submit pattern instead of deprecated csurf; getSessionIdentifier required in v4 API"
  - "MemoryStore left in place for dev/staging; TODO comment added for connect-pg-simple in production"
  - "CSRF exemptions: login, register, public/* — these are safe because they don't operate on pre-existing session state"
  - "requireAuth applied globally in index.ts via path prefix exclusion rather than per-router to catch all future routers automatically"
metrics:
  duration: 2m
  completed: 2026-04-15
  tasks_completed: 2
  files_changed: 5
---

# Phase 1 Plan 02: Session Auth + CSRF + CORS Hardening Summary

**One-liner:** express-session with httpOnly/SameSite=strict cookies, requireAuth middleware on all routes, csrf-csrf double-submit CSRF protection, and CORS restricted to ALLOWED_ORIGINS.

## What Was Done

### Task 1 — Install packages and wire session + CORS + CSRF middleware (commit: 9fde72f)

Installed `express-session`, `@types/express-session`, and `csrf-csrf` v4.

Updated `app.ts` to add:
- **CORS** restricted to `ALLOWED_ORIGINS` env var (defaults to `http://localhost:5173`); `credentials: true` for session cookies
- **express-session** with `httpOnly: true`, `sameSite: "strict"`, `secure` in production, 7-day expiry
- **csrf-csrf** double-submit CSRF protection applied to all mutations, exempting login/register/public paths
- `app.locals.generateCsrfToken` exposed so auth routes can issue tokens to the frontend
- Session startup guard: throws if `SESSION_SECRET` is unset in production

Created `src/types/session.d.ts` to augment `express-session`'s `SessionData` interface with `userId: number`.

### Task 2 — requireAuth middleware + session-based login/logout/me (commit: 6deb753)

Updated `routes/index.ts`:
- Added `requireAuth` middleware that checks `req.session?.userId` and returns `401` if absent
- Applied globally before all route registrations, with path exemptions for `/auth/*`, `/healthz`, `/health`, `/public/*`
- This protects all `/organizations/*` routes and any future routes automatically

Updated `routes/auth.ts`:
- **GET /auth/me** — reads `userId` from session (was hardcoded to `1`); returns `401` if no session; issues fresh CSRF token on each call
- **POST /auth/login** — sets `req.session.userId = user.id` after password check; returns `csrfToken` for frontend to store
- **POST /auth/logout** — destroys session via `req.session.destroy()` and clears `connect.sid` cookie
- `POST /auth/register` — unchanged (no session set on register; user must log in separately)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed csrf-csrf v4 API differences**
- **Found during:** Task 1 typecheck
- **Issue:** Plan used csrf-csrf v3 API (`generateToken`, `getTokenFromRequest`). Installed version is v4 which requires `generateCsrfToken`, `getCsrfTokenFromRequest`, and a new required option `getSessionIdentifier`
- **Fix:** Updated `doubleCsrf()` call to use v4 API; `getSessionIdentifier` uses `req.session.id` as the per-user HMAC binding identifier
- **Files modified:** `artifacts/api-server/src/app.ts`
- **Commit:** 9fde72f

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| `artifacts/api-server/src/app.ts` | 54 | `// TODO: Replace MemoryStore with connect-pg-simple for production` — intentional; plan noted this is acceptable for the April 20 deadline |

## Verification Status

### Must-Have Truths

| Truth | Status |
|-------|--------|
| Unauthenticated request to /api/organizations/* returns 401 | Satisfied — requireAuth middleware blocks all non-open paths |
| State-changing request from external origin without CSRF token is rejected | Satisfied — doubleCsrfProtection applied to all mutations |
| Login sets secure, httpOnly, SameSite=Strict session cookie | Satisfied — session middleware configured with these exact options |
| GET /auth/me reads userId from session, not hardcoded to 1 | Satisfied — reads `req.session?.userId`, returns 401 if absent |

### TypeScript

- `app.ts`: clean (no errors)
- `routes/auth.ts`: one pre-existing TS6305 error from broken `@workspace/api-zod` dist build — not introduced by this plan; same error exists in `organizations.ts`, `reminders.ts`, `social.ts`, `team.ts`
- `routes/index.ts`: clean (no errors)

### Pre-existing Issues (Out of Scope)

The `@workspace/api-zod` package has a broken `dist/` build (ambiguous re-exports in `src/index.ts`) causing TS6305 errors across multiple route files. This was present before this plan and is deferred to QUAL-01 (Phase 3).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes were introduced beyond what was planned. The session cookie and CSRF token cookie are new browser-visible artifacts, but these are the mitigations for T-02-03/T-02-04, not new attack surface.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `artifacts/api-server/src/app.ts` | FOUND |
| `artifacts/api-server/src/routes/auth.ts` | FOUND |
| `artifacts/api-server/src/routes/index.ts` | FOUND |
| `artifacts/api-server/src/types/session.d.ts` | FOUND |
| `.planning/phases/01-security-hardening/01-02-SUMMARY.md` | FOUND |
| Commit 9fde72f (Task 1) | FOUND |
| Commit 6deb753 (Task 2) | FOUND |
