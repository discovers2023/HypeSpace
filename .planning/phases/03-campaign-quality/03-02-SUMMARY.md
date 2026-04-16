---
phase: 03-campaign-quality
plan: "02"
subsystem: api-server/tracking
tags: [tracking, email, analytics, campaigns, open-rate, click-rate]
dependency_graph:
  requires: []
  provides: [campaign-open-tracking, campaign-click-tracking]
  affects: [campaigns-send-endpoint, campaign-analytics-panel]
tech_stack:
  added: []
  patterns: [tracking-pixel, redirect-link-injection, rate-approximation-without-counter-column]
key_files:
  created:
    - artifacts/api-server/src/routes/tracking.ts
  modified:
    - artifacts/api-server/src/routes/campaigns.ts
    - artifacts/api-server/src/routes/index.ts
decisions:
  - Tracking endpoints added to openPaths in index.ts (email clients load without session cookies)
  - Click redirect validates ^https?:// strictly to prevent javascript:/data: open redirect (T-03-02-02)
  - openRate/clickRate incremented via read-modify-write approximation (no separate counter column)
  - sendEmail() call wrapped in .catch() so email delivery failure never fails the send API response
  - injectTracking() exported so scheduler.ts (Plan 03-01) can reuse it
metrics:
  duration: ~15min
  completed: "2026-04-15"
  tasks_completed: 2
  files_changed: 3
---

# Phase 03 Plan 02: Email Open & Click Tracking Summary

Email open rate tracking pixel (CAMP-03) and click rate redirect link injection (CAMP-04) wired into the campaign send endpoint via a new `injectTracking()` helper and a dedicated `/api/track/*` router.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create tracking router (open pixel + click redirect) | 32a7bbe | tracking.ts (created), index.ts |
| 2 | Inject tracking pixel and rewrite links at send time | 32a7bbe | campaigns.ts |

## What Was Built

### tracking.ts — New Router

`GET /api/track/open/:campaignId`
- Returns a 1x1 transparent GIF (base64-encoded, no redirect)
- Increments `openRate` in DB using read-modify-write: `floor(openRate * recipientCount) + 1) / recipientCount`
- Always returns the GIF even on DB errors — never breaks email rendering
- Cache-Control: no-store headers prevent CDN/proxy caching

`GET /api/track/click/:campaignId?url=<encoded>`
- Increments `clickRate` in DB with same approximation pattern
- Validates target URL against `^https?://` before redirecting (T-03-02-02 mitigation)
- Falls back to `redirect("/")` for missing, invalid, or non-http/https URLs (blocks `javascript:`, `data:`, `vbscript:`)

### campaigns.ts — injectTracking() Helper

```
injectTracking(html, campaignId, baseUrl): string
```
- Rewrites all `<a href="http...">` links to `/api/track/click/:id?url=<encoded>` (excludes `#` and `mailto:` links)
- Injects `<img src="/api/track/open/:id" ...>` pixel just before `</body>` (or appended if no `</body>`)
- Exported so scheduler.ts can reuse it for scheduled sends

### campaigns.ts — Send Endpoint

After marking campaign as sent and inserting activity, the send endpoint now:
1. Calls `injectTracking()` with `getAppBaseUrl(req)` for absolute tracking URLs
2. Calls `sendEmail()` with the tracked HTML
3. Wraps `sendEmail()` in `.catch()` — delivery failure never fails the API response

### index.ts — Router Mounting

- Imported `trackingRouter` and mounted at `/track`
- Added `/track/` to `openPaths` — email clients load tracking URLs without session cookies

## Security

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-03-02-01: Unauthenticated pixel load | Accept | Tracking pixels are inherently public; only a GIF returned |
| T-03-02-02: Open redirect via ?url= | Mitigated | `/^https?:\/\//i.test(target)` — falls back to "/" for any other scheme |
| T-03-02-03: Guessable campaignId | Accept | openRate/clickRate are non-sensitive analytics |
| T-03-02-04: URL in server logs | Accept | URLs already present in email HTML |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `to: "broadcast@placeholder"` in the send endpoint — per-guest iteration is v2. The campaign is marked sent and tracking HTML is correct; the actual recipient list fanout is deferred. This does not prevent CAMP-03/CAMP-04 from being verified (tracking pixel and link rewriting are correct in the HTML).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| tracking.ts created | FOUND |
| index.ts updated (tracking mount + open path) | FOUND |
| campaigns.ts updated (injectTracking exported) | FOUND |
| Commit 32a7bbe exists | FOUND |
| `export function injectTracking` in campaigns.ts line 38 | FOUND |
| `/track/` in openPaths | FOUND |
| `router.use("/track", trackingRouter)` mounted | FOUND |
| Open redirect protection `^https?://` regex in tracking.ts | FOUND |
