---
status: complete
phase: 01-security-hardening
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-04-19T00:00:00.000Z
updated: 2026-04-19T19:06:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill running server. Start fresh via `pnpm dev`. Server boots clean; DB reachable at port 5433; homepage loads; no fatal errors in stdout.
result: issue
reported: "pnpm dev from a clean shell crashes api-server with: `Error: PORT environment variable is required but was not provided.` The `dev:api` script is `dotenv -e .env -- cross-env PORT=$API_SERVER_PORT pnpm ...` — `$API_SERVER_PORT` is expanded by the OUTER shell BEFORE dotenv-cli loads .env, so it's empty unless the user manually exports API_SERVER_PORT+VITE_PORT in their shell. Fresh clone or new shell session = broken cold start. Passes when `API_SERVER_PORT=4000 VITE_PORT=5173` is set in the shell."
severity: blocker

### 2. Random RSVP tokens (SEC-04)
expected: |
  Query DB: `psql ... -c "SELECT id, rsvp_token FROM guests LIMIT 3;"` — tokens are 32-char hex strings, NOT null, NOT the integer id.
result: pass
note: "Guest id=2 rsvp_token=f314af054f9bfd1c3bb3a2bfe87f5dc9 (32-char hex)"

### 3. RSVP link works with token, not integer (SEC-04)
expected: |
  POST /api/public/events/:slug/rsvp with `{ "guestToken": "<rsvp_token>", "status": "confirmed" }` → 200.
  Same endpoint with `{ "guestToken": "2" }` (old integer-style) → 404.
result: pass
note: "Body shape is {guestToken, status} not {guestToken, response}. Token → 200 {status:confirmed,name:Ishaque}. Integer token → 404 Guest not found. SEC-04 confirmed — cannot enumerate guests by sequential id."

### 4. Public event filters drafts/cancelled (SEC-05)
expected: |
  Create a draft event. GET /api/public/events/<slug> → 404.
  Publish it → GET returns 200, response JSON has NO `status` field.
  Cancel it → GET returns 404 again.
result: pass
note: "draft→404, published→200 (no `status` field in body), cancelled→404 all confirmed via curl"

### 5. Auth guard on /organizations/* (SEC-01)
expected: |
  Unauthenticated call (no cookie): `curl -i http://localhost:3000/api/organizations/1/events` → 401 Unauthorized.
  Same call after login (with cookie) → 200 with event list.
result: pass
note: "Unauth → 401, authenticated w/ session cookie → 200"

### 6. CSRF protection blocks cross-origin mutations (SEC-03)
expected: |
  After login, POST to a mutation endpoint (e.g. POST /api/organizations/1/events) WITHOUT the `x-csrf-token` header → rejected (403 or similar CSRF error).
  Same request WITH valid CSRF token from /auth/me → succeeds.
result: issue
reported: "csrf-csrf middleware was REMOVED (commit 6e17308: 'Remove csrf-csrf, rely on SameSite=Strict session cookie for CSRF'). SUMMARY 01-02-SUMMARY.md still claims doubleCsrfProtection is active — it is NOT. POST /api/organizations/1/events with session cookie and NO csrf token reached handler (402 plan-limit, not 403). Actual CSRF defense is SameSite=Strict on session cookie, which protects modern browsers but summary is misleading; csrf-csrf still a dep in package.json."
severity: major

### 7. Session cookie is httpOnly + SameSite=strict
expected: |
  After POST /api/auth/login, response `Set-Cookie` header contains `HttpOnly`, `SameSite=Strict` (and `Secure` in prod).
  Inspect in browser devtools or `curl -i ... /auth/login`.
result: pass
note: "Set-Cookie: connect.sid=...; HttpOnly; SameSite=Strict; 7-day expiry. `Secure` absent in dev (expected, NODE_ENV=development)."

### 8. Email verification blocks login until confirmed (SEC-02)
expected: |
  Register a brand new user (unique email) → 201 with `emailVerified: false`, message says check your email.
  Immediately attempt POST /auth/login with those creds → 403 with `error: "EMAIL_NOT_VERIFIED"`.
  Click verification link (from email / Ethereal preview / DB token) → redirects to /login?verified=true.
  Login again → 200, session established.
result: pass
note: "Register uat-test@example.com with {email,password,name,company} → 201 emailVerified:false. Pre-verify login → 403 EMAIL_NOT_VERIFIED. GET /api/auth/verify/:token → 302 Location: /login?verified=true. Token CLEARED from DB after use (replay protection). Login post-verify → 200."

### 9. Resend verification is enumeration-safe
expected: |
  POST /api/auth/resend-verification with `{ "email": "real-unverified@test.com" }` → 200 with generic message.
  POST with `{ "email": "nonexistent-fake-email@test.com" }` → 200 with IDENTICAL response body.
  (Response must not reveal whether the email exists.)
result: pass
note: "Real unverified email and totally-fake email both return 200 with IDENTICAL body: 'If that email is registered and unverified, a new verification link has been sent.' Enumeration-safe confirmed."

## Summary

total: 9
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Running `pnpm dev` from a clean clone/shell boots api-server + vite successfully"
  status: failed
  reason: "User reported: dev:api script uses $API_SERVER_PORT shell expansion, which is empty unless manually exported. Fresh shell = api-server crashes with 'PORT env var required'."
  severity: blocker
  test: 1
  artifacts: []
  missing: []
