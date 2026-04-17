---
phase: quick-260417-ois
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/db/src/schema/organizations.ts
  - artifacts/api-server/src/routes/auth.ts
  - artifacts/api-server/src/routes/organizations.ts
  - artifacts/hypespace/src/pages/dashboard.tsx
  - artifacts/hypespace/src/pages/settings.tsx
  - artifacts/hypespace/src/pages/onboarding.tsx
  - artifacts/hypespace/src/components/auth-provider.tsx
  - artifacts/hypespace/src/App.tsx
autonomous: true
requirements:
  - QUICK-260417-OIS-01  # Route "Configure Integrations" button to Integrations tab
  - QUICK-260417-OIS-02  # First-login onboarding wizard (Branding, Email, AI, Integrations)
  - QUICK-260417-OIS-03  # Re-entry link in Settings to replay wizard

must_haves:
  truths:
    - "The dashboard 'Configure Integrations' button navigates directly to the Integrations tab in Settings (not the General tab)."
    - "Settings page respects a ?tab=<id> query param on mount and activates that tab."
    - "A brand-new organization (onboardingCompletedAt is null) is redirected from /dashboard to /onboarding after login."
    - "The /onboarding wizard walks through Branding, Email Sending, AI Settings, and Integrations using the existing Settings forms (no duplicate forms)."
    - "The user can Skip / Finish Later on any wizard step, and completion is stored incrementally (progress is preserved if they close the tab)."
    - "Clicking 'Finish' on the wizard sets organizations.onboardingCompletedAt and future logins go straight to /dashboard."
    - "Settings > General shows a 'Run setup wizard' link that reopens /onboarding for users who already finished it."
  artifacts:
    - path: "lib/db/src/schema/organizations.ts"
      provides: "onboardingCompletedAt timestamp column on organizations table"
      contains: "onboardingCompletedAt"
    - path: "artifacts/api-server/src/routes/organizations.ts"
      provides: "PATCH /organizations/:orgId/onboarding endpoint that sets/clears onboardingCompletedAt"
      contains: "/onboarding"
    - path: "artifacts/api-server/src/routes/auth.ts"
      provides: "/auth/me response includes onboardingCompletedAt for active org"
      contains: "onboardingCompletedAt"
    - path: "artifacts/hypespace/src/pages/onboarding.tsx"
      provides: "Full-page wizard shell with 4 steps reusing settings sub-components"
      min_lines: 150
    - path: "artifacts/hypespace/src/App.tsx"
      provides: "Route registration for /onboarding"
      contains: "/onboarding"
    - path: "artifacts/hypespace/src/components/auth-provider.tsx"
      provides: "onboardingCompletedAt exposed on AuthContext"
      contains: "onboardingCompletedAt"
    - path: "artifacts/hypespace/src/pages/dashboard.tsx"
      provides: "Configure Integrations link points to /settings?tab=integrations; redirect to /onboarding when not completed"
      contains: "/settings?tab=integrations"
    - path: "artifacts/hypespace/src/pages/settings.tsx"
      provides: "Named exports of BrandingTab/EmailSendingTab/AiSettingsTab/IntegrationsTab + ?tab= URL sync + 'Run setup wizard' link"
      contains: "export { BrandingTab"
  key_links:
    - from: "artifacts/hypespace/src/pages/dashboard.tsx"
      to: "/settings?tab=integrations"
      via: "Link href"
      pattern: "href=\"/settings\\?tab=integrations\""
    - from: "artifacts/hypespace/src/pages/settings.tsx"
      to: "activeTab state"
      via: "useSearch() param reader setting initial TabId"
      pattern: "useSearch\\(\\)|URLSearchParams"
    - from: "artifacts/hypespace/src/pages/onboarding.tsx"
      to: "BrandingTab/EmailSendingTab/AiSettingsTab/IntegrationsTab"
      via: "named imports from @/pages/settings"
      pattern: "from \"@/pages/settings\""
    - from: "artifacts/hypespace/src/pages/dashboard.tsx"
      to: "/onboarding"
      via: "Redirect when onboardingCompletedAt is null"
      pattern: "onboardingCompletedAt"
    - from: "artifacts/hypespace/src/pages/onboarding.tsx"
      to: "PATCH /api/organizations/:orgId/onboarding"
      via: "fetch on Finish"
      pattern: "/onboarding"
---

<objective>
Two deliverables in one atomic plan:

1. Fix the dashboard "Configure Integrations" button so it deep-links to the
   Integrations tab of Settings (today it dumps users on the General tab).
2. Add a first-login onboarding wizard at `/onboarding` that walks brand-new
   organizations through Branding, Email Sending, AI Settings, and
   Integrations — reusing the existing Settings tab components so there is
   one source of truth for each form.

Purpose: Reduce time-to-first-event for new signups and stop the
"why does this button take me to the wrong place?" bug. This is the kind of
polish required for the resellable v1 on April 20.

Output: schema column + onboarding API endpoint + /auth/me field +
/onboarding page + wizard gate + tab deep-link + Settings re-entry link.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@artifacts/hypespace/CLAUDE.md
@artifacts/hypespace/src/App.tsx
@artifacts/hypespace/src/components/auth-provider.tsx
@artifacts/hypespace/src/pages/dashboard.tsx
@artifacts/hypespace/src/pages/settings.tsx
@artifacts/api-server/src/routes/auth.ts
@artifacts/api-server/src/routes/organizations.ts
@lib/db/src/schema/organizations.ts
@lib/db/src/schema/users.ts

<codebase_facts>
These are non-obvious facts the executor will need — verified during planning.

- **Router is Wouter**, NOT React Router. Use `useLocation()` for navigation and
  `useSearch()` to read query params (already used in `pages/register.tsx:2`).
- **Settings tab state is local, not URL-backed today**:
  `settings.tsx:2553` → `const [activeTab, setActiveTab] = useState<TabId>("general")`.
  `TabId` is defined at `settings.tsx:70` as
  `"general" | "branding" | "email" | "ai" | "integrations" | "billing"`.
- **The "Configure Integrations" button** is at `dashboard.tsx:244-249` —
  `<Link href="/settings">` wrapping an outline Button. Only the `href` needs to change.
- **Settings sub-tabs are already standalone React components** inside the same
  file, accepting just `{ orgId: number }`:
    - `BrandingTab` — `settings.tsx:1787`
    - `EmailSendingTab` — `settings.tsx:1566`
    - `IntegrationsTab` — `settings.tsx:857`
    - `AiSettingsTab` — `settings.tsx:2103`
  They are not exported today. The plan EXPORTS them (adds `export` keyword or
  a named re-export block) rather than moving them into separate files —
  settings.tsx is 2759 lines and a split would be a much bigger task.
- **Organizations table already stores all the fields the wizard configures**
  (logoUrl, primaryColor, accentColor, fromEmail, aiProvider, aiApiKey, aiModel,
  aiBaseUrl). Adding one more column (`onboardingCompletedAt`) is a pure additive
  change.
- **openapi.yaml's `Organization` schema is intentionally incomplete** — it
  omits primaryColor, aiProvider, etc. The frontend already reads these via
  `Record<string, unknown>` casts (see `settings.tsx:2117`). We will follow this
  pattern for `onboardingCompletedAt` to avoid a regen cycle on
  `@workspace/api-zod` / `@workspace/api-client-react`.
- **`/auth/me` response pattern for extra fields**: auth.ts:50-60 spreads extra
  properties (`orgs`, `activeOrgId`) OUTSIDE `GetMeResponse.parse(...)` so the
  Zod schema does not need to be touched. `onboardingCompletedAt` follows the
  same pattern. Existing precedent is documented in STATE.md decision log:
  "orgs/activeOrgId spread outside GetMeResponse.parse() — same pattern as csrfToken".
- **Database schema changes are applied via** `pnpm drizzle-kit push` from
  `lib/db/` — there are no migration files committed. CLAUDE.md confirms this.
- **Sessions work**: login sets `req.session.userId`, `/auth/me` returns user
  + orgs. The `activeOrgId` is derived server-side from the first team_members
  row (by `createdAt asc`).
- **There is no routing/auth-guard middleware on the frontend today** — pages
  are all free-routed in `App.tsx`. Redirect logic happens inside pages
  (see the `<SetupRedirect />` helper in `App.tsx:31-34`).
</codebase_facts>

<interfaces>
Key contracts the executor will consume / extend. Use these directly — do not
re-read the source files looking for them.

From `lib/db/src/schema/organizations.ts` (current):
```typescript
export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // ... description, logoUrl, plan, ownerId, primaryColor, accentColor,
  // fromEmail, replyToEmail, emailFooterText, aiProvider, aiApiKey, aiModel,
  // aiBaseUrl, createdAt, updatedAt
});
```
Add ONE new column:
```typescript
onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
```

From `artifacts/api-server/src/routes/auth.ts:50-60` (GET /auth/me response shape):
```typescript
res.json({
  ...GetMeResponse.parse({ id, email, name, avatarUrl, createdAt }),
  orgs,
  activeOrgId,
  // ADD: onboardingCompletedAt (ISO string | null) — from the active org
});
```

From `artifacts/hypespace/src/components/auth-provider.tsx`:
```typescript
type AuthContextType = {
  user: User | null;
  orgs: OrgSummary[];
  activeOrgId: number;
  // ADD:
  onboardingCompletedAt: string | null;
  // ... rest
};
```

From `artifacts/hypespace/src/pages/settings.tsx` (to expose after this plan):
```typescript
export type TabId = "general" | "branding" | "email" | "ai" | "integrations" | "billing";
export function BrandingTab(props: { orgId: number }): JSX.Element;
export function EmailSendingTab(props: { orgId: number }): JSX.Element;
export function IntegrationsTab(props: { orgId: number }): JSX.Element;
export function AiSettingsTab(props: { orgId: number }): JSX.Element;
```

New backend contract (to be added in this plan):
```
PATCH /api/organizations/:orgId/onboarding
Body:  { completedAt: string | null }   // ISO8601 or null to re-open
Resp:  200 { onboardingCompletedAt: string | null }
       404 { error: "Organization not found" }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix button routing + URL-sync Settings tabs + add Settings "Run wizard" entry</name>
  <files>
    artifacts/hypespace/src/pages/dashboard.tsx
    artifacts/hypespace/src/pages/settings.tsx
  </files>
  <action>
    Deliverable A — Fix the "Configure Integrations" button:

    1. In `artifacts/hypespace/src/pages/dashboard.tsx` at line 244, change
       `<Link href="/settings">` to `<Link href="/settings?tab=integrations">`.
       Do not touch any other dashboard button or layout.

    Deliverable B — Make Settings honor `?tab=` on mount AND write it back when
    a tab is clicked (so the deep-link works AND refreshing preserves the
    user's current tab):

    2. In `artifacts/hypespace/src/pages/settings.tsx`, add `useSearch` and
       `useLocation` imports from `wouter` (follow the existing import style at
       the top of the file; `register.tsx:2` is the reference usage).
    3. In the `Settings` component (line 2550), compute the initial tab from
       the URL once:
       ```ts
       const [location, setLocation] = useLocation();
       const search = useSearch();
       const initialTab: TabId = (() => {
         const t = new URLSearchParams(search).get("tab");
         const valid: TabId[] = ["general", "branding", "email", "ai", "integrations", "billing"];
         return (valid as string[]).includes(t ?? "") ? (t as TabId) : "general";
       })();
       const [activeTab, setActiveTab] = useState<TabId>(initialTab);
       ```
       Replace the existing `useState<TabId>("general")` at line 2553.
    4. Wrap the existing `onClick={() => setActiveTab(id)}` on the tab button
       (line 2608) so it also updates the URL without reloading:
       ```ts
       onClick={() => {
         setActiveTab(id);
         setLocation(`/settings?tab=${id}`, { replace: true });
       }}
       ```
       Use Wouter's `replace: true` so tab clicks do not spam the history stack.
    5. Add a React effect so external `?tab=` changes (e.g. landing from
       dashboard while already on /settings) sync into state:
       ```ts
       useEffect(() => {
         const t = new URLSearchParams(search).get("tab");
         const valid: TabId[] = ["general","branding","email","ai","integrations","billing"];
         if (t && (valid as string[]).includes(t) && t !== activeTab) {
           setActiveTab(t as TabId);
         }
       }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
       ```

    Deliverable C — Export the four tab components so the wizard (Task 3) can
    import them, and add a "Run setup wizard" entry in General:

    6. Add the `export` keyword to the four function declarations in
       settings.tsx (do NOT move them — just prefix):
       - `function IntegrationsTab` (line 857) → `export function IntegrationsTab`
       - `function EmailSendingTab` (line 1566) → `export function EmailSendingTab`
       - `function BrandingTab` (line 1787) → `export function BrandingTab`
       - `function AiSettingsTab` (line 2103) → `export function AiSettingsTab`
       Also add `export` to the `TabId` type at line 70.
    7. In the General tab content (the `activeTab === "general"` block,
       line 2623), add a small card BELOW the "Organization Profile" card
       and ABOVE the "Danger Zone" card:
       ```tsx
       <Card>
         <CardHeader>
           <CardTitle>Setup wizard</CardTitle>
           <CardDescription>
             Re-run the first-time setup walkthrough — configure branding,
             email sending, AI, and integrations in one guided flow.
           </CardDescription>
         </CardHeader>
         <CardContent>
           <Link href="/onboarding">
             <Button variant="outline">Run setup wizard</Button>
           </Link>
         </CardContent>
       </Card>
       ```
       If `Link` from `wouter` is not already imported in settings.tsx, add it.

    Do NOT modify any other tab content, any other routing, or any other page.
    The goal is a surgical, low-blast-radius edit set.
  </action>
  <verify>
    <automated>cd artifacts/hypespace &amp;&amp; pnpm typecheck</automated>
    Manual spot check the executor should also do:
    - `grep -n "Configure Integrations" artifacts/hypespace/src/pages/dashboard.tsx`
      should show the line wrapped by `<Link href="/settings?tab=integrations">`.
    - `grep -n "^export function \(Branding\|EmailSending\|Integrations\|AiSettings\)Tab" artifacts/hypespace/src/pages/settings.tsx`
      should return 4 matches.
    - `grep -n "useSearch\|URLSearchParams" artifacts/hypespace/src/pages/settings.tsx`
      should show the tab param read wiring.
  </verify>
  <done>
    - Dashboard "Configure Integrations" `<Link>` targets `/settings?tab=integrations`.
    - Opening `/settings?tab=integrations` in a fresh tab renders with the
      Integrations tab pre-selected (verified manually after `pnpm dev`).
    - Clicking any other tab updates the URL to `/settings?tab=<id>`.
    - Four tab components are exported from settings.tsx and importable
      from other files.
    - Settings > General shows a "Run setup wizard" card linking to /onboarding.
    - `pnpm typecheck` passes in `artifacts/hypespace`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add onboarding column + backend endpoint + /auth/me exposure</name>
  <files>
    lib/db/src/schema/organizations.ts
    artifacts/api-server/src/routes/organizations.ts
    artifacts/api-server/src/routes/auth.ts
  </files>
  <action>
    Deliverable A — Schema:

    1. In `lib/db/src/schema/organizations.ts`, add ONE new column inside the
       `pgTable("organizations", {...})` definition (place it between
       `aiBaseUrl` and `createdAt`, keeping the `withTimezone: true` convention
       used by `createdAt`/`updatedAt`):
       ```ts
       onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
       ```
       Do NOT set a default. `null` is the signal for "onboarding not complete".

    2. Apply the schema to the dev database:
       ```bash
       cd lib/db && pnpm drizzle-kit push
       ```
       Accept the prompt to add the nullable column (drizzle-kit push is the
       project convention — see `artifacts/hypespace/CLAUDE.md`).

       IMPORTANT: After pushing, backfill existing development orgs so seeded
       test accounts don't land in the wizard forever:
       ```sql
       UPDATE organizations SET onboarding_completed_at = NOW() WHERE id = 1;
       ```
       Run this via `psql $DATABASE_URL -c "..."` or the same method used in
       `users.ts` comment (see `emailVerified` backfill note at line 12-14).
       Only backfill org id=1 (the dev/seed org) so QA of the wizard with a
       freshly registered account still works.

    Deliverable B — Backend endpoint:

    3. In `artifacts/api-server/src/routes/organizations.ts`, add a new route
       handler BELOW the existing PUT `/organizations/:orgId` handler (after
       line 85, before `export default router`):
       ```ts
       router.patch("/organizations/:orgId/onboarding", async (req, res): Promise<void> => {
         const userId = req.session?.userId;
         if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

         const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
         const orgId = parseInt(raw, 10);
         if (!Number.isFinite(orgId)) {
           res.status(400).json({ error: "Invalid orgId" });
           return;
         }

         // Verify user is a member of this org (cheap IDOR check).
         const [membership] = await db
           .select()
           .from(teamMembersTable)
           .where(and(eq(teamMembersTable.userId, userId), eq(teamMembersTable.organizationId, orgId)));
         if (!membership) { res.status(404).json({ error: "Organization not found" }); return; }

         const { completedAt } = req.body ?? {};
         // Accept an ISO string or null. Anything else → 400.
         let value: Date | null;
         if (completedAt === null) {
           value = null;
         } else if (typeof completedAt === "string") {
           const d = new Date(completedAt);
           if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "Invalid completedAt" }); return; }
           value = d;
         } else {
           res.status(400).json({ error: "completedAt must be an ISO string or null" });
           return;
         }

         const [updated] = await db
           .update(organizationsTable)
           .set({ onboardingCompletedAt: value })
           .where(eq(organizationsTable.id, orgId))
           .returning();
         if (!updated) { res.status(404).json({ error: "Organization not found" }); return; }

         res.json({ onboardingCompletedAt: updated.onboardingCompletedAt?.toISOString() ?? null });
       });
       ```
       NOTE: The existing handlers in this file hardcode `userId = 1` (see
       line 37 and 59). That's a pre-existing issue tracked in STATE.md
       (auth middleware). DO NOT fix those here — use `req.session?.userId`
       ONLY for this new endpoint so we don't regress other work.

    Deliverable C — Expose onboarding status via `/auth/me`:

    4. In `artifacts/api-server/src/routes/auth.ts`, in the GET `/auth/me`
       handler (line 16), after memberships are computed and `activeOrgId` is
       assigned (around line 48), fetch the active org's onboarding status:
       ```ts
       const [activeOrg] = await db
         .select({ onboardingCompletedAt: organizationsTable.onboardingCompletedAt })
         .from(organizationsTable)
         .where(eq(organizationsTable.id, activeOrgId));
       const onboardingCompletedAt = activeOrg?.onboardingCompletedAt?.toISOString() ?? null;
       ```
    5. Spread it into the response alongside `orgs` and `activeOrgId`
       (line 50-60) — OUTSIDE `GetMeResponse.parse(...)` so we do not touch
       `@workspace/api-zod`:
       ```ts
       res.json({
         ...GetMeResponse.parse({ id, email, name, avatarUrl, createdAt: user.createdAt.toISOString() }),
         orgs,
         activeOrgId,
         onboardingCompletedAt,
       });
       ```
       This is the same pattern STATE.md calls out for `csrfToken` /
       `activeOrgId`.

    Do NOT regenerate `@workspace/api-zod` or `@workspace/api-client-react`.
    The wizard will read `onboardingCompletedAt` from `/auth/me` via the raw
    fetch path used in auth-provider.tsx.
  </action>
  <verify>
    <automated>cd artifacts/api-server &amp;&amp; pnpm typecheck 2>&amp;1 | tail -20 || echo "no typecheck script — falling back to build"</automated>
    Manual checks the executor should run:
    ```bash
    # Confirm the column exists after push:
    psql "$DATABASE_URL" -c "\d organizations" | grep onboarding_completed_at
    # Confirm /auth/me returns the new field (requires dev server running
    # and a logged-in session cookie in ./cookies.txt):
    curl -s -b cookies.txt http://localhost:4000/api/auth/me | jq '.onboardingCompletedAt'
    # Should print: null  (for a fresh org) or an ISO timestamp string.
    # Confirm the new endpoint responds:
    curl -s -b cookies.txt -X PATCH http://localhost:4000/api/organizations/1/onboarding \
      -H 'Content-Type: application/json' \
      -d '{"completedAt":"2026-04-17T12:00:00.000Z"}' | jq
    # Should return: { "onboardingCompletedAt": "2026-04-17T12:00:00.000Z" }
    ```
  </verify>
  <done>
    - `organizations.onboarding_completed_at` column exists in Postgres (nullable).
    - Dev seed org (id=1) backfilled so existing QA accounts aren't force-routed
      to the wizard.
    - `GET /api/auth/me` response includes `onboardingCompletedAt` (ISO string or null).
    - `PATCH /api/organizations/:orgId/onboarding` with `{completedAt}` updates
      the column and returns the new value.
    - Membership check is present on the PATCH endpoint (non-members get 404).
    - api-server builds / typechecks cleanly.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: /onboarding wizard page, auth-provider plumbing, and post-login gate</name>
  <files>
    artifacts/hypespace/src/components/auth-provider.tsx
    artifacts/hypespace/src/App.tsx
    artifacts/hypespace/src/pages/onboarding.tsx
    artifacts/hypespace/src/pages/dashboard.tsx
  </files>
  <action>
    Deliverable A — auth-provider exposes onboarding status:

    1. In `artifacts/hypespace/src/components/auth-provider.tsx`:
       - Add `onboardingCompletedAt: string | null` to `AuthContextType`
         (line 19-30).
       - Add a state hook: `const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);`
       - Inside the `useEffect` that consumes `authData` (line 57), set it:
         ```ts
         setOnboardingCompletedAt(authData.onboardingCompletedAt ?? null);
         ```
         And in the `else` branch, set it back to `null`.
       - Expose it in the `<AuthContext.Provider value={...}>` object.
       - Also expose a helper so the wizard can mark things complete without
         plumbing its own fetch — add to the context:
         ```ts
         refreshOnboarding: () => void;
         ```
         Implementation:
         ```ts
         const refreshOnboarding = () => {
           queryClient.invalidateQueries({ queryKey: ["auth_status"] });
         };
         ```

    Deliverable B — Register the /onboarding route:

    2. In `artifacts/hypespace/src/App.tsx`:
       - Import the new page: `import Onboarding from "@/pages/onboarding";`
       - Add a Route entry, place it after the `/dashboard` line (line 42):
         `<Route path="/onboarding" component={Onboarding} />`

    Deliverable C — Create the wizard page:

    3. Create `artifacts/hypespace/src/pages/onboarding.tsx` as a full-page
       wizard shell (NOT a modal — per the locked design decision). Required
       behavior:

       Structure:
       ```tsx
       import { useState } from "react";
       import { Link, useLocation } from "wouter";
       import { useAuth } from "@/components/auth-provider";
       import { BrandingTab, EmailSendingTab, AiSettingsTab, IntegrationsTab } from "@/pages/settings";
       import { Button } from "@/components/ui/button";
       import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
       import { Check, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

       const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

       type StepId = "branding" | "email" | "ai" | "integrations";

       const STEPS: { id: StepId; title: string; description: string }[] = [
         { id: "branding", title: "Branding", description: "Logo and colors for your event pages and emails." },
         { id: "email", title: "Email Sending", description: "Connect a sending domain so campaigns come from your address." },
         { id: "ai", title: "AI Settings", description: "Hook up an AI provider (Anthropic, OpenAI, Gemini, or Ollama) for campaign generation." },
         { id: "integrations", title: "Integrations", description: "Connect contact sources (GoHighLevel, HubSpot) and social platforms." },
       ];
       ```

       Behavior requirements:
       - Use `useAuth()` to get `activeOrgId` and `refreshOnboarding`.
       - Local state: `const [currentIdx, setCurrentIdx] = useState(0);`
       - Render a left-side step rail showing all 4 steps (done/active/pending
         states use `Check` icon + opacity) — mirror the visual style of the
         existing Settings sidebar (`settings.tsx:2604-2619`) for consistency.
       - Main panel:
         - Header row with step title, step description, and an "X Skip setup"
           button (top-right). "Skip setup" calls the finish handler (see below)
           and then navigates to `/dashboard`.
         - The active step's component rendered directly:
           `{current === "branding" && <BrandingTab orgId={activeOrgId} />}` etc.
           The four Settings tab components ALREADY save to the backend on
           their own "Save" button, so wizard progress IS incremental — we
           don't need our own save layer.
         - Footer row: Back (disabled on step 0), Next (on last step this
           button becomes "Finish").
       - `handleFinish` posts to the new endpoint:
         ```ts
         async function handleFinish() {
           await fetch(`${BASE}/api/organizations/${activeOrgId}/onboarding`, {
             method: "PATCH",
             headers: { "Content-Type": "application/json" },
             credentials: "include",
             body: JSON.stringify({ completedAt: new Date().toISOString() }),
           });
           refreshOnboarding();
           setLocation("/dashboard");
         }
         ```
       - Skip invokes the SAME `handleFinish` — per the locked constraint
         ("Users should be able to Skip / Finish Later on any step, store
         progress incrementally"). Reasoning: each tab already persists on its
         own Save button, so skipping is safe; we just want to stop blocking
         /dashboard.
       - Include a small note at the top: "You can come back to these any
         time under Settings — this wizard just walks you through them once."

       Layout: wrap the whole page in a simple centered container WITHOUT
       `<AppLayout>` (the AppLayout has the sidebar nav; this is a focused
       flow). Use a minimal top bar with the HypeSpace logo (import pattern
       matches `login.tsx:6` — `import logoSrc from "@assets/HS_logo_1775759732611.png";`)
       and a "Log out" link in the corner so users aren't trapped.

       Guards:
       - If `isLoading || !user` → show a loader (Skeleton) then fall through.
       - If `!activeOrgId` → render nothing (auth-provider hasn't resolved).
       - If `onboardingCompletedAt !== null` on mount AND the user arrived here
         from the auto-redirect (no way to know) — still render the wizard
         normally. The "Run setup wizard" Settings link is the re-entry path
         and we don't want to bounce them back. Only /dashboard auto-redirect
         checks this flag.

    Deliverable D — Post-login gate on /dashboard:

    4. In `artifacts/hypespace/src/pages/dashboard.tsx`:
       - Pull `onboardingCompletedAt` and `isLoading` from `useAuth()`.
       - At the very top of the `Dashboard()` component render, BEFORE the
         `return <AppLayout>...`, add:
         ```ts
         const { activeOrgId, onboardingCompletedAt, isLoading: authLoading } = useAuth();
         // ...existing stats queries...

         if (!authLoading && activeOrgId && onboardingCompletedAt === null) {
           return <Redirect to="/onboarding" />;
         }
         ```
       - Import `Redirect` from `wouter` at the top (alongside `Link`).
       - Do NOT gate any other route. This is deliberate: if a user navigates
         DIRECTLY to `/events` or `/campaigns`, they can still use the app
         — we only bounce them from `/dashboard` (the default landing page
         after login per `login.tsx:54` and `register.tsx:101`).
  </action>
  <verify>
    <automated>cd artifacts/hypespace &amp;&amp; pnpm typecheck &amp;&amp; pnpm build</automated>
    Manual smoke test after `pnpm dev` + api-server running:
    1. Register a brand new account → should land on /onboarding (not /dashboard).
    2. Step through Branding → Email → AI → Integrations. Each Save button
       should work as it does in Settings today. The step rail should mark
       each step as visited.
    3. Click "Finish" on the last step. Verify:
       - URL becomes `/dashboard`.
       - `curl -b cookies.txt /api/auth/me | jq .onboardingCompletedAt` is NOT null.
       - Subsequent refreshes of `/dashboard` render normally (no redirect loop).
    4. Register another fresh account, click "Skip setup" on step 1.
       Verify: lands on /dashboard, onboardingCompletedAt populated.
    5. Go to Settings → General → click "Run setup wizard" → lands on /onboarding.
    6. Dashboard "Configure Integrations" button → lands on Settings with the
       Integrations tab pre-selected.
  </verify>
  <done>
    - `/onboarding` route exists and renders the 4-step wizard using the
      existing `BrandingTab`, `EmailSendingTab`, `AiSettingsTab`,
      `IntegrationsTab` components (no form duplication).
    - A brand-new account is auto-redirected from `/dashboard` → `/onboarding`.
    - Finish and Skip both persist `onboardingCompletedAt` and then navigate
      to `/dashboard`.
    - The "Run setup wizard" link in Settings > General reopens the wizard
      even for already-completed users.
    - The Configure Integrations button (from Task 1) lands on the Integrations
      tab.
    - `pnpm typecheck` passes and `pnpm build` succeeds in `artifacts/hypespace`.
  </done>
</task>

</tasks>

<verification>
Full-flow manual verification after all three tasks complete:

1. **Typecheck + build both workspaces:**
   ```bash
   cd artifacts/hypespace && pnpm typecheck && pnpm build
   cd artifacts/api-server && pnpm build
   ```

2. **Schema applied:**
   ```bash
   psql "$DATABASE_URL" -c "\d organizations" | grep onboarding_completed_at
   ```

3. **Configure Integrations button fix:**
   - Start dev stack (api-server + hypespace), log in as seed user.
   - Dashboard → click "Configure Integrations".
   - Assert URL is `/settings?tab=integrations` and the Integrations tab is
     highlighted in the left rail.

4. **First-login wizard:**
   - Register a brand new account (new email).
   - Assert auto-redirect to `/onboarding`.
   - Step through all four steps; save each; click Finish.
   - Assert landing on `/dashboard` and `/auth/me` now returns a non-null
     `onboardingCompletedAt`.

5. **Skip path:**
   - Register another brand new account.
   - On /onboarding, click "Skip setup" immediately.
   - Assert landing on /dashboard and `onboardingCompletedAt` is set
     (skip is equivalent to finish — user can still access everything in
     Settings and can re-enter via the "Run setup wizard" link).

6. **Re-entry link:**
   - As an already-onboarded user, go to Settings > General.
   - Assert a "Run setup wizard" card is visible linking to /onboarding.
   - Click it, step through, finish. Assert no regression.

7. **No regression checks:**
   - Existing seed user (org id=1) is backfilled → dashboard loads directly.
   - Other tabs in Settings still work (General profile form, Billing, AI).
   - Deep-link `/settings?tab=ai` works the same way for completeness.
</verification>

<success_criteria>
- [ ] Dashboard "Configure Integrations" button routes to `/settings?tab=integrations`.
- [ ] `/settings` honors `?tab=` on mount and writes back on tab click.
- [ ] `organizations.onboarding_completed_at` column exists in the DB.
- [ ] `GET /api/auth/me` returns `onboardingCompletedAt` (ISO | null).
- [ ] `PATCH /api/organizations/:orgId/onboarding` sets / clears the column
      with a membership check.
- [ ] `/onboarding` wizard page exists, reuses `BrandingTab`, `EmailSendingTab`,
      `AiSettingsTab`, `IntegrationsTab` directly (no duplicate forms).
- [ ] Brand-new org → `/dashboard` redirects to `/onboarding`.
- [ ] Finish and Skip both persist completion; subsequent dashboard visits
      do not loop.
- [ ] Settings > General has a "Run setup wizard" card linking to /onboarding.
- [ ] `pnpm typecheck && pnpm build` passes in `artifacts/hypespace`.
- [ ] api-server builds cleanly.
- [ ] Seed org (id=1) backfilled so existing QA flows are not affected.
</success_criteria>

<output>
After completion, create
`.planning/quick/260417-ois-fix-dashboard-configure-integrations-but/260417-ois-SUMMARY.md`
documenting:
- Files changed and why.
- The exact button fix location + before/after.
- Wizard route + redirect behavior.
- Any deviations from this plan (e.g. if `pnpm drizzle-kit push` prompted
  differently on your machine).
- Known follow-ups: the existing `routes/organizations.ts` handlers still
  hardcode `userId = 1` — pre-existing, tracked by STATE.md auth-middleware
  work, intentionally NOT fixed here.
</output>
