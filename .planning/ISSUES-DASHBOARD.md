---
name: HypeSpace Issues Dashboard
date: 2026-04-15
sources:
  - .planning/codebase/CONCERNS.md (codebase mapper, 745 lines)
  - .planning/REVIEW.md (gsd-code-reviewer, 19 P0/P1 + 20 P2)
  - Runtime smoke tests (API curl, April 15 2026)
  - TypeScript typecheck (clean, no errors)
---

# HypeSpace Issues Dashboard

Aggregated from static review and runtime smoke tests against the running dev server.
TypeScript typecheck: **clean** (no compile errors).

---

## P0 — Blockers (ship-stoppers)

### Security / Auth

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | **All API routes are unauthenticated.** Campaign create/delete, event launch, AI generation all work without a session cookie. | Runtime: `POST /api/organizations/1/campaigns` → 201 with no auth; `POST /api/organizations/1/events/1/launch` → 200 | Add session middleware to all `/api/organizations/*` routes; gate by `team_members` membership |
| 2 | **IDOR on guests.** `GET /organizations/999/events/1/guests` returns event 1's real guests even though org 999 doesn't own it. | Runtime: returned `[{"email":"imohammed88@gmail.com",...}]` | Drop URL `orgId`, look up event's org from DB, assert caller is a member (`guests.ts:45-157`) |
| 3 | **Public RSVP uses guest.id as token** (sequential integer). Trivial to iterate and hijack every guest's RSVP. | `REVIEW.md` P0 #9 (`events.ts:454-461`) | Generate random `rsvp_token` per guest; look up by token, never by id |
| 4 | **Stored XSS via campaign HTML.** Server accepts `<img src=x onerror=alert(1)>` raw; frontend renders via `dangerouslySetInnerHTML` and iframe `srcDoc` in the same origin. | Runtime: XSS payload stored via `POST /campaigns` (201, persisted). Frontend: `campaign-ai.tsx:347`, `bulk-email-dialog.tsx:209`, `event-detail.tsx:2320` | Sanitize HTML server-side (DOMPurify in Node); always preview in sandboxed iframe with `sandbox="allow-same-origin"` (no scripts) |
| 5 | **`applyBranding()` injects org fields unescaped into campaign HTML** → stored XSS delivered to every recipient's inbox. | `REVIEW.md` P0 (`event-creation-modal.tsx:92-99`) | HTML-escape `name`, `logoUrl`, colors before substitution |
| 6 | **Reminder templates interpolate `${reminder.subject/message}` unescaped.** | `reminders.ts:76-79` | Escape; or use a templating lib with auto-escape |
| 7 | **Team invite overwrites existing user's password on accept.** Unauthenticated password reset by guessing emails. | `team.ts:149-155` | Never touch existing user's password; require login flow for existing users |
| 8 | **`getAppBaseUrl()` trusts client `Origin`/`Referer`.** Attacker-controlled URLs embedded in real campaign emails. | `api-server/src/lib/app-url.ts:17` | Use a server-configured `APP_BASE_URL`; remove client-header fallback |
| 9 | **Login user-enumeration** (distinct 404 vs 401 codes). | `auth.ts:39-48` | Return same status/message for both missing user and wrong password |
| 10 | **Dashboard loads all guests across all tenants into Node** then filters in JS. Leaks cross-tenant data if filter ever changes; also perf disaster. | `dashboard.ts:41` | Scope query to `WHERE organization_id = ?` at DB level |
| 11 | **Unencrypted OAuth/integration credentials in `integrations.metadata`.** | `CONCERNS.md`, `lib/db/src/schema/integrations.ts` | Envelope-encrypt with KMS key or `pgcrypto` |
| 12 | **Public event endpoint returns draft events and numeric `event.id`** — fuels guest-id RSVP hijack. | `events.ts:406-427` | Only return `status='published'`; expose `public_slug` not id |
| 13 | **`/auth/register` has no email verification.** Allows pre-registration squatting. | `auth.ts` | Send verification email; block login until verified |

### Multi-tenancy

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 14 | **Hardcoded `ORG_ID = 1` throughout frontend.** | `event-creation-modal.tsx:40`, `campaign-ai.tsx`, and ~15 more files per `CONCERNS.md` | Read current org from auth context; pass into hooks |
| 15 | **`POST /events/:id/duplicate` silently skips plan-limit check** (wrong signature to `assertWithinLimit`, TypeError swallowed). | `REVIEW.md` P1 (`events.ts:552`) | Fix call signature; remove swallowing try/catch |

---

## P1 — Serious (fix before next release)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 16 | **Update-campaign route returns 404** where list+create+delete work. Routing bug. | Runtime: `PATCH /api/organizations/1/campaigns/1` → 404 | Check Express route registration order in `campaigns.ts` |
| 17 | **Frontend queries `/api/dashboard/stats` but server route is `/api/organizations/:id/dashboard`** — mismatch. | Runtime: `/api/dashboard/stats` → 404; `/api/organizations/1/dashboard` → 200. `event-creation-modal.tsx:184` invalidates `["/api/dashboard/stats"]` | Unify path; fix invalidation keys |
| 18 | **`getAppBaseUrl` falls back to `localhost:5173`** — will ship in prod emails if env missing. | `app-url.ts:45` | Throw if `APP_BASE_URL` unset in production |
| 19 | **Reminder + guest routes ignore URL `orgId` for ownership checks** (IDOR). | `reminders.ts:49-92`, `guests.ts:45-157` | Ownership assertion middleware |
| 20 | **Campaign/social create accept `eventId` without verifying event belongs to `orgId`.** | `REVIEW.md` P1 | Verify `event.organization_id = :orgId` before insert |
| 21 | **Sending-domain verification passes with ANY SPF `include:`.** Org can claim domains it doesn't own. | `REVIEW.md` P1 (`sending-domains.ts`) | Verify a cryptographic TXT record the user adds |
| 22 | **`guests` table missing `UNIQUE(event_id, email)`.** Duplicate RSVPs on CSV re-import. | `lib/db/src/schema/guests.ts` | Add unique index + migration |
| 23 | **Email case-sensitivity mismatch** between auth and team routes → duplicate users / 500s. | `REVIEW.md` P1 | Normalize (`toLowerCase()`) at insert and lookup |
| 24 | **Bulk-email `catch { failed++ }` logs nothing.** 83 `parseInt` sites, zero `isNaN` checks. | `REVIEW.md` P1 | Add structured error logging; `Number()` + `Number.isFinite` |
| 25 | **Generated campaign was lost on "Next"** — fixed in commit today but confirms a whole class of step-navigation data-loss bugs in the modal. | This session | Audit all modal steps for "generate but not persisted" states |
| 26 | **Campaign Step allows skipping without saving** — if user discards the generated preview they silently lose it. | `event-creation-modal.tsx` | Confirm before discard; persist drafts |

---

## P2 — Polish / Medium

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 27 | **SSRF in iCal fetch.** Attacker sets `metadata.calendarUrl = "http://169.254.169.254/..."`. | `integrations.ts:490` | Block RFC1918 / link-local / localhost; allowlist schemes |
| 28 | **No SMTP TLS enforcement on port 587.** | `api-server/src/lib/email.ts` | `requireTLS: true` |
| 29 | **`formatGuest` omits fields** causing silent data loss on update. | `REVIEW.md` P2 | Return all fields |
| 30 | **`Math.random()` for slug suffix** — collision-prone and non-uniform. | `REVIEW.md` P2 | Use `crypto.randomBytes(4).toString("hex")` |
| 31 | **N+1 on team roster.** | `team.ts` | `JOIN` users once |
| 32 | **`GET /organizations` returns only first of multiple memberships.** | `REVIEW.md` P2 | Return full list |
| 33 | **Test email input disabled when no campaign.** Fixed in session. | `event-creation-modal.tsx` (fixed) | ✓ done |
| 34 | **Launch/Review step had no email preview.** Fixed in session. | `event-creation-modal.tsx` (fixed) | ✓ done |
| 35 | **Step order put Guests before Campaign/Test.** Fixed in session. | `event-creation-modal.tsx` (fixed) | ✓ done |
| 36 | **No rate limiting anywhere** — AI generate, login, bulk-email all uncapped. | Grep: no `express-rate-limit` | Add per-IP + per-user limiter on expensive/sensitive routes |
| 37 | **No audit log.** | — | Append-only `activity` or `audit_log` table for launches, deletes, member changes |
| 38 | **No CSRF protection** (cookie-based session). | `REVIEW.md` / `CONCERNS.md` | SameSite=Strict + CSRF token on state-changing requests |
| 39 | **Missing cascade deletes** — deleting event leaves orphaned guests/campaigns. | `CONCERNS.md` | Add `ON DELETE CASCADE` FKs |
| 40 | **Zero test coverage.** | `wc -l` returns 0 test files | Pick Vitest, start TDD on new code |
| 41 | **`node_modules` install has unmet peer dep** `esbuild-plugin-pino` vs `esbuild`. | `pnpm install` warning | Pin compatible versions or override |
| 42 | **`/api/health` returns 404** (only `/api/healthz` exists). Docs / LB checks may reference wrong path. | Runtime | Alias both; document canonical path |

---

## Totals

| Severity | Count |
|---|---|
| P0 blockers | 15 |
| P1 serious | 11 |
| P2 polish | 16 |
| **Total** | **42** |

Fixed this session: 3 (items 33, 34, 35). Unfixed at close: 39.

---

## Proposed Backlog Features (from observation, not bugs)

These came up while walking the flows; each is a **new feature**, not a fix:

1. **Image / media library for campaigns.** Upload logos, speaker photos, sponsor images; insert into AI-generated HTML. (User asked for this in session.) Non-trivial — needs storage backend decision.
2. **Save-as-template for campaigns.** Good AI-generated invites should be reusable across events; today each event regenerates from scratch.
3. **Guest segmentation + filters.** Send campaign only to RSVP=yes / no-response / VIP tags.
4. **Scheduled sends.** Column already exists (`scheduledAt`) but there's no UI to pick a send time — today everything launches immediately.
5. **Per-guest email personalization tokens** (`{{first_name}}`, `{{company}}`). Schema supports it; AI prompts don't use it.
6. **Public event landing page** with the invitation preview — today `event.id` is exposed and drafts leak; a proper `/e/:public_slug` route fixes UX and closes the RSVP-token hole simultaneously.
7. **QR-code check-in app** for onsite events — guest table already tracks `status`, just needs a `/check-in/:event` view and a token on each RSVP confirmation.
8. **Multi-organization switcher in the navbar.** Would unblock fixing the hardcoded-ORG_ID cluster (P0 #14).
9. **Campaign A/B test** — generate 2 variants, send to 10% of list each, auto-pick winner.
10. **Analytics dashboard** — open-rate and click-rate columns exist on `campaigns` but nothing populates them. Wire SMTP webhooks or tracking pixel.

Top 3 suggested for next milestone: **#1 (image upload)**, **#6 (public slug)**, **#4 (scheduled sends)** — first two also retire P0 security items.
