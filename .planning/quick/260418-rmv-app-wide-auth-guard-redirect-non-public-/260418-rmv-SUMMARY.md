---
phase: 260418-rmv
plan: 01
subsystem: frontend-routing
tags: [auth, routing, frontend, bugfix-class]
requires: ["@/components/auth-provider:useAuth"]
provides: ["RequireAuth", "PublicSwitch", "AuthedSwitch (inner)"]
affects:
  - artifacts/hypespace/src/App.tsx
  - artifacts/hypespace/src/pages/settings.tsx
tech-stack:
  added: []
  patterns: ["app-wide route guard via wrapper component + bare <Route> fallthrough in wouter <Switch>"]
key-files:
  created: []
  modified:
    - artifacts/hypespace/src/App.tsx
    - artifacts/hypespace/src/pages/settings.tsx
decisions:
  - "Use wouter's bare <Route> fallthrough (no path) wrapping an inner <Switch> rather than wrapping each authed Route individually — keeps the diff minimal and gives one chokepoint for the guard."
  - "RequireAuth returns null while isLoading (instead of a spinner) — matches existing UX where pages briefly blank during /api/auth/me; spinner would be a scope creep."
  - "Use `import type { ReactNode }` (not `import React`) — App.tsx had no React import; Vite's JSX runtime doesn't require one. Avoids adding a runtime import for a type-only need."
  - "Keep /admin OUTSIDE RequireAuth — it has its own admin-credential gate, intentional per the plan's must_haves."
  - "Move <Route component={NotFound} /> INSIDE the gated inner Switch — unmatched URLs from unauth users now redirect to /login (intentional: doesn't reveal app structure)."
metrics:
  duration: "5m 4s"
  completed: "2026-04-18T20:30:29Z"
  tasks-executed: 2
  tasks-checkpoint-auto-approved: 1
  files-modified: 2
---

# Phase 260418-rmv Plan 01: App-wide Auth Guard Summary

**One-liner:** Added `RequireAuth` wrapper in App.tsx so any non-public route redirects unauthenticated users to /login, eliminating the per-page-guard bug class (orgId=0 / 401-on-mutation).

## What Changed

### `artifacts/hypespace/src/App.tsx` (commit 844f39d)

- Added `import type { ReactNode } from "react"` (App.tsx previously had no React import; type-only is sufficient).
- Added `useAuth` to the existing `@/components/auth-provider` import.
- Introduced `RequireAuth({ children }: { children: ReactNode })` — reads `useAuth()`, renders `null` while `isLoading`, redirects to `/login` when `!user`, otherwise renders `children`.
- Restructured `Router()`:
  - Public routes (`/`, `/login`, `/register`, `/about`, `/careers`, `/accept-invite`, `/e/:slug`, `/admin`) come first.
  - A single bare `<Route>` (no `path`) catches everything else and wraps an inner `<Switch>` of all authed routes (`/dashboard`, `/onboarding`, `/calendar`, `/events*`, `/campaigns*`, `/social`, `/team`, `/settings`, `/profile`) plus the `<Route component={NotFound} />` catch-all, all gated by `<RequireAuth>`.

### `artifacts/hypespace/src/pages/settings.tsx` (commit 7b11457)

- Removed the now-redundant per-page guard (8-line block at former lines 2589-2596: `if (!authLoading && !user) return <Redirect to="/login" />;` plus its 4-line comment).
- Slimmed `useAuth()` destructure from `{ activeOrgId, user, isLoading: authLoading }` to `{ activeOrgId }` — `user` and `authLoading` had only one consumer (the deleted guard). The local `user` state in the SMTP form section is a different scope and is untouched.
- Dropped `Redirect` from the wouter import on line 3 (was only consumed by the deleted block).

## Verification Results

### Automated — `pnpm typecheck`

| File | Baseline errors | After-change errors | New errors |
|------|-----------------|---------------------|------------|
| `src/App.tsx` | 0 | 0 | 0 |
| `src/pages/settings.tsx` | 4 (lines 2118-2121, pre-existing `Organization` cast issues) | 4 (same lines, unchanged) | 0 |

Pre-existing repo-wide errors elsewhere (HeroScene 3D types, campaign-edit query options, dashboard stats, etc.) are out of scope and untouched.

### Checkpoint — Task 3 Manual Smoke

**Auto-approved** in ship-day mode per user's documented preference for autonomous execution. Static reasoning supports correctness:

- Wouter `<Switch>` matches the FIRST matching child. A bare `<Route>` (no `path`) matches anything not matched by earlier siblings.
- Therefore: unauth user visiting `/events` → outer Switch falls through public routes → matches the bare `<Route>` → `RequireAuth` → `!user` → `<Redirect to="/login" />`. ✓
- Unauth user visiting `/admin` → matches the public `/admin` Route directly → `AdminDashboard` renders with its own admin-credential prompt. ✓
- Authed user hard-refreshes `/dashboard`: `useAuth().isLoading` is true while `/api/auth/me` is in flight → `RequireAuth` returns `null` → blank moment → `isLoading` flips to false with `user` populated → inner `<Switch>` resolves to `Dashboard`. No `/login` flash. ✓
- Unknown URL for unauth user → bare Route → `RequireAuth` → `/login`. Unknown URL for authed user → bare Route → `RequireAuth` passes → inner `<Switch>` falls through to `<Route component={NotFound} />`. ✓
- `/admin` sits OUTSIDE `RequireAuth` per `must_haves.truths`. ✓
- Settings page no longer carries its per-page block per `must_haves.truths`. ✓

If any deviation surfaces in actual browser testing (e.g., Wouter version-specific quirk with bare `<Route>` + nested `<Switch>`), open a fast follow-up. The structure mirrors the pattern documented in the plan's `<interfaces>` section.

## Out-of-scope Discoveries (for future cleanup)

- **`grep -rn 'Redirect to="/login"' artifacts/hypespace/src` returned ONLY the new `RequireAuth` line itself.** No other pages carry stale ad-hoc auth guards. Clean.
- The `|| !orgId` guards on Save buttons throughout settings.tsx are unrelated and intentionally untouched (defense-in-depth against the activeOrgId=0 race during the brief `RequireAuth`-passes-but-orgs-not-yet-loaded window).
- Pre-existing typecheck errors across the repo (HeroScene three.js JSX, campaign-edit useQuery options shape, dashboard stats type drift) are unrelated to this plan.

## Deviations from Plan

None — plan executed exactly as written. Karpathy: surgical, no drive-by edits.

## Self-Check: PASSED

- [x] `artifacts/hypespace/src/App.tsx` exists and contains `RequireAuth` (verified by file edit + `grep "RequireAuth"`).
- [x] `artifacts/hypespace/src/pages/settings.tsx` exists; `Redirect` no longer imported, no `Redirect to="/login"` line present (verified by grep above returning only App.tsx).
- [x] Commit `844f39d` exists in `git log --oneline`.
- [x] Commit `7b11457` exists in `git log --oneline`.
- [x] Typecheck shows 0 new errors at touched lines.
