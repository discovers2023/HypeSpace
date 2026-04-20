# Concerns — Technical Debt & Risk Areas

**Analysis Date:** 2026-04-20

## Severity Legend

- 🔴 **Critical** — fix before v1 ship
- 🟡 **Warn** — accept for v1, schedule post-ship
- 🟢 **Minor** — acknowledge, no action needed short-term

---

## 🔴 Critical

### C1. Team invite flow overwrites existing user's password

**Where:** `artifacts/api-server/src/routes/team.ts:152-155`

```ts
const [user] = await db.update(usersTable)
  .set({ passwordHash })
  .where(eq(usersTable.id, member.userId))
  .returning();
```

**Issue:** `POST /team/accept-invite` unconditionally updates `usersTable.passwordHash` with the new-user password. If an existing HypeSpace user is invited to a second org, accepting the invite overwrites their existing password and locks them out of their original account.

**Impact:** Account takeover path for anyone who knows a registered email + can trigger an invite to that email from a controlled org. Also a silent data-loss bug for legitimate multi-org users.

**Fix shape:** Only set `passwordHash` when the user was created as a result of the invite (status == `invited` AND `users.passwordHash` is null/placeholder). Otherwise skip the password update and just activate membership.

---

### C2. Memory-backed session store

**Where:** `artifacts/api-server/src/app.ts:86-100`

```ts
// TODO: Replace MemoryStore with connect-pg-simple for production
app.use(session({ secret: ..., /* no store configured → MemoryStore */ }));
```

**Issue:** `express-session` defaults to `MemoryStore`, which:
1. Loses every session on process restart (users re-login on every deploy)
2. Breaks behind any load balancer / multi-instance deployment
3. Leaks memory under load (per express-session docs, "not designed for production")

**Impact:** Blocker for any deployment beyond a single always-on dev instance. Since v1 is "resellable SaaS," buyers will hit this immediately.

**Fix shape:** `pnpm add connect-pg-simple @types/connect-pg-simple`, configure with existing `DATABASE_URL`, create `session` table.

---

### C3. SSRF risk in calendar-feed import

**Where:** `artifacts/api-server/src/routes/integrations.ts` (calendar import endpoint, uses `node-ical`)

**Issue:** Public iCalendar feed URLs are fetched server-side with no URL allowlist / no block-list for internal networks. An attacker who can save an integration can target:
- `http://169.254.169.254/` (cloud metadata services)
- `http://localhost:*` (internal admin panels, Postgres via HTTP proxies, etc.)
- `http://10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12` (internal lan)

**Impact:** Server-Side Request Forgery. On cloud hosting this can leak IAM credentials from instance metadata.

**Fix shape:** Before passing URL to `node-ical`, resolve DNS → verify resolved IP is not in private/link-local ranges. Reject `file://`, `gopher://`, non-http(s) schemes. Optionally whitelist known calendar providers.

---

### C4. Multi-Org scope verification — requireOrgMembership coverage

**Where:** `artifacts/api-server/src/routes/index.ts:60-87`

**Good news:** The P0 IDOR reported in the Phase 2 UAT was mitigated in commit `5dc391a` / `843f5f3` by introducing `requireOrgMembership` middleware on every `/organizations/:orgId/*` path:

```ts
router.use("/organizations/:orgId", requireOrgMembership);
```

**Residual concern:** Routes that access org-scoped resources **without** the `/organizations/:orgId/` prefix (e.g., anything that looks up an event/campaign by numeric ID in the path without the org in the path) would still be vulnerable. Spot-check every route under `/api` that takes an `:id` param and confirm it joins through `organizationId` in the WHERE clause.

**Action:** Grep every route file for `req.params.id` / `req.params.eventId` / `req.params.campaignId` / `req.params.guestId` and verify each query is scoped by `organizationId` derived from a verified source (session active org OR path `:orgId` that has been membership-checked).

---

## 🟡 Warn (accept for v1, fix post-ship)

### W1. Zero automated test coverage

**Where:** entire repo

No vitest/jest/playwright config, no `*.test.*` files, no CI test step. All verification is manual UAT in `.planning/phases/*/`. See `.planning/codebase/TESTING.md`.

**Accept rationale:** Explicit sprint trade-off to ship v1 by 2026-04-20. Must be a dedicated post-v1 phase — auth flows, invite flows, and campaign sending are high-blast-radius and deserve integration tests before wider rollout.

---

### W2. Cold-start boot fragility (env var expansion)

**Where:** root `package.json` dev scripts

The dev script expands `$API_SERVER_PORT` in shell before `dotenv` loads from `.env`, so a fresh clone boots with an empty PORT. Documented in `.planning/phases/01-security-hardening/01-UAT.md` issue #1.

**Fix shape:** Move to `dotenv-cli` or `dotenvx run -- <cmd>` so dotenv resolves first. Low-effort post-v1.

---

### W3. `any` type leakage on the frontend

**Where:** scattered across `artifacts/hypespace/src/components/` and `pages/` — form components particularly

~32 `any` instances noted (most in RHF `FieldValues` contexts). Hides type bugs in form shape, API response shape, and event handlers.

**Fix shape:** Sweep per file as they're touched. The hook generator already emits precise types — most `any` is a local shortcut.

---

### W4. N+1 query pattern in event listing

**Where:** `artifacts/api-server/src/routes/events.ts` list handler

Each event row triggers separate queries for guest count / confirmed count / pending count instead of a single aggregation. OK at 20-50 events (v1 quotas), becomes noticeable at agency-plan scale (2000 attendees × 15-unlimited events).

**Fix shape:** Single query with `COUNT(*) FILTER (WHERE ...)` aggregates joined on guests. Drizzle supports this via `sql` template literal.

---

### W5. No rate limiting on several sensitive endpoints

**Where:** `artifacts/api-server/src/routes/index.ts` applies `authLimiter` only to `/auth` and `aiLimiter` to AI-generation endpoints.

**Uncovered:**
- Password reset request
- Resend invite
- Resend verification email (if present)
- Guest CSV/GHL import (DB-write-heavy)
- Campaign send (SMTP-quota-heavy)

**Fix shape:** Apply per-endpoint rate limiters — lower bounds for write-heavy or outbound-email endpoints.

---

### W6. Hardcoded default session secret

**Where:** `artifacts/api-server/src/app.ts:91`

```ts
secret: SESSION_SECRET ?? "dev-secret-change-in-production",
```

**Mitigation already in place:** Production deployments throw on startup if `SESSION_SECRET` is unset (`throw new Error("SESSION_SECRET env var is required in production")`).

**Residual risk:** In NODE_ENV=development, the fallback string is well-known. Not a v1 blocker (dev-only), but any test environment that doesn't set NODE_ENV=production inherits the weak secret. Document explicitly in the deploy checklist.

---

### W7. Large route files past the 500-line readability threshold

- `artifacts/api-server/src/routes/events.ts` — 667 lines
- `artifacts/api-server/src/routes/integrations.ts` — 602 lines
- `artifacts/api-server/src/routes/campaigns.ts` — 523 lines

Not urgent; slicing will be easier after a test harness exists so regressions are catchable.

---

## 🟢 Minor

### M1. No ESLint/Biome

Prettier + TS strict is the only automation. Some classes of issues (unused imports with side-effects, accidental `==`, missing `await`) aren't caught. Low-priority for a solo+AI workflow — invest if the team grows.

### M2. Console logs in production paths

`artifacts/api-server/src/lib/email.ts` uses `console.log` for dispatch confirmations rather than Pino. Functional but inconsistent with the rest of the backend.

### M3. Three.js/R3F landing visual shipped in main bundle

`artifacts/hypespace/src/components/3d/` is imported from `landing.tsx`. Three.js is heavy (~500 KB gzip). Dynamic-import on the landing route and it'll trim TTI significantly.

### M4. `any` in PROGRESS-REPORT.md as source of truth

`PROGRESS-REPORT.md` at repo root is the human-friendly status doc but lives outside `.planning/`. Not in conflict with GSD state, but easy to let drift. Consider linking it from `.planning/STATE.md` or auto-generating from phase UAT outcomes.

---

## Recent Fixes Worth Acknowledging (no action needed)

- ✅ **P0 IDOR** closed in commit `5dc391a` with `requireOrgMembership` middleware (Phase 2 UAT critical finding)
- ✅ **HTML sanitization** in place for campaign email body (prevents stored-XSS when recipients view in a browser)
- ✅ **CSRF** addressed via `SameSite=Strict` session cookie (documented rationale in `app.ts:74`)
- ✅ **Bcrypt cost factor 12** on password hash (`team.ts:148`, `auth.ts`)
- ✅ **Explicit production SESSION_SECRET check** (`app.ts:87-90`)
- ✅ **ALLOWED_ORIGINS required in production** — no permissive CORS fallback

---

## Prioritized Action List (for post-v1 or insert-phase)

1. **C1** — team invite password overwrite (1h fix, auth surface)
2. **C2** — session store to `connect-pg-simple` (2h fix, unblocks deployment)
3. **C3** — SSRF guard on calendar import (2h fix, narrow surface)
4. **C4** — audit non-path-scoped routes for residual IDOR (2h grep + patch)
5. **W2** — dotenv load order (30min)
6. **W5** — add rate limiters to password reset / import / campaign send (1h)
7. **W4** — N+1 fix on event listing (2h)
8. **W1** — introduce Vitest + first integration test suite (dedicated phase)
