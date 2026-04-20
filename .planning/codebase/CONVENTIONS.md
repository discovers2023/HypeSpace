# Code Conventions

**Analysis Date:** 2026-04-20

## Tooling

- **Formatter:** Prettier 3.8.1 with defaults — no `.prettierrc` committed. Trailing commas, double quotes, 2-space indent.
- **Linter:** None. No ESLint or Biome configured. Correctness relies on TypeScript strict mode + runtime Zod validation.
- **TypeScript:** Strict mode in `tsconfig.base.json` with these pragmatic loosenings:
  - `isolatedModules: true`
  - `noUnusedLocals: false` — unused vars tolerated
  - `strictFunctionTypes: false` — function-signature variance tolerated
  - `skipLibCheck: true`

## Naming

### Files

- **Backend route modules:** `[domain].ts` (lowercase) — `events.ts`, `campaigns.ts`, `team.ts`
- **Backend lib modules:** lowercase-with-dashes — `ai-campaign.ts`, `app-url.ts`
- **Frontend pages/components:** `kebab-case.tsx` — `campaign-edit.tsx`, `cover-image-picker.tsx`
- **Hooks:** `use-[name].ts` — `use-toast.ts`, `use-mobile.tsx`
- **DB schemas:** `[entity].ts` under `lib/db/src/schema/` — one file per table

### Symbols

| Kind | Convention | Example |
|------|------------|---------|
| Functions | `camelCase` | `generateSlug`, `formatCampaign`, `sendEmail` |
| Async fns | Same as sync — no `Async` suffix | `sendEmail()` is always async |
| Helpers | Verb prefix | `get*`, `set*`, `format*`, `parse*`, `send*`, `validate*`, `extract*` |
| Variables | `camelCase` | `searchTerm`, `statusFilter`, `activeOrgId` |
| Constants | `UPPER_SNAKE_CASE` if truly constant | `TOAST_LIMIT`, `MAX_SIZE`, `UNLIMITED` |
| Config objects | `camelCase` keys | `STATUS_CONFIG`, `TYPE_ICON`, `STOCK_IMAGES` |
| Booleans | `is`/`has`/`can` prefix | `isLoading`, `hasNoBody`, `canSendCampaigns` |
| Zod schemas | `PascalCase` + `Schema`/`Body` suffix | `CreateEventBody`, `editSchema` |
| Interfaces/types | `PascalCase` | `PlanLimits`, `CoverImagePickerProps` |
| Component props | `[ComponentName]Props` | `AiPromptBarProps` |
| DB types | `typeof table.$inferSelect` / `.$inferInsert` | `typeof eventsTable.$inferSelect` |

## Backend Route Handler Pattern

Every route handler follows this shape — pervasive across `artifacts/api-server/src/routes/*.ts`:

```ts
router.post(
  "/organizations/:orgId/events",
  async (req, res): Promise<void> => {
    const orgId = parseInt(
      Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId,
      10,
    );

    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // plan quota check
    const limits = await getPlanLimits(orgId);
    if (current >= limits.maxEvents) {
      res.status(402).json({
        error: "PLAN_LIMIT_EXCEEDED",
        message: "Event limit reached for your plan",
        limit: limits.maxEvents,
        plan: limits.plan,
        current,
        max: limits.maxEvents,
        suggestedPlan: "starter",
      });
      return;
    }

    const [event] = await db.insert(eventsTable).values({ ... }).returning();
    if (!event) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }

    await db.insert(activityTable).values({ ... });

    res.json(formatEvent(event));
  },
);
```

### Observations

- **Return type:** `Promise<void>` (responses are side effects via `res.json()` / `res.status()`)
- **Early-return on error:** always — no thrown exceptions for expected failure cases
- **Param parsing:** `parseInt(Array.isArray(x) ? x[0] : x, 10)` is the idiomatic defense against Express's loose typing
- **Validation:** Zod `safeParse()` at the top — never `parse()` which would throw
- **DB writes:** `.returning()` destructured into `const [row]`
- **Audit:** significant mutations followed by `activityTable` insert
- **Response shaping:** always via a `format*()` helper, never raw rows

## Error-Status Contract

| Status | When | Body |
|--------|------|------|
| 400 | Zod validation failed | `{ error: parsed.error.message }` |
| 401 | No session | `{ error: "Unauthorized" }` |
| 402 | Plan quota exceeded | `{ error, message, limit, plan, current, max, suggestedPlan }` |
| 403 | Not a member of org / CSRF | `{ error: "FORBIDDEN", message }` |
| 404 | Resource missing | `{ error: "Not found" }` |
| 409 | Duplicate / already accepted | `{ error: "EMAIL_TAKEN" }` or `"ALREADY_ACCEPTED"` |
| 410 | Expired invite token | `{ error: "TOKEN_EXPIRED" }` |
| 429 | Rate-limited | `{ error: "Too many attempts, please try again later." }` |
| 500 | Unexpected | Global handler in `app.ts:139` |

## Frontend Patterns

### Data fetching

- Use the auto-generated hook from `@workspace/api-client-react` — never hand-roll `fetch`
- Access loading via `isLoading`, errors via `error`, data via `data`
- Mutation `onSuccess` invalidates specific query keys:

```ts
const createEvent = useCreateEvent({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["events", orgId] });
    toast({ title: "Event created" });
  },
  onError: (err) => {
    toast({ title: "Error", description: err.message, variant: "destructive" });
  },
});
```

### Forms

- React Hook Form + Zod resolver — schema lives in the same file as the component
- Validation errors shown via `<FormMessage>`; submit errors via toast

### Auth

- `useAuth()` from `components/auth-provider.tsx` returns `{ user, activeOrgId, isLoading, startImpersonation, stopImpersonation }`
- `<RequireAuth>` wrapper in `App.tsx` renders nothing while `isLoading`, redirects to `/login` if no user (avoids login flash on refresh)

### UI

- Toast notifications via `use-toast.ts`: `toast({ title, description, variant: "destructive"? })`
- shadcn/ui primitives imported from `@/components/ui/*` — do not import Radix directly
- Icons: `lucide-react` (primary), `react-icons` (brand marks)
- Styling: Tailwind v4 classes; theming via HSL CSS variables in `index.css`; use `cn()` from `@/lib/utils` to merge class strings

## Imports

- Auto-formatted by Prettier (trailing commas on multi-line)
- Frontend: `@/` → `artifacts/hypespace/src/`
- Backend: workspace package names (`@workspace/db`, `@workspace/api-zod`) or relative paths — no `@/` alias
- Barrel exports: `lib/db/src/schema/index.ts`, `lib/api-client-react/src/index.ts`, `components/ui/*` (each primitive re-exported by name)

## Error Handling Idioms

### Backend

- **Validation:** `parsed.error.message` → 400 JSON
- **Not found:** `if (!row) { res.status(404).json({ error: "Not found" }); return; }`
- **Optional config:** `try { ... } catch { return null; }` — silent fallback for nullable lookups
- **No thrown exceptions** for expected failure cases
- Global handler in `app.ts` catches CSRF (returns 403) and everything else (500 with `err.message`)

### Frontend

- React Query `error` property; `useMutation` `onError`
- User-facing messages via toast (`variant: "destructive"`)
- File uploads: validate type/size locally before sending, toast on failure
- No global error boundaries observed — errors surface per-hook/per-route

## Logging

- **Backend (Pino):** `logger.info({ ... }, "message")` — structured
- **Pino-http:** request/response auto-logged with redaction of `authorization`, `cookie`, `set-cookie`
- **Ad-hoc:** `console.log` used in `email.ts` for dispatch confirmations (`📧 Email sent to … (messageId: …)`)
- **Frontend:** `console.error` only for truly exceptional cases; user-facing messages via toast

## Comments

- Sparse. Default to none.
- JSDoc reserved for non-obvious helpers or exported utilities with complex signatures
- Inline comments explain *why* (e.g., the regex in `generateSlug`, the CORS Capacitor-origin rationale in `app.ts`)
- Section headers occasionally used: `// ─── Schema ───`, `// ─── Component ───`
- No automated doc generation

## Function Sizing

- Utility functions: 10-50 lines
- Route handlers: 20-100 lines (validation + DB + format + audit)
- React components: 50-300 lines (hooks + JSX)
- No enforced limit — smaller is preferred but not policed

## Module Design

### Backend
- **Named exports** for helpers and types
- **Default export** for each domain's `router: IRouter`
- `routes/index.ts` aggregates all routers and mounts under `/api`

### Frontend
- **Default export** for the page/component
- **Named export** for the `*Props` interface when non-trivial
- No re-exports unless reused

### DB
- `lib/db/src/index.ts` re-exports `db` client + all tables + all Zod insert schemas
- Per-schema files use Drizzle `.$inferSelect` / `.$inferInsert` for row types
- Conditional queries use Drizzle's `.$dynamic()` helper

## Session Type Augmentation

Session fields are declared via module augmentation in `artifacts/api-server/src/types/session.d.ts`:

```ts
declare module "express-session" {
  interface SessionData {
    userId?: number;
    activeOrgId?: number;
  }
}
```

Always update this file when adding a new session field.
