---
phase: 260418-rmv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - artifacts/hypespace/src/App.tsx
  - artifacts/hypespace/src/pages/settings.tsx
autonomous: true
requirements:
  - app-wide-auth-guard
must_haves:
  truths:
    - "Unauthenticated user navigating to any /dashboard, /onboarding, /calendar, /events*, /campaigns*, /social, /team, /settings, /profile, or any unmatched URL is redirected to /login"
    - "Unauthenticated user can still load /, /login, /register, /about, /careers, /accept-invite, /e/:slug, and /admin without redirect"
    - "Authenticated user landing on any authed route on hard-refresh sees the page (no /login flash) once /api/auth/me resolves"
    - "/admin retains its own admin-credential gate and is NOT touched by the user auth guard"
    - "Settings page no longer carries its own per-page auth-redirect block (the guard is now app-wide)"
  artifacts:
    - path: "artifacts/hypespace/src/App.tsx"
      provides: "RequireAuth wrapper + split PublicSwitch / AuthedSwitch"
      contains: "RequireAuth"
    - path: "artifacts/hypespace/src/pages/settings.tsx"
      provides: "Settings without redundant per-page auth-redirect"
  key_links:
    - from: "artifacts/hypespace/src/App.tsx (RequireAuth)"
      to: "artifacts/hypespace/src/components/auth-provider.tsx (useAuth)"
      via: "useAuth() returns { user, isLoading }; isLoading -> render null, !user -> Redirect to /login"
      pattern: "useAuth\\(\\)"
---

<objective>
Add an app-wide authentication guard so any non-public route redirects to /login when the user is not signed in. Eliminates the recurring `orgId=0` / 401-on-mutation bug class that has appeared in Settings and Event Save and is latent on every other authenticated page.

Purpose: Stop relying on per-page auth-redirect blocks (easy to forget when adding new routes) and fix the underlying class of bugs where an unauthenticated session reaches mutation code paths with `orgId=0`.

Output:
- `artifacts/hypespace/src/App.tsx` restructured with a `RequireAuth` wrapper and split `PublicSwitch` / `AuthedSwitch` so all authenticated routes go through one guard.
- `artifacts/hypespace/src/pages/settings.tsx` cleaned of its now-redundant per-page redirect block (and orphaned imports/destructured fields).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@artifacts/hypespace/CLAUDE.md
@artifacts/hypespace/src/App.tsx
@artifacts/hypespace/src/components/auth-provider.tsx

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase — no exploration required. -->

From artifacts/hypespace/src/components/auth-provider.tsx:
```typescript
type User = { id: number; email: string; username: string };

type AuthContextType = {
  user: User | null;
  orgs: OrgSummary[];
  activeOrgId: number;        // 0 means "not yet loaded"
  onboardingCompletedAt: string | null;
  impersonation: ImpersonationState;
  isLoading: boolean;         // true while /api/auth/me is in flight
  login: (...) => void;
  logout: () => void;
  switchOrg: (orgId: number) => void;
  startImpersonation: (targetOrgId: number) => void;
  stopImpersonation: () => void;
  refreshOnboarding: () => void;
};

export function useAuth(): AuthContextType;
```

From wouter (already imported in App.tsx):
```typescript
import { Switch, Route, Router as WouterRouter, Redirect, useParams } from "wouter";
// <Redirect to="/login" /> performs a client-side redirect.
```

Current App.tsx route inventory (line 39-64) — split as follows:

PUBLIC (no guard):
  /                /login              /register
  /about           /careers            /accept-invite
  /e/:slug         /admin              (admin has its own credential gate)

AUTHENTICATED (wrapped in RequireAuth):
  /dashboard       /onboarding         /calendar
  /events          /events/new         /events/:id/setup
  /events/:id      /events/:id/edit
  /campaigns       /campaigns/ai       /campaigns/:id/edit
  /social          /team               /settings           /profile
  <Route component={NotFound} />   (catch-all)

Settings.tsx redundant guard to remove (lines 2589-2596):
```tsx
if (!authLoading && !user) {
  return <Redirect to="/login" />;
}
```
Also slim line 2552 from `const { activeOrgId, user, isLoading: authLoading } = useAuth();`
to `const { activeOrgId } = useAuth();` and remove `Redirect` from the wouter import on line 3
(verified: `Redirect` is used nowhere else in settings.tsx).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add RequireAuth + split routes in App.tsx</name>
  <files>artifacts/hypespace/src/App.tsx</files>
  <action>
Modify `artifacts/hypespace/src/App.tsx` to introduce an app-wide auth guard. Surgical changes only — do not reformat unrelated code, do not reorder imports beyond what's needed.

1. Add `useAuth` import:
   ```tsx
   import { useAuth } from "@/components/auth-provider";
   ```
   Place it near the existing `import { AuthProvider } from "@/components/auth-provider";` line.

2. Add a `RequireAuth` component above `function Router()`:
   ```tsx
   function RequireAuth({ children }: { children: React.ReactNode }) {
     const { user, isLoading } = useAuth();
     // While /api/auth/me is in flight, render nothing — avoids flashing /login
     // on hard refresh for users who actually have a valid session.
     if (isLoading) return null;
     if (!user) return <Redirect to="/login" />;
     return <>{children}</>;
   }
   ```
   Note: `React` is already in scope via `import React from "react"`? Verify — current App.tsx has no explicit `React` import. Use `import type { ReactNode } from "react"` and type as `{ children: ReactNode }` to avoid adding a runtime React import. (TypeScript JSX runtime in Vite handles JSX without `React` in scope.)

3. Replace the single `<Switch>` block (current lines 39-64) with this structure:
   ```tsx
   function Router() {
     return (
       <Switch>
         {/* Public routes — no auth required */}
         <Route path="/" component={Landing} />
         <Route path="/login" component={Login} />
         <Route path="/register" component={Register} />
         <Route path="/about" component={About} />
         <Route path="/careers" component={Careers} />
         <Route path="/accept-invite" component={AcceptInvite} />
         <Route path="/e/:slug" component={PublicEvent} />
         {/* /admin has its own admin-credential gate — intentionally public from the user-auth guard's perspective */}
         <Route path="/admin" component={AdminDashboard} />

         {/* Everything else requires authentication */}
         <Route>
           <RequireAuth>
             <Switch>
               <Route path="/dashboard" component={Dashboard} />
               <Route path="/onboarding" component={Onboarding} />
               <Route path="/calendar" component={CalendarPage} />
               <Route path="/events" component={EventList} />
               <Route path="/events/new"><Redirect to="/events" /></Route>
               <Route path="/events/:id/setup"><SetupRedirect /></Route>
               <Route path="/events/:id" component={EventDetail} />
               <Route path="/events/:id/edit" component={EventEdit} />
               <Route path="/campaigns" component={CampaignList} />
               <Route path="/campaigns/ai" component={CampaignAi} />
               <Route path="/campaigns/:id/edit" component={CampaignEdit} />
               <Route path="/social" component={SocialList} />
               <Route path="/team" component={TeamList} />
               <Route path="/settings" component={Settings} />
               <Route path="/profile" component={Profile} />
               <Route component={NotFound} />
             </Switch>
           </RequireAuth>
         </Route>
       </Switch>
     );
   }
   ```

   Why one outer `<Route>` (no path) wrapping the inner Switch: Wouter's `<Switch>` matches the FIRST matching child. A bare `<Route>` matches anything not matched above it, so the inner `<Switch>` (gated by `RequireAuth`) handles every authed path AND the NotFound catch-all. This means:
   - Unauthed user visiting /events → outer Switch falls through public routes → matches the bare Route → RequireAuth → no user → Redirect to /login.
   - Unauthed user visiting /unknown-junk → same path → Redirect to /login (intentional: unknown URLs don't reveal app structure).
   - Authed user visiting /unknown-junk → RequireAuth passes → inner Switch falls through to `<Route component={NotFound} />`.

4. Do NOT touch the `App` component (lines 68-81), the `SetupRedirect` helper, the `queryClient` constant, or the existing component imports. Imports stay alphabetical-ish in their current order — only ADD the `useAuth` import and the `import type { ReactNode } from "react"` if needed.

Karpathy: surgical. Every changed line traces to "guard authenticated routes app-wide". No drive-by edits.
  </action>
  <verify>
    <automated>cd artifacts/hypespace && pnpm typecheck</automated>
  </verify>
  <done>
- App.tsx contains a `RequireAuth` component using `useAuth()` from `@/components/auth-provider`.
- Routes are split: public routes (/, /login, /register, /about, /careers, /accept-invite, /e/:slug, /admin) sit above a bare `<Route>` whose child wraps an inner `<Switch>` of authed routes (and NotFound) in `<RequireAuth>`.
- `pnpm typecheck` produces no NEW errors compared to baseline (`git stash && pnpm typecheck` to capture baseline if needed).
- `/admin` route still resolves to `AdminDashboard` directly — it is NOT inside `RequireAuth`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove redundant per-page auth guard from settings.tsx</name>
  <files>artifacts/hypespace/src/pages/settings.tsx</files>
  <action>
The Settings page now sits behind the app-wide `RequireAuth`, so its per-page redirect block is dead weight. Remove it surgically:

1. Delete lines 2589-2596 (the entire comment block + `if (!authLoading && !user) return <Redirect to="/login" />;`). Leave the surrounding `useEffect` (line 2583) and `onSubmit` declaration (line 2598) untouched.

2. Update line 2552 from:
   ```tsx
   const { activeOrgId, user, isLoading: authLoading } = useAuth();
   ```
   to:
   ```tsx
   const { activeOrgId } = useAuth();
   ```
   (`user` and `authLoading` were used only by the deleted guard. Verified by grep: line 2552 is their only consuming reference; the `user` references at lines 1157/1180/1203/1214/1227/1458/1495 are a different local state variable in a different component scope.)

3. Update the wouter import on line 3 from:
   ```tsx
   import { Link, Redirect, useLocation, useSearch } from "wouter";
   ```
   to:
   ```tsx
   import { Link, useLocation, useSearch } from "wouter";
   ```
   (`Redirect` was used only at line 2595. Verified by grep: `Redirect` appears only at lines 3 and 2595 in settings.tsx.)

4. Do NOT touch the `|| !orgId` guards on Save buttons or any other code in settings.tsx. The redundant page-level redirect is the only target.

Karpathy: clean up only the orphans MY change created. Do not refactor adjacent code.
  </action>
  <verify>
    <automated>cd artifacts/hypespace && pnpm typecheck</automated>
  </verify>
  <done>
- `artifacts/hypespace/src/pages/settings.tsx` no longer contains `if (!authLoading && !user) return <Redirect to="/login" />`.
- Line 2552 destructures only `activeOrgId` from `useAuth()`.
- Line 3 wouter import no longer includes `Redirect`.
- `pnpm typecheck` produces no NEW errors.
- Other usages in settings.tsx (the local `user` state in the SMTP form section, the `orgId` guards on Save buttons) are unchanged.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual smoke test — guarded vs public routes</name>
  <what-built>App-wide auth guard via `RequireAuth` wrapping all authenticated routes; redundant per-page guard removed from settings.tsx.</what-built>
  <how-to-verify>
Run the dev server (`pnpm dev` in `artifacts/hypespace` with the API also running). Then in a browser:

**A. Unauthenticated (log out first, or use a private/incognito window):**
  1. Visit `/dashboard` → MUST redirect to `/login`.
  2. Visit `/events` → MUST redirect to `/login`.
  3. Visit `/campaigns` → MUST redirect to `/login`.
  4. Visit `/settings` → MUST redirect to `/login`.
  5. Visit `/some-random-url-that-does-not-exist` → MUST redirect to `/login` (NotFound is now inside the guard).

**B. Public routes (still unauthenticated, same window):**
  6. Visit `/` → renders Landing page, no redirect.
  7. Visit `/login` → renders Login page, no redirect.
  8. Visit `/register` → renders Register page, no redirect.
  9. Visit `/about` → renders About page, no redirect.
  10. Visit `/e/{any-slug-or-fake-slug}` → renders PublicEvent page, no redirect.
  11. Visit `/admin` → renders AdminDashboard with its own admin-credential prompt (NOT redirected to /login).

**C. Authenticated (log in, then):**
  12. Hard-refresh `/dashboard` (Cmd/Ctrl+Shift+R) → page loads cleanly. There should be a brief blank moment, then the dashboard. NO flash of `/login`.
  13. Visit `/settings` → page renders, save the org form → MUST succeed (confirms removing the per-page guard didn't break anything).
  14. Visit `/events`, `/campaigns`, `/social`, `/team`, `/profile` → each renders normally.

Report any deviation. Especially flag: any flash of /login on authed hard-refresh, any public route redirecting unexpectedly, or /admin routing through the user-auth guard.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd artifacts/hypespace && pnpm typecheck` passes (no NEW errors vs baseline).
- All manual smoke checks in Task 3 pass.
- Search confirms no other page still has its own ad-hoc `if (!user) return <Redirect to="/login" />` block (out of scope to remove if found — log them in the SUMMARY for a follow-up quick).
</verification>

<success_criteria>
- Unauthenticated requests to any non-public path land on `/login`.
- Public paths (/, /login, /register, /about, /careers, /accept-invite, /e/:slug, /admin) render without redirect for unauthenticated users.
- Authenticated users do not see a /login flash on hard-refresh.
- /admin's own credential gate is intact (untouched by RequireAuth).
- Settings page no longer holds a redundant per-page auth-redirect; orphaned imports/destructured fields removed.
- `pnpm typecheck` clean.
</success_criteria>

<output>
After completion, create `.planning/quick/260418-rmv-app-wide-auth-guard-redirect-non-public-/260418-rmv-SUMMARY.md` with:
- What changed (App.tsx structural change + settings.tsx cleanup)
- Verification results (typecheck output, manual smoke results)
- Any other pages discovered with similar ad-hoc auth guards (for a follow-up cleanup)
</output>
