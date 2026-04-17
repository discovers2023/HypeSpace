---
phase: quick-260417-ois
plan: 01
subsystem: onboarding
tags: [onboarding, settings, wizard, dashboard, routing, schema]
requires:
  - "@workspace/db organizations table"
  - "GET /api/auth/me session-based auth"
  - "Settings page tab components (BrandingTab, EmailSendingTab, AiSettingsTab, IntegrationsTab)"
provides:
  - "organizations.onboarding_completed_at column"
  - "PATCH /api/organizations/:orgId/onboarding endpoint"
  - "/auth/me onboardingCompletedAt field"
  - "AuthContext.onboardingCompletedAt + refreshOnboarding()"
  - "/onboarding route (Onboarding wizard page)"
  - "Dashboard -> /onboarding redirect for unfinished orgs"
  - "Settings > General -> Run setup wizard entry"
  - "?tab= deep-link support on /settings"
affects:
  - artifacts/hypespace/src/pages/dashboard.tsx
  - artifacts/hypespace/src/pages/settings.tsx
  - artifacts/hypespace/src/pages/onboarding.tsx
  - artifacts/hypespace/src/components/auth-provider.tsx
  - artifacts/hypespace/src/App.tsx
  - artifacts/api-server/src/routes/auth.ts
  - artifacts/api-server/src/routes/organizations.ts
  - lib/db/src/schema/organizations.ts
tech-stack:
  added: []
  patterns:
    - "Spread extra fields outside GetMeResponse.parse() (same pattern as csrfToken/activeOrgId) to avoid @workspace/api-zod regen"
    - "Wouter useSearch + setLocation(replace: true) for URL-synced tab state"
    - "Export existing tab components in place (add export keyword) instead of splitting monolithic settings.tsx"
key-files:
  created:
    - artifacts/hypespace/src/pages/onboarding.tsx
  modified:
    - artifacts/hypespace/src/pages/dashboard.tsx
    - artifacts/hypespace/src/pages/settings.tsx
    - artifacts/hypespace/src/components/auth-provider.tsx
    - artifacts/hypespace/src/App.tsx
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/api-server/src/routes/organizations.ts
    - lib/db/src/schema/organizations.ts
decisions:
  - "Skip button invokes the same finish handler as Finish (per locked plan constraint) — each wizard step already persists via its own Save button, so skipping preserves work done so far."
  - "Onboarding page renders WITHOUT AppLayout sidebar for a focused flow; a minimal top bar with the logo and a Log out link prevents users from feeling trapped."
  - "Dashboard is the only route that gates on onboardingCompletedAt. Direct links to /events, /campaigns, etc. still work — consistent with users who already skipped the wizard."
  - "PATCH /organizations/:orgId/onboarding uses req.session.userId + a team_members membership check; the other handlers in that file still hardcode userId=1 (pre-existing issue, intentionally NOT fixed here to stay in scope)."
  - "onboardingCompletedAt spread outside GetMeResponse.parse() so we do not need to regenerate @workspace/api-zod / @workspace/api-client-react — same pattern already used for orgs/activeOrgId/csrfToken."
metrics:
  tasks: 3
  files_changed: 7
  files_created: 1
  completed: "2026-04-17T17:50:00.000Z"
---

# Phase quick-260417-ois Plan 01: Fix dashboard Configure Integrations button + first-login onboarding wizard — Summary

**One-liner:** Dashboard "Configure Integrations" now deep-links to the Integrations tab; new orgs walk through a 4-step setup wizard at `/onboarding` that reuses existing Settings tab components.

## Overview

Two deliverables landed atomically in one quick task:

1. **Bug fix** — The dashboard "Configure Integrations" button now routes to `/settings?tab=integrations` instead of dumping users on the General tab. `/settings` honors the `?tab=` query param on mount and writes it back when a tab is clicked, so refreshes preserve the current tab.
2. **First-login onboarding** — Brand-new organizations (no `onboardingCompletedAt`) are auto-redirected from `/dashboard` to a new full-page wizard at `/onboarding` that walks through Branding, Email Sending, AI Settings, and Integrations. The wizard reuses the existing Settings tab components verbatim (no duplicate forms). Finish or Skip both set `onboardingCompletedAt` so future logins go straight to `/dashboard`. A new "Run setup wizard" card in Settings > General lets already-onboarded users replay it.

## Files changed and why

### Backend / DB

- **`lib/db/src/schema/organizations.ts`** — Added one nullable column `onboarding_completed_at timestamp with time zone` so we can tell whether an org has finished the wizard. Null = not yet; any timestamp = completed.
- **`artifacts/api-server/src/routes/organizations.ts`** — Added `PATCH /organizations/:orgId/onboarding` (accepts `{ completedAt: ISO string | null }`). Uses `req.session.userId` + a team_members membership lookup for IDOR protection. The two existing handlers in this file still hardcode `userId = 1` — that's a pre-existing issue tracked in STATE.md under the auth-middleware work item and was intentionally NOT fixed here to keep scope tight.
- **`artifacts/api-server/src/routes/auth.ts`** — `GET /auth/me` now fetches `onboardingCompletedAt` for the active org and spreads it into the response outside `GetMeResponse.parse(...)` — same pattern already used for `orgs`, `activeOrgId`, and `csrfToken`. This avoids a regen cycle on `@workspace/api-zod`.

### Frontend

- **`artifacts/hypespace/src/pages/dashboard.tsx`**:
  - Button fix: `<Link href="/settings">` → `<Link href="/settings?tab=integrations">` (line ~244).
  - Added the onboarding redirect at the top of the Dashboard component:
    ```tsx
    if (!authLoading && activeOrgId && onboardingCompletedAt === null) {
      return <Redirect to="/onboarding" />;
    }
    ```
- **`artifacts/hypespace/src/pages/settings.tsx`**:
  - Imported `useLocation`/`useSearch` from wouter alongside `Link`.
  - Exported `TabId` and the four tab function components (`BrandingTab`, `EmailSendingTab`, `AiSettingsTab`, `IntegrationsTab`) in place — no file split, just added the `export` keyword. The wizard imports them directly.
  - `Settings()` now derives `activeTab` initial value from `?tab=`, writes back to the URL (`replace: true`) on tab click, and syncs via an effect on `search` changes.
  - Added a "Run setup wizard" card in General between Organization Profile and Danger Zone.
- **`artifacts/hypespace/src/components/auth-provider.tsx`**:
  - `AuthContextType` gained `onboardingCompletedAt: string | null` and `refreshOnboarding: () => void`.
  - Reads `authData.onboardingCompletedAt` in the effect, resets to `null` on logout.
  - `refreshOnboarding()` invalidates `["auth_status"]` so the new flag propagates after the wizard submits.
- **`artifacts/hypespace/src/App.tsx`** — Added `import Onboarding from "@/pages/onboarding"` and `<Route path="/onboarding" component={Onboarding} />`.
- **`artifacts/hypespace/src/pages/onboarding.tsx`** (new, ~220 lines) — Full-page wizard shell. No AppLayout; just a minimal top bar (HypeSpace logo + Log out) and a 4-step stepper + main panel. Each step renders the corresponding exported Settings tab component directly so there's one source of truth per form. Back/Next navigate locally; Finish and Skip both call the PATCH endpoint and invalidate auth.

## Exact button fix (before/after)

**Before** (`artifacts/hypespace/src/pages/dashboard.tsx:244-249`):
```tsx
<Link href="/settings">
  <Button variant="outline" className="border-primary/20 hover:bg-primary/10 rounded-xl">
    Configure Integrations
    <ArrowUpRight className="ml-2 h-4 w-4" />
  </Button>
</Link>
```

**After**:
```tsx
<Link href="/settings?tab=integrations">
  <Button variant="outline" className="border-primary/20 hover:bg-primary/10 rounded-xl">
    Configure Integrations
    <ArrowUpRight className="ml-2 h-4 w-4" />
  </Button>
</Link>
```

## Wizard route + redirect behavior

- `/onboarding` — New route; renders the 4-step wizard. Guards: shows a skeleton while `isLoading`, redirects to `/login` if `!user`, renders nothing if `!activeOrgId` (auth not resolved yet).
- `/dashboard` — If `!authLoading && activeOrgId && onboardingCompletedAt === null`, returns `<Redirect to="/onboarding" />`. This is the ONLY gate: other routes (`/events`, `/campaigns`, etc.) remain directly accessible so users who skip the wizard can still use the app.
- Finish/Skip flow:
  1. `PATCH /api/organizations/:orgId/onboarding` with `{ completedAt: <now> }` (ISO string).
  2. `refreshOnboarding()` invalidates the `auth_status` query; `/auth/me` re-fetches.
  3. `setLocation("/dashboard")` — subsequent dashboard visits render normally with no redirect loop.

## Deviations from plan

**None** — plan executed exactly as written, with these notes:

- `pnpm drizzle-kit push` was run via the root `pnpm run db:push` script (which reads `.env` through `dotenv-cli`). Non-interactive and clean: `[✓] Changes applied`.
- `psql` is not installed in the worktree's host, so the seed org backfill was done via `docker exec hypespace-postgres psql -U hypespace -d hypespace -c "UPDATE organizations SET onboarding_completed_at = NOW() WHERE id = 1;"`. Verified immediately with a SELECT — org id=1 ("Discover Solutions") now has a timestamp.
- Frontend typecheck baseline: 43 errors existed on `main` before this plan (HeroScene JSX intrinsics, campaign-creation-modal, dashboard `perEventRsvp`/`guestsByStatus.maybe`, event-detail, campaign-ai, settings AiSettingsTab `Record<string, unknown>` casts, etc.). After this plan: still 43. **Zero new typecheck errors introduced.** Confirmed via a `git stash` pre/post diff.
- api-server typecheck: Remaining errors are all pre-existing (admin.ts `isAdmin`/`impersonating` session properties, campaigns.ts line 304 string/null mismatch). None introduced by this plan.
- Dev servers on :4000 (API) and :5175 (web) were left untouched per constraint. A restart will pick up the new build.

## Known follow-ups

- `routes/organizations.ts` GET/POST handlers still hardcode `userId = 1` — pre-existing issue tracked by STATE.md's auth-middleware work item. Only the new PATCH endpoint introduced here uses `req.session.userId`.
- Plan context noted the `@workspace/api-zod` `Organization` schema is intentionally incomplete (`primaryColor`, `aiProvider`, etc. not in the OpenAPI). We followed the same pattern for `onboardingCompletedAt` (consumed via raw `/auth/me` JSON, not via generated hooks).
- Pre-existing dashboard type errors (`perEventRsvp`, `guestsByStatus.maybe`) remain — unrelated to this plan.

## Verification

- [x] `organizations.onboarding_completed_at` column exists (confirmed via `docker exec ... \d organizations`).
- [x] Seed org id=1 backfilled with `NOW()` so QA accounts aren't bounced into the wizard.
- [x] Dashboard "Configure Integrations" link points to `/settings?tab=integrations` (grep-verified).
- [x] Four settings tabs exported (grep-verified: 4 matches for `^export function (Branding|EmailSending|Integrations|AiSettings)Tab`).
- [x] `/settings` honors `?tab=` and writes back on tab click (useSearch + setLocation with replace:true).
- [x] `/onboarding` route registered in App.tsx.
- [x] Dashboard renders `<Redirect to="/onboarding" />` when `onboardingCompletedAt` is null.
- [x] Settings > General has a "Run setup wizard" card linking to /onboarding.
- [x] Frontend build succeeds (`pnpm build` — 10.25s, no build errors).
- [x] api-server build succeeds (`pnpm build` — 506ms).
- [x] Zero new typecheck errors introduced vs. pre-change baseline.

## Commits

| Task | Commit   | Message                                                                                      |
| ---- | -------- | -------------------------------------------------------------------------------------------- |
| 1    | fc2339e  | feat(quick-260417-ois-01): deep-link Configure Integrations + URL-sync Settings tabs         |
| 2    | 73eea08  | feat(quick-260417-ois-02): onboardingCompletedAt column + PATCH endpoint + /auth/me exposure |
| 3    | a772f70  | feat(quick-260417-ois-03): onboarding wizard page + auth-provider plumbing + dashboard gate  |

## Self-Check

**Files verified to exist:**
- FOUND: artifacts/hypespace/src/pages/onboarding.tsx
- FOUND: artifacts/hypespace/src/pages/dashboard.tsx
- FOUND: artifacts/hypespace/src/pages/settings.tsx
- FOUND: artifacts/hypespace/src/components/auth-provider.tsx
- FOUND: artifacts/hypespace/src/App.tsx
- FOUND: artifacts/api-server/src/routes/auth.ts
- FOUND: artifacts/api-server/src/routes/organizations.ts
- FOUND: lib/db/src/schema/organizations.ts

**Commits verified:**
- FOUND: fc2339e (task 1)
- FOUND: 73eea08 (task 2)
- FOUND: a772f70 (task 3)

## Self-Check: PASSED
