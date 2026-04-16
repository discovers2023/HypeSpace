---
phase: 01-security-hardening
plan: "03"
subsystem: api-server
tags: [security, email-verification, auth, registration]
dependency_graph:
  requires: [session-auth, requireAuth-middleware]
  provides: [email-verification, verified-login-gate]
  affects:
    - lib/db/src/schema/users.ts
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/api-server/src/lib/email.ts
tech_stack:
  added: []
  patterns: [crypto.randomBytes token, best-effort email send, enumeration-safe resend]
key_files:
  created: []
  modified:
    - lib/db/src/schema/users.ts
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/api-server/src/lib/email.ts
decisions:
  - "Registration succeeds even if verification email fails — user can resend via /auth/resend-verification"
  - "POST /auth/resend-verification returns identical response regardless of user existence to prevent email enumeration (T-03-03)"
  - "Verification token cleared on first use (set to NULL) preventing replay (T-03-05)"
  - "Token is 32-byte crypto.randomBytes hex (64 chars) — brute force infeasible against rate-limited endpoint"
  - "Dev seed user (id=1) must be manually marked verified after schema push: UPDATE users SET email_verified = true WHERE id = 1"
metrics:
  duration: 15m
  completed: 2026-04-15
  tasks_completed: 2
  files_changed: 3
---

# Phase 1 Plan 03: Email Verification Summary

**One-liner:** 32-byte crypto token email verification flow — register sends verification email, login blocks unverified accounts with 403, GET /auth/verify/:token activates account and redirects, resend endpoint is enumeration-safe and rate-limited.

## What Was Done

### Task 1 — Add emailVerified + emailVerificationToken columns to users schema (commit: de09465)

Added two columns to `usersTable` in `lib/db/src/schema/users.ts`:

- `emailVerified: boolean("email_verified").notNull().default(false)` — new users start unverified
- `emailVerificationToken: text("email_verification_token")` — nullable, cleared after use
- Imported `boolean` from `drizzle-orm/pg-core`
- Schema pushed to DB at port 5433 successfully (`[✓] Changes applied`)
- Dev seed user (id=1) requires a manual SQL to remain usable in local dev:
  ```sql
  UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = 1;
  ```

### Task 2 — Register/login/verify/resend routes + sendVerificationEmail helper (commit: 721c29d)

**email.ts — sendVerificationEmail() helper:**

New exported function using existing `sendEmail()` helper and `escapeHtml()`:
- Constructs verify URL: `${APP_BASE_URL}/verify-email?token=<encoded-token>`
- Sends branded HTML email (same gradient header as invite email)
- Plain-text fallback included

**auth.ts — POST /auth/register updated:**

After creating the user and org:
1. Generates `crypto.randomBytes(32).toString("hex")` verification token
2. Stores token in `emailVerificationToken` column via UPDATE
3. Calls `sendVerificationEmail()` inside try/catch — registration never fails due to email errors
4. Returns 201 with `emailVerified: false` and a "check your email" message

**auth.ts — POST /auth/login updated:**

After password check passes, before session creation:
- Checks `user.emailVerified`; if false → returns 403 with `{ error: "EMAIL_NOT_VERIFIED", message: "..." }`

**auth.ts — GET /auth/verify/:token (new route):**

- Looks up user by `emailVerificationToken`
- If not found → 400 `Invalid or expired verification token`
- If found → sets `emailVerified = true`, `emailVerificationToken = null`, redirects to `${APP_BASE_URL}/login?verified=true`

**auth.ts — POST /auth/resend-verification (new route):**

- Validates email format; returns 400 if invalid
- Looks up user; only sends new token if user exists AND is not yet verified
- Returns identical `{ message: "..." }` response regardless — prevents email enumeration (T-03-03)
- Automatically rate-limited by `authLimiter` (20 req/15 min) in `routes/index.ts` which applies to all `/auth/*`

## Manual Step Required (Dev Environment)

After the schema push, the existing dev seed user (id=1) has `email_verified = false` (new column default). This blocks local development login. Run once:

```bash
DATABASE_URL=postgres://hypespace:hypespace@localhost:5433/hypespace \
  psql postgres://hypespace:hypespace@localhost:5433/hypespace \
  -c "UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = 1;"
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all paths are fully wired. Email is best-effort (T-03-06 mitigation) but the registration and verification flows are complete end-to-end.

## Threat Surface Scan

All new endpoints (`GET /auth/verify/:token`, `POST /auth/resend-verification`) are within the `/auth/*` path, already covered by `authLimiter` rate limiting in `routes/index.ts`. These mitigations were planned in the threat model (T-03-03, T-03-04, T-03-05, T-03-06) and are now implemented. No new unplanned attack surface introduced.

## Verification Status

### Must-Have Truths

| Truth | Status |
|-------|--------|
| A newly registered user cannot log in until they click their verification email link | Satisfied — login returns 403 + EMAIL_NOT_VERIFIED if `emailVerified = false` |
| Clicking the verification link marks the account as verified and redirects to login | Satisfied — GET /auth/verify/:token sets emailVerified=true, redirects to /login?verified=true |
| Resend verification email is available for users who have not yet verified | Satisfied — POST /auth/resend-verification issues new token + sends email |
| Already-verified users are not re-prompted on subsequent logins | Satisfied — login check is `if (!user.emailVerified)`, so verified users proceed normally |

### TypeScript

- `lib/db/src/schema/users.ts`: clean (no errors)
- `artifacts/api-server/src/lib/email.ts`: clean (no errors)
- `artifacts/api-server/src/routes/auth.ts`: one pre-existing TS6305 from `@workspace/api-zod` dist not built — same error present in `organizations.ts`, `campaigns.ts`, `dashboard.ts`, `events.ts`, `guests.ts`, `health.ts`, `reminders.ts`, `social.ts`, `team.ts`. Deferred to QUAL-01.

### STRIDE Threat Register Coverage

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-03-01 | Login blocked until email verified | Implemented |
| T-03-02 | Email must be accessible to verify | Implemented (owner controls delivery) |
| T-03-03 | /auth/resend-verification enumeration-safe | Implemented (same response always) |
| T-03-04 | 32-byte token + rate limiting (authLimiter) | Implemented |
| T-03-05 | Token set to NULL after verification | Implemented |
| T-03-06 | Email send wrapped in try/catch | Implemented |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `lib/db/src/schema/users.ts` | FOUND — emailVerified + emailVerificationToken columns present |
| `artifacts/api-server/src/lib/email.ts` | FOUND — sendVerificationEmail() exported |
| `artifacts/api-server/src/routes/auth.ts` | FOUND — all 4 changes: register token, login block, verify endpoint, resend endpoint |
| Commit de09465 (Task 1 — schema) | FOUND |
| Commit 721c29d (Task 2 — routes) | FOUND |
