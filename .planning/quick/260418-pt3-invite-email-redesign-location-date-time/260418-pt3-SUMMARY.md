---
phase: 260418-pt3
plan: 01
subsystem: frontend (artifacts/hypespace)
tags: [ui, auth-guard, invite-page, settings, surgical]
requires: []
provides:
  - "Grouped Date/Time/Location info card on /e/<slug> public invite page"
  - "Auth guard on /settings — redirects to /login when unauthenticated"
  - "Save button disable when activeOrgId === 0 sentinel"
affects: []
tech-stack:
  added: []
  patterns:
    - "wouter Redirect for client-side route-level auth guard"
    - "Tailwind icon-chip pattern (h-10 w-10 rounded-lg bg-background border)"
    - "React rules-of-hooks: early return placed AFTER all hook calls"
key-files:
  created: []
  modified:
    - artifacts/hypespace/src/pages/public-event.tsx
    - artifacts/hypespace/src/pages/settings.tsx
decisions:
  - "Place Settings auth-guard early-return AFTER all hooks (not at the top of the function as the plan literally specified) to comply with React's rules of hooks — short-circuiting before useState/useEffect/useGetOrganization would crash with 'rendered fewer hooks than expected' on auth state transition."
  - "Did NOT extract a Row sub-component for the three info-card rows — three repetitions inline is the right call per Karpathy 'no abstractions for single-use code'."
  - "Did NOT add `|| !orgId` to the Branding (line 2086) and AI Settings (line 2224) Save buttons — the route-level guard already prevents those sub-components from rendering with no user, so symmetric edits would be unnecessary churn."
metrics:
  duration: ~10m
  completed: 2026-04-18
---

# Phase 260418-pt3 Plan 01: Invite landing redesign + Settings auth guard — Summary

Two surgical UI/auth fixes for ship-day v1: (1) grouped the Date/Time/Location
rows on the public invite page into a single rounded info card with icon chips
and uppercase muted labels so the block no longer looks "very congested",
and (2) added a two-layer auth guard to `/settings` that redirects to
`/login` once `/auth/me` resolves with no user and disables the Organization
Profile Save button while `activeOrgId` is the `0` sentinel — stopping the
stray `PUT /api/organizations/0` → 404 the user was seeing in the network tab.

## Tasks completed

| Task | Name                                                | Commit  | Files modified                                  |
| ---- | --------------------------------------------------- | ------- | ----------------------------------------------- |
| 1    | Redesign Date/Time/Location info block              | 70ebfa5 | artifacts/hypespace/src/pages/public-event.tsx  |
| 2    | Add auth guard + Save-button disable to Settings    | 5fd525a | artifacts/hypespace/src/pages/settings.tsx      |

## What changed

### Task 1 — `public-event.tsx`

Lines ~209-245 (the `space-y-6` stack of three icon+text rows for Date/Time,
Location, Online URL). Wrapped in a single `rounded-2xl border bg-muted/30 p-5
space-y-5` container and gave each row a 10x10 icon chip (`h-10 w-10
rounded-lg bg-background border`) + uppercase muted label + bold value.
Description block, RSVP form, header, footer, and all other sections
byte-identical. No new imports. 55 insertions / 33 deletions.

### Task 2 — `settings.tsx`

Three edits:
1. Line 3: extended wouter import to include `Redirect`.
2. Lines 2552 + 2589-2596: read `user` and `isLoading: authLoading` from
   `useAuth()` and added an early-return `<Redirect to="/login" />` when
   `!authLoading && !user`. Placed AFTER all hook calls (see Deviation 1
   below). Total: 12 insertions / 3 deletions.
3. Line 2731 (was 2723 before drift): appended `|| !orgId` to the Save
   button's `disabled` prop on the Organization Profile form.

Branding (line 2086) and AI Settings (line 2224) Save buttons unchanged —
they live in sub-components that the route guard already protects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Moved Settings auth-guard early-return AFTER all hooks
   (plan said put it at the top of the component, immediately after the
   useAuth destructure)**

- **Found during:** Task 2, while staring at the diff.
- **Issue:** The plan's literal instruction placed the `if (!authLoading &&
  !user) return <Redirect/>;` at line 2554 — BEFORE the subsequent
  `useState`, `useEffect`, `useGetOrganization`, `useUpdateOrganization`,
  `useToast`, `useQueryClient`, `useRef`, `useForm`, and a second
  `useEffect`. On the very common transition "user is initially logged in →
  session expires → user becomes null", the conditional return would skip
  those 9 hook calls in the next render, violating React's rules of hooks
  ("Rendered fewer hooks than expected"). The component would crash on
  auth-state change.
- **Fix:** Relocated the early-return block to immediately AFTER the last
  hook call (`useEffect` ending at line 2587), BEFORE the regular
  `onSubmit` function definition. Hook order is now stable across renders;
  the guard still short-circuits before any JSX is rendered.
- **Files modified:** artifacts/hypespace/src/pages/settings.tsx
- **Commit:** 5fd525a
- **Cost:** A `useGetOrganization(0)` call still fires once on the
  unauthenticated render before the redirect kicks in. This is harmless
  (it'll 404 silently and React Query will cache the error; the user is
  already being redirected away). The plan's stated goal was specifically
  to prevent the spurious `PUT /api/organizations/0` (a user-initiated
  mutation), not the GET — and the guard does prevent the PUT cleanly
  because the form never renders.

## Authentication Gates

None — both tasks were straightforward UI/code edits, no auth interactions
needed during execution.

## Verification results

- `npx tsc --noEmit` (worktree, after `pnpm install` to populate
  `node_modules`): no NEW errors at any of my edited lines (3, 2550-2596,
  2731 in settings.tsx; 209-269 in public-event.tsx). Pre-existing errors
  in unrelated lines/files (campaign-ai, dashboard, event-detail, etc.)
  are documented in `deferred-items.md` — they exist on the base commit
  `07ba58d` and are out of scope per the SCOPE BOUNDARY rule.

## Known Stubs

None.

## Operator notes

- **Main-repo file pollution:** While verifying the worktree base, I edited
  `/root/Claude-projects/HypeSpace/artifacts/hypespace/src/pages/public-event.tsx`
  (the main repo, not the worktree) ONCE before realizing the bash sandbox
  was rooted at the worktree. The unstaged change in the main repo's
  `public-event.tsx` is byte-identical to what I committed in the worktree
  (commit `70ebfa5`), so no information loss — but the orchestrator should
  `git checkout -- artifacts/hypespace/src/pages/public-event.tsx` in the
  main repo before merging the worktree branch back, otherwise the merge
  will see a "modified in both" situation. The sandbox blocked me from
  doing this cleanup myself.

## Self-Check: PASSED

- File `artifacts/hypespace/src/pages/public-event.tsx` modified — verified
  via `git log --oneline -3` showing `70ebfa5` and `git show 70ebfa5
  --stat` would show 1 file changed (visually confirmed via Read of edited
  region).
- File `artifacts/hypespace/src/pages/settings.tsx` modified — verified via
  `git log --oneline -3` showing `5fd525a` and Read of edited region.
- Commit `70ebfa5` exists in worktree branch `worktree-agent-a365aa36`.
- Commit `5fd525a` exists in worktree branch `worktree-agent-a365aa36`.
- No file deletions (`git diff --diff-filter=D --name-only HEAD~2 HEAD`
  returned empty).
- `git status --short` is clean.
